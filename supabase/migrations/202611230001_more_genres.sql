-- Expand only the genre validation, preserving the deployed command and grants.
begin;
do $migration$
declare definition text; old_rule text := $old$coalesce(d->>'genre','') not in ('퍼즐','로그라이크','플랫포머','어드벤처','시뮬레이션','액션')$old$; new_rule text := $new$coalesce(d->>'genre','') not in ('퍼즐','로그라이크','플랫포머','어드벤처','시뮬레이션','액션','RPG','전략','생존','공포','슈팅','리듬','스포츠','레이싱','비주얼 노벨')$new$;
begin
 definition := pg_get_functiondef('public.pt_command(text,jsonb)'::regprocedure);
 if position(new_rule in definition)>0 then return; end if;
 if position(old_rule in definition)=0 then raise exception 'Unexpected pt_command genre validation; no change applied.'; end if;
 execute replace(definition,old_rule,new_rule);
end $migration$;
commit;
