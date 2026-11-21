-- All members can participate and publish. No developer/tester role switch.
create or replace function public.pt_sync_profile() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid=auth.uid();metadata jsonb;nickname text;
begin
 if u is null then raise exception '로그인이 필요합니다.' using errcode='42501';end if;
 select raw_user_meta_data into metadata from auth.users where id=u;
 nickname=left(coalesce(nullif(trim(metadata->>'nickname'),''),nullif(trim(metadata->>'preferred_username'),''),nullif(trim(metadata->>'full_name'),''),nullif(trim(metadata->>'name'),''),'플레이어'),40);
 insert into public.pt_profiles as p values(u,nickname)
 on conflict(id) do update set nickname=case when p.nickname='플레이어' then excluded.nickname else p.nickname end;
 return public.pt_snapshot();
end $$;
revoke execute on function public.pt_sync_profile() from public,anon;
grant execute on function public.pt_sync_profile() to authenticated;
