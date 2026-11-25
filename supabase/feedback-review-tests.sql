-- Synthetic accounts and responses. All writes are rolled back.
begin;
do $test$
declare
 developer uuid=gen_random_uuid();
 tester uuid=gen_random_uuid();
 game_id text=gen_random_uuid()::text;
 other_game text=gen_random_uuid()::text;
 response uuid=gen_random_uuid();
 unread_response uuid=gen_random_uuid();
 other_response uuid=gen_random_uuid();
 game jsonb;
begin
 insert into auth.users(id,aud,role) values(developer,'authenticated','authenticated'),(tester,'authenticated','authenticated');
 insert into pt_tests(id,owner_id,doc,slots,visibility,deadline)
 values(game_id,developer,'{"title":"Feedback Review QA","media":[]}',1,'public',current_date+2),
 (other_game,tester,'{"title":"Other Game QA","media":[]}',1,'public',current_date+2);
 insert into pt_feedback(id,test_id,tester_id,doc) values
 (response,game_id,tester,'{"build":"v1","answers":{}}'),
 (unread_response,game_id,developer,'{"build":"v2","answers":{}}'),
 (other_response,other_game,developer,'{"build":"v1","answers":{}}');

 perform set_config('request.jwt.claim.sub',tester::text,true);
 begin
  perform pt_command('review_feedback',jsonb_build_object('testId',game_id,'responseIds',jsonb_build_array(response)));
  raise exception 'Non-owner reviewed a response';
 exception when insufficient_privilege then null;
 end;
 select value into game from jsonb_array_elements(pt_snapshot()->'tests') where value->>'id'=game_id;
 if game->'feedbacks' is distinct from '[]'::jsonb then raise exception 'Feedback leaked to a non-owner';end if;

 perform set_config('request.jwt.claim.sub',developer::text,true);
 perform pt_command('review_feedback',jsonb_build_object('testId',game_id,'responseIds',jsonb_build_array(response,other_response,response)));
 select value into game from jsonb_array_elements(pt_snapshot()->'tests') where value->>'id'=game_id;
 if not exists(select 1 from jsonb_array_elements(game->'feedbacks') f where f->>'responseId'=response::text and f->>'reviewed'='true')
   or not exists(select 1 from jsonb_array_elements(game->'feedbacks') f where f->>'responseId'=unread_response::text and f->>'reviewed'='false')
   or exists(select 1 from pt_feedback_reviews where feedback_id=other_response) then
  raise exception 'Review state was not limited to visible owned responses';
 end if;
end $test$;
rollback;
select 'PASS: response review, ownership and exact selection' as result;
