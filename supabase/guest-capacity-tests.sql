-- Anonymous participation requires a fixed capacity. Rolled back.
begin;
do $test$
declare
 owner_id uuid=gen_random_uuid();
 game_id text;
 result jsonb;
 base jsonb=jsonb_build_object(
  'title','Guest cap QA','team','Fixture','platform','WebGL','genre','퍼즐',
  'teaser','A synthetic public playtest','feedbackFocus','Check whether instructions are clear.',
  'build','v1','minutes',10,'vis','public',
  'deadline',((now() at time zone 'Asia/Seoul')::date+1)::text,
  'link','https://example.com/game','how','Open the test build.',
  'survey','[{"id":"goal","label":"Was it clear?","type":"scale","required":true}]'::jsonb,
  'media','[]'::jsonb);
begin
 insert into auth.users(id,aud,role) values(owner_id,'authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 begin
  perform pt_command('save_test',jsonb_build_object('data',base||'{"slots":null,"allowGuests":true}'));
  raise exception 'FAIL unlimited game accepted anonymous players' using errcode='XX000';
 exception when sqlstate 'P0001' then null;
 end;
 result=pt_command('save_test',jsonb_build_object('data',base||'{"slots":4,"allowGuests":true}'));
 select value->>'id' into game_id from jsonb_array_elements(result->'tests') where value->>'title'='Guest cap QA';
 -- A limited game keeps working for guests.
 perform set_config('request.jwt.claim.sub','',true);
 perform pt_guest_playtest('join',game_id,null,'{"agreed":true}');
 -- If capacity is later removed directly, guests are refused.
 update pt_tests set slots=null where id=game_id;
 begin
  perform pt_guest_playtest('join',game_id,null,'{"agreed":true}');
  raise exception 'FAIL guest joined an unlimited game' using errcode='XX000';
 exception when sqlstate 'PT410' then null;
 end;
end $test$;
rollback;
