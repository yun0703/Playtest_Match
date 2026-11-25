begin;

create table public.pt_guest_participants (
 id uuid primary key default gen_random_uuid(),
 test_id text not null references public.pt_tests(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '2 hours'),
 played_build text not null,
 submitted_at timestamptz,
 unique (test_id, id)
);
alter table public.pt_guest_participants enable row level security;
revoke all on public.pt_guest_participants from public, anon, authenticated;
create index pt_guest_test_created on public.pt_guest_participants(test_id, created_at);

alter table public.pt_feedback add column guest_id uuid,
 add foreign key (test_id, guest_id) references public.pt_guest_participants(test_id, id),
 add unique (test_id, guest_id),
 add check (guest_id is null or (tester_id is null and test_id is not null));
alter table public.pt_bugs add column guest_id uuid,
 add foreign key (test_id, guest_id) references public.pt_guest_participants(test_id, id),
 add check (guest_id is null or (tester_id is null and test_id is not null));
create index pt_guest_bug_rate on public.pt_bugs(test_id, created_at) where guest_id is not null;
create index pt_guest_bug_participant on public.pt_bugs(test_id, guest_id) where guest_id is not null;

create function public.pt_recruitment_count(game_id text) returns bigint
language sql stable set search_path=public,pg_temp as $$
 select (select count(*) from pt_applications where test_id=game_id and status in ('applied','done'))
      + (select count(*) from pt_guest_participants
         where test_id=game_id and (submitted_at is not null or expires_at>now()));
$$;
revoke all on function public.pt_recruitment_count(text) from public, anon, authenticated;

