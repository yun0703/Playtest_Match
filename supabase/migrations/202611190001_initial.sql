-- PlayTest Match: all mutations run through authenticated transactional RPCs.
-- Public listing data and participation-only build information are separate.
begin;
create table public.pt_profiles(id uuid primary key references auth.users(id) on delete cascade,nickname text not null check(length(nickname) between 1 and 40));
create table public.pt_admins(id uuid primary key references auth.users(id) on delete cascade);
create table public.pt_tests(id text primary key default gen_random_uuid()::text,owner_id uuid not null references auth.users(id),doc jsonb not null,slots int not null check(slots between 1 and 50),visibility text not null check(visibility in ('public','approval','invite')),status text not null default 'open' check(status in ('open','closed','hidden','appeal')),deadline date,reason text,hidden_by text,prior_status text default 'open',created_at timestamptz not null default now());
create table public.pt_secrets(test_id text primary key references public.pt_tests on delete cascade,link text not null,how text not null,survey jsonb not null,invite_code text not null default '');
create table public.pt_applications(test_id text references public.pt_tests on delete cascade,tester_id uuid references auth.users(id),status text not null check(status in ('waiting','applied','declined','done')),agreed_at timestamptz not null default now(),started_at timestamptz,primary key(test_id,tester_id));
create table public.pt_feedback(id uuid primary key default gen_random_uuid(),test_id text references public.pt_tests,tester_id uuid references auth.users(id),doc jsonb not null,created_at timestamptz default now(),unique(test_id,tester_id));
create table public.pt_bugs(id text primary key default gen_random_uuid()::text,test_id text references public.pt_tests,tester_id uuid references auth.users(id),doc jsonb not null,status text not null default 'new' check(status in ('new','review','planned','fixed','unreproduced')),developer_note text not null default '',history jsonb not null default '[]',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.pt_reports(id text primary key default gen_random_uuid()::text,test_id text references public.pt_tests,reporter_id uuid references auth.users(id),reason text not null,detail text not null,status text not null default 'open',created_at timestamptz default now(),unique(test_id,reporter_id));
create table public.pt_notifications(id text primary key default gen_random_uuid()::text,user_id uuid references auth.users(id),doc jsonb not null,created_at timestamptz default now());
create table public.pt_reads(user_id uuid references auth.users(id),notification_id text,primary key(user_id,notification_id));
create table public.pt_moderation(id bigint generated always as identity primary key,admin_id uuid references auth.users(id),test_id text references public.pt_tests,action text,note text,created_at timestamptz default now());
create index pt_app_tester on public.pt_applications(tester_id);
create index pt_bugs_test on public.pt_bugs(test_id);
create index pt_tests_owner on public.pt_tests(owner_id);
create index pt_notifications_user on public.pt_notifications(user_id,created_at desc);
do $$ declare n text;begin foreach n in array array['pt_profiles','pt_admins','pt_tests','pt_secrets','pt_applications','pt_feedback','pt_bugs','pt_reports','pt_notifications','pt_reads','pt_moderation'] loop execute format('alter table public.%I enable row level security',n);execute format('revoke all on table public.%I from anon, authenticated',n);end loop;end $$;

create function public.pt_is_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from pt_admins where id=auth.uid())$$;
create function public.pt_validate_survey(qs jsonb) returns void language plpgsql set search_path=public,pg_temp as $$
declare q jsonb;o jsonb;ids text[]='{}';
begin
 if jsonb_typeof(qs) is distinct from 'array' or jsonb_array_length(qs) not between 1 and 10 then raise exception '설문은 1~10문항이어야 합니다.';end if;
 for q in select value from jsonb_array_elements(qs) loop
  if coalesce(q->>'id','') !~ '^[A-Za-z0-9_-]{1,80}$' or q->>'id'=any(ids) then raise exception '질문 ID가 올바르지 않습니다.';end if;ids=array_append(ids,q->>'id');
  if length(coalesce(q->>'label','')) not between 2 and 80 or coalesce(q->>'type','') not in ('text','scale','choice') or jsonb_typeof(q->'required') is distinct from 'boolean' then raise exception '질문 형식을 확인해 주세요.';end if;
  if q->>'type'='choice' then
   if jsonb_typeof(q->'options') is distinct from 'array' or jsonb_array_length(q->'options') not between 2 and 6 then raise exception '보기는 2~6개가 필요합니다.';end if;
   for o in select value from jsonb_array_elements(q->'options') loop if jsonb_typeof(o)<>'string' or length(o#>>'{}') not between 1 and 200 then raise exception '보기 형식이 올바르지 않습니다.';end if;end loop;
   if (select count(distinct value) from jsonb_array_elements(q->'options'))<>jsonb_array_length(q->'options') then raise exception '중복된 보기는 사용할 수 없습니다.';end if;
  end if;
 end loop;
end $$;
create function public.pt_validate_media(items jsonb,scope text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb;meta jsonb;out_items jsonb='[]';mime text;bytes bigint;images int=0;videos int=0;covers int=0;path text;
begin
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)>7 then raise exception '첨부 파일 개수를 확인해 주세요.';end if;
 for item in select value from jsonb_array_elements(items) loop
  path=item->>'id';
  if split_part(path,'/',1)<>scope or split_part(path,'/',2)<>auth.uid()::text then raise exception '내가 업로드한 파일만 첨부할 수 있습니다.';end if;
  select metadata into meta from storage.objects where bucket_id='playtest-media' and name=path;
  if not found then raise exception '첨부 파일을 저장소에서 찾을 수 없습니다.';end if;
  mime=meta->>'mimetype';bytes=(meta->>'size')::bigint;
  if mime in ('image/jpeg','image/png','image/webp','image/gif') and bytes between 1 and 5242880 then images=images+1;
  elsif scope='game' and mime in ('video/mp4','video/webm') and bytes between 1 and 52428800 then videos=videos+1;
  else raise exception '첨부 형식 또는 용량이 올바르지 않습니다.';end if;
  if coalesce((item->>'cover')::boolean,false) then covers=covers+1;end if;
  out_items=out_items||jsonb_build_array(jsonb_build_object('id',path,'name',left(item->>'name',200),'type',mime,'size',bytes,'kind',case when mime like 'image/%' then 'image' else 'video' end,'cover',coalesce((item->>'cover')::boolean,false)));
 end loop;
 if images>(case when scope='bug' then 1 else 6 end) or videos>1 or covers>1 then raise exception '첨부 파일 개수를 확인해 주세요.';end if;
 return out_items;
end $$;

create function public.pt_snapshot() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u uuid=auth.uid();adm boolean=pt_is_admin();result jsonb;tests jsonb='[]';t pt_tests;sec pt_secrets;allowed boolean;requests jsonb;feedback jsonb;item jsonb;
begin
 for t in select * from pt_tests x where x.status in ('open','closed') or x.owner_id=u or adm or exists(select 1 from pt_applications a where a.test_id=x.id and a.tester_id=u) order by x.created_at loop
  allowed=t.owner_id=u or adm or exists(select 1 from pt_applications where test_id=t.id and tester_id=u and status in ('applied','done'));
  sec=null;requests='[]';feedback='[]';
  if allowed then select * into sec from pt_secrets where test_id=t.id;end if;
  if t.owner_id=u then
   select coalesce(jsonb_agg(jsonb_build_object('id',case when a.tester_id=u then 'me' else a.tester_id::text end,'name',coalesce(p.nickname,'플레이어'),'status',case when a.status in ('applied','done') then 'approved' else a.status end,'agreed',true)),'[]') into requests from pt_applications a left join pt_profiles p on p.id=a.tester_id where a.test_id=t.id;
   select coalesce(jsonb_agg(f.doc order by created_at),'[]') into feedback from pt_feedback f where test_id=t.id;
  end if;
  item=t.doc||jsonb_build_object('id',t.id,'owner',case when t.owner_id=u then 'me' else t.owner_id::text end,'status',t.status,'vis',t.visibility,'slots',t.slots,'deadline',coalesce(t.deadline::text,''),'applicants',(select count(*) from pt_applications where test_id=t.id and status in ('applied','done')),'requests',requests,'feedbacks',feedback,'reason',coalesce(t.reason,''),'link',coalesce(sec.link,''),'how',coalesce(sec.how,''),'survey',coalesce(sec.survey,'[]'),'code',case when t.owner_id=u then coalesce(sec.invite_code,'') else '' end);
  tests=tests||jsonb_build_array(item);
 end loop;
 select jsonb_build_object('tests',tests,'mine',coalesce((select jsonb_object_agg(test_id,jsonb_build_object('status',status,'agreedAt',to_char(agreed_at at time zone 'Asia/Seoul','YYYY-MM-DD'),'startedAt',started_at)) from pt_applications where tester_id=u),'{}'),'myReports',coalesce((select jsonb_object_agg(test_id,true) from pt_reports where reporter_id=u),'{}'),'reports',case when adm then coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'testId',r.test_id,'cat',r.reason,'detail',r.detail,'by',coalesce(p.nickname,'플레이어'),'date',r.created_at::date,'status',r.status)) from pt_reports r left join pt_profiles p on p.id=r.reporter_id),'[]') else '[]'::jsonb end,'bugs',coalesce((select jsonb_agg(b.doc||jsonb_build_object('id',b.id,'testId',b.test_id,'testerId',case when b.tester_id=u then 'me' else b.tester_id::text end,'status',b.status,'developerNote',b.developer_note,'history',b.history,'createdAt',b.created_at,'updatedAt',b.updated_at)) from pt_bugs b join pt_tests x on x.id=b.test_id where b.tester_id=u or x.owner_id=u),'[]'),'notifications',coalesce((select jsonb_agg(n.doc||jsonb_build_object('id',n.id) order by n.created_at desc) from pt_notifications n where user_id=u),'[]'),'readNotifications',coalesce((select jsonb_object_agg(notification_id,true) from pt_reads where user_id=u),'{}'),'log',case when adm then coalesce((select jsonb_agg(jsonb_build_object('title',x.doc->>'title','date',m.created_at::date,'action',m.action,'note',m.note) order by m.created_at desc) from pt_moderation m join pt_tests x on x.id=m.test_id),'[]') else '[]'::jsonb end,'viewer',jsonb_build_object('id',u,'nickname',(select nickname from pt_profiles where id=u),'admin',adm)) into result;
 return result;
