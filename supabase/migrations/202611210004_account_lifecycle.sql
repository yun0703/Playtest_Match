begin;
-- Only the authenticated member can inspect or finalize their own deletion.
create table public.pt_account_deletions(user_id uuid primary key references auth.users(id) on delete cascade,files jsonb not null,started_at timestamptz not null default now());
alter table public.pt_account_deletions enable row level security;
revoke all on public.pt_account_deletions from anon,authenticated;
alter table public.pt_applications drop constraint pt_applications_status_check;
alter table public.pt_applications add constraint pt_applications_status_check check(status in ('waiting','applied','declined','done','cancelled'));
create function public.pt_active_member() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from auth.users where id=auth.uid()) and not exists(select 1 from pt_account_deletions where user_id=auth.uid())
$$;
create or replace function public.pt_is_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$select pt_active_member() and exists(select 1 from pt_admins where id=auth.uid())$$;
create function public.pt_update_profile(nickname text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare clean text=trim(nickname);u uuid=auth.uid();
begin
 if not pt_active_member() then raise exception '로그인이 필요합니다.' using errcode='42501';end if;
 if clean is null or length(clean) not between 1 and 40 or clean ~ '[[:cntrl:]]' then raise exception '닉네임은 공백만 제외한 1~40자로 입력해 주세요.';end if;
 insert into pt_profiles values(u,clean) on conflict(id) do update set nickname=excluded.nickname;
 update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}')||jsonb_build_object('nickname',clean) where id=u;
 return pt_snapshot();
end $$;
create function public.pt_account_delete_preview() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid=auth.uid();files jsonb;
begin
 if u is null or not exists(select 1 from auth.users where id=u) then raise exception '로그인이 필요합니다.' using errcode='42501';end if;
 select coalesce(jsonb_agg(o.name order by o.name),'[]') into files from storage.objects o where o.bucket_id='playtest-media' and
  (o.owner_id=u::text or split_part(o.name,'/',2)=u::text or exists(select 1 from pt_bugs b join pt_tests t on t.id=b.test_id where t.owner_id=u and exists(select 1 from jsonb_array_elements(b.doc->'attachments') a where a->>'id'=o.name)));
 return jsonb_build_object('games',(select count(*) from pt_tests where owner_id=u),'applications',(select count(*) from pt_applications where tester_id=u and status<>'cancelled'),'feedback',(select count(*) from pt_feedback where tester_id=u),'bugs',(select count(*) from pt_bugs where tester_id=u),'files',files,'pending',exists(select 1 from pt_account_deletions where user_id=u));
