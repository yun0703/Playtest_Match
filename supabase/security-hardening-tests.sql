-- Synthetic game, members and notifications. Roll back every change.
begin;
do $test$
declare
 developer uuid=gen_random_uuid();
 tester uuid=gen_random_uuid();
 game_id text=gen_random_uuid()::text;
 own_notice text=gen_random_uuid()::text;
 other_notice text=gen_random_uuid()::text;
 deadline_notice text;
 game jsonb;
begin
 insert into auth.users(id,aud,role)
 values(developer,'authenticated','authenticated'),(tester,'authenticated','authenticated');
 insert into pt_tests(id,owner_id,doc,slots,visibility,deadline)
 values(game_id,developer,'{"title":"Security QA","media":[]}',3,'public',(now() at time zone 'Asia/Seoul')::date+1);
 insert into pt_secrets(test_id,link,how,survey)
 values(game_id,'https://example.com/private','Private instructions','[]');
 insert into pt_applications(test_id,tester_id,status) values(game_id,tester,'applied');
 insert into pt_notifications(id,user_id,doc) values(own_notice,tester,'{}'),(other_notice,developer,'{}');

 perform set_config('request.jwt.claim.sub',tester::text,true);
 select value into game from jsonb_array_elements(pt_snapshot()->'tests') where value->>'id'=game_id;
 if game->>'link' is distinct from 'https://example.com/private' or game->>'owner' is distinct from 'other' then
  raise exception 'Approved access or owner identifier redaction failed';
 end if;
 select concat('deadline:',id,':',deadline,':soon') into deadline_notice from pt_tests where id=game_id;
 perform pt_command('mark_read',jsonb_build_object('ids',jsonb_build_array(own_notice,other_notice,'invented',deadline_notice)));
 if not exists(select 1 from pt_reads where user_id=tester and notification_id=own_notice)
    or not exists(select 1 from pt_reads where user_id=tester and notification_id=deadline_notice)
    or exists(select 1 from pt_reads where user_id=tester and notification_id in (other_notice,'invented')) then
  raise exception 'Notification ownership validation failed';
 end if;

 update pt_tests set status='hidden',reason='Moderator-only reason' where id=game_id;
 select value into game from jsonb_array_elements(pt_snapshot()->'tests') where value->>'id'=game_id;
 if game->>'link' is distinct from '' or game->>'how' is distinct from '' or game->>'reason' is distinct from '' then
  raise exception 'Hidden build or moderation details leaked to a participant';
 end if;
 perform set_config('request.jwt.claim.sub',developer::text,true);
 select value into game from jsonb_array_elements(pt_snapshot()->'tests') where value->>'id'=game_id;
 if game->>'link' is distinct from 'https://example.com/private' or game->>'reason' is distinct from 'Moderator-only reason' then
  raise exception 'Developer access to own hidden game was lost';
 end if;
end $test$;
rollback;
select 'PASS: protected builds and notification ownership' as result;
