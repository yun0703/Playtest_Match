begin;

alter table public.pt_moderation
 add column actor_name text,
 add column before_status text,
 add column after_status text;

do $migration$
declare
 snapshot_sql text=pg_get_functiondef('public.pt_snapshot()'::regprocedure);
 command_sql text=pg_get_functiondef('public.pt_command(text,jsonb)'::regprocedure);
 legacy_log text=$old$(select jsonb_agg(jsonb_build_object('title',x.doc->>'title','date',m.created_at::date,'action',m.action,'note',m.note) order by m.created_at desc) from pt_moderation m join pt_tests x on x.id=m.test_id)$old$;
 legacy_auto text=$old$if (select count(*) from pt_reports where test_id=tid and status='open')>=3 then update pt_tests set prior_status=status,status='hidden',hidden_by='auto',reason='신고 3건 누적으로 임시 숨김 처리되었습니다.' where id=tid;end if;$old$;
 legacy_record text=$old$insert into pt_moderation(admin_id,test_id,action,note) values(u,tid,action,note);$old$;
 note_anchor text=$old$  note=coalesce(payload->>'note','');
  if action='dismiss' then$old$;
begin
 if position(legacy_log in snapshot_sql)=0 or position(legacy_auto in command_sql)=0
    or position(legacy_record in command_sql)=0 or position(note_anchor in command_sql)=0 then
  raise exception 'Expected moderation logic was not found';
 end if;
 snapshot_sql=replace(snapshot_sql,legacy_log,$new$(
  select jsonb_agg(jsonb_build_object(
   'testId',m.test_id,'title',x.doc->>'title','date',m.created_at,
   'action',m.action,'note',m.note,'actor',coalesce(m.actor_name,p.nickname),
   'beforeStatus',m.before_status,'afterStatus',m.after_status
  ) order by m.created_at desc,m.id desc)
  from pt_moderation m join pt_tests x on x.id=m.test_id
  left join pt_profiles p on p.id=m.admin_id
 )$new$);
 command_sql=replace(command_sql,legacy_auto,$new$
  if (select count(*) from pt_reports where test_id=tid and status='open')>=3 then
   update pt_tests set prior_status=status,status='hidden',hidden_by='auto',
    reason='신고 3건 누적으로 임시 숨김 처리되었습니다.' where id=tid;
   insert into pt_moderation(test_id,action,note,actor_name,before_status,after_status)
   values(tid,'auto_hide','신고 3건 누적으로 임시 숨김 처리되었습니다.','시스템',t.status,'hidden');
  end if;
 $new$);
 -- Keep legacy callers compatible. The current UI requires a reason for
 -- every manual action, while legacy dismiss/restore requests can omit it.
 command_sql=replace(command_sql,note_anchor,$new$
  note=btrim(coalesce(payload->>'note',''));
  if (note<>'' or action='hide') and length(note) not between 4 and 4000 then
   raise exception '처리 사유를 4~4000자로 입력해 주세요.';
  end if;
  if action='dismiss' then$new$);
 command_sql=replace(command_sql,legacy_record,$new$
  insert into pt_moderation(admin_id,test_id,action,note,actor_name,before_status,after_status)
  values(u,tid,action,note,coalesce((select nickname from pt_profiles where id=u),'운영자'),
    t.status,(select status from pt_tests where id=tid));
 $new$);
 execute snapshot_sql;
 execute command_sql;
end $migration$;
commit;
