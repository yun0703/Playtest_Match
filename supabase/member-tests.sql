begin;
do $$
declare a uuid=gen_random_uuid();b uuid=gen_random_uuid();first_id text;second_id text;snapshot jsonb;draft jsonb;
begin
 insert into auth.users(id,aud,role,raw_user_meta_data) values(a,'authenticated','authenticated','{"name":"Google QA member"}'),(b,'authenticated','authenticated','{"preferred_username":"Naver QA member"}');
 perform set_config('request.jwt.claim.sub',a::text,true);snapshot=public.pt_sync_profile();
 if snapshot->'viewer'->>'nickname'<>'Google QA member' or (snapshot->'viewer'->>'admin')::boolean then raise exception 'FAIL: Google profile or permissions';end if;
 draft=jsonb_build_object('title','Member QA rollback','team','QA','teaser','Rollback only dual-member test.','feedbackFocus','Verify every member can both publish and participate.','genre','퍼즐','platform','WebGL','build','v1','minutes',10,'slots',2,'vis','public','deadline','','link','https://example.com/qa-build','how','This fixture does not contain a real game.','survey','[{"id":"q1","label":"Rating","type":"scale","required":true,"options":[]}]'::jsonb,'media','[]'::jsonb);
 perform public.pt_command('save_test',jsonb_build_object('data',draft));select id into first_id from public.pt_tests where owner_id=a;
 perform set_config('request.jwt.claim.sub',b::text,true);snapshot=public.pt_sync_profile();
 if snapshot->'viewer'->>'nickname'<>'Naver QA member' then raise exception 'FAIL: Naver profile';end if;
 perform public.pt_command('apply',jsonb_build_object('testId',first_id,'agreed',true));
 perform public.pt_command('save_test',jsonb_build_object('data',draft));select id into second_id from public.pt_tests where owner_id=b;
 perform set_config('request.jwt.claim.sub',a::text,true);snapshot=public.pt_command('apply',jsonb_build_object('testId',second_id,'agreed',true));
 if snapshot->'mine'->second_id->>'status'<>'applied' or not exists(select 1 from public.pt_tests where id=first_id and owner_id=a) then raise exception 'FAIL: publisher can participate';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);snapshot=public.pt_sync_profile();
 if snapshot->'mine'->first_id->>'status'<>'applied' or not exists(select 1 from public.pt_tests where id=second_id and owner_id=b) then raise exception 'FAIL: tester can publish';end if;
 if has_function_privilege('anon','public.pt_sync_profile()','execute') then raise exception 'FAIL: anonymous profile sync';end if;
end $$;
select 'PASS: Google/Naver profile names, member can publish and participate, no admin promotion, anonymous access denied' as result;
rollback;
