-- Synthetic identities only; every statement and auth session is rolled back.
begin;
do $$
declare dev uuid=gen_random_uuid();tester uuid=gen_random_uuid();outsider uuid=gen_random_uuid();sid uuid=gen_random_uuid();tid text;other_id text;bid text;draft jsonb;snapshot jsonb;preview jsonb;failed boolean;path text;name_before text;
begin
 insert into auth.users(id,aud,role,raw_user_meta_data) values(dev,'authenticated','authenticated','{"nickname":"QA developer"}'),(tester,'authenticated','authenticated','{"nickname":"QA tester"}'),(outsider,'authenticated','authenticated','{"nickname":"QA outsider"}');
 insert into auth.sessions(id,user_id,created_at,updated_at) values(sid,dev,now()-interval '1 hour',now());
 perform set_config('request.jwt.claim.sub',dev::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',dev,'role','authenticated','session_id',sid)::text,true);
 draft=jsonb_build_object('title','Lifecycle rollback QA','team','QA','teaser','Rollback-only full workflow verification.','feedbackFocus','Verify application, cancellation, feedback and account lifecycle.','genre','퍼즐','platform','WebGL','build','v1','minutes',15,'slots',1,'vis','approval','deadline',((now() at time zone 'Asia/Seoul')::date+1)::text,'link','https://example.com/private-build','how','Private instructions for the approved QA participant.','survey','[{"id":"q1","label":"Rating","type":"scale","required":true,"options":[]}]'::jsonb,'media','[]'::jsonb);
 perform pt_command('save_test',jsonb_build_object('data',draft));select id into tid from pt_tests where owner_id=dev;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 snapshot=pt_snapshot();if exists(select 1 from jsonb_array_elements(snapshot->'tests') t where t->>'id'=tid and (t->>'link'<>'' or jsonb_array_length(t->'survey')<>0)) then raise exception 'FAIL anonymous private access';end if;
 perform set_config('request.jwt.claim.sub',tester::text,true);
 snapshot=pt_command('apply',jsonb_build_object('testId',tid,'agreed',true));if snapshot->'mine'->tid->>'status'<>'waiting' then raise exception 'FAIL wait for approval';end if;
 snapshot=pt_command('cancel_application',jsonb_build_object('testId',tid,'testerId',outsider));if snapshot->'mine' ? tid or not exists(select 1 from pt_applications where test_id=tid and tester_id=tester and status='cancelled') then raise exception 'FAIL waiting cancellation';end if;
 perform pt_command('apply',jsonb_build_object('testId',tid,'agreed',true));
 perform set_config('request.jwt.claim.sub',dev::text,true);
 perform pt_command('review_application',jsonb_build_object('testId',tid,'testerId',tester,'decision','approve'));
 perform set_config('request.jwt.claim.sub',tester::text,true);
 snapshot=pt_snapshot();if not exists(select 1 from jsonb_array_elements(snapshot->'tests') t where t->>'id'=tid and t->>'link'='https://example.com/private-build') then raise exception 'FAIL approved build';end if;
 snapshot=pt_command('cancel_application',jsonb_build_object('testId',tid));
 if (select count(*) from pt_applications where test_id=tid and status in ('applied','done'))<>0 or exists(select 1 from jsonb_array_elements(snapshot->'tests') t where t->>'id'=tid and t->>'link'<>'') then raise exception 'FAIL seat or access after cancel';end if;
 perform pt_command('apply',jsonb_build_object('testId',tid,'agreed',true));
 perform set_config('request.jwt.claim.sub',dev::text,true);perform pt_command('review_application',jsonb_build_object('testId',tid,'testerId',tester,'decision','approve'));
 perform set_config('request.jwt.claim.sub',tester::text,true);perform pt_command('start_play',jsonb_build_object('testId',tid));
 snapshot=pt_command('bug',jsonb_build_object('testId',tid,'data',jsonb_build_object('title','QA movement issue','description','Movement stops after opening the QA settings.','steps','Start then open the settings screen.','device','QA browser','severity','normal','attachments','[]'::jsonb)));
 select id into bid from pt_bugs where test_id=tid;
 snapshot=pt_command('feedback',jsonb_build_object('testId',tid,'answers','{"q1":4}'::jsonb,'issueStatus','reported','bugIds',jsonb_build_array(bid)));
 if snapshot->'mine'->tid->>'status'<>'done' then raise exception 'FAIL feedback completion';end if;
 failed=false;begin perform pt_command('cancel_application',jsonb_build_object('testId',tid));exception when others then failed=true;end;if not failed then raise exception 'FAIL completed cancellation';end if;
 perform set_config('request.jwt.claim.sub',dev::text,true);perform pt_command('bug_status',jsonb_build_object('bugId',bid,'status','fixed','note','Fixed in QA v2'));
 snapshot=pt_update_profile(' New QA developer ');if snapshot->'viewer'->>'nickname'<>'New QA developer' then raise exception 'FAIL profile update';end if;
 snapshot=pt_sync_profile();if snapshot->'viewer'->>'nickname'<>'New QA developer' then raise exception 'FAIL profile persistence';end if;
 failed=false;begin perform pt_update_profile('   ');exception when others then failed=true;end;if not failed then raise exception 'FAIL empty nickname';end if;
 perform set_config('request.jwt.claim.sub',tester::text,true);snapshot=pt_snapshot();if not exists(select 1 from jsonb_array_elements(snapshot->'notifications') n where n->>'bugId'=bid and n->>'status'='fixed') then raise exception 'FAIL issue notification';end if;
 perform pt_command('save_test',jsonb_build_object('data',draft||'{"vis":"public","title":"Other developer retained game"}'::jsonb));select id into other_id from pt_tests where owner_id=tester;
 perform set_config('request.jwt.claim.sub',dev::text,true);perform pt_command('apply',jsonb_build_object('testId',other_id,'agreed',true));perform pt_command('feedback',jsonb_build_object('testId',other_id,'answers','{"q1":3}'::jsonb,'issueStatus','none'));
 preview=pt_account_delete_preview();if (preview->>'games')::int<>1 or (preview->>'feedback')::int<>1 then raise exception 'FAIL deletion preview';end if;
 failed=false;begin perform pt_begin_account_delete('wrong');exception when others then failed=true;end;if not failed then raise exception 'FAIL deletion confirmation';end if;
 failed=false;begin perform pt_begin_account_delete('탈퇴');exception when others then failed=true;end;if not failed then raise exception 'FAIL stale login deletion';end if;
 update auth.sessions set created_at=now() where id=sid;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',dev,'role','authenticated','session_id',sid)::text,true);
 -- Subtransaction exercises pending-file protection without creating/deleting physical blobs.
 begin
  path='game/'||dev::text||'/qa.png';
  insert into storage.objects(bucket_id,name,owner_id,metadata) values('playtest-media',path,dev::text,'{"mimetype":"image/png","size":10}');
  preview=pt_begin_account_delete('탈퇴');if not(preview->'files' @> jsonb_build_array(path)) or not pt_pending_delete_file(path) or pt_active_member() then raise exception 'FAIL scoped pending-file cleanup';end if;
  failed=false;begin perform pt_finish_account_delete();exception when others then failed=true;end;if not failed then raise exception 'FAIL finalize with files remaining';end if;
  raise exception using errcode='P0999',message='rollback synthetic file fixture';
 exception when sqlstate 'P0999' then null;
 end;
 perform pt_begin_account_delete('탈퇴');
 failed=false;begin perform pt_update_profile('Blocked');exception when others then failed=true;end;if not failed then raise exception 'FAIL pending profile mutation';end if;
 failed=false;begin perform pt_command('save_test',jsonb_build_object('data',draft));exception when others then failed=true;end;if not failed then raise exception 'FAIL pending game mutation';end if;
 perform pt_begin_account_delete('탈퇴'); -- Retry is idempotent.
 perform pt_finish_account_delete();
 if exists(select 1 from auth.users where id=dev) or exists(select 1 from auth.sessions where user_id=dev) or exists(select 1 from pt_tests where id=tid) or exists(select 1 from pt_applications where tester_id=dev) or exists(select 1 from pt_feedback where tester_id=dev) or exists(select 1 from pt_bugs where test_id=tid) or pt_active_member() then raise exception 'FAIL deletion cleanup or stale token access';end if;
 if not exists(select 1 from auth.users where id=tester) or not exists(select 1 from pt_tests where id=other_id) then raise exception 'FAIL unrelated account data removed';end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 failed=false;begin perform pt_finish_account_delete();exception when others then failed=true;end;if not failed then raise exception 'FAIL unrelated deletion';end if;
 if has_function_privilege('anon','public.pt_update_profile(text)','execute') or has_function_privilege('anon','public.pt_begin_account_delete(text)','execute') or has_table_privilege('authenticated','public.pt_account_deletions','select') then raise exception 'FAIL lifecycle access grants';end if;
end $$;
select 'PASS: two-member full workflow, cancellation and reapply, seat/private access revocation, linked bug feedback, profile, recent-login deletion, file cleanup guard, retry, stale token isolation, unrelated data retained' as result;
rollback;