-- Move the existing member survey/bug validators to private helpers, so both
-- entry points enforce the same limits on structured input and build versions.
create function public.pt_validate_answers(survey jsonb, answers jsonb) returns void
language plpgsql set search_path=public,pg_temp as $$
declare q jsonb; answer jsonb; question_id text;
begin
 if jsonb_typeof(answers) is distinct from 'object' then raise exception '응답 형식이 올바르지 않습니다.'; end if;
 for question_id in select jsonb_object_keys(answers) loop
  if not exists(select 1 from jsonb_array_elements(survey) sq(item) where sq.item->>'id'=question_id) then
   raise exception '알 수 없는 질문입니다.';
  end if;
 end loop;
 for q in select value from jsonb_array_elements(survey) loop
  answer=answers->(q->>'id');
  if answer is null or answer in ('null','""') then
   if (q->>'required')::boolean then raise exception '필수 문항에 답해 주세요.'; end if;
   continue;
  end if;
  if q->>'type'='scale' then
   if jsonb_typeof(answer)<>'number' then raise exception '척도 응답이 올바르지 않습니다.'; end if;
   if (answer#>>'{}')::numeric not in (1,2,3,4,5) then raise exception '척도 범위가 올바르지 않습니다.'; end if;
  elsif q->>'type'='choice' then
   if not (q->'options' @> jsonb_build_array(answer)) then raise exception '보기를 선택해 주세요.'; end if;
  elsif jsonb_typeof(answer)<>'string' or length(answer#>>'{}')>4000 then
   raise exception '주관식 응답이 올바르지 않습니다.';
  end if;
 end loop;
end $$;

create function public.pt_validate_bug_details(d jsonb) returns void
language plpgsql set search_path=public,pg_temp as $$
begin
 if length(coalesce(d->>'title','')) not between 3 and 100
    or length(coalesce(d->>'description','')) not between 10 and 4000
    or length(coalesce(d->>'steps','')) not between 5 and 4000
    or length(coalesce(d->>'device','')) not between 1 and 200
    or coalesce(d->>'severity','') not in ('minor','normal','critical') then
  raise exception '버그 제보 내용을 확인해 주세요.';
 end if;
end $$;

create function public.pt_validate_played_build(game_doc jsonb, requested text, played text) returns text
language plpgsql set search_path=public,pg_temp as $$
declare version_label text=coalesce(nullif(trim(requested),''),played,game_doc->>'build');
begin
 if version_label is null or not (coalesce(game_doc->'builds',jsonb_build_array(game_doc->>'build')) ? version_label) then
  raise exception '등록된 플레이 빌드를 선택해 주세요.';
 end if;
 return version_label;
end $$;
revoke all on function public.pt_validate_answers(jsonb,jsonb), public.pt_validate_bug_details(jsonb),
 public.pt_validate_played_build(jsonb,text,text) from public, anon, authenticated;

do $migration$
declare
 snapshot_sql text=pg_get_functiondef('public.pt_snapshot()'::regprocedure);
 command_sql text=pg_get_functiondef('public.pt_command(text,jsonb)'::regprocedure);
 count_expr text=$old$(select count(*) from pt_applications where test_id=tid and status in ('applied','done'))$old$;
 snapshot_count text=$old$(select count(*) from pt_applications where test_id=t.id and status in ('applied','done'))$old$;
 answer_start text=$old$  if jsonb_typeof(payload->'answers') is distinct from 'object'$old$;
 issue_start text=$old$  st=payload->>'issueStatus';$old$;
 bug_start text=$old$  if length(coalesce(d->>'title','')) not between 3 and 100$old$;
 bug_end text=$old$  version_label=coalesce(nullif(trim(d->>'build')$old$;
 build_start text=$old$version_label=coalesce(nullif(trim($old$;
 old_build text=$old$  if version_label is null or not (coalesce(t.doc->'builds',jsonb_build_array(t.doc->>'build')) ? version_label) then raise exception '등록된 플레이 빌드를 선택해 주세요.';end if;$old$;
 save_anchor text=$old$  if tid is null then insert into pt_tests(owner_id,doc,slots,visibility,deadline)$old$;
 note_anchor text=$old$   insert into pt_notifications(user_id,doc) values(b.tester_id,$old$;
 note_end text=$old$'title','버그 제보 처리 내용이 업데이트되었습니다.','date',stamp));$old$;
 first_pos int;
 last_pos int;
begin
 if position(snapshot_count in snapshot_sql)=0 or position(count_expr in command_sql)=0
    or position(save_anchor in command_sql)=0 or position(note_anchor in command_sql)=0
    or position(note_end in command_sql)=0 or position(old_build in command_sql)=0 then
  raise exception 'Expected member save, visibility, capacity, or notification logic was not found';
 end if;

 snapshot_sql=replace(snapshot_sql,snapshot_count,'pt_recruitment_count(t.id)');
 command_sql=replace(command_sql,count_expr,'pt_recruitment_count(tid)');
 command_sql=replace(command_sql,save_anchor,$new$
  if d ? 'allowGuests' and jsonb_typeof(d->'allowGuests') is distinct from 'boolean' then
   raise exception '익명 테스트 설정을 확인해 주세요.';
  end if;
  if coalesce((d->>'allowGuests')::boolean,(t.doc->>'allowGuests')::boolean,false)
     and d->>'vis'='public' and d->>'platform'='WebGL' then
   newdoc=newdoc||jsonb_build_object('allowGuests',true);
  elsif (d->>'allowGuests')::boolean is true then
   raise exception '공개 WebGL 게임에서만 익명 테스트를 허용할 수 있습니다.';
  end if;
$new$||save_anchor);
 command_sql=replace(command_sql,note_anchor,'   if b.tester_id is not null then'||chr(10)||note_anchor);
 command_sql=replace(command_sql,note_end,note_end||chr(10)||'   end if;');
 first_pos=position(answer_start in command_sql);
 last_pos=position(issue_start in command_sql);
 if first_pos=0 or last_pos<=first_pos then raise exception 'Expected member survey validator was not found'; end if;
 command_sql=overlay(command_sql placing '  perform pt_validate_answers(s.survey,payload->''answers'');'||chr(10)
  from first_pos for last_pos-first_pos);
 first_pos=position(bug_start in command_sql);
 last_pos=position(bug_end in command_sql);
 if first_pos=0 or last_pos<=first_pos then raise exception 'Expected member bug validator was not found'; end if;
 command_sql=overlay(command_sql placing '  perform pt_validate_bug_details(d);'||chr(10)
  from first_pos for last_pos-first_pos);
 command_sql=replace(command_sql,$old$version_label=coalesce(nullif(trim(payload->>'build'),''),a.played_build,t.doc->>'build');$old$,
  $new$version_label=pt_validate_played_build(t.doc,payload->>'build',a.played_build);$new$);
 command_sql=replace(command_sql,$old$version_label=coalesce(nullif(trim(d->>'build'),''),a.played_build,t.doc->>'build');$old$,
  $new$version_label=pt_validate_played_build(t.doc,d->>'build',a.played_build);$new$);
 if position(build_start in command_sql)>0 then raise exception 'Expected member build validator was not replaced'; end if;
 command_sql=replace(command_sql,old_build,'');
 execute snapshot_sql;
 execute command_sql;
end $migration$;

create function public.pt_guest_playtest(action text, game_id text, participant_id uuid default null, payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 game pt_tests;
 secrets pt_secrets;
 guest pt_guest_participants;
 stamp timestamptz=clock_timestamp();
 data jsonb=payload->'data';
 version_label text;
 issue text;
 ids jsonb;
 bug_id text;
 bugs jsonb;
begin
 if auth.uid() is not null then raise exception '로그인한 계정으로 참여해 주세요.' using errcode='42501'; end if;
 if action is null or action not in ('join','view','feedback','bug') or game_id is null or length(game_id)>100
    or jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>262144 then
  raise exception '요청 형식 또는 크기가 올바르지 않습니다.';
 end if;

 -- Lock in the same order as member enrollment and developer edits.
 select * into game from pt_tests where id=game_id for update;
 stamp=clock_timestamp();
 if not found or game.status<>'open' or game.visibility<>'public'
    or game.doc->>'platform' is distinct from 'WebGL' or game.doc->'allowGuests' is distinct from 'true'::jsonb
    or game.deadline is null or game.deadline<(stamp at time zone 'Asia/Seoul')::date
    or exists(select 1 from pt_account_deletions where user_id=game.owner_id) then
  raise exception '지금은 익명으로 참여할 수 없는 테스트입니다.' using errcode='PT410';
 end if;
 select * into strict secrets from pt_secrets where test_id=game_id;
 if participant_id is not null then
  select * into guest from pt_guest_participants where id=participant_id and test_id=game_id;
 end if;

 if action='join' then
  if payload->'agreed' is distinct from 'true'::jsonb then raise exception '이용 동의서에 동의해 주세요.'; end if;
  if guest.id is null or (guest.submitted_at is null and guest.expires_at<=stamp) then
   if game.slots is not null and pt_recruitment_count(game_id)>=game.slots then raise exception '모집이 마감되었습니다.'; end if;
   if guest.id is null then
    if (select count(*) from pt_guest_participants where test_id=game_id and created_at>stamp-interval '10 minutes')>=30 then
     raise exception '익명 참여 요청이 많습니다. 잠시 후 다시 시도해 주세요.' using errcode='PT429';
    end if;
    insert into pt_guest_participants(test_id,created_at,expires_at,played_build)
     values(game_id,stamp,stamp+interval '2 hours',game.doc->>'build') returning * into guest;
   else
    update pt_guest_participants set expires_at=stamp+interval '2 hours' where id=guest.id returning * into guest;
   end if;
  end if;
 elsif guest.id is null or (guest.submitted_at is null and guest.expires_at<=stamp) then
  raise exception '익명 참여 시간이 끝났습니다. 이용 동의 후 다시 시작해 주세요.' using errcode='PT410';
 end if;

 if action='feedback' then
  if guest.submitted_at is not null then raise exception '이 익명 참가 ID로 이미 설문을 제출했습니다.' using errcode='PT409'; end if;
  version_label=pt_validate_played_build(game.doc,payload->>'build',guest.played_build);
  perform pt_validate_answers(secrets.survey,payload->'answers');
  issue=payload->>'issueStatus';
  ids=coalesce(payload->'bugIds','[]');
  if issue is null or issue not in ('none','reported') or jsonb_typeof(ids)<>'array' then
   raise exception '문제 발견 여부를 선택해 주세요.';
  end if;
  if issue='reported' then
   if jsonb_array_length(ids)=0 then raise exception '연결할 버그를 선택해 주세요.'; end if;
   for bug_id in select jsonb_array_elements_text(ids) loop
    if not exists(select 1 from pt_bugs where id=bug_id and test_id=game_id and guest_id=guest.id) then
     raise exception '내 제보만 연결할 수 있습니다.';
    end if;
   end loop;
  else ids='[]'; end if;
  insert into pt_feedback(test_id,guest_id,doc) values(game_id,guest.id,
   jsonb_build_object('answers',payload->'answers','issueStatus',issue,'bugIds',ids,
    'build',version_label,'surveySnapshot',secrets.survey,'anonymous',true));
  update pt_guest_participants set submitted_at=stamp where id=guest.id returning * into guest;
 elsif action='bug' then
  perform pt_validate_bug_details(data);
  version_label=pt_validate_played_build(game.doc,data->>'build',guest.played_build);
  if coalesce(data->'attachments','[]')<>'[]'::jsonb then raise exception '익명 버그 제보는 텍스트만 지원합니다.'; end if;
  if (select count(*) from pt_bugs where test_id=game_id and guest_id=guest.id and created_at>stamp-interval '1 hour')>=3 then
   raise exception '익명 버그 제보는 한 시간에 3건까지 가능합니다.' using errcode='PT429';
  end if;
  if (select count(*) from pt_bugs where test_id=game_id and guest_id is not null and created_at>stamp-interval '1 hour')>=60 then
   raise exception '이 테스트의 익명 제보가 많습니다. 잠시 후 다시 시도해 주세요.' using errcode='PT429';
  end if;
  insert into pt_bugs(test_id,guest_id,created_at,updated_at,doc,history) values(game_id,guest.id,stamp,stamp,
   jsonb_build_object('title',data->>'title','description',data->>'description','steps',data->>'steps',
    'device',data->>'device','severity',data->>'severity','attachments','[]'::jsonb,'build',version_label,'anonymous',true),
   jsonb_build_array(jsonb_build_object('status','new','date',stamp,'note',''))) returning id into bug_id;
 end if;

 select coalesce(jsonb_agg(b.doc||jsonb_build_object('id',b.id,'testId',b.test_id,'testerId','me','status',b.status,
  'developerNote',b.developer_note,'history',b.history,'createdAt',b.created_at,'updatedAt',b.updated_at) order by b.created_at desc),'[]')
 into bugs from pt_bugs b where b.test_id=game_id and b.guest_id=guest.id;
 return jsonb_build_object('participantId',guest.id,'expiresAt',guest.expires_at,'submitted',guest.submitted_at is not null,
  'playedBuild',guest.played_build,'link',secrets.link,'how',secrets.how,'survey',secrets.survey,
  'applicants',pt_recruitment_count(game_id),'bugs',bugs,'newBugId',bug_id);
end $$;
revoke all on function public.pt_guest_playtest(text,text,uuid,jsonb) from public, authenticated;
grant execute on function public.pt_guest_playtest(text,text,uuid,jsonb) to anon;

commit;