end $$;

create function public.pt_command(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid=auth.uid();adm boolean=pt_is_admin();tid text=payload->>'testId';t pt_tests;s pt_secrets;a pt_applications;b pt_bugs;d jsonb=payload->'data';q jsonb;answer jsonb;media jsonb;bid text;ids jsonb;st text;note text;nick text;due date;newdoc jsonb;stamp timestamptz=now();cnt int;
begin
 if u is null then raise exception '로그인이 필요합니다.' using errcode='42501';end if;
 insert into pt_profiles values(u,left(coalesce(nullif(auth.jwt()->'user_metadata'->>'nickname',''),'플레이어'),40)) on conflict do nothing;
 if action='mark_read' then
  for bid in select jsonb_array_elements_text(payload->'ids') loop insert into pt_reads values(u,left(bid,250)) on conflict do nothing;end loop;return pt_snapshot();
 end if;
 if action='save_test' then
  if tid is not null then select * into t from pt_tests where id=tid for update;if not found or t.owner_id<>u then raise exception '내 테스트만 수정할 수 있습니다.';end if;end if;
  if length(trim(coalesce(d->>'title',''))) not between 1 and 40 or length(trim(coalesce(d->>'team',''))) not between 1 and 40 or length(coalesce(d->>'teaser','')) not between 8 and 80 or length(coalesce(d->>'feedbackFocus','')) not between 10 and 600 then raise exception '게임 정보와 테스트 목표를 확인해 주세요.';end if;
  if coalesce(d->>'genre','') not in ('퍼즐','로그라이크','플랫포머','어드벤처','시뮬레이션','액션') or coalesce(d->>'platform','') not in ('WebGL','Windows','Android') or length(coalesce(d->>'build',''))>16 or coalesce((d->>'minutes')::int,0) not between 5 and 120 or (d->>'slots')::int not between 1 and 50 or coalesce(d->>'vis','') not in ('public','approval','invite') then raise exception '모집 조건이 올바르지 않습니다.';end if;
  if coalesce(d->>'link','') !~ '^https://[^[:space:]]+$' or length(coalesce(d->>'how','')) not between 10 and 10000 then raise exception '빌드 링크와 플레이 방법을 확인해 주세요.';end if;
  if d->>'vis'='invite' and coalesce(d->>'code','') !~ '^[A-Z0-9]{4,12}$' then raise exception '초대 코드 형식이 올바르지 않습니다.';end if;
  due=nullif(d->>'deadline','')::date;
  if due<(now() at time zone 'Asia/Seoul')::date and (tid is null or due is distinct from t.deadline) then raise exception '마감일은 오늘 이후여야 합니다.';end if;
  if tid is not null and (d->>'slots')::int<(select count(*) from pt_applications where test_id=tid and status in ('applied','done')) then raise exception '참여자 수보다 모집 인원을 줄일 수 없습니다.';end if;
  perform pt_validate_survey(d->'survey');media=pt_validate_media(coalesce(d->'media','[]'),'game');
  newdoc=jsonb_build_object('title',trim(d->>'title'),'team',trim(d->>'team'),'genre',d->>'genre','platform',d->>'platform','build',d->>'build','minutes',(d->>'minutes')::int,'teaser',d->>'teaser','feedbackFocus',d->>'feedbackFocus','media',media);
  if tid is null then insert into pt_tests(owner_id,doc,slots,visibility,deadline) values(u,newdoc,(d->>'slots')::int,d->>'vis',due) returning id into tid;
  else update pt_tests set doc=newdoc,slots=(d->>'slots')::int,visibility=d->>'vis',deadline=due,status=case when status='hidden' then 'appeal' else status end where id=tid;end if;
  insert into pt_secrets values(tid,d->>'link',d->>'how',d->'survey',case when d->>'vis'='invite' then d->>'code' else '' end) on conflict(test_id) do update set link=excluded.link,how=excluded.how,survey=excluded.survey,invite_code=excluded.invite_code;
  return pt_snapshot();
 end if;
 if action='bug_status' then select * into b from pt_bugs where id=payload->>'bugId' for update;tid=b.test_id;end if;
 select * into t from pt_tests where id=tid for update;if not found then raise exception '테스트를 찾을 수 없습니다.';end if;
 select * into s from pt_secrets where test_id=tid;
 select * into a from pt_applications where test_id=tid and tester_id=u;
 if action='apply' then
  if t.status<>'open' or (t.deadline+time '23:59:59.999') at time zone 'Asia/Seoul'<now() then raise exception '모집이 종료되었습니다.';end if;
  if coalesce((payload->>'agreed')::boolean,false) is not true then raise exception '이용 동의서에 동의해 주세요.';end if;
  if a.tester_id is not null then raise exception '이미 신청한 테스트입니다.';end if;
  if t.visibility='invite' and upper(coalesce(payload->>'code',''))<>s.invite_code then raise exception '초대 코드가 올바르지 않습니다.';end if;
  if (select count(*) from pt_applications where test_id=tid and status in ('applied','done'))>=t.slots then raise exception '모집이 마감되었습니다.';end if;
  insert into pt_applications(test_id,tester_id,status) values(tid,u,case when t.visibility='approval' then 'waiting' else 'applied' end);
 elsif action='start_play' then
  update pt_applications set started_at=coalesce(started_at,stamp) where test_id=tid and tester_id=u and status='applied';
 elsif action='review_application' then
  if t.owner_id<>u then raise exception '내 테스트만 관리할 수 있습니다.';end if;
  if payload->>'decision'='approve' then
   if t.status<>'open' or (t.deadline+time '23:59:59.999') at time zone 'Asia/Seoul'<now() then raise exception '모집이 종료되었습니다.';end if;
   if (select count(*) from pt_applications where test_id=tid and status in ('applied','done'))>=t.slots then raise exception '모집이 마감되었습니다.';end if;
   st='applied';
  elsif payload->>'decision'='decline' then st='declined';else raise exception '처리 상태가 올바르지 않습니다.';end if;
  update pt_applications set status=st where test_id=tid and tester_id=(payload->>'testerId')::uuid and status='waiting';if not found then raise exception '대기 중인 신청이 아닙니다.';end if;
 elsif action='toggle_close' then
  if t.owner_id<>u or t.status not in ('open','closed') then raise exception '모집 상태를 변경할 수 없습니다.';end if;
  update pt_tests set status=case when status='open' then 'closed' else 'open' end where id=tid;
 elsif action='feedback' then
  if a.status is distinct from 'applied' or t.status not in ('open','closed') then raise exception '참여 중인 테스트에서만 제출할 수 있습니다.';end if;
  if jsonb_typeof(payload->'answers') is distinct from 'object' then raise exception '응답 형식이 올바르지 않습니다.';end if;
  for bid in select jsonb_object_keys(payload->'answers') loop if not exists(select 1 from jsonb_array_elements(s.survey) as sq(item) where sq.item->>'id'=bid) then raise exception '알 수 없는 질문입니다.';end if;end loop;
  for q in select value from jsonb_array_elements(s.survey) loop
   answer=payload->'answers'->(q->>'id');
   if answer is null or answer='null' or answer='""' then if (q->>'required')::boolean then raise exception '필수 문항에 답해 주세요.';end if;continue;end if;
   if q->>'type'='scale' then if jsonb_typeof(answer)<>'number' then raise exception '척도 응답이 올바르지 않습니다.';end if;if (answer#>>'{}')::numeric not in (1,2,3,4,5) then raise exception '척도 범위가 올바르지 않습니다.';end if;
   elsif q->>'type'='choice' then if not (q->'options' @> jsonb_build_array(answer)) then raise exception '보기를 선택해 주세요.';end if;
   elsif jsonb_typeof(answer)<>'string' or length(answer#>>'{}')>4000 then raise exception '주관식 응답이 올바르지 않습니다.';end if;
  end loop;
  st=payload->>'issueStatus';ids=coalesce(payload->'bugIds','[]');
  if st is null or st not in ('none','reported') or jsonb_typeof(ids)<>'array' then raise exception '문제 발견 여부를 선택해 주세요.';end if;
  if st='reported' then
   if jsonb_array_length(ids)=0 then raise exception '연결할 버그를 선택해 주세요.';end if;
   for bid in select jsonb_array_elements_text(ids) loop if not exists(select 1 from pt_bugs where id=bid and test_id=tid and tester_id=u) then raise exception '내 제보만 연결할 수 있습니다.';end if;end loop;
  else ids='[]';end if;
  insert into pt_feedback(test_id,tester_id,doc) values(tid,u,jsonb_build_object('answers',payload->'answers','issueStatus',st,'bugIds',ids));
  update pt_applications set status='done' where test_id=tid and tester_id=u;
 elsif action='bug' then
  if a.status is null or a.status not in ('applied','done') or t.status not in ('open','closed') then raise exception '승인된 참여자만 제보할 수 있습니다.';end if;
  if length(coalesce(d->>'title','')) not between 3 and 100 or length(coalesce(d->>'description','')) not between 10 and 4000 or length(coalesce(d->>'steps','')) not between 5 and 4000 or length(coalesce(d->>'device','')) not between 1 and 200 or coalesce(d->>'severity','') not in ('minor','normal','critical') then raise exception '버그 제보 내용을 확인해 주세요.';end if;
  media=pt_validate_media(coalesce(d->'attachments','[]'),'bug');
  insert into pt_bugs(test_id,tester_id,doc,history) values(tid,u,jsonb_build_object('title',d->>'title','description',d->>'description','steps',d->>'steps','device',d->>'device','severity',d->>'severity','attachments',media,'build',t.doc->>'build'),jsonb_build_array(jsonb_build_object('status','new','date',stamp,'note','')));
 elsif action='bug_status' then
  if t.owner_id<>u then raise exception '내 테스트의 버그만 처리할 수 있습니다.';end if;
  st=payload->>'status';note=coalesce(payload->>'note','');if st is null or st not in ('new','review','planned','fixed','unreproduced') or length(note)>2000 then raise exception '처리 내용을 확인해 주세요.';end if;
  if b.status<>st or b.developer_note<>note then
   update pt_bugs set status=st,developer_note=note,updated_at=stamp,history=history||jsonb_build_array(jsonb_build_object('status',st,'note',note,'date',stamp)) where id=b.id;
   insert into pt_notifications(user_id,doc) values(b.tester_id,jsonb_build_object('type','bug','testId',tid,'bugId',b.id,'bugTitle',b.doc->>'title','status',st,'title','버그 제보 처리 내용이 업데이트되었습니다.','date',stamp));
  end if;
 elsif action='report' then
  if t.status not in ('open','closed') or t.owner_id=u then raise exception '이 테스트는 신고할 수 없습니다.';end if;
  if payload->>'reason' is null or payload->>'reason' not in ('부적절한 내용','악성 링크·파일 의심','저작권·도용 의심','홍보·스팸','기타') or length(coalesce(payload->>'detail',''))>4000 then raise exception '신고 내용을 확인해 주세요.';end if;
  if payload->>'reason'='기타' and length(coalesce(payload->>'detail',''))<5 then raise exception '기타 사유는 5자 이상 적어 주세요.';end if;
  insert into pt_reports(test_id,reporter_id,reason,detail) values(tid,u,payload->>'reason',coalesce(payload->>'detail',''));
  if (select count(*) from pt_reports where test_id=tid and status='open')>=3 then update pt_tests set prior_status=status,status='hidden',hidden_by='auto',reason='신고 3건 누적으로 임시 숨김 처리되었습니다.' where id=tid;end if;
 elsif action in ('dismiss','hide','restore') then
  if not adm then raise exception '운영자 권한이 필요합니다.' using errcode='42501';end if;
  note=coalesce(payload->>'note','');
  if action='dismiss' then
   update pt_reports set status='dismissed' where test_id=tid and status='open';
   if t.hidden_by='auto' then update pt_tests set status=prior_status,hidden_by=null,reason=null where id=tid;end if;
  elsif action='hide' then
   if length(note) not between 4 and 4000 then raise exception '숨김 사유를 입력해 주세요.';end if;
   update pt_reports set status='actioned' where test_id=tid and status='open';
   update pt_tests set prior_status=case when status in ('open','closed') then status else prior_status end,status='hidden',hidden_by='admin',reason=note where id=tid;
  else update pt_tests set status=prior_status,reason=null,hidden_by=null where id=tid;end if;
  insert into pt_moderation(admin_id,test_id,action,note) values(u,tid,action,note);
 else raise exception '지원하지 않는 작업입니다.';end if;
 return pt_snapshot();
end $$;

create function public.pt_can_read_file(path text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
select split_part(path,'/',2)=auth.uid()::text or (split_part(path,'/',1)='game' and exists(select 1 from pt_tests t where (t.status in ('open','closed') or t.owner_id=auth.uid()) and exists(select 1 from jsonb_array_elements(t.doc->'media') m where m->>'id'=path))) or (split_part(path,'/',1)='bug' and exists(select 1 from pt_bugs b join pt_tests t on t.id=b.test_id where (b.tester_id=auth.uid() or t.owner_id=auth.uid()) and exists(select 1 from jsonb_array_elements(b.doc->'attachments') m where m->>'id'=path)))
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('playtest-media','playtest-media',false,52428800,array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm']) on conflict(id) do nothing;
create policy pt_file_read on storage.objects for select to anon,authenticated using(bucket_id='playtest-media' and public.pt_can_read_file(name));
create policy pt_file_insert on storage.objects for insert to authenticated with check(bucket_id='playtest-media' and split_part(name,'/',1) in ('game','bug') and split_part(name,'/',2)=auth.uid()::text);
create policy pt_file_delete on storage.objects for delete to authenticated using(bucket_id='playtest-media' and split_part(name,'/',2)=auth.uid()::text);
revoke execute on function public.pt_validate_media(jsonb,text),public.pt_validate_survey(jsonb),public.pt_command(text,jsonb),public.pt_snapshot(),public.pt_is_admin(),public.pt_can_read_file(text) from public,anon,authenticated;
grant execute on function public.pt_snapshot(),public.pt_can_read_file(text) to anon,authenticated;
grant execute on function public.pt_command(text,jsonb) to authenticated;
commit;
