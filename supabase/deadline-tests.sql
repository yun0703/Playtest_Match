-- Rollback-only tests of mandatory deadlines and the immutable two-month window.
begin;
do $$
declare owner_uid uuid=gen_random_uuid();tid text;draft jsonb;snapshot jsonb;failed boolean;cap date;today date=(now() at time zone 'Asia/Seoul')::date;missing jsonb;
begin
 insert into auth.users(id,aud,role) values(owner_uid,'authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',owner_uid::text,true);
 cap=(today+interval '2 months')::date;
 draft=jsonb_build_object('title','Deadline rollback QA','team','QA','teaser','Rollback-only deadline verification.','feedbackFocus','Check mandatory deadlines and the two-calendar-month window.','genre','퍼즐','platform','WebGL','build','v1','minutes',15,'slots',1,'vis','public','deadline',cap::text,'link','https://example.com/build','how','Play this test and provide your feedback.','survey','[{"id":"q1","label":"Rating","type":"scale","required":true,"options":[]}]'::jsonb,'media','[]'::jsonb);
 for missing in select value from jsonb_array_elements('["",null]'::jsonb) loop
  failed=false;begin perform pt_command('save_test',jsonb_build_object('data',draft||jsonb_build_object('deadline',missing)));exception when others then failed=true;end;if not failed then raise exception 'FAIL bounded missing deadline';end if;
  failed=false;begin perform pt_command('save_test',jsonb_build_object('data',draft||jsonb_build_object('deadline',missing,'slots',null)));exception when others then failed=true;end;if not failed then raise exception 'FAIL unlimited missing deadline';end if;
 end loop;
 failed=false;begin perform pt_command('save_test',jsonb_build_object('data',draft-'deadline'));exception when others then failed=true;end;if not failed then raise exception 'FAIL omitted deadline';end if;
 failed=false;begin perform pt_command('save_test',jsonb_build_object('data',draft||jsonb_build_object('deadline',(cap+1)::text)));exception when others then failed=true;end;if not failed then raise exception 'FAIL over two months';end if;
 failed=false;begin perform pt_command('save_test',jsonb_build_object('data',draft||jsonb_build_object('deadline',(today-1)::text)));exception when others then failed=true;end;if not failed then raise exception 'FAIL new past deadline';end if;
 snapshot=pt_command('save_test',jsonb_build_object('data',draft));
 select id into tid from pt_tests where owner_id=owner_uid;
 if not exists(select 1 from jsonb_array_elements(snapshot->'tests') t where t->>'id'=tid and t->>'createdDate'=today::text and t->>'deadline'=cap::text) then raise exception 'FAIL registration date snapshot';end if;
 -- Simulate yesterday's first publication; editing today must not reset the clock.
 update pt_tests set deadline=today,created_at=created_at-interval '1 day' where id=tid;
 select ((created_at at time zone 'Asia/Seoul')::date+interval '2 months')::date into cap from pt_tests where id=tid;
 perform pt_command('save_test',jsonb_build_object('testId',tid,'data',draft||jsonb_build_object('deadline',cap::text)));
 failed=false;begin perform pt_command('save_test',jsonb_build_object('testId',tid,'data',draft||jsonb_build_object('deadline',(cap+1)::text,'createdDate',today::text)));exception when others then failed=true;end;if not failed then raise exception 'FAIL edit extension or client registration spoof';end if;
 failed=false;begin update pt_tests set deadline=null where id=tid;exception when others then failed=true;end;if not failed then raise exception 'FAIL database not-null';end if;
 failed=false;begin update pt_tests set deadline=cap+1 where id=tid;exception when others then failed=true;end;if not failed then raise exception 'FAIL database upper bound';end if;
 update pt_tests set deadline=today-1 where id=tid;
 perform pt_command('save_test',jsonb_build_object('testId',tid,'data',draft||jsonb_build_object('deadline',(today-1)::text)));
 if ('2026-12-31'::date+interval '2 months')::date<>'2027-02-28'::date or ('2023-12-31'::date+interval '2 months')::date<>'2024-02-29'::date then raise exception 'FAIL month-end arithmetic';end if;
end $$;
select 'PASS: required bounded/unlimited dates, exact two-month boundary, immutable registration on edit, database constraints, archived edit, leap-year/month-end' as result;
rollback;
