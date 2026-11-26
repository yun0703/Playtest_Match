-- The fixture is rolled back, including the anonymous submissions.
begin;
do $test$
declare
 owner_id uuid=gen_random_uuid();
 member_id uuid=gen_random_uuid();
 game_id text;
 other_game text;
 guest_id uuid;
 other_guest uuid;
 result jsonb;
 public_game jsonb;
 bug_id text;
 save_data jsonb=jsonb_build_object(
  'title','Guest QA','team','Fixture','platform','WebGL','genre','퍼즐',
  'teaser','A synthetic public playtest','feedbackFocus','Check whether instructions are clear.',
  'build','v1','minutes',10,'vis','public','slots',3,
  'deadline',((now() at time zone 'Asia/Seoul')::date+1)::text,
  'link','https://example.com/game','how','Open the test build.',
  'survey','[{"id":"goal","label":"Was it clear?","type":"scale","required":true}]'::jsonb,
  'media','[]'::jsonb);
 bug_payload jsonb='{"data":{"title":"Test bug","description":"Button does not respond.","steps":"Open menu","device":"Browser","severity":"normal","build":"v1"}}';
begin
 insert into auth.users(id,aud,role) values(owner_id,'authenticated','authenticated'),(member_id,'authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 result=pt_command('save_test',jsonb_build_object('data',save_data||'{"allowGuests":true}'));
 select value->>'id' into game_id from jsonb_array_elements(result->'tests') where value->>'title'='Guest QA';
 begin
  perform pt_command('save_test',jsonb_build_object('testId',game_id,'data',save_data||'{"allowGuests":true,"vis":"approval"}'));
  raise exception 'An approval-only game accepted anonymous access' using errcode='XX000';
 exception when sqlstate 'P0001' then null;
 end;
 result=pt_command('save_test',jsonb_build_object('data',save_data||'{"title":"Guest QA other","allowGuests":true}'));
 select value->>'id' into other_game from jsonb_array_elements(result->'tests') where value->>'title'='Guest QA other';

 perform set_config('request.jwt.claim.sub','',true);
 if not has_function_privilege('anon','public.pt_guest_playtest(text,text,uuid,jsonb)','execute')
    or has_function_privilege('authenticated','public.pt_guest_playtest(text,text,uuid,jsonb)','execute')
    or has_table_privilege('anon','public.pt_guest_participants','select') then
  raise exception 'Incorrect guest grants';
 end if;
 select value into public_game from jsonb_array_elements(pt_snapshot()->'tests') where value->>'id'=game_id;
 if public_game->'allowGuests' is distinct from 'true'::jsonb or public_game->>'link' is distinct from ''
    or public_game->'survey' is distinct from '[]'::jsonb then raise exception 'Catalog access boundary failed'; end if;
 begin
  perform pt_guest_playtest('join',game_id,null,'{"agreed":false}');
  raise exception 'Guest joined without consent' using errcode='XX000';
 exception when sqlstate 'P0001' then null;
 end;
 result=pt_guest_playtest('join',game_id,null,'{"agreed":true}');
 guest_id=(result->>'participantId')::uuid;
 if guest_id is null or result->>'link' is distinct from 'https://example.com/game' or result->>'applicants' is distinct from '1' then
  raise exception 'Anonymous join failed';
 end if;
 result=pt_guest_playtest('join',game_id,guest_id,'{"agreed":true}');
 if result->>'participantId' is distinct from guest_id::text then raise exception 'Anonymous join issued a second ID'; end if;
 begin
  perform pt_guest_playtest('view',other_game,guest_id);
  raise exception 'Token worked for another game';
 exception when sqlstate 'PT410' then null;
 end;
 result=pt_guest_playtest('join',game_id,null,'{"agreed":true}');
 other_guest=(result->>'participantId')::uuid;
 -- Anonymous participants may hold at most half of the places (2 of 3).
 begin
  perform pt_guest_playtest('join',game_id,null,'{"agreed":true}');
  raise exception 'Anonymous participation exceeded its share' using errcode='XX000';
 exception when sqlstate 'PT429' then null;
 end;
 perform set_config('request.jwt.claim.sub',member_id::text,true);
 perform pt_command('apply',jsonb_build_object('testId',game_id,'agreed',true));
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform pt_guest_playtest('join',game_id,null,'{"agreed":true}');
  raise exception 'Anonymous participation exceeded capacity' using errcode='XX000';
 exception when sqlstate 'P0001' then null;
 end;
 update pt_guest_participants set expires_at=now()-interval '1 second' where id=other_guest;
 if pt_recruitment_count(game_id)<>2 then raise exception 'Expired session did not release its seat'; end if;

 begin
  perform pt_guest_playtest('bug',game_id,guest_id,jsonb_set(bug_payload,'{data,attachments}','[{"id":"external"}]'));
  raise exception 'Anonymous attachment accepted' using errcode='XX000';
 exception when sqlstate 'P0001' then null;
 end;
 for i in 1..3 loop
  result=pt_guest_playtest('bug',game_id,guest_id,bug_payload);
  bug_id=result->>'newBugId';
 end loop;
 begin
  perform pt_guest_playtest('bug',game_id,guest_id,bug_payload);
  raise exception 'Fourth bug was accepted';
 exception when sqlstate 'PT429' then null;
 end;
 begin
  perform pt_guest_playtest('feedback',game_id,guest_id,'{"answers":{"goal":"wrong"},"issueStatus":"none"}');
  raise exception 'Invalid survey answer was accepted' using errcode='XX000';
 exception when sqlstate 'P0001' then null;
 end;
 result=pt_guest_playtest('feedback',game_id,guest_id,jsonb_build_object(
  'answers','{"goal":5}'::jsonb,'issueStatus','reported','bugIds',jsonb_build_array(bug_id)));
 if result->'submitted' is distinct from 'true'::jsonb then raise exception 'Anonymous survey failed'; end if;
 begin
  perform pt_guest_playtest('feedback',game_id,guest_id,'{"answers":{"goal":5},"issueStatus":"none"}');
  raise exception 'Duplicate anonymous feedback was accepted';
 exception when sqlstate 'PT409' then null;
 end;
 result=pt_guest_playtest('join',game_id,other_guest,'{"agreed":true}');
 if result->'bugs' is distinct from '[]'::jsonb then raise exception 'Another guest saw private reports'; end if;
 begin
  perform pt_guest_playtest('feedback',game_id,other_guest,jsonb_build_object(
   'answers','{"goal":5}'::jsonb,'issueStatus','reported','bugIds',jsonb_build_array(bug_id)));
  raise exception 'Another guest linked a private report' using errcode='XX000';
 exception when sqlstate 'P0001' then null;
 end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 result=pt_command('bug_status',jsonb_build_object('bugId',bug_id,'status','fixed','note','Fixed in the next build'));
 select value into public_game from jsonb_array_elements(result->'tests') where value->>'id'=game_id;
 if public_game->'feedbacks'->0->'anonymous' is distinct from 'true'::jsonb
    or not exists(select 1 from jsonb_array_elements(result->'bugs') where value->>'id'=bug_id and value->>'status'='fixed')
    or position(guest_id::text in result::text)>0
    or exists(select 1 from pt_notifications where doc->>'bugId'=bug_id) then
  raise exception 'Developer results or participant credential isolation failed';
 end if;
 perform pt_command('save_test',jsonb_build_object('testId',game_id,'data',save_data||'{"allowGuests":false}'));
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform pt_guest_playtest('view',game_id,guest_id);
  raise exception 'Disabled game exposed the build';
 exception when sqlstate 'PT410' then null;
 end;
 update pt_tests set deadline=(now() at time zone 'Asia/Seoul')::date-1 where id=other_game;
 begin
  perform pt_guest_playtest('join',other_game,null,'{"agreed":true}');
  raise exception 'Expired recruitment accepted a guest';
 exception when sqlstate 'PT410' then null;
 end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform pt_begin_game_delete(game_id);
 perform pt_command('delete_game',jsonb_build_object('testId',game_id));
 if exists(select 1 from pt_guest_participants where test_id=game_id) then raise exception 'Game deletion left guest IDs'; end if;
end $test$;
rollback;
select 'PASS: guest opt-in, consent, credential isolation, capacity, expiry, survey uniqueness, and bug rate limit' as result;
