create or replace function public.pt_command(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid=auth.uid();adm boolean=pt_is_admin();tid text=payload->>'testId';t pt_tests;s pt_secrets;a pt_applications;b pt_bugs;d jsonb=payload->'data';q jsonb;answer jsonb;media jsonb;bid text;ids jsonb;st text;note text;nick text;due date;newdoc jsonb;stamp timestamptz=now();cnt int;
begin
 if u is null then raise exception '로그인이 필요합니다.' using errcode='42501';end if;
 insert into pt_profiles values(u,left(coalesce(nullif(auth.jwt()->'user_metadata'->>'nickname',''),'플레이어'),40)) on conflict do nothing;
 if action='mark_read' then
  for bid in select jsonb_array_elements_text(payload->'ids') loop insert into pt_reads values(u,left(bid,250)) on conflict do nothing;end loop;return pt_snapshot();
 end if;
 if action='save_test' then
  if tid is not null then select * into t from pt_tests where id=tid for update;if not found or t.owner_id<>u then raise exception '내 테스트만 수정할 수 있습니다.';end if;end if;
  if length(trim(coalesce(d->>'title',''))) not between 1 and 40 or length(trim(coalesce(d->>'team',''))) not between 1 and 40 or length(coalesce(d->>'teaser','')) not between 8 and 80 or length(coalesce(d->>'feedbackFocus','')) not between 10 and 600 then raise exception '게임 정보와 테스트 목표를 확인해 주세요.';end if;
  if coalesce(d->>'genre','') not in ('퍼즐','로그라이크','플랫포머','어드벤처','시뮬레이션','액션') or coalesce(d->>'platform','') not in ('WebGL','Windows','Android') or length(coalesce(d->>'build',''))>16 or coalesce((d->>'minutes')::int,0) not between 5 and 120 or (d->>'slots')::int not between 1 and 50 or coalesce(d->>'vis','') not in ('public','approval','invite') then raise exception '모집 조건이 올바르지 않습니다.';end if;
  if coalesce(d->>'link','') !~ '^https://[^[:space:]]+$' or length(coalesce(d->>'how','')) not between 10 and 10000 then raise exception '빌드 링크와 플레이 방법을 확인해 주세요.';end if;
  if d->>'vis'='invite' and coalesce(d->>'code','') !~ '^[A-Z0-9]{4,12}$' then raise exception '초대 코드 형식이 올바르지 않습니다.';end if;
  due=nullif(d->>'deadline','')::date;
  if due<(now() at time zone 'Asia/Seoul')::date and (tid is null or due is distinct from t.deadline) then raise exception '마감일은 오늘 이후여야 합니다.';end if;
  if tid is not null and (d->>'slots')::int<(select count(*) from pt_applications where test_id=tid and status in ('applied','done')) then raise exception '참여자 수보다 모집 인원을 줄일 수 없습니다.';end if;
  perform pt_validate_survey(d->'survey');media=pt_validate_media(coalesce(d->'media','[]'),'game');
  newdoc=jsonb_build_object('title',trim(d->>'title'),'team',trim(d->>'team'),'genre',d->>'genre','platform',d->>'platform','build',d->>'build','minutes',(d->>'minutes')::int,'teaser',d->>'teaser','feedbackFocus',d->>'feedbackFocus','media',media);
  if tid is null then insert into pt_tests(owner_id,doc,slots,visibility,deadline) values(u,newdoc,(d->>'slots')::int,d->>'vis',due) returning id into tid;
  else update pt_tests set doc=newdoc,slots=(d->>'slots')::int,visibility=d->>'vis',deadline=due,status=case when status='hidden' then 'appeal' else status end where id=tid;end if;
  insert into pt_secrets values(tid,d->>'link',d->>'how',d->'survey',case when d->>'vis'='invite' then d->>'code' else '' end) on conflict(test_id) do update set link=excluded.link,how=excluded.how,survey=excluded.survey,invite_code=excluded.invite_code;
  return pt_snapshot();
 end if;
 if action='bug_status' then select * into b from pt_bugs where id=payload->>'bugId' for update;tid=b.test_id;end if;
 select * into t from pt_tests where id=tid for update;if not found then raise exception '테스트를 찾을 수 없습니다.';end if;
 select * into s from pt_secrets where test_id=tid;
 select * into a from pt_applications where test_id=tid and tester_id=u;
 if action='apply' then
  if t.status<>'open' or (t.deadline+time '23:59:59.999') at time zone 'Asia/Seoul'<now() then raise exception '모집이 종료되었습니다.';end if;
  if coalesce((payload->>'agreed')::boolean,false) is not true then raise exception '이용 동의서에 동의해 주세요.';end if;
  if a.tester_id is not null then raise exception '이미 신청한 테스트입니다.';end if;
  if t.visibility='invite' and upper(coalesce(payload->>'code',''))<>s.invite_code then raise exception '초대 코드가 올바르지 않습니다.';end if;
  if (select count(*) from pt_applications where test_id=tid and status in ('applied','done'))>=t.slots then raise exception '모집이 마감되었습니다.';end if;
  insert into pt_applications(test_id,tester_id,status) values(tid,u,case when t.visibility='approval' then 'waiting' else 'applied' end);
 elsif action='start_play' then
  update pt_applications set started_at=coalesce(started_at,stamp) where test_id=tid and tester_id=u and status='applied';
 elsif action='review_application' then
  if t.owner_id<>u then raise exception '내 테스트만 관리할 수 있습니다.';end if;
  if payload->>'decision'='approve' then
   if t.status<>'open' or (t.deadline+time '23:59:59.999') at time zone 'Asia/Seoul'<now() then raise exception '모집이 종료되었습니다.';end if;
   if (select count(*) from pt_applications where test_id=tid and status in ('applied','done'))>=t.slots then raise exception '모집이 마감되었습니다.';end if;
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
