begin;

-- Record exactly the responses reviewed, so new responses stay unread
-- even when a response is deleted or a new submission arrives concurrently.
create table public.pt_feedback_reviews (
 feedback_id uuid primary key references public.pt_feedback(id) on delete cascade
);
alter table public.pt_feedback_reviews enable row level security;
revoke all on public.pt_feedback_reviews from public,anon,authenticated;

do $migration$
declare
 snapshot_sql text=pg_get_functiondef('public.pt_snapshot()'::regprocedure);
 command_sql text=pg_get_functiondef('public.pt_command(text,jsonb)'::regprocedure);
 old_feedback text=$old$jsonb_agg(f.doc order by created_at)$old$;
 command_anchor text=$old$ select * into s from pt_secrets where test_id=tid;$old$;
begin
 if position(old_feedback in snapshot_sql)=0 or position(command_anchor in command_sql)=0 then
  raise exception 'Expected feedback and game ownership logic was not found';
 end if;

 snapshot_sql=replace(snapshot_sql,old_feedback,$new$
  jsonb_agg(f.doc||jsonb_build_object('responseId',f.id,'reviewed',exists(
   select 1 from pt_feedback_reviews r where r.feedback_id=f.id
  )) order by f.created_at, f.id)
 $new$);
 command_sql=replace(command_sql,command_anchor,$new$
 if action='review_feedback' then
  if t.owner_id<>u then raise exception '내 테스트의 설문만 확인할 수 있습니다.' using errcode='42501';end if;
  if jsonb_typeof(payload->'responseIds') is distinct from 'array' then
   raise exception '확인할 설문 응답을 선택해 주세요.';
  end if;
  insert into pt_feedback_reviews(feedback_id)
  select f.id from pt_feedback f
  join (
   select distinct id::uuid as id
   from jsonb_array_elements_text(payload->'responseIds') item(id)
   where id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) selected on selected.id=f.id
  where f.test_id=tid
  on conflict do nothing;
  return pt_snapshot();
 end if;
$new$||command_anchor);

 execute snapshot_sql;
 execute command_sql;
end $migration$;
commit;
