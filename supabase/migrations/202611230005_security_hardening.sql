begin;

-- Keep the public catalog and moderator workflow, while revoking a hidden
-- game's private build instructions from participants.
do $migration$
declare
 snapshot_sql text=pg_get_functiondef('public.pt_snapshot()'::regprocedure);
 command_sql text=pg_get_functiondef('public.pt_command(text,jsonb)'::regprocedure);
 old_access text=$old$allowed=t.owner_id=u or adm or exists(select 1 from pt_applications where test_id=t.id and tester_id=u and status in ('applied','done'));$old$;
 old_reads text=$old$for bid in select jsonb_array_elements_text(payload->'ids') loop insert into pt_reads values(u,left(bid,250)) on conflict do nothing;end loop;return pt_snapshot();$old$;
 old_owner text=$old$'owner',case when t.owner_id=u then 'me' else t.owner_id::text end$old$;
 old_reason text=$old$'reason',coalesce(t.reason,'')$old$;
 old_login text=$old$if not pt_active_member() then raise exception '로그인하거나 진행 중인 탈퇴를 완료해 주세요.' using errcode='42501';end if;$old$;
 old_link text=$old$coalesce(d->>'link','') !~ '^https://[^[:space:]]+$'$old$;
begin
 if position(old_access in snapshot_sql)=0 or position(old_reads in command_sql)=0
    or position(old_owner in snapshot_sql)=0 or position(old_reason in snapshot_sql)=0
    or position(old_login in command_sql)=0 or position(old_link in command_sql)=0 then
  raise exception 'Expected permission and validation logic was not found';
 end if;
 snapshot_sql=replace(snapshot_sql,old_access,$new$allowed=t.owner_id=u or adm or (t.status in ('open','closed') and exists(select 1 from pt_applications where test_id=t.id and tester_id=u and status in ('applied','done')));$new$);
 snapshot_sql=replace(snapshot_sql,old_owner,$new$'owner',case when t.owner_id=u then 'me' else 'other' end$new$);
 snapshot_sql=replace(snapshot_sql,old_reason,$new$'reason',case when t.owner_id=u or adm then coalesce(t.reason,'') else '' end$new$);
 command_sql=replace(command_sql,old_login,old_login||$new$
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>262144 then
  raise exception '요청 형식 또는 크기가 올바르지 않습니다.';
 end if;$new$);
 command_sql=replace(command_sql,old_link,$new$(length(coalesce(d->>'link',''))>2048
   or coalesce(d->>'link','') !~ '^https://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$'
   or strpos(coalesce(d->>'link',''),chr(92))>0
   or coalesce(d->>'link','') ~ '[[:cntrl:]]')$new$);
 command_sql=replace(command_sql,old_reads,$new$
  if jsonb_typeof(payload->'ids') is distinct from 'array' then
   raise exception '알림 목록을 확인해 주세요.';
  end if;
  if jsonb_array_length(payload->'ids')>100 then
   raise exception '알림은 한 번에 100개까지 읽음 처리할 수 있습니다.';
  end if;
  insert into pt_reads(user_id,notification_id)
  select u, requested.id
  from jsonb_array_elements_text(payload->'ids') requested(id)
  where length(requested.id)<=250 and (
   exists(select 1 from pt_notifications n where n.id=requested.id and n.user_id=u)
   or exists(
    select 1 from pt_applications ap join pt_tests game on game.id=ap.test_id
    cross join lateral (select (game.deadline+time '23:59:59.999') at time zone 'Asia/Seoul' as due) dline
    where ap.tester_id=u and ap.status='applied' and game.status in ('open','closed') and game.deadline is not null
      and dline.due<=now()+interval '48 hours'
      and requested.id=concat('deadline:',game.id,':',game.deadline::text,':',case when dline.due<now() then 'overdue' else 'soon' end)
   )
  )
  on conflict do nothing;
  return pt_snapshot();
 $new$);
 execute snapshot_sql;
 execute command_sql;
end $migration$;

-- Uploads use locally generated UUID object keys. Existing paths remain
-- readable and removable under their original authorization rules.
drop policy pt_file_insert on storage.objects;
create policy pt_file_insert on storage.objects for insert to authenticated with check (
 bucket_id='playtest-media'
 and public.pt_active_member()
 and (storage.foldername(name))=array[split_part(name,'/',1),auth.uid()::text]
 and split_part(name,'/',1) in ('game','bug')
 and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);
commit;
