begin;

-- Anonymous participation needs a fixed number of places. With unlimited capacity
-- there is no ceiling on anonymous survey responses, so fake answers could pile up
-- without bound. Developers must set a capacity to accept anonymous players.

do $migration$
declare
 command_sql text=replace(pg_get_functiondef('public.pt_command(text,jsonb)'::regprocedure),chr(13)||chr(10),chr(10));
 guest_sql text=replace(pg_get_functiondef('public.pt_guest_playtest(text,text,uuid,jsonb)'::regprocedure),chr(13)||chr(10),chr(10));
 old_allow text=$old$     and d->>'vis'='public' and d->>'platform'='WebGL' then$old$;
 old_error text=$old$   raise exception '공개 WebGL 게임에서만 익명 테스트를 허용할 수 있습니다.';$old$;
 old_gate text=$old$    or game.deadline is null or game.deadline<(stamp at time zone 'Asia/Seoul')::date$old$;
begin
 if position(old_allow in command_sql)=0 or position(old_error in command_sql)=0 or position(old_gate in guest_sql)=0 then
  raise exception 'Expected anonymous participation logic was not found';
 end if;
 command_sql=replace(command_sql,old_allow,$new$     and d->>'vis'='public' and d->>'platform'='WebGL' and jsonb_typeof(d->'slots')='number' then$new$);
 command_sql=replace(command_sql,old_error,$new$   raise exception '익명 테스트는 모집 인원을 정한 공개 WebGL 게임에서만 허용할 수 있습니다.';$new$);
 guest_sql=replace(guest_sql,old_gate,old_gate||$new$
    or game.slots is null$new$);
 execute command_sql;
 execute guest_sql;
end $migration$;

-- Existing unlimited games stop accepting anonymous players.
update public.pt_tests set doc=doc-'allowGuests' where slots is null and doc ? 'allowGuests';

commit;
