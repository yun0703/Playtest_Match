-- Synthetic developer and games only; all test data is rolled back.
begin;
do $$
declare developer uuid=gen_random_uuid(); genre text; draft jsonb; denied boolean=false;
begin
 insert into auth.users(id,aud,role,raw_user_meta_data) values(developer,'authenticated','authenticated','{"nickname":"Genre QA"}');
 perform set_config('request.jwt.claim.sub',developer::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',developer,'role','authenticated')::text,true);
 draft=jsonb_build_object('title','Genre validation QA','team','QA','teaser','Rollback-only genre registration test.','feedbackFocus','Check every supported genre can be registered.','platform','WebGL','build','v1','minutes',15,'slots',1,'vis','public','deadline',((now() at time zone 'Asia/Seoul')::date+1)::text,'link','https://example.com/build','how','Instructions for a synthetic test game.','survey','[{"id":"q1","label":"Rating","type":"scale","required":true,"options":[]}]'::jsonb,'media','[]'::jsonb);
 foreach genre in array array['퍼즐','로그라이크','플랫포머','어드벤처','시뮬레이션','액션','RPG','전략','생존','공포','슈팅','리듬','스포츠','레이싱','비주얼 노벨'] loop
  perform pt_command('save_test',jsonb_build_object('data',draft||jsonb_build_object('genre',genre)));
 end loop;
 if (select count(*) from pt_tests where owner_id=developer)<>15 then raise exception 'FAIL supported genre registration';end if;
 begin perform pt_command('save_test',jsonb_build_object('data',draft||'{"genre":"unknown"}'::jsonb));exception when others then denied=true;end;
 if not denied then raise exception 'FAIL unknown genre accepted';end if;
end $$;
rollback;
select 'PASS all 15 genres accepted; unknown genre rejected; synthetic data rolled back' as result;
