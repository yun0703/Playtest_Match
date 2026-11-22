-- Prepared for the next real DB verification session; not run as part of this feature delivery.
-- Synthetic identities and data; all changes roll back.
begin;
do $$
declare dev uuid=gen_random_uuid(); player uuid=gen_random_uuid(); peer uuid=gen_random_uuid(); stranger uuid=gen_random_uuid(); tid text; bid text; draft jsonb; snap jsonb; failed boolean;
begin
 insert into auth.users(id,aud,role) values(dev,'authenticated','authenticated'),(player,'authenticated','authenticated'),(peer,'authenticated','authenticated'),(stranger,'authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',dev::text,true);
 draft=jsonb_build_object('title','Build QA','team','QA','teaser','Transaction-only feature verification.','feedbackFocus','Verify version history and private favorite behavior.','genre','RPG','platform','WebGL','build','v1','minutes',15,'slots',5,'vis','public','deadline',((now() at time zone 'Asia/Seoul')::date+1)::text,'link','https://example.com/build','how','Instructions for synthetic verification.','survey','[{"id":"q","label":"Rating","type":"scale","options":[],"required":true}]'::jsonb,'media','[]'::jsonb);
 perform pt_command('save_test',jsonb_build_object('data',draft));select id into tid from pt_tests where owner_id=dev;
 perform set_config('request.jwt.claim.sub',player::text,true);
 perform pt_command('favorite',jsonb_build_object('testId',tid,'saved',true,'userId',peer));
 snap=pt_command('favorite',jsonb_build_object('testId',tid,'saved',true));
 if jsonb_array_length(snap->'favorites')<>1 then raise exception 'FAIL favorite idempotency';end if;
 perform pt_command('apply',jsonb_build_object('testId',tid,'agreed',true));snap=pt_command('start_play',jsonb_build_object('testId',tid));
 if snap->'mine'->tid->>'playedBuild'<>'v1' then raise exception 'FAIL played build';end if;
 perform pt_command('bug',jsonb_build_object('testId',tid,'data','{"build":"v1","title":"Settings freezes","description":"The settings screen freezes during play.","steps":"Open settings twice.","device":"QA browser","severity":"normal"}'::jsonb));select id into bid from pt_bugs where test_id=tid;
 perform set_config('request.jwt.claim.sub',stranger::text,true);snap=pt_snapshot();if jsonb_array_length(snap->'favorites')<>0 or jsonb_array_length(snap->'bugSummaries')<>0 then raise exception 'FAIL private favorite or summary';end if;
 perform set_config('request.jwt.claim.sub',peer::text,true);perform pt_command('apply',jsonb_build_object('testId',tid,'agreed',true));snap=pt_snapshot();
 if jsonb_array_length(snap->'bugs')<>0 or jsonb_array_length(snap->'bugSummaries')<>1 or (snap->'bugSummaries'->0) ? 'description' or (snap->'bugSummaries'->0) ? 'testerId' then raise exception 'FAIL summary privacy';end if;
 perform pt_command('feedback',jsonb_build_object('testId',tid,'build','v1','answers','{"q":4}'::jsonb,'issueStatus','existing','bugIds',jsonb_build_array(bid)));
 perform set_config('request.jwt.claim.sub',dev::text,true);perform pt_command('save_test',jsonb_build_object('testId',tid,'data',draft||'{"build":"v2","survey":[{"id":"q","label":"New question","type":"text","options":[],"required":true}]}'::jsonb));
 perform set_config('request.jwt.claim.sub',player::text,true);
 snap=pt_command('feedback',jsonb_build_object('testId',tid,'build','v1','answers','{"q":"Current survey answer"}'::jsonb,'issueStatus','reported','bugIds',jsonb_build_array(bid)));
 if not exists(select 1 from pt_feedback where tester_id=player and doc->>'build'='v1' and doc->'surveySnapshot'->0->>'label'='New question') then raise exception 'FAIL version or survey capture';end if;
 perform set_config('request.jwt.claim.sub',stranger::text,true);perform pt_command('apply',jsonb_build_object('testId',tid,'agreed',true));failed=false;
 begin perform pt_command('feedback',jsonb_build_object('testId',tid,'build','v2','answers','{"q":"Answer"}'::jsonb,'issueStatus','existing','bugIds',jsonb_build_array(bid)));exception when others then failed=true;end;if not failed then raise exception 'FAIL cross-version existing link';end if;
 perform pt_command('cancel_application',jsonb_build_object('testId',tid));snap=pt_snapshot();if jsonb_array_length(snap->'bugSummaries')<>0 then raise exception 'FAIL summary access after cancellation';end if;
 perform set_config('request.jwt.claim.sub',player::text,true);snap=pt_command('favorite',jsonb_build_object('testId',tid,'saved',false));if jsonb_array_length(snap->'favorites')<>0 then raise exception 'FAIL unsave';end if;
 perform set_config('request.jwt.claim.sub','',true);failed=false;begin perform pt_command('favorite',jsonb_build_object('testId',tid,'saved',true));exception when others then failed=true;end;if not failed then raise exception 'FAIL anonymous favorite';end if;
end $$;
rollback;
select 'PASS build capture, private favorites, approved summaries, shared linking and revocation' as result;