end $$;
create function public.pt_begin_account_delete(confirmation text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid=auth.uid();preview jsonb;pending jsonb;
begin
 if u is null or not exists(select 1 from auth.users where id=u) then raise exception '로그인이 필요합니다.' using errcode='42501';end if;
 if confirmation is distinct from '탈퇴' then raise exception '확인란에 탈퇴를 입력해 주세요.';end if;
 perform 1 from auth.users where id=u for update;
 select files into pending from pt_account_deletions where user_id=u;
 if found then
  preview=pt_account_delete_preview();
  select coalesce(jsonb_agg(distinct path),'[]') into pending from jsonb_array_elements(pending||(preview->'files')) path;
  update pt_account_deletions set files=pending where user_id=u;
  return jsonb_build_object('files',pending);
 end if;
 if not exists(select 1 from auth.sessions s where s.user_id=u and s.id::text=auth.jwt()->>'session_id' and s.created_at>now()-interval '15 minutes') then raise exception '탈퇴하려면 로그아웃 후 다시 로그인해 주세요. 최근 15분 이내 로그인이 필요합니다.';end if;
 perform 1 from pt_tests where owner_id=u for update;
 preview=pt_account_delete_preview();
 insert into pt_account_deletions(user_id,files) values(u,preview->'files');
 update pt_tests set prior_status=status,status='hidden',reason='개발자가 회원 탈퇴를 진행 중입니다.' where owner_id=u;
 return jsonb_build_object('files',preview->'files');
end $$;
create function public.pt_pending_delete_file(path text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from pt_account_deletions where user_id=auth.uid() and files @> jsonb_build_array(path))
$$;
create or replace function public.pt_can_read_file(path text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select pt_pending_delete_file(path) or (pt_active_member() and split_part(path,'/',2)=auth.uid()::text)
 or (split_part(path,'/',1)='game' and exists(select 1 from pt_tests t where (t.status in ('open','closed') or (pt_active_member() and t.owner_id=auth.uid())) and exists(select 1 from jsonb_array_elements(t.doc->'media') m where m->>'id'=path)))
 or (pt_active_member() and split_part(path,'/',1)='bug' and exists(select 1 from pt_bugs b join pt_tests t on t.id=b.test_id where (b.tester_id=auth.uid() or t.owner_id=auth.uid()) and exists(select 1 from jsonb_array_elements(b.doc->'attachments') m where m->>'id'=path)))
$$;
drop policy pt_file_insert on storage.objects;
create policy pt_file_insert on storage.objects for insert to authenticated with check(bucket_id='playtest-media' and public.pt_active_member() and split_part(name,'/',1) in ('game','bug') and split_part(name,'/',2)=auth.uid()::text);
drop policy pt_file_delete on storage.objects;
create policy pt_file_delete on storage.objects for delete to authenticated using(bucket_id='playtest-media' and ((public.pt_active_member() and split_part(name,'/',2)=auth.uid()::text) or public.pt_pending_delete_file(name)));
create function public.pt_finish_account_delete() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid=auth.uid();files jsonb;
begin
 if u is null then raise exception '로그인이 필요합니다.' using errcode='42501';end if;
 perform 1 from auth.users where id=u for update;
 select d.files into files from pt_account_deletions d where user_id=u for update;
 if not found then raise exception '탈퇴 확인을 먼저 완료해 주세요.';end if;
 if exists(select 1 from storage.objects o where (o.bucket_id='playtest-media' and (files @> jsonb_build_array(o.name) or split_part(o.name,'/',2)=u::text)) or o.owner_id=u::text) then raise exception '첨부파일을 모두 삭제하지 못했습니다. 탈퇴를 다시 시도해 주세요.';end if;
 delete from pt_reads where user_id=u or notification_id in (select id from pt_notifications where user_id=u or doc->>'testId' in (select id from pt_tests where owner_id=u) or doc->>'bugId' in (select id from pt_bugs where tester_id=u));
 delete from pt_notifications where user_id=u or doc->>'testId' in (select id from pt_tests where owner_id=u) or doc->>'bugId' in (select id from pt_bugs where tester_id=u);
 delete from pt_moderation where admin_id=u or test_id in (select id from pt_tests where owner_id=u);
 delete from pt_reports where reporter_id=u or test_id in (select id from pt_tests where owner_id=u);
 -- Remove linked bug IDs from another developer's retained feedback before deleting those bugs.
 update pt_feedback f set doc=jsonb_set(f.doc,'{bugIds}',coalesce((select jsonb_agg(bid) from jsonb_array_elements(coalesce(f.doc->'bugIds','[]')) bid where not exists(select 1 from pt_bugs b where b.id=bid#>>'{}' and b.tester_id=u)),'[]')) where exists(select 1 from pt_bugs b where b.tester_id=u and f.doc->'bugIds' @> jsonb_build_array(b.id));
 delete from pt_feedback where tester_id=u or test_id in (select id from pt_tests where owner_id=u);
 delete from pt_bugs where tester_id=u or test_id in (select id from pt_tests where owner_id=u);
 delete from pt_applications where tester_id=u or test_id in (select id from pt_tests where owner_id=u);
 delete from pt_tests where owner_id=u;
 delete from auth.users where id=u;
end $$;
revoke execute on function public.pt_active_member(),public.pt_update_profile(text),public.pt_account_delete_preview(),public.pt_begin_account_delete(text),public.pt_pending_delete_file(text),public.pt_finish_account_delete() from public,anon,authenticated;
grant execute on function public.pt_active_member(),public.pt_pending_delete_file(text) to anon,authenticated;
grant execute on function public.pt_update_profile(text),public.pt_account_delete_preview(),public.pt_begin_account_delete(text),public.pt_finish_account_delete() to authenticated;

create or replace function public.pt_snapshot() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u uuid=case when pt_active_member() then auth.uid() else null end;adm boolean=pt_is_admin();result jsonb;tests jsonb='[]';t pt_tests;sec pt_secrets;allowed boolean;requests jsonb;feedback jsonb;item jsonb;
begin
 for t in select * from pt_tests x where x.status in ('open','closed') or x.owner_id=u or adm or exists(select 1 from pt_applications a where a.test_id=x.id and a.tester_id=u) order by x.created_at loop
  allowed=t.owner_id=u or adm or exists(select 1 from pt_applications where test_id=t.id and tester_id=u and status in ('applied','done'));
  allowed=allowed and not exists(select 1 from pt_account_deletions where user_id=t.owner_id);
  sec=null;requests='[]';feedback='[]';
  if allowed then select * into sec from pt_secrets where test_id=t.id;end if;
  if t.owner_id=u then
   select coalesce(jsonb_agg(jsonb_build_object('id',case when a.tester_id=u then 'me' else a.tester_id::text end,'name',coalesce(p.nickname,'플레이어'),'status',case when a.status in ('applied','done') then 'approved' else a.status end,'agreed',true)),'[]') into requests from pt_applications a left join pt_profiles p on p.id=a.tester_id where a.test_id=t.id and a.status<>'cancelled';
   select coalesce(jsonb_agg(f.doc order by created_at),'[]') into feedback from pt_feedback f where test_id=t.id;
  end if;
  item=t.doc||jsonb_build_object('id',t.id,'owner',case when t.owner_id=u then 'me' else t.owner_id::text end,'status',t.status,'vis',t.visibility,'slots',t.slots,'deadline',coalesce(t.deadline::text,''),'createdDate',(t.created_at at time zone 'Asia/Seoul')::date::text,'applicants',(select count(*) from pt_applications where test_id=t.id and status in ('applied','done')),'requests',requests,'feedbacks',feedback,'reason',coalesce(t.reason,''),'link',coalesce(sec.link,''),'how',coalesce(sec.how,''),'survey',coalesce(sec.survey,'[]'),'code',case when t.owner_id=u then coalesce(sec.invite_code,'') else '' end);
  tests=tests||jsonb_build_array(item);
 end loop;
 select jsonb_build_object('tests',tests,'mine',coalesce((select jsonb_object_agg(test_id,jsonb_build_object('status',status,'agreedAt',to_char(agreed_at at time zone 'Asia/Seoul','YYYY-MM-DD'),'startedAt',started_at)) from pt_applications where tester_id=u and status<>'cancelled'),'{}'),'myReports',coalesce((select jsonb_object_agg(test_id,true) from pt_reports where reporter_id=u),'{}'),'reports',case when adm then coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'testId',r.test_id,'cat',r.reason,'detail',r.detail,'by',coalesce(p.nickname,'플레이어'),'date',r.created_at::date,'status',r.status)) from pt_reports r left join pt_profiles p on p.id=r.reporter_id),'[]') else '[]'::jsonb end,'bugs',coalesce((select jsonb_agg(b.doc||jsonb_build_object('id',b.id,'testId',b.test_id,'testerId',case when b.tester_id=u then 'me' else b.tester_id::text end,'status',b.status,'developerNote',b.developer_note,'history',b.history,'createdAt',b.created_at,'updatedAt',b.updated_at)) from pt_bugs b join pt_tests x on x.id=b.test_id where b.tester_id=u or x.owner_id=u),'[]'),'notifications',coalesce((select jsonb_agg(n.doc||jsonb_build_object('id',n.id) order by n.created_at desc) from pt_notifications n where user_id=u),'[]'),'readNotifications',coalesce((select jsonb_object_agg(notification_id,true) from pt_reads where user_id=u),'{}'),'log',case when adm then coalesce((select jsonb_agg(jsonb_build_object('title',x.doc->>'title','date',m.created_at::date,'action',m.action,'note',m.note) order by m.created_at desc) from pt_moderation m join pt_tests x on x.id=m.test_id),'[]') else '[]'::jsonb end,'viewer',jsonb_build_object('id',u,'nickname',(select nickname from pt_profiles where id=u),'admin',adm)) into result;
 return result;
end $$;
create or replace function public.pt_command(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid=auth.uid();adm boolean=pt_is_admin();tid text=payload->>'testId';t pt_tests;s pt_secrets;a pt_applications;b pt_bugs;d jsonb=payload->'data';q jsonb;answer jsonb;media jsonb;bid text;ids jsonb;st text;note text;nick text;due date;newdoc jsonb;stamp timestamptz=now();cnt int;
begin
 if not pt_active_member() then raise exception '로그인하거나 진행 중인 탈퇴를 완료해 주세요.' using errcode='42501';end if;
 insert into pt_profiles values(u,left(coalesce(nullif(auth.jwt()->'user_metadata'->>'nickname',''),'플레이어'),40)) on conflict do nothing;
 if action='mark_read' then
  for bid in select jsonb_array_elements_text(payload->'ids') loop insert into pt_reads values(u,left(bid,250)) on conflict do nothing;end loop;return pt_snapshot();
 end if;
 if action='save_test' then
  if tid is not null then select * into t from pt_tests where id=tid for update;if not found or t.owner_id<>u then raise exception '내 테스트만 수정할 수 있습니다.';end if;end if;
  if length(trim(coalesce(d->>'title',''))) not between 1 and 40 or length(trim(coalesce(d->>'team',''))) not between 1 and 40 or length(coalesce(d->>'teaser','')) not between 8 and 80 or length(coalesce(d->>'feedbackFocus','')) not between 10 and 600 then raise exception '게임 정보와 테스트 목표를 확인해 주세요.';end if;
  if coalesce(d->>'genre','') not in ('퍼즐','로그라이크','플랫포머','어드벤처','시뮬레이션','액션') or coalesce(d->>'platform','') not in ('WebGL','Windows','Android') or length(coalesce(d->>'build',''))>16 or coalesce((d->>'minutes')::int,0) not between 5 and 120 or coalesce(d->>'vis','') not in ('public','approval','invite') then raise exception '모집 조건이 올바르지 않습니다.';end if;
  if coalesce(d->>'link','') !~ '^https://[^[:space:]]+$' or length(coalesce(d->>'how','')) not between 10 and 10000 then raise exception '빌드 링크와 플레이 방법을 확인해 주세요.';end if;
  if d->>'vis'='invite' and coalesce(d->>'code','') !~ '^[A-Z0-9]{4,12}$' then raise exception '초대 코드 형식이 올바르지 않습니다.';end if;
  -- Require an explicit JSON null for unlimited capacity; missing/malformed input fails closed.
  if not (d ? 'slots') or jsonb_typeof(d->'slots') not in ('number','null') then raise exception '모집 인원은 1~50명의 정수로 입력해 주세요.';end if;
  if d->'slots'<>'null'::jsonb then
   if (d->>'slots') !~ '^[0-9]+$' or (d->>'slots')::numeric not between 1 and 50 then raise exception '모집 인원은 1~50명의 정수로 입력해 주세요.';end if;
  end if;
  due=nullif(d->>'deadline','')::date;
  if due is null then raise exception '모든 테스트에 마감일을 설정해 주세요.';end if;
  if due > (((coalesce(t.created_at,stamp) at time zone 'Asia/Seoul')::date + interval '2 months')::date) then raise exception '마감일은 최초 등록일부터 최대 두 달 이내로 설정해 주세요.';end if;
  if due<(now() at time zone 'Asia/Seoul')::date and (tid is null or due is distinct from t.deadline) then raise exception '마감일은 오늘 이후여야 합니다.';end if;
  if tid is not null and d->'slots'<>'null'::jsonb and (d->>'slots')::int<(select count(*) from pt_applications where test_id=tid and status in ('applied','done')) then raise exception '참여자 수보다 모집 인원을 줄일 수 없습니다.';end if;
  perform pt_validate_survey(d->'survey');media=pt_validate_media(coalesce(d->'media','[]'),'game');
  newdoc=jsonb_build_object('title',trim(d->>'title'),'team',trim(d->>'team'),'genre',d->>'genre','platform',d->>'platform','build',d->>'build','minutes',(d->>'minutes')::int,'teaser',d->>'teaser','feedbackFocus',d->>'feedbackFocus','media',media);
  if tid is null then insert into pt_tests(owner_id,doc,slots,visibility,deadline) values(u,newdoc,(d->>'slots')::int,d->>'vis',due) returning id into tid;
  else update pt_tests set doc=newdoc,slots=(d->>'slots')::int,visibility=d->>'vis',deadline=due,status=case when status='hidden' then 'appeal' else status end where id=tid;end if;
  insert into pt_secrets values(tid,d->>'link',d->>'how',d->'survey',case when d->>'vis'='invite' then d->>'code' else '' end) on conflict(test_id) do update set link=excluded.link,how=excluded.how,survey=excluded.survey,invite_code=excluded.invite_code;
  return pt_snapshot();
 end if;
 if action='bug_status' then select * into b from pt_bugs where id=payload->>'bugId' for update;tid=b.test_id;end if;
 select * into t from pt_tests where id=tid for update;if not found then raise exception '테스트를 찾을 수 없습니다.';end if;
 if exists(select 1 from pt_account_deletions where user_id=t.owner_id) then raise exception '개발자가 탈퇴 중인 테스트입니다.';end if;
 select * into s from pt_secrets where test_id=tid;
 select * into a from pt_applications where test_id=tid and tester_id=u;
 if action='apply' then
  if t.status<>'open' or (t.deadline+time '23:59:59.999') at time zone 'Asia/Seoul'<now() then raise exception '모집이 종료되었습니다.';end if;
  if coalesce((payload->>'agreed')::boolean,false) is not true then raise exception '이용 동의서에 동의해 주세요.';end if;
  if a.tester_id is not null and a.status<>'cancelled' then raise exception '이미 신청한 테스트입니다.';end if;
  if t.visibility='invite' and upper(coalesce(payload->>'code',''))<>s.invite_code then raise exception '초대 코드가 올바르지 않습니다.';end if;
  if t.slots is not null and (select count(*) from pt_applications where test_id=tid and status in ('applied','done'))>=t.slots then raise exception '모집이 마감되었습니다.';end if;
  insert into pt_applications(test_id,tester_id,status) values(tid,u,case when t.visibility='approval' then 'waiting' else 'applied' end) on conflict(test_id,tester_id) do update set status=excluded.status,agreed_at=stamp,started_at=null;
 elsif action='cancel_application' then
  if a.status is null or a.status not in ('waiting','applied') then raise exception '승인 대기 또는 참여 중인 신청만 취소할 수 있습니다.';end if;
  update pt_applications set status='cancelled',started_at=null where test_id=tid and tester_id=u;
 elsif action='start_play' then
  update pt_applications set started_at=coalesce(started_at,stamp) where test_id=tid and tester_id=u and status='applied';
 elsif action='review_application' then
  if t.owner_id<>u then raise exception '내 테스트만 관리할 수 있습니다.';end if;
  if payload->>'decision'='approve' then
   if t.status<>'open' or (t.deadline+time '23:59:59.999') at time zone 'Asia/Seoul'<now() then raise exception '모집이 종료되었습니다.';end if;
   if t.slots is not null and (select count(*) from pt_applications where test_id=tid and status in ('applied','done'))>=t.slots then raise exception '모집이 마감되었습니다.';end if;
   st='applied';
  elsif payload->>'decision'='decline' then st='declined';else raise exception '처리 상태가 올바르지 않습니다.';end if;
  update pt_applications set status=st where test_id=tid and tester_id=(payload->>'testerId')::uuid and status='waiting';if not found then raise exception '대기 중인 신청이 아닙니다.';end if;
 elsif action='toggle_close' then
  if t.owner_id<>u or t.status not in ('open','closed') then raise exception '모집 상태를 변경할 수 없습니다.';end if;
  update pt_tests set status=case when status='open' then 'closed' else 'open' end where id=tid;
 elsif action='feedback' then
  if a.status is distinct from 'applied' or t.status not in ('open','closed') then raise exception '참여 중인 테스트에서만 제출할 수 있습니다.';end if;
  if jsonb_typeof(payload->'answers') is distinct from 'object' then raise exception '응답 형식이 올바르지 않습니다.';end if;
  for bid in select jsonb_object_keys(payload->'answers') loop if not exists(select 1 from jsonb_array_elements(s.survey) as sq(item) where sq.item->>'id'=bid) then raise exception '알 수 없는 질문입니다.';end if;end loop;
  for q in select value from jsonb_array_elements(s.survey) loop
   answer=payload->'answers'->(q->>'id');
   if answer is null or answer='null' or answer='""' then if (q->>'required')::boolean then raise exception '필수 문항에 답해 주세요.';end if;continue;end if;
   if q->>'type'='scale' then if jsonb_typeof(answer)<>'number' then raise exception '척도 응답이 올바르지 않습니다.';end if;if (answer#>>'{}')::numeric not in (1,2,3,4,5) then raise exception '척도 범위가 올바르지 않습니다.';end if;
   elsif q->>'type'='choice' then if not (q->'options' @> jsonb_build_array(answer)) then raise exception '보기를 선택해 주세요.';end if;
   elsif jsonb_typeof(answer)<>'string' or length(answer#>>'{}')>4000 then raise exception '주관식 응답이 올바르지 않습니다.';end if;
  end loop;
  st=payload->>'issueStatus';ids=coalesce(payload->'bugIds','[]');
  if st is null or st not in ('none','reported') or jsonb_typeof(ids)<>'array' then raise exception '문제 발견 여부를 선택해 주세요.';end if;
  if st='reported' then
   if jsonb_array_length(ids)=0 then raise exception '연결할 버그를 선택해 주세요.';end if;
   for bid in select jsonb_array_elements_text(ids) loop if not exists(select 1 from pt_bugs where id=bid and test_id=tid and tester_id=u) then raise exception '내 제보만 연결할 수 있습니다.';end if;end loop;
  else ids='[]';end if;
  insert into pt_feedback(test_id,tester_id,doc) values(tid,u,jsonb_build_object('answers',payload->'answers','issueStatus',st,'bugIds',ids));
  update pt_applications set status='done' where test_id=tid and tester_id=u;
 elsif action='bug' then
  if a.status is null or a.status not in ('applied','done') or t.status not in ('open','closed') then raise exception '승인된 참여자만 제보할 수 있습니다.';end if;
  if length(coalesce(d->>'title','')) not between 3 and 100 or length(coalesce(d->>'description','')) not between 10 and 4000 or length(coalesce(d->>'steps','')) not between 5 and 4000 or length(coalesce(d->>'device','')) not between 1 and 200 or coalesce(d->>'severity','') not in ('minor','normal','critical') then raise exception '버그 제보 내용을 확인해 주세요.';end if;
  media=pt_validate_media(coalesce(d->'attachments','[]'),'bug');
  insert into pt_bugs(test_id,tester_id,doc,history) values(tid,u,jsonb_build_object('title',d->>'title','description',d->>'description','steps',d->>'steps','device',d->>'device','severity',d->>'severity','attachments',media,'build',t.doc->>'build'),jsonb_build_array(jsonb_build_object('status','new','date',stamp,'note','')));
 elsif action='bug_status' then
  if t.owner_id<>u then raise exception '내 테스트의 버그만 처리할 수 있습니다.';end if;
  st=payload->>'status';note=coalesce(payload->>'note','');if st is null or st not in ('new','review','planned','fixed','unreproduced') or length(note)>2000 then raise exception '처리 내용을 확인해 주세요.';end if;
  if b.status<>st or b.developer_note<>note then
   update pt_bugs set status=st,developer_note=note,updated_at=stamp,history=history||jsonb_build_array(jsonb_build_object('status',st,'note',note,'date',stamp)) where id=b.id;
   insert into pt_notifications(user_id,doc) values(b.tester_id,jsonb_build_object('type','bug','testId',tid,'bugId',b.id,'bugTitle',b.doc->>'title','status',st,'title','버그 제보 처리 내용이 업데이트되었습니다.','date',stamp));
  end if;
 elsif action='report' then
  if t.status not in ('open','closed') or t.owner_id=u then raise exception '이 테스트는 신고할 수 없습니다.';end if;
  if payload->>'reason' is null or payload->>'reason' not in ('부적절한 내용','악성 링크·파일 의심','저작권·도용 의심','홍보·스팸','기타') or length(coalesce(payload->>'detail',''))>4000 then raise exception '신고 내용을 확인해 주세요.';end if;
  if payload->>'reason'='기타' and length(coalesce(payload->>'detail',''))<5 then raise exception '기타 사유는 5자 이상 적어 주세요.';end if;
  insert into pt_reports(test_id,reporter_id,reason,detail) values(tid,u,payload->>'reason',coalesce(payload->>'detail',''));
  if (select count(*) from pt_reports where test_id=tid and status='open')>=3 then update pt_tests set prior_status=status,status='hidden',hidden_by='auto',reason='신고 3건 누적으로 임시 숨김 처리되었습니다.' where id=tid;end if;
 elsif action in ('dismiss','hide','restore') then
  if not adm then raise exception '운영자 권한이 필요합니다.' using errcode='42501';end if;
  note=coalesce(payload->>'note','');
  if action='dismiss' then
   update pt_reports set status='dismissed' where test_id=tid and status='open';
   if t.hidden_by='auto' then update pt_tests set status=prior_status,hidden_by=null,reason=null where id=tid;end if;
  elsif action='hide' then
   if length(note) not between 4 and 4000 then raise exception '숨김 사유를 입력해 주세요.';end if;
   update pt_reports set status='actioned' where test_id=tid and status='open';
   update pt_tests set prior_status=case when status in ('open','closed') then status else prior_status end,status='hidden',hidden_by='admin',reason=note where id=tid;
  else update pt_tests set status=prior_status,reason=null,hidden_by=null where id=tid;end if;
  insert into pt_moderation(admin_id,test_id,action,note) values(u,tid,action,note);
 else raise exception '지원하지 않는 작업입니다.';end if;
 return pt_snapshot();
end $$;
create or replace function public.pt_sync_profile() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid=auth.uid();metadata jsonb;nickname text;
begin
 if not pt_active_member() then raise exception '로그인이 필요합니다.' using errcode='42501';end if;
 select raw_user_meta_data into metadata from auth.users where id=u;
 nickname=left(coalesce(nullif(trim(metadata->>'nickname'),''),nullif(trim(metadata->>'preferred_username'),''),nullif(trim(metadata->>'full_name'),''),nullif(trim(metadata->>'name'),''),'플레이어'),40);
 insert into public.pt_profiles as p values(u,nickname)
 on conflict(id) do update set nickname=case when p.nickname='플레이어' then excluded.nickname else p.nickname end;
 return public.pt_snapshot();
end $$;
commit;
