-- Synthetic users and games. All test records roll back.
begin;
do $test$
declare
 operator uuid=gen_random_uuid();
 developer uuid=gen_random_uuid();
 reporter uuid=gen_random_uuid();
 extra_reporter uuid=gen_random_uuid();
 game_id text=gen_random_uuid()::text;
 req jsonb=jsonb_build_object('testId',game_id,'reason','부적절한 내용','detail','Synthetic moderation QA');
 logs jsonb;
begin
 insert into auth.users(id,aud,role) values(operator,'authenticated','authenticated'),(developer,'authenticated','authenticated'),(reporter,'authenticated','authenticated'),(extra_reporter,'authenticated','authenticated');
 insert into pt_profiles(id,nickname) values(operator,'QA Moderator');
 insert into pt_admins(id) values(operator);
 insert into pt_tests(id,owner_id,doc,slots,visibility,deadline)
 values(game_id,developer,'{"title":"Moderation History QA","media":[]}',2,'public',current_date+2);

 perform set_config('request.jwt.claim.sub',operator::text,true);perform pt_command('report',req);
 perform set_config('request.jwt.claim.sub',extra_reporter::text,true);perform pt_command('report',req);
 perform set_config('request.jwt.claim.sub',reporter::text,true);perform pt_command('report',req);
 if pt_snapshot()->'log' is distinct from '[]'::jsonb then raise exception 'Moderator history exposed to member';end if;

 perform set_config('request.jwt.claim.sub',operator::text,true);
 perform pt_command('dismiss',jsonb_build_object('testId',game_id,'note','QA review completed'));
 logs=pt_snapshot()->'log';
 if not exists(select 1 from jsonb_array_elements(logs) l where l->>'testId'=game_id and l->>'action'='auto_hide' and l->>'actor'='시스템' and l->>'beforeStatus'='open' and l->>'afterStatus'='hidden')
 or not exists(select 1 from jsonb_array_elements(logs) l where l->>'testId'=game_id and l->>'action'='dismiss' and l->>'actor'='QA Moderator' and l->>'note'='QA review completed' and l->>'beforeStatus'='hidden' and l->>'afterStatus'='open') then raise exception 'Moderation history missing or incomplete';end if;
end $test$;
rollback;
select 'PASS: moderator history access, reason, and status transitions' as result;
