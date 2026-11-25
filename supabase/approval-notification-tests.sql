-- Synthetic members and game. All records are rolled back.
begin;
do $test$
declare
 developer uuid=gen_random_uuid();
 tester uuid=gen_random_uuid();
 game_id text=gen_random_uuid()::text;
 notice_id text;
 payload jsonb=jsonb_build_object('testId',game_id,'testerId',tester,'decision','approve');
begin
 insert into auth.users(id,aud,role) values(developer,'authenticated','authenticated'),(tester,'authenticated','authenticated');
 insert into pt_tests(id,owner_id,doc,slots,visibility,deadline)
 values(game_id,developer,'{"title":"Approval QA","media":[]}',1,'approval',current_date+2);
 insert into pt_secrets(test_id,link,how,survey) values(game_id,'https://example.com/build','QA instructions','[]');
 perform set_config('request.jwt.claim.sub',tester::text,true);
 perform pt_command('apply',jsonb_build_object('testId',game_id,'agreed',true));
 if exists(select 1 from pt_notifications where user_id=tester) then raise exception 'A pending application was notified';end if;

 perform set_config('request.jwt.claim.sub',developer::text,true);
 perform pt_command('review_application',payload);
 begin
  perform pt_command('review_application',payload);
  raise exception 'Repeated approval unexpectedly succeeded';
 exception when others then
  if sqlerrm<>'대기 중인 신청이 아닙니다.' and sqlerrm<>'모집이 마감되었습니다.' then raise;end if;
 end;
 if exists(select 1 from jsonb_array_elements(pt_snapshot()->'notifications') n where n->>'testId'=game_id) then
  raise exception 'Developer can see tester notification';
 end if;
 select id into strict notice_id from pt_notifications
 where user_id=tester and doc->>'testId'=game_id and doc->>'type'='approval';

 perform set_config('request.jwt.claim.sub',tester::text,true);
 if not exists(select 1 from jsonb_array_elements(pt_snapshot()->'notifications') n where n->>'id'=notice_id and n->>'gameTitle'='Approval QA') then
  raise exception 'Tester cannot see their approval notification';
 end if;
 if not exists(select 1 from jsonb_array_elements(pt_snapshot()->'tests') t where t->>'id'=game_id and t->>'link'='https://example.com/build') then
  raise exception 'Approved tester cannot see the build';
 end if;
 perform pt_command('mark_read',jsonb_build_object('ids',jsonb_build_array(notice_id)));
 if not (pt_snapshot()->'readNotifications' ? notice_id) then raise exception 'Approval read state did not persist';end if;
end $test$;
rollback;
select 'PASS: approval, private notification, build access, and read state' as result;
