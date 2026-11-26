begin;

-- 1) Invite codes: require 8-12 characters for new or edited invite games,
--    and limit wrong guesses per member. A wrong guess returns a
--    commandError instead of raising, so the recorded attempt is committed.
create table public.pt_invite_attempts (
 user_id uuid not null references auth.users(id) on delete cascade,
 test_id text not null references public.pt_tests(id) on delete cascade,
 attempted_at timestamptz not null default now()
);
alter table public.pt_invite_attempts enable row level security;
revoke all on public.pt_invite_attempts from public, anon, authenticated;
create index pt_invite_attempts_user_time on public.pt_invite_attempts(user_id, attempted_at);

-- 2) Anonymous participants: remember a hashed client address per game so
--    one client cannot mint unlimited participant IDs.
alter table public.pt_guest_participants add column client_key bytea;
create index pt_guest_client_key on public.pt_guest_participants(test_id, client_key, created_at)
 where client_key is not null;

-- Cloudflare sets cf-connecting-ip and overwrites any client-supplied value.
-- Without the header (local tests, other proxies) the per-client limit is skipped
-- and the per-game limits below still apply.
create function public.pt_guest_client_key(game_id text) returns bytea
language sql stable set search_path=public,pg_temp as $$
 select case when h.ip is null then null
  else sha256(convert_to(game_id||'|'||h.ip,'UTF8')) end
 from (select nullif(btrim(coalesce(
  nullif(current_setting('request.headers',true),''),'{}')::json->>'cf-connecting-ip'),'') as ip) h
$$;
revoke all on function public.pt_guest_client_key(text) from public, anon, authenticated;

do $migration$
declare
 command_sql text=pg_get_functiondef('public.pt_command(text,jsonb)'::regprocedure);
 guest_sql text=pg_get_functiondef('public.pt_guest_playtest(text,text,uuid,jsonb)'::regprocedure);
 old_format text=$old$  if d->>'vis'='invite' and coalesce(d->>'code','') !~ '^[A-Z0-9]{4,12}$' then raise exception '초대 코드 형식이 올바르지 않습니다.';end if;$old$;
 old_check text=$old$  if t.visibility='invite' and upper(coalesce(payload->>'code',''))<>s.invite_code then raise exception '초대 코드가 올바르지 않습니다.';end if;$old$;
 old_slots text=$old$   if game.slots is not null and pt_recruitment_count(game_id)>=game.slots then raise exception '모집이 마감되었습니다.'; end if;$old$;
 old_rate text=$old$    if (select count(*) from pt_guest_participants where test_id=game_id and created_at>stamp-interval '10 minutes')>=30 then$old$;
 old_insert text=$old$    insert into pt_guest_participants(test_id,created_at,expires_at,played_build)
     values(game_id,stamp,stamp+interval '2 hours',game.doc->>'build') returning * into guest;$old$;
begin
 if position(old_format in command_sql)=0 or position(old_check in command_sql)=0
    or position(old_slots in guest_sql)=0 or position(old_rate in guest_sql)=0
    or position(old_insert in guest_sql)=0 then
  raise exception 'Expected invite code or anonymous participation logic was not found';
 end if;

 command_sql=replace(command_sql,old_format,$new$  if d->>'vis'='invite' and coalesce(d->>'code','') !~ '^[A-Z0-9]{8,12}$' then raise exception '초대 코드는 영문 대문자와 숫자 8~12자로 입력해 주세요.';end if;$new$);

 command_sql=replace(command_sql,old_check,$new$  if t.visibility='invite' then
   if (select count(*) from pt_invite_attempts where user_id=u and attempted_at>stamp-interval '15 minutes')>=5
      or (select count(*) from pt_invite_attempts where user_id=u and attempted_at>stamp-interval '1 day')>=20 then
    raise exception '초대 코드를 너무 많이 틀렸습니다. 잠시 후 다시 시도해 주세요.' using errcode='PT429';
   end if;
   if upper(coalesce(payload->>'code',''))<>s.invite_code then
    delete from pt_invite_attempts where user_id=u and attempted_at<stamp-interval '1 day';
    insert into pt_invite_attempts(user_id,test_id,attempted_at) values(u,tid,stamp);
    return jsonb_build_object('commandError','초대 코드가 올바르지 않습니다.');
   end if;
  end if;$new$);

 -- Anonymous participants may hold at most half of a limited game's places,
 -- and only a few places may be held by participants who have not submitted yet.
 guest_sql=replace(guest_sql,old_slots,old_slots||$new$
   if game.slots is not null and (select count(*) from pt_guest_participants g where g.test_id=game_id
       and g.id is distinct from guest.id and (g.submitted_at is not null or g.expires_at>stamp))>=ceil(game.slots/2.0) then
    raise exception '익명 참여 자리가 모두 찼습니다. 로그인하면 남은 자리로 참여할 수 있습니다.' using errcode='PT429';
   end if;
   if (select count(*) from pt_guest_participants g where g.test_id=game_id and g.id is distinct from guest.id
       and g.submitted_at is null and g.expires_at>stamp)
      >=(case when game.slots is null then 10 else greatest(2,ceil(game.slots*0.2)::int) end) then
    raise exception '지금 익명으로 플레이 중인 참가자가 많습니다. 잠시 후 다시 시도하거나 로그인해서 참여해 주세요.' using errcode='PT429';
   end if;$new$);

 guest_sql=replace(guest_sql,old_rate,$new$    update pt_guest_participants set client_key=null
     where test_id=game_id and client_key is not null and created_at<stamp-interval '1 day';
    if pt_guest_client_key(game_id) is not null and (select count(*) from pt_guest_participants
        where test_id=game_id and client_key=pt_guest_client_key(game_id) and created_at>stamp-interval '1 hour')>=5 then
     raise exception '이 기기에서 익명 참여를 너무 많이 시작했습니다. 잠시 후 다시 시도해 주세요.' using errcode='PT429';
    end if;
$new$||old_rate);

 guest_sql=replace(guest_sql,old_insert,$new$    insert into pt_guest_participants(test_id,created_at,expires_at,played_build,client_key)
     values(game_id,stamp,stamp+interval '2 hours',game.doc->>'build',pt_guest_client_key(game_id)) returning * into guest;$new$);

 execute command_sql;
 execute guest_sql;
end $migration$;
commit;
