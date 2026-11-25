begin;

-- The notification and the approval commit together. Repeated approval
-- requests cannot create duplicates because only waiting → applied fires.
create function public.pt_notify_application_approved() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into pt_notifications(user_id,doc)
 values(new.tester_id,jsonb_build_object(
  'type','approval',
  'testId',new.test_id,
  'gameTitle',(select doc->>'title' from pt_tests where id=new.test_id),
  'title','참여가 승인됐어요',
  'date',now()
 ));
 return new;
end $$;
revoke execute on function public.pt_notify_application_approved() from public,anon,authenticated;

create trigger pt_application_approved
after update of status on public.pt_applications
for each row when (old.status='waiting' and new.status='applied')
execute function public.pt_notify_application_approved();

commit;
