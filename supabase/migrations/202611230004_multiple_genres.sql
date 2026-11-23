begin;
do $migration$
declare
 command_sql text=pg_get_functiondef('public.pt_command(text,jsonb)'::regprocedure);
 updated text;
 genre_validation text=$validation$
  if d ? 'genres' or d ? 'customGenres' then
   if jsonb_typeof(d->'genres') is distinct from 'array'
      or jsonb_typeof(d->'customGenres') is distinct from 'array' then
    raise exception '장르 선택을 확인해 주세요.';
   end if;
   if jsonb_array_length(d->'genres') + jsonb_array_length(d->'customGenres') = 0
      or jsonb_array_length(d->'genres') > 15
      or jsonb_array_length(d->'customGenres') > 5 then
    raise exception '장르 선택을 확인해 주세요.';
   end if;
   if exists(select 1 from jsonb_array_elements(d->'genres') x
             where jsonb_typeof(x)<>'string' or (x#>>'{}') not in ('퍼즐','로그라이크','플랫포머','어드벤처','시뮬레이션','액션','RPG','전략','생존','공포','슈팅','리듬','스포츠','레이싱','비주얼 노벨'))
      or (select count(distinct x) from jsonb_array_elements(d->'genres') x)<>jsonb_array_length(d->'genres') then
    raise exception '기본 장르 선택을 확인해 주세요.';
   end if;
   if exists(select 1 from jsonb_array_elements(d->'customGenres') x
             where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 24
                or (x#>>'{}') <> btrim(x#>>'{}') or (x#>>'{}') ~ '[,[:cntrl:]]'
                or (x#>>'{}') in ('퍼즐','로그라이크','플랫포머','어드벤처','시뮬레이션','액션','RPG','전략','생존','공포','슈팅','리듬','스포츠','레이싱','비주얼 노벨','그 외'))
      or (select count(distinct lower(x)) from jsonb_array_elements_text(d->'customGenres') x)<>jsonb_array_length(d->'customGenres') then
    raise exception '직접 입력한 장르를 확인해 주세요.';
   end if;
   d=jsonb_set(d,'{genre}',to_jsonb(coalesce(d->'genres'->>0,'그 외')));
  elsif coalesce(d->>'genre','') not in ('퍼즐','로그라이크','플랫포머','어드벤처','시뮬레이션','액션','RPG','전략','생존','공포','슈팅','리듬','스포츠','레이싱','비주얼 노벨') then
   raise exception '장르 선택을 확인해 주세요.';
  end if;
$validation$;
 old_genre text=$old$if coalesce(d->>'genre','') not in ('퍼즐','로그라이크','플랫포머','어드벤처','시뮬레이션','액션','RPG','전략','생존','공포','슈팅','리듬','스포츠','레이싱','비주얼 노벨') or coalesce(d->>'platform','')$old$;
 doc_marker text=$doc$'genre',d->>'genre','platform'$doc$;
begin
 if position(old_genre in command_sql)=0 or position(doc_marker in command_sql)=0 then
  raise exception 'Expected game registration logic was not found';
 end if;
 updated=replace(command_sql,old_genre,genre_validation||$new$if coalesce(d->>'platform','')$new$);
 updated=replace(updated,doc_marker,$new$'genre',d->>'genre','genres',coalesce(d->'genres',jsonb_build_array(d->>'genre')),'customGenres',coalesce(d->'customGenres','[]'::jsonb),'platform'$new$);
 execute updated;
end $migration$;
commit;
