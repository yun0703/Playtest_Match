-- Real RPC integration tests. All synthetic users and records are rolled back.
begin;
do $$
declare owner_uid uuid=gen_random_uuid();tester_uid uuid;uids uuid[]='{}';tid text;approval_id text;limited_id text;draft jsonb;snapshot jsonb;bad jsonb;failed boolean;i int;
begin
 insert into auth.users(id,aud,role,raw_user_meta_data) values(owner_uid,'authenticated','authenticated','{"nickname":"Capacity QA owner"}');
 for i in 1..61 loop
  tester_uid=gen_random_uuid();uids=array_append(uids,tester_uid);
  insert into auth.users(id,aud,role) values(tester_uid,'authenticated','authenticated');
 end loop;
 perform set_config('request.jwt.claim.sub',owner_uid::text,true);
 draft=jsonb_build_object('title','Capacity rollback QA','team','QA','teaser','Rollback-only capacity verification.','feedbackFocus','Verify unlimited recruitment and deadline enforcement.','genre','퍼즐','platform','WebGL','build','v1','minutes',15,'slots',null,'vis','public','deadline',((now() at time zone 'Asia/Seoul')::date+1)::text,'link','https://example.com/build','how','Play the game and complete the feedback form.','survey','[{"id":"q1","label":"Rating","type":"scale","required":true,"options":[]}]'::jsonb,'media','[]'::jsonb);
 for bad in select value from jsonb_array_elements('[0,-1,1.5,51,"1",true]'::jsonb) loop
  failed=false;begin perform pt_command('save_test',jsonb_build_object('data',draft||jsonb_build_object('slots',bad)));exception when others then failed=true;end;
  if not failed then raise exception 'FAIL invalid capacity: %',bad;end if;
 end loop;
 failed=false;begin perform pt_command('save_test',jsonb_build_object('data',draft-'slots'));exception when others then failed=true;end;if not failed then raise exception 'FAIL missing capacity';end if;
 failed=false;begin perform pt_command('save_test',jsonb_build_object('data',draft||'{"deadline":""}'::jsonb));exception when others then failed=true;end;if not failed then raise exception 'FAIL unlimited without deadline';end if;
 perform pt_command('save_test',jsonb_build_object('data',draft));
 select id into tid from pt_tests where owner_id=owner_uid;
 for i in 1..60 loop
  perform set_config('request.jwt.claim.sub',uids[i]::text,true);
  snapshot=pt_command('apply',jsonb_build_object('testId',tid,'agreed',true));
  if snapshot->'mine'->tid->>'status'<>'applied' then raise exception 'FAIL unlimited application';end if;
 end loop;
 if (select count(*) from pt_applications where test_id=tid and status='applied')<>60 then raise exception 'FAIL unlimited beyond 50';end if;
 if not exists(select 1 from jsonb_array_elements(snapshot->'tests') t where t->>'id'=tid and t->'slots'='null'::jsonb and (t->>'applicants')::int=60) then raise exception 'FAIL snapshot null capacity';end if;
 perform set_config('request.jwt.claim.sub',owner_uid::text,true);
 failed=false;begin perform pt_command('save_test',jsonb_build_object('testId',tid,'data',draft||'{"slots":50}'::jsonb));exception when others then failed=true;end;if not failed then raise exception 'FAIL reducing below participants';end if;
 perform pt_command('toggle_close',jsonb_build_object('testId',tid));
 perform set_config('request.jwt.claim.sub',uids[61]::text,true);
 failed=false;begin perform pt_command('apply',jsonb_build_object('testId',tid,'agreed',true));exception when others then failed=true;end;if not failed then raise exception 'FAIL manual close';end if;
 update pt_tests set status='open',deadline=(now() at time zone 'Asia/Seoul')::date-1 where id=tid;
 failed=false;begin perform pt_command('apply',jsonb_build_object('testId',tid,'agreed',true));exception when others then failed=true;end;if not failed then raise exception 'FAIL unlimited deadline';end if;
 perform set_config('request.jwt.claim.sub',owner_uid::text,true);
 perform pt_command('save_test',jsonb_build_object('data',draft||'{"vis":"approval"}'::jsonb));
 select id into approval_id from pt_tests where owner_id=owner_uid and visibility='approval';
 for i in 1..2 loop
  perform set_config('request.jwt.claim.sub',uids[i]::text,true);
  snapshot=pt_command('apply',jsonb_build_object('testId',approval_id,'agreed',true));
  if snapshot->'mine'->approval_id->>'status'<>'waiting' then raise exception 'FAIL approval gate';end if;
  perform set_config('request.jwt.claim.sub',owner_uid::text,true);
  perform pt_command('review_application',jsonb_build_object('testId',approval_id,'testerId',uids[i],'decision','approve'));
 end loop;
 perform set_config('request.jwt.claim.sub',uids[3]::text,true);perform pt_command('apply',jsonb_build_object('testId',approval_id,'agreed',true));
 update pt_tests set deadline=(now() at time zone 'Asia/Seoul')::date-1 where id=approval_id;
 perform set_config('request.jwt.claim.sub',owner_uid::text,true);
 failed=false;begin perform pt_command('review_application',jsonb_build_object('testId',approval_id,'testerId',uids[3],'decision','approve'));exception when others then failed=true;end;if not failed then raise exception 'FAIL approval after deadline';end if;
 perform pt_command('save_test',jsonb_build_object('data',draft||'{"slots":1,"vis":"invite","code":"CAPQA"}'::jsonb));
 select id into limited_id from pt_tests where owner_id=owner_uid and visibility='invite';
 perform set_config('request.jwt.claim.sub',uids[1]::text,true);
 failed=false;begin perform pt_command('apply',jsonb_build_object('testId',limited_id,'agreed',true,'code','WRONG'));exception when others then failed=true;end;if not failed then raise exception 'FAIL invite bypass';end if;
 perform pt_command('apply',jsonb_build_object('testId',limited_id,'agreed',true,'code','CAPQA'));
 perform set_config('request.jwt.claim.sub',uids[2]::text,true);
 failed=false;begin perform pt_command('apply',jsonb_build_object('testId',limited_id,'agreed',true,'code','CAPQA'));exception when others then failed=true;end;if not failed then raise exception 'FAIL limited full';end if;
 perform set_config('request.jwt.claim.sub',owner_uid::text,true);
 perform pt_command('save_test',jsonb_build_object('testId',limited_id,'data',draft||'{"vis":"invite","code":"CAPQA"}'::jsonb));
 perform set_config('request.jwt.claim.sub',uids[2]::text,true);
 perform pt_command('apply',jsonb_build_object('testId',limited_id,'agreed',true,'code','CAPQA'));
end $$;
select 'PASS: unlimited >50, snapshot, validation, deadline, approval, manual close, bounded capacity, mode changes, invite rules' as result;
rollback;
