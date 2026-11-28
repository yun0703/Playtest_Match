-- Invite-code guessing limits and anonymous participation limits.
-- Every fixture row is rolled back.
begin;
do $test$
declare
 owner_id uuid=gen_random_uuid();
 member_id uuid=gen_random_uuid();
 other_member uuid=gen_random_uuid();
 invite_game text;
 small_game text;
 open_game text;
 result jsonb;
 guests uuid[]='{}';
 i int;
 base jsonb=jsonb_build_object(
  'title','Limit QA','team','Fixture','platform','WebGL','genre','퍼즐',
  'teaser','A synthetic limit playtest','feedbackFocus','Check whether instructions are clear.',
  'build','v1','minutes',10,'slots',10,
  'deadline',((now() at time zone 'Asia/Seoul')::date+1)::text,
  'link','https://example.com/game','how','Open the test build.',
  'survey','[{"id":"goal","label":"Was it clear?","type":"scale","required":true}]'::jsonb,
  'media','[]'::jsonb);
begin
 insert into auth.users(id,aud,role) values(owner_id,'authenticated','authenticated'),
  (member_id,'authenticated','authenticated'),(other_member,'authenticated','authenticated');
 if has_table_privilege('authenticated','public.pt_invite_attempts','select')
    or has_table_privilege('anon','public.pt_invite_attempts','select') then
  raise exception 'FAIL invite attempts are readable';
 end if;

 -- Invite codes need 8-12 characters.
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 begin
  perform pt_command('save_test',jsonb_build_object('data',base||'{"title":"Invite QA","vis":"invite","code":"SHORT12"}'));
  raise exception 'FAIL a 7-character invite code was accepted' using errcode='XX000';
 exception when sqlstate 'P0001' then null;
 end;
 result=pt_command('save_test',jsonb_build_object('data',base||'{"title":"Invite QA","vis":"invite","code":"LONGCODE8"}'));
 select value->>'id' into invite_game from jsonb_array_elements(result->'tests') where value->>'title'='Invite QA';

 -- A wrong guess is reported and recorded; the sixth try within 15 minutes is refused.
 perform set_config('request.jwt.claim.sub',member_id::text,true);
 for i in 1..5 loop
  result=pt_command('apply',jsonb_build_object('testId',invite_game,'agreed',true,'code','WRONG'||i||'XYZ'));
  if result->>'commandError' is null then raise exception 'FAIL wrong code did not report an error'; end if;
 end loop;
 if (select count(*) from pt_invite_attempts where user_id=member_id)<>5 then raise exception 'FAIL attempts were not recorded'; end if;
 if exists(select 1 from pt_applications where test_id=invite_game and tester_id=member_id) then raise exception 'FAIL wrong code enrolled'; end if;
 begin
  perform pt_command('apply',jsonb_build_object('testId',invite_game,'agreed',true,'code','LONGCODE8'));
  raise exception 'FAIL guessing limit was not enforced' using errcode='XX000';
 exception when sqlstate 'PT429' then null;
 end;
 -- Another member is unaffected and the right code still works.
 perform set_config('request.jwt.claim.sub',other_member::text,true);
 result=pt_command('apply',jsonb_build_object('testId',invite_game,'agreed',true,'code','longcode8'));
 if result ? 'commandError' or not exists(select 1 from pt_applications where test_id=invite_game and tester_id=other_member and status='applied') then
  raise exception 'FAIL correct invite code was refused';
 end if;

 -- Limited game (4 places): guests may hold 2; only 2 may be unsubmitted at once.
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 result=pt_command('save_test',jsonb_build_object('data',base||'{"title":"Small QA","vis":"public","slots":4,"allowGuests":true}'));
 select value->>'id' into small_game from jsonb_array_elements(result->'tests') where value->>'title'='Small QA';
 result=pt_command('save_test',jsonb_build_object('data',base||'{"title":"Open QA","vis":"public","slots":50,"allowGuests":true}'));
 select value->>'id' into open_game from jsonb_array_elements(result->'tests') where value->>'title'='Open QA';

 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.headers','{}',true);
 guests=guests||(pt_guest_playtest('join',small_game,null,'{"agreed":true}')->>'participantId')::uuid;
 guests=guests||(pt_guest_playtest('join',small_game,null,'{"agreed":true}')->>'participantId')::uuid;
 begin
  perform pt_guest_playtest('join',small_game,null,'{"agreed":true}');
  raise exception 'FAIL guests took more than half of the places' using errcode='XX000';
 exception when sqlstate 'PT429' then null;
 end;
 perform set_config('request.jwt.claim.sub',member_id::text,true);
 perform pt_command('apply',jsonb_build_object('testId',small_game,'agreed',true));
 perform set_config('request.jwt.claim.sub',other_member::text,true);
 perform pt_command('apply',jsonb_build_object('testId',small_game,'agreed',true));
 if pt_recruitment_count(small_game)<>4 then raise exception 'FAIL members could not use the reserved places'; end if;

 -- Large game (50 places): at most 10 unsubmitted guests, and 5 new IDs per client per hour.
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.headers','{"cf-connecting-ip":"203.0.113.9"}',true);
 for i in 1..5 loop perform pt_guest_playtest('join',open_game,null,'{"agreed":true}'); end loop;
 if exists(select 1 from pt_guest_participants where test_id=open_game and client_key is null) then
  raise exception 'FAIL client key was not stored';
 end if;
 begin
  perform pt_guest_playtest('join',open_game,null,'{"agreed":true}');
  raise exception 'FAIL one client minted unlimited participant IDs' using errcode='XX000';
 exception when sqlstate 'PT429' then null;
 end;
 perform set_config('request.headers','{"cf-connecting-ip":"198.51.100.7"}',true);
 for i in 1..5 loop perform pt_guest_playtest('join',open_game,null,'{"agreed":true}'); end loop;
 perform set_config('request.headers','{"cf-connecting-ip":"192.0.2.44"}',true);
 begin
  perform pt_guest_playtest('join',open_game,null,'{"agreed":true}');
  raise exception 'FAIL more than 10 unsubmitted guests' using errcode='XX000';
 exception when sqlstate 'PT429' then null;
 end;
 -- Submitting a survey frees an unsubmitted place.
 perform pt_guest_playtest('feedback',open_game,
  (select id from pt_guest_participants where test_id=open_game order by created_at limit 1),
  '{"answers":{"goal":4},"issueStatus":"none","bugIds":[]}');
 perform pt_guest_playtest('join',open_game,null,'{"agreed":true}');
end $test$;
rollback;
