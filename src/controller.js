import {dateAfterDays,seoulDate,deadlineTime,deadlineState,deadlineNotifications,migrateFeatures,bugValidation,validateFeedbackIssue,isLegacyBugQuestion,BUG_STATUSES,unlimitedCapacity,capacityFull,remainingCapacity,capacityValidation,maximumDeadline,deadlineValidation,recruitmentOpen} from './playtest-features.js';
import {validateMedia,stageMedia,saveMedia,removeMedia,mediaMetadata,releaseStaged,createMediaHydrator} from './media-store.js';
import {fileView,mediaEditor,galleryHtml,deadlineHtml,progressHtml,bugFormHtml,bugListHtml,notificationsHtml,focusHtml,problemChoiceHtml} from './feature-views.js';
export function initialize({cloud=null,initialState=null}={}){
const controller = new AbortController();
const listen=(target,type,handler)=>target.addEventListener(type,handler,{signal:controller.signal});

const KEY='playtest-match-project-v1';
const GENRES=['퍼즐','로그라이크','플랫포머','어드벤처','시뮬레이션','액션'];
const PLATFORMS=['WebGL','Windows','Android'];
const PAGES=['home','tester','developer','admin'];
const MENU=[['home','홈'],['tester','테스터'],['developer','개발자'],['admin','운영자']];
const TSTATUS={open:'모집 중',closed:'모집 종료',hidden:'숨김',appeal:'재공개 검토 중'};
const TBADGE={open:'approved',closed:'vis',hidden:'rejected',appeal:'pending'};
const VIS={public:'공개',approval:'승인제',invite:'초대 전용'};
const VIS_DESC={public:'신청하면 바로 참여할 수 있습니다.',approval:'개발자가 신청자를 승인하면 참여가 열립니다.',invite:'개발자에게 받은 초대 코드가 필요합니다.'};
const REQ={waiting:['대기','pending'],approved:['승인됨','approved'],declined:['거절','rejected']};
const MINE_LABEL={done:'설문 완료',applied:'참여 중',waiting:'승인 대기',declined:'참여 불가'};
const QTYPE={scale:'5점 척도',choice:'객관식',text:'주관식'};
const REPORT_CATS=['부적절한 내용','악성 링크·파일 의심','저작권·도용 의심','홍보·스팸','기타'];
const MAXQ=10;
const TERMS=[
  '테스트 빌드와 관련 자료를 다른 사람에게 공유하거나 재배포하지 않습니다.',
  '빌드를 분석해 코드나 리소스를 추출하는 행위를 하지 않습니다.',
  '게임의 아이디어, 화면, 구성을 다른 게임 제작이나 AI 도구에 입력해 복제하는 데 사용하지 않습니다.',
  '위반이 확인되면 서비스 이용이 제한될 수 있음을 이해합니다.'
];
const RULES=[
  '악성 코드, 개인정보 수집 등 안전을 해치는 빌드를 올리지 않습니다.',
  '타인의 게임이나 저작물을 허락 없이 올리지 않습니다.',
  '선정적·폭력적이거나 부적절한 내용, 광고성 내용을 올리지 않습니다.'
];

let uid=Date.now()%1000000;
const newQ=(type)=>({id:'q'+(uid++),type:type||'text',label:'',options:type==='choice'?['','']:[],required:true});
const defaultSurvey=()=>[
  {id:'q'+(uid++),type:'scale',label:'재미는 어땠나요?',options:[],required:true},
  {id:'q'+(uid++),type:'choice',label:'난이도는 어땠나요?',options:['쉬움','적당함','어려움'],required:true},
  {id:'q'+(uid++),type:'text',label:'좋았던 점이나 개선했으면 하는 점을 적어 주세요.',options:[],required:false}];
const clone=o=>JSON.parse(JSON.stringify(o));

function seed(){return{
  mine:{},myReports:{},
  reports:[
    {id:'p1',testId:'t7',cat:'악성 링크·파일 의심',detail:'설치 중에 관련 없는 권한을 계속 요구했어요.',by:'테스터 A',date:'2026-11-08',status:'open'},
    {id:'p2',testId:'t7',cat:'홍보·스팸',detail:'플레이 방법에 다른 사이트 주소가 계속 나와요.',by:'테스터 B',date:'2026-11-09',status:'open'}],
  log:[{date:'2026-11-07',title:'Neon Relay',action:'숨김 처리',note:'빌드 링크가 열리지 않는다는 신고 2건'},
       {date:'2026-11-06',title:'Cave Chef',action:'신고 기각',note:'신고 1건, 정책 위반 아님'}],
  tests:[
   {id:'t1',feedbackFocus:'튜토리얼 없이 퍼즐 규칙을 이해할 수 있는지, 막히는 구간이 어디인지 확인하고 싶습니다.',deadline:dateAfterDays(1),owner:'me',status:'open',vis:'approval',code:'',title:'달빛 정거장',team:'아주 게임제작 동아리 MOON',genre:'퍼즐',platform:'WebGL',build:'v0.4.1',minutes:20,slots:8,applicants:5,
    teaser:'규칙 하나로 시작해 점점 꼬이는 정거장 퍼즐',
    link:'https://example.com/moon-station',how:'링크를 열고 튜토리얼 없이 1~3스테이지를 플레이해 주세요. 마우스만 사용합니다.',
    survey:[
      {id:'q1',type:'scale',label:'재미는 어땠나요?',options:[],required:true},
      {id:'q2',type:'choice',label:'난이도는 어땠나요?',options:['쉬움','적당함','어려움'],required:true},
      {id:'q3',type:'text',label:'스테이지 2의 규칙을 바로 이해했나요?',options:[],required:true},
      {id:'q4',type:'text',label:'발견한 버그가 있다면 적어 주세요.',options:[],required:false}],
    requests:[{id:'r1',name:'민재',status:'approved',agreed:true},{id:'r2',name:'유나',status:'waiting',agreed:true}],
    feedbacks:[
     {answers:{q1:4,q2:'적당함',q3:'두 번째 시도에 이해했어요.',q4:'스테이지 3에서 블록이 벽에 끼는 현상이 있어요.'}},
     {answers:{q1:5,q2:'적당함',q3:'바로 이해했습니다. 규칙이 단순해요.'}},
     {answers:{q1:3,q2:'어려움',q3:'조금 헷갈렸어요.',q4:'되돌리기 버튼이 눈에 띄지 않아요.'}}]},
   {id:'t2',owner:'other',status:'open',vis:'invite',code:'HARBOR',title:'Hollow Harbor',team:'1인 개발 해나',genre:'로그라이크',platform:'Windows',build:'v0.2.0',minutes:30,slots:10,applicants:7,
    teaser:'짧은 항해마다 지도가 바뀌는 로그라이크',
    link:'https://example.com/hollow-harbor',how:'zip을 받아 실행한 뒤 첫 번째 보스까지 진행해 주세요. 사망해도 계속 시도해도 됩니다.',
    survey:[
      {id:'q1',type:'scale',label:'첫 10분이 지루하지 않았나요?',options:[],required:true},
      {id:'q2',type:'choice',label:'난이도는 어땠나요?',options:['쉬움','적당함','어려움'],required:true},
      {id:'q3',type:'text',label:'무기 교체가 자연스러웠나요?',options:[],required:false}],
    requests:[],
    feedbacks:[{answers:{q1:4,q2:'어려움',q3:'조금 불편했어요.'}},{answers:{q1:4,q2:'적당함',q3:'자연스러웠어요.'}}]},
   {id:'t3',feedbackFocus:'터치 한 번으로 점프 타이밍을 조절하기 편한지, 착지 위치를 예측할 수 있는지 확인하고 싶습니다.',deadline:dateAfterDays(1),owner:'other',status:'open',vis:'public',code:'',title:'구름 달리기',team:'팀 사이다',genre:'플랫포머',platform:'Android',build:'v1.0.3',minutes:15,slots:6,applicants:4,
    teaser:'터치 한 번으로 구름을 타고 달리는 플랫포머',
    link:'https://example.com/cloud-run',how:'APK를 설치하고 1~2월드를 클리어해 주세요. 터치 조작감 위주로 봐 주세요.',
    survey:[
      {id:'q1',type:'scale',label:'점프 조작감은 어땠나요?',options:[],required:true},
      {id:'q2',type:'text',label:'불편했던 점이 있다면 알려 주세요.',options:[],required:false}],
    requests:[],feedbacks:[]},
   {id:'t4',owner:'me',status:'open',vis:'invite',code:'TAVERN24',title:'Tiny Tavern',team:'아주 게임제작 동아리 MOON',genre:'시뮬레이션',platform:'WebGL',build:'v0.1.0',minutes:25,slots:5,applicants:0,
    teaser:'작은 술집을 하루 동안 운영하는 시뮬레이션',
    link:'https://example.com/tiny-tavern',how:'손님 10명을 응대하며 하루를 마무리해 주세요.',
    survey:[
      {id:'q1',type:'scale',label:'재미는 어땠나요?',options:[],required:true},
      {id:'q2',type:'text',label:'주문 화면이 이해하기 쉬웠나요?',options:[],required:true}],
    requests:[],feedbacks:[]},
   {id:'t5',owner:'me',status:'hidden',vis:'public',code:'',title:'Neon Relay',team:'아주 게임제작 동아리 MOON',genre:'액션',platform:'Windows',build:'v0.0.9',minutes:10,slots:4,applicants:0,
    teaser:'릴레이로 이어 달리는 네온 액션',
    link:'https://example.com/neon-relay',how:'첫 스테이지를 플레이해 주세요.',
    survey:[{id:'q1',type:'scale',label:'조작이 편했나요?',options:[],required:true}],
    requests:[],feedbacks:[],
    reason:'빌드 링크가 열리지 않는다는 신고가 2건 접수되었습니다. 링크를 확인한 뒤 재공개를 요청해 주세요.'},
   {id:'t6',owner:'other',status:'open',vis:'approval',code:'',title:'새벽 우체국',team:'스튜디오 도담',genre:'어드벤처',platform:'WebGL',build:'v0.3.0',minutes:20,slots:8,applicants:0,
    teaser:'새벽 우체국에서 편지를 배달하는 어드벤처',
    link:'https://example.com/dawn-post',how:'프롤로그와 1장을 플레이해 주세요. 대사를 끝까지 읽어 주시면 좋아요.',
    survey:[
      {id:'q1',type:'scale',label:'이야기가 흥미로웠나요?',options:[],required:true},
      {id:'q2',type:'choice',label:'선택지가 의미 있게 느껴졌나요?',options:['매우 그랬어요','보통이에요','그렇지 않았어요'],required:true}],
    requests:[],feedbacks:[]},
   {id:'t7',owner:'other',status:'open',vis:'public',code:'',title:'Pixel Pirates',team:'해적선 스튜디오',genre:'액션',platform:'Android',build:'v0.5.2',minutes:15,slots:6,applicants:3,
    teaser:'도트 해적선으로 바다를 누비는 액션',
    link:'https://example.com/pixel-pirates',how:'APK를 설치하고 첫 항해를 끝까지 진행해 주세요. 자세한 안내는 외부 링크를 참고하세요.',
    survey:[{id:'q1',type:'scale',label:'조작감은 어땠나요?',options:[],required:true}],
    requests:[],feedbacks:[]},
   {id:'t8',owner:'other',status:'appeal',vis:'public',code:'',title:'Echo Garden',team:'정원사 팀',genre:'퍼즐',platform:'WebGL',build:'v0.2.4',minutes:10,slots:5,applicants:0,
    teaser:'소리를 따라 정원의 문을 여는 퍼즐',
    link:'https://example.com/echo-garden',how:'헤드폰을 쓰고 1~2스테이지를 플레이해 주세요.',
    survey:[{id:'q1',type:'scale',label:'소리 단서가 도움이 되었나요?',options:[],required:true}],
    requests:[],feedbacks:[],
    reason:'다른 게임의 이미지와 유사하다는 신고가 접수되어 숨김 처리되었습니다.'}
  ]};}

function load(){try{const r=localStorage.getItem(KEY);if(r){const o=JSON.parse(r);if(o&&Array.isArray(o.tests)&&Array.isArray(o.reports))return o}}catch(e){}return seed()}
function save(){if(cloud)throw new Error('서버 모드에서 로컬 변경은 허용되지 않습니다.');try{localStorage.setItem(KEY,JSON.stringify(S));return true}catch(e){toast('저장 공간이 부족합니다. 변경 내용을 저장하지 못했습니다.');return false}}

let S=migrateFeatures(cloud?initialState:load());
let mediaHydrator=createMediaHydrator();
const ui={cancelApplication:null,feedbackDrafts:{},mediaDraft:null,bugMedia:[],saving:false,gallery:null,search:'',platform:'all',sort:'default',featured:null,page:'home',tTab:'open',genre:'전체',detail:null,reporting:null,dTab:'mine',edit:null,draft:null,aTab:'reports',hiding:null};
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>/^https?:\/\//i.test(u||'')?u:'';
const byId=id=>S.tests.find(t=>t.id===id);
const today=()=>seoulDate();
const allNotifications=()=>[...deadlineNotifications(S),...S.notifications].slice(0,100);
function renderNotifications(){const el=$('#notification-area');if(el){const open=el.querySelector('details')?.open;el.innerHTML=notificationsHtml(allNotifications(),S);if(open)el.querySelector('details').open=true;}}
function clearUploads(){releaseStaged((ui.mediaDraft||[]).filter(x=>x.file));releaseStaged(ui.bugMedia);ui.mediaDraft=null;ui.bugMedia=[];}
function updateMediaEditor(){const el=$('#media-preview');if(el){el.innerHTML=mediaEditor(ui.mediaDraft||[]);mediaHydrator.hydrate(el);}}
function updateBugPreview(){const el=$('#bug-preview');if(el)el.innerHTML=ui.bugMedia.map(x=>fileView(x,{preview:true})+`<button class="text-link" type="button" data-act="bug-file-remove">삭제</button>`).join('');}
function refreshDeadlines(){renderNotifications();const main=$('#main');if(main?.querySelectorAll)main.querySelectorAll('[data-deadline-test]').forEach(el=>{const test=byId(el.dataset.deadlineTest);if(test)el.outerHTML=deadlineHtml(test);});if((ui.page==='home'||ui.page==='tester'&&ui.tTab==='open')&&main?.querySelector?.('.deadline-line.overdue'))render(false);}

const tBadge=s=>`<span class="badge b-${TBADGE[s]}">${TSTATUS[s]}</span>`;
const visBadge=v=>`<span class="badge b-vis">${VIS[v]||VIS.public}</span>`;
const openReports=()=>S.reports.filter(r=>r.status==='open');
const reportedIds=()=>[...new Set(openReports().map(r=>r.testId))].filter(id=>byId(id)&&['open','hidden'].includes(byId(id).status));
const appeals=()=>S.tests.filter(t=>t.status==='appeal');
const adminCount=()=>reportedIds().length+appeals().length;
const visibleTo=t=>t.status==='open'||t.owner==='me'||(t.status==='closed'&&S.mine[t.id]);

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),2800)}
function logAdd(t,action,note){S.log.unshift({date:today(),title:t.title,action,note:note||''})}

/* ---------- menu ---------- */
function renderMenu(){
  renderNotifications();
  const n=adminCount();
  $('#menu').innerHTML=MENU.filter(([k])=>k!=='admin'||!cloud||cloud.canAdmin).map(([k,l])=>`<a href="#${k}" data-nav="${k}" ${ui.page===k?'aria-current="page"':''}>${l}${k==='admin'&&n?`<span class="cnt">${n}</span>`:''}</a>`).join('');
}

/* ---------- home ---------- */
function gameArt(t, hero=false){
 const cover=(t.media||[]).find(m=>m.kind==='image'&&m.cover)||(t.media||[]).find(m=>m.kind==='image');
 if(cover)return fileView(cover,{cover:true});
 const index={t1:0,t2:1,t3:2,t4:3,t5:4,t6:5,t7:1,t8:0}[t.id];
 return `<div class="game-art art-${index===undefined?'new':index} ${hero?'hero-art':''}" role="img" aria-label="${esc(t.title)} 예시 게임 아트워크"><span class="art-caption">CONCEPT ART · 예시 이미지</span></div>`;
}
function gameCard(t){
 const m=S.mine[t.id],full=capacityFull(t)||deadlineState(t.deadline)==='overdue';
 return `<article class="card game-card"><button class="cover-button" type="button" data-act="open" data-id="${t.id}" aria-label="${esc(t.title)} 테스트 살펴보기">${gameArt(t)}</button><div class="card-body"><div class="row"><span class="genre-label">${esc(t.genre)}</span>${visBadge(t.vis)}</div><h3 data-no-translate>${esc(t.title)}</h3><p class="team" data-no-translate>${esc(t.team)}</p><p class="teaser" data-no-translate>${esc(t.teaser)}</p>${focusHtml(t,true)}<div class="card-meta"><span>${esc(t.platform)}</span><span>◷ ${t.minutes}분</span></div><div class="foot">${deadlineHtml(t)}${slotsHtml(t)}<button class="btn ghost card-join" type="button" data-act="open" data-id="${t.id}">${m?MINE_LABEL[m.status]:full?'모집 마감':'테스트 참여하기'} <span>→</span></button></div></div></article>`;
}
function filteredTests(list){
 let result=list.filter(t=>(ui.genre==='전체'||t.genre===ui.genre)&&(ui.platform==='all'||t.platform===ui.platform)&&(!ui.search||[t.title,t.team,t.teaser,t.genre,t.feedbackFocus].join(' ').toLocaleLowerCase().includes(ui.search.toLocaleLowerCase())));
 if(ui.sort==='short')result.sort((a,b)=>a.minutes-b.minutes);
 if(ui.sort==='seats')result.sort((a,b)=>(remainingCapacity(b)-remainingCapacity(a))||0);
 if(ui.sort==='new')result.reverse();
 return result;
}
function catalogTools(){return `<div class="catalog-tools"><form data-form="search" class="search-form"><label class="sr-only" for="game-search">게임 검색</label><input id="game-search" type="search" name="search" value="${esc(ui.search)}" placeholder="게임, 개발팀 검색" autocomplete="off"><button type="submit" aria-label="검색">⌕</button></form><div class="catalog-selects"><label class="sr-only" for="platform-filter">플랫폼</label><select id="platform-filter"><option value="all" ${ui.platform==='all'?'selected':''}>모든 플랫폼</option>${PLATFORMS.map(p=>`<option value="${p}" ${ui.platform===p?'selected':''}>${p}</option>`).join('')}</select><label class="sr-only" for="sort-filter">정렬</label><select id="sort-filter">${[['default','등록 순'],['new','최근 등록 순'],['short','짧은 플레이 시간 순'],['seats','남은 자리 많은 순']].map(([v,l])=>`<option value="${v}" ${ui.sort===v?'selected':''}>${l}</option>`).join('')}</select></div></div>`;}
function renderHome(){
 const tests=S.tests.filter(t=>recruitmentOpen(t));
 const featured=tests.find(t=>t.id===ui.featured)||tests[0];
 const list=filteredTests(tests);
 return `<div class="store-layout"><aside class="store-sidebar"><h2>게임 둘러보기</h2><button class="side-link ${ui.genre==='전체'?'active':''}" data-act="catalog-genre" data-genre="전체">전체 게임 <span>${tests.length}</span></button><h3>장르</h3>${GENRES.map(g=>`<button class="side-link ${ui.genre===g?'active':''}" type="button" data-act="catalog-genre" data-genre="${g}">${g}<span>${tests.filter(t=>t.genre===g).length}</span></button>`).join('')}<div class="sidebar-note"><h3>게임을 만들고 있나요?</h3><p>첫 빌드를 공개하고<br>플레이어의 의견을 모아보세요.</p><a href="#developer" data-nav="developer" data-sub="new">테스트 등록하기 →</a></div></aside><div class="store-content"><div class="store-title"><div><span class="page-kicker">PLAYTEST MATCH</span><h1>인디게임 플레이테스트</h1><p>개발 중인 게임을 먼저 만나고, 피드백을 남겨주세요.</p></div><a class="btn" href="#developer" data-nav="developer" data-sub="new">+ 테스트 등록</a></div>
 ${featured?`<section class="featured-section" aria-labelledby="featured-title"><div class="section-heading"><h2 id="featured-title">추천 테스트</h2><span class="section-note">모집 중인 게임</span></div><div class="feature-stage"><button type="button" class="feature-image" data-act="open" data-id="${featured.id}" aria-label="${esc(featured.title)} 테스트 살펴보기">${gameArt(featured)}</button><div class="feature-info"><span class="genre-label">${esc(featured.genre)} · ${esc(featured.platform)}</span><h2 data-no-translate>${esc(featured.title)}</h2><p data-no-translate>${esc(featured.teaser)}</p>${focusHtml(featured,true)}<div class="feature-facts"><span>예상 플레이 시간</span><b>${featured.minutes}분</b><span>참여 방식</span>${visBadge(featured.vis)}</div>${slotsHtml(featured)}<button class="btn" type="button" data-act="open" data-id="${featured.id}">테스트 살펴보기 →</button></div></div><div class="feature-picker">${tests.slice(0,4).map(t=>`<button type="button" class="feature-pick ${t.id===featured.id?'selected':''}" data-act="feature" data-id="${t.id}" aria-pressed="${t.id===featured.id}">${gameArt(t)}<span>${esc(t.title)}<small>${esc(t.genre)}</small></span></button>`).join('')}</div></section>`:''}
 <section class="recruit-section"><div class="section-heading"><h2>테스터 모집 중 <span class="count">${list.length}</span></h2><button class="text-link" type="button" data-act="clear-filters">필터 초기화</button></div>${catalogTools()}${ui.genre!=='전체'?`<p class="filter-caption">${esc(ui.genre)}</p>`:''}<div class="grid home-games">${list.length?list.map(gameCard).join(''):'<div class="empty">검색 조건에 맞는 테스트가 없습니다.</div>'}</div></section><div class="developer-strip"><div><h2>다음 빌드에 필요한 피드백을 모으세요.</h2><p>모집부터 설문 결과 확인까지 한 곳에서.</p></div><a class="btn ghost" href="#developer" data-nav="developer" data-sub="new">개발자 공간 →</a></div></div></div>`;
}

/* ---------- tester ---------- */
function slotsHtml(t){
  if(unlimitedCapacity(t))return `<div class="slots"><span class="badge b-public">인원 제한 없음</span><span class="mono">${t.applicants}명 참여</span></div>`;
  const full=capacityFull(t),pct=Math.min(100,Math.round(t.applicants/t.slots*100));
  return `<div class="slots"><div class="bar ${full?'full':''}"><span style="width:${pct}%"></span></div><span class="mono">${t.applicants}/${t.slots}명</span></div>`;
}
function renderTester(){
  if(ui.detail){const d=byId(ui.detail);if(d&&visibleTo(d))return renderDetail(d)}
  const open=S.tests.filter(t=>recruitmentOpen(t));
  const mineList=S.tests.filter(t=>S.mine[t.id]);
  const genres=['전체',...GENRES.filter(g=>open.some(t=>t.genre===g))];
  const list=filteredTests(ui.tTab==='mine'?mineList:open);
  const tabs=`<div class="tabs" role="tablist">
    <button role="tab" type="button" data-act="tab-t" data-tab="open" aria-selected="${ui.tTab==='open'}">모집 중 ${open.length}</button>
    <button role="tab" type="button" data-act="tab-t" data-tab="mine" aria-selected="${ui.tTab==='mine'}">내 참여 ${mineList.length}</button></div>`;
  const chips=ui.tTab==='open'?`<div class="sub" aria-label="장르 필터">${genres.map(g=>`<button type="button" class="chip" data-act="genre" data-genre="${g}" aria-pressed="${ui.genre===g}">${g}</button>`).join('')}</div>`:'';
  const cards=list.map(t=>ui.tTab==='mine'?`<article class="participation-card panel"><div class="row"><h2 data-no-translate>${esc(t.title)}</h2><span class="badge b-vis">${MINE_LABEL[S.mine[t.id].status]}</span></div>${progressHtml(t,S.mine[t.id])}${t.status==='hidden'||t.status==='appeal'?'<p class="notice">이 테스트는 현재 숨김 상태입니다.</p>':`<button class="btn ghost" type="button" data-act="open" data-id="${t.id}">참여 화면 열기 →</button>`}<details><summary>내 버그 제보</summary>${bugListHtml(t,S.bugs)}</details></article>`:gameCard(t)).join('');
  const empty=ui.tTab==='mine'?'아직 신청한 테스트가 없습니다. 모집 중 탭에서 플레이해 보고 싶은 게임을 골라 보세요.':'조건에 맞는 테스트가 없습니다.';
  return `<div class="browse-heading"><h1>게임 둘러보기</h1><p class="muted">새로운 세계를 만나고, 당신의 의견을 남겨보세요.</p></div>${tabs}${chips}${catalogTools()}${list.length?`<div class="grid">${cards}</div>`:`<div class="empty">${empty}</div>`}`;
}
function questionHtml(q){
  const star=q.required?' *':'';
  if(q.type==='scale')return `<fieldset><legend>${esc(q.label)}${star}</legend><div class="rate" role="radiogroup">${[1,2,3,4,5].map(n=>`<label class="rate-opt"><input type="radio" name="a-${q.id}" value="${n}"><span>${n}</span></label>`).join('')}</div><div class="scale"><span>별로예요</span><span>아주 좋아요</span></div></fieldset>`;
  if(q.type==='choice')return `<fieldset><legend>${esc(q.label)}${star}</legend><div class="opts">${q.options.map(o=>`<label class="opt"><input type="radio" name="a-${q.id}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div></fieldset>`;
  return `<div class="field" ${isLegacyBugQuestion(q)?'data-legacy-bug-field':''}><label for="a-${q.id}">${esc(q.label)}${star}</label>${isLegacyBugQuestion(q)?'<p class="hint">버그 내용은 아래에서 제보하거나 기존 제보를 연결하세요. 여기는 추가 의견만 적어도 됩니다.</p>':''}<textarea id="a-${q.id}"></textarea></div>`;
}
function reportPanel(t){
  if(t.owner==='me')return '';
  if(S.myReports[t.id])return `<p class="hint">이 테스트를 신고했습니다. 운영자가 확인합니다.</p>`;
  if(ui.reporting!==t.id)return `<button class="btn ghost sm" type="button" data-act="report-open" data-id="${t.id}" style="align-self:flex-start">이 테스트 신고하기</button>`;
  return `<div class="panel quiet"><h3>신고하기</h3><p class="hint">부적절한 내용이나 위험한 빌드를 발견했다면 알려 주세요. 신고는 운영자에게만 전달됩니다.</p>
    <form data-form="report" data-id="${t.id}" novalidate>
      <div class="field"><label for="rp-cat">신고 사유</label><select id="rp-cat">${REPORT_CATS.map(c=>`<option value="${esc(c)}">${c}</option>`).join('')}</select></div>
      <div class="field"><label for="rp-detail">자세한 내용</label><textarea id="rp-detail" placeholder="어떤 점이 문제인지 적어 주세요."></textarea></div>
      <p class="err" id="rp-err" role="alert"></p>
      <div class="actions"><button class="btn" type="submit">신고 접수</button><button class="btn ghost" type="button" data-act="report-cancel">취소</button></div></form></div>`;
}
function renderDetail(t){
  const m=S.mine[t.id],st=m&&m.status,access=st==='applied'||st==='done',own=t.owner==='me',closed=t.status!=='open'||deadlineState(t.deadline)==='overdue',full=capacityFull(t),url=safeUrl(t.link);
  const guarded=access
    ?`<div><h3>플레이 방법</h3><p style="margin-top:6px">${esc(t.how)}</p></div>
      <div><h3>이 설문에 답해 주세요</h3><ol class="qs" style="margin-top:6px">${t.survey.map(q=>`<li>${esc(q.label)} <span class="mono muted">${QTYPE[q.type]}</span></li>`).join('')}</ol></div>`
    :`<div class="lock"><span class="mono">LOCKED</span><p>플레이 방법, 설문 문항, 빌드 링크는 이용 동의 후 참여가 열리면 공개됩니다.</p></div>`;
  const info=`${progressHtml(t,m)}${focusHtml(t)}${t.media.length?galleryHtml(t,ui.gallery):`<div class="detail-cover">${gameArt(t)}</div>`}<div class="panel"><div class="row"><div class="stack" style="gap:4px"><h2 data-no-translate>${esc(t.title)}</h2><p class="muted">${esc(t.team)}</p></div><span class="pair">${own?'<span class="badge b-mine">내 테스트</span>':''}${t.status!=='open'?tBadge(t.status):''}${visBadge(t.vis)}</span></div>
    <p data-no-translate>${esc(t.teaser)}</p>
    <dl class="facts"><dt>BUILD</dt><dd class="mono">${esc(t.build)}</dd><dt>PLATFORM</dt><dd>${esc(t.platform)}</dd><dt>GENRE</dt><dd>${esc(t.genre)}</dd><dt>TIME</dt><dd>약 ${t.minutes}분</dd><dt>SLOTS</dt><dd>${slotsHtml(t)}</dd><dt>ACCESS</dt><dd>${VIS[t.vis]} · ${VIS_DESC[t.vis]}</dd></dl>
    ${deadlineHtml(t)}${guarded}</div>`;
  let side;
  if(!m){
    const btn=t.vis==='approval'?'동의하고 승인 요청':'동의하고 신청';
    side=`<div class="panel"><h3>참여하기</h3>
      <form data-form="apply" data-id="${t.id}" novalidate>
        ${t.vis==='invite'?`<div class="field"><label for="ap-code">초대 코드</label><input type="text" id="ap-code" autocomplete="off" maxlength="12"><span class="hint">개발자에게 받은 코드를 입력해 주세요.</span></div>`:''}
        <div class="terms"><p class="mono">이용 동의서</p><ol class="qs">${TERMS.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>
        <label class="check"><input type="checkbox" id="ap-agree"><span>위 내용을 읽고 동의합니다.</span></label>
        <p class="err" id="ap-err" role="alert"></p>
        <button class="btn" type="submit" ${(full||closed)?'disabled':''}>${closed?'모집 종료':full?'모집 마감':btn}</button></form></div>`;
  }else if(st==='waiting'){
    side=`<div class="panel"><h3>개발자의 승인을 기다리고 있습니다</h3><p class="muted">승인되면 플레이 방법, 설문 문항, 빌드 링크가 열립니다.</p><p class="mono muted">이용 동의 ${esc(m.agreedAt||'')}</p></div>`;
  }else if(st==='declined'){
    side=`<div class="panel"><h3>이번 테스트에는 참여할 수 없습니다</h3><p class="muted">개발자가 신청을 받지 않았습니다. 다른 테스트를 둘러보세요.</p></div>`;
  }else if(st==='applied'){
    side=`<div class="panel"><h3>빌드 열기</h3>${url?`<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${esc(t.platform)} 빌드 받기</a>`:'<p class="err">빌드 링크 형식이 올바르지 않습니다.</p>'}
      <p class="mono muted">이용 동의 ${esc(m.agreedAt||'')} · 공유와 재배포는 금지됩니다.</p>
      <form data-form="feedback" data-id="${t.id}" novalidate>
        <p class="hint">* 표시는 필수 문항입니다.</p>
        ${t.survey.map(questionHtml).join('')}${problemChoiceHtml(t,S.bugs)}
        <p class="err" id="fb-err" role="alert"></p>
        <button class="btn" type="submit">설문 제출</button></form></div>`;
  }else{
    side=`<div class="panel"><h3>설문을 제출했습니다</h3><p class="muted">참여해 주셔서 감사합니다. 개발자가 결과를 확인합니다.</p></div>`;
  }
  const cancellation=['waiting','applied'].includes(st)?`<section class="cancellation-panel">${ui.cancelApplication===t.id?`<p>신청을 취소하면 빌드와 설문 접근이 종료됩니다. 모집 중이면 다시 신청할 수 있습니다.</p><div class="actions"><button type="button" class="btn danger" data-act="confirm-cancellation" data-id="${t.id}">신청 취소 확정</button><button type="button" class="btn ghost" data-act="keep-application">참여 유지</button></div>`:`<button type="button" class="text-link" data-act="cancel-application" data-id="${t.id}">신청 취소</button>`}</section>`:'';
  return `<button class="back" type="button" data-act="back">← 목록으로</button><div class="cols"><div class="stack">${info}</div><div class="col-side">${side}${cancellation}${bugFormHtml(t,m)}${m&&['applied','done'].includes(m.status)?`<section class="panel"><h3>내 버그 제보</h3>${bugListHtml(t,S.bugs)}</section>`:''}${reportPanel(t)}</div></div>`;
}

/* ---------- developer ---------- */
const bar=(l,n,tot)=>`<div><span>${esc(l)}</span><div class="bar"><span style="width:${tot?Math.round(n/tot*100):0}%"></span></div><span class="mono">${n}</span></div>`;
function summaryHtml(t){
  const f=t.feedbacks;
  if(!f.length)return '<p class="muted" style="margin-top:8px">아직 제출된 응답이 없습니다.</p>';
  const linkedIds=[...new Set(f.flatMap(item=>item.bugIds||[]))],linked=S.bugs.filter(b=>linkedIds.includes(b.id)&&b.testId===t.id);
  return `<p class="mono muted" style="margin:8px 0">${f.length}명 응답</p><div class="stack">${t.survey.map(q=>{
    const vals=f.map(x=>x.answers&&x.answers[q.id]).filter(v=>v!==undefined&&v!=='');
    let body;
    if(q.type==='scale'){
      const avg=vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):'-';
      body=`<p><span class="big">${avg}</span> <span class="muted">/ 5</span></p><div class="dist">${[1,2,3,4,5].map(n=>bar(n+'점',vals.filter(v=>v===n).length,vals.length)).join('')}</div>`;
    }else if(q.type==='choice'){
      body=`<div class="dist">${q.options.map(o=>bar(o,vals.filter(v=>v===o).length,vals.length)).join('')}</div>`;
    }else{
      body=`<ul class="list">${vals.map(v=>`<li>${esc(v)}</li>`).join('')||'<li class="muted">응답 없음</li>'}</ul>`;
    }
    return `<div class="qres"><p><strong>${esc(q.label)}</strong> <span class="mono muted">${QTYPE[q.type]} · ${vals.length}건</span></p>${body}</div>`;
  }).join('')}</div>${linked.length?`<details class="res"><summary>설문에 연결된 버그 <span>${linked.length}</span></summary>${bugListHtml(t,linked,{ownOnly:false})}</details>`:''}`;
}
function reqsHtml(t){
  const r=t.requests||[];
  if(!r.length)return '';
  const w=r.filter(x=>x.status==='waiting').length;
  return `<details class="res" ${w?'open':''}><summary>신청자 관리 (${r.length}${w?` · 대기 ${w}`:''})</summary><ul class="reqs">${r.map(x=>`<li><span>${esc(x.name)} ${x.agreed?'<span class="ck">동의 완료</span>':''}</span>${x.status==='waiting'
    ?`<span class="actions"><button class="btn sm" type="button" data-act="req-approve" data-id="${t.id}" data-req="${esc(x.id)}">승인</button><button class="btn ghost sm" type="button" data-act="req-decline" data-id="${t.id}" data-req="${esc(x.id)}">거절</button></span>`
    :`<span class="badge b-${REQ[x.status][1]}">${REQ[x.status][0]}</span>`}</li>`).join('')}</ul></details>`;
}
function surveyBuilderHtml(){
  const d=ui.draft;
  return `<div class="stack">${d.map((q,i)=>`<div class="qrow" data-i="${i}">
    <div class="qhead"><span class="qno">Q${i+1}</span>
      <select class="q-type" aria-label="질문 ${i+1} 유형">${Object.keys(QTYPE).map(k=>`<option value="${k}" ${k===q.type?'selected':''}>${QTYPE[k]}</option>`).join('')}</select>
      <label class="check small"><input type="checkbox" class="q-req" ${q.required?'checked':''}>필수</label>
      <span class="actions"><button class="btn ghost sm" type="button" data-act="q-up" data-i="${i}" ${i===0?'disabled':''} aria-label="질문 ${i+1} 위로">위로</button><button class="btn ghost sm" type="button" data-act="q-down" data-i="${i}" ${i===d.length-1?'disabled':''} aria-label="질문 ${i+1} 아래로">아래로</button><button class="btn danger sm" type="button" data-act="q-del" data-i="${i}" aria-label="질문 ${i+1} 삭제">삭제</button></span></div>
    <input type="text" class="q-label" maxlength="80" value="${esc(q.label)}" placeholder="질문을 입력하세요" aria-label="질문 ${i+1} 내용">
    ${q.type==='choice'?`<textarea class="q-opts" placeholder="보기를 한 줄에 하나씩 적어 주세요 (2~6개)" aria-label="질문 ${i+1} 보기">${esc(q.options.join('\n'))}</textarea>`:''}
    ${q.type==='scale'?'<p class="hint">테스터가 1점(별로예요)부터 5점(아주 좋아요)까지 고릅니다. 결과는 평균과 분포로 보입니다.</p>':''}
    ${q.type==='text'?'<p class="hint">테스터가 자유롭게 적습니다. 결과는 응답 목록으로 보입니다.</p>':''}
  </div>`).join('')}</div>
  <div class="actions" style="align-items:center"><button class="btn ghost sm" type="button" data-act="q-add" ${d.length>=MAXQ?'disabled':''}>질문 추가</button><span class="hint">${d.length}/${MAXQ}문항</span></div>`;
}
function renderSurvey(){const c=$('#survey-builder');if(c&&ui.draft)c.innerHTML=surveyBuilderHtml()}
function syncDraft(){
  const c=$('#survey-builder');if(!c||!ui.draft)return;
  c.querySelectorAll('.qrow').forEach((r,i)=>{
    const q=ui.draft[i];if(!q)return;
    q.label=r.querySelector('.q-label').value;
    q.type=r.querySelector('.q-type').value;
    q.required=r.querySelector('.q-req').checked;
    const o=r.querySelector('.q-opts');
    if(o)q.options=o.value.split('\n');
    else if(q.type==='choice'&&!q.options.length)q.options=['',''];
    if(q.type!=='choice')q.options=[];
  });
}
function devForm(){
  const e=ui.edit?byId(ui.edit):null;
  if(!ui.draft)ui.draft=e?clone(e.survey):defaultSurvey();
  if(ui.mediaDraft===null)ui.mediaDraft=e?clone(e.media):[];
  const v=k=>e?esc(e[k]):'';
  const opts=(arr,cur)=>arr.map(x=>`<option value="${esc(x)}" ${x===cur?'selected':''}>${x}</option>`).join('');
  const curVis=e?e.vis:'public';
  const hid=e&&e.status==='hidden';
  const deadlineMax=maximumDeadline(e?.createdDate||today());
  return `<div class="panel" id="dev-form"><h2>${e?'테스트 수정':'새 테스트 등록'}</h2>
    ${hid?`<p class="reason">숨김 사유: ${esc(e.reason||'')}</p>`:''}
    <p class="notice">${hid?'수정을 저장하면 운영자에게 재공개 요청이 전달됩니다.':e?'수정 내용은 바로 반영됩니다.':'등록하면 바로 공개됩니다. 사전 심사는 없고, 신고가 접수되면 운영자가 확인합니다.'}</p>
    <form data-form="dev" novalidate>
      <fieldset class="group"><legend>기본 정보</legend><div class="fields">
        <div class="field"><label for="f-title">게임 이름</label><input type="text" id="f-title" value="${v('title')}" maxlength="40"></div>
        <div class="field"><label for="f-team">팀 이름</label><input type="text" id="f-team" value="${v('team')}" maxlength="40"></div>
        <div class="field"><label for="f-genre">장르</label><select id="f-genre">${opts(GENRES,e&&e.genre)}</select></div>
        <div class="field"><label for="f-platform">플랫폼</label><select id="f-platform">${opts(PLATFORMS,e&&e.platform)}</select></div>
        <div class="field"><label for="f-build">빌드 버전</label><input type="text" id="f-build" value="${e?esc(e.build):'v0.1.0'}" maxlength="16"></div>
        <div class="field"><label for="f-min">예상 소요 시간 (분)</label><input type="number" id="f-min" min="5" max="120" value="${e?e.minutes:20}"></div>
        <div class="field"><label for="f-slots">모집 인원</label><input type="number" id="f-slots" min="1" max="50" step="1" value="${e?.slots??5}" ${e&&unlimitedCapacity(e)?'disabled':''} aria-describedby="capacity-hint"><label class="check"><input type="checkbox" id="f-unlimited" ${e&&unlimitedCapacity(e)?'checked':''}><span>인원 제한 없음</span></label><span class="hint" id="capacity-hint">인원 지정 시 1~50명 · 제한이 없으면 마감일까지 신청을 받습니다.</span></div>
        <div class="field"><label for="f-deadline">모집·피드백 마감일</label><input type="date" id="f-deadline" value="${e?esc(e.deadline||deadlineMax):dateAfterDays(7)}" min="${e?.deadline&&e.deadline<today()?esc(e.deadline):today()}" max="${deadlineMax}" required aria-describedby="deadline-hint"><span class="hint" id="deadline-hint">모든 테스트 필수 · 최초 등록일부터 최대 두 달 · 한국 시간 23:59 마감</span></div>
      </div></fieldset>
      <fieldset class="group"><legend>스크린샷 · 영상</legend><p class="hint">스크린샷 최대 6장(각 5MB), 영상 최대 1개(50MB). 공개 소개에 표시됩니다.</p><label for="f-media">미디어 파일 추가</label><input id="f-media" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"><p class="hint">PNG · JPG · WebP · GIF / MP4 · WebM</p><p id="media-error" class="err" role="alert"></p><div id="media-preview">${mediaEditor(ui.mediaDraft)}</div></fieldset>
      <fieldset class="group"><legend>공개 설정</legend>
        <p class="hint">신청 전에는 게임명, 팀, 장르, 플랫폼, 소요 시간, 한 줄 소개만 보입니다.</p>
        <div class="fields">
          <div class="field"><label for="f-vis">공개 범위</label><select id="f-vis">${Object.keys(VIS).map(k=>`<option value="${k}" ${k===curVis?'selected':''}>${VIS[k]}</option>`).join('')}</select><span class="hint" id="vis-desc">${VIS_DESC[curVis]}</span></div>
          <div class="field" id="code-field" ${curVis==='invite'?'':'hidden'}><label for="f-code">초대 코드</label><input type="text" id="f-code" value="${v('code')}" maxlength="12" autocomplete="off"><span class="hint">영문과 숫자 4~12자</span></div>
          <div class="field wide"><label for="f-focus">이번 테스트에서 확인할 점</label><textarea id="f-focus" maxlength="600" placeholder="예: 튜토리얼 없이 조작을 이해할 수 있는지, 처음 막히는 구간이 어디인지 알고 싶어요.">${v('feedbackFocus')}</textarea><span class="hint">신청 전 카드와 상세에 공개됩니다. 10~600자로 구체적인 목표를 적어 주세요.</span></div><div class="field wide"><label for="f-teaser">공개 소개 (한 줄)</label><input type="text" id="f-teaser" value="${v('teaser')}" maxlength="80"><span class="hint">목록에 그대로 보입니다. 핵심 메커니즘은 적지 마세요.</span></div>
        </div></fieldset>
      <fieldset class="group"><legend>참여자에게만 공개</legend><div class="fields">
        <div class="field wide"><label for="f-link">빌드 링크</label><input type="text" id="f-link" value="${v('link')}" placeholder="https://"><span class="hint">https:// 로 시작해야 합니다. 이용 동의 후 참여가 열린 테스터에게만 보입니다.</span></div>
        <div class="field wide"><label for="f-how">플레이 방법</label><textarea id="f-how">${v('how')}</textarea></div>
      </div></fieldset>
      <fieldset class="group"><legend>설문지</legend>
        <p class="hint">테스터가 플레이한 뒤 응답할 질문입니다. 기본 문항 3개로 시작하며 자유롭게 고치거나 추가할 수 있습니다. 설문은 참여가 열린 테스터에게만 보입니다.${e&&e.feedbacks.length?' 이미 응답이 있는 테스트입니다. 삭제한 문항의 기존 응답은 결과에서 보이지 않습니다.':''}</p>
        <div id="survey-builder">${surveyBuilderHtml()}</div>
      </fieldset>
      <fieldset class="group"><legend>등록 기준</legend>
        <ol class="qs">${RULES.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
        <label class="check"><input type="checkbox" id="f-policy" ${e?'checked':''}><span>등록 기준을 확인했고, 위반 시 테스트가 숨김 처리될 수 있음에 동의합니다.</span></label>
      </fieldset>
      <p class="err" id="dev-err" role="alert"></p>
      <div class="actions"><button class="btn" type="submit">${hid?'수정하고 재공개 요청':e?'수정 저장':'등록하고 바로 공개'}</button>${e?'<button class="btn ghost" type="button" data-act="cancel-edit">수정 취소</button>':''}</div></form></div>`;
}
function myTestCard(t){
  let body='';
  if(t.status==='hidden')body=`<p class="reason">운영자가 숨김 처리했습니다. ${esc(t.reason||'')}</p><div class="actions"><button class="btn sm" type="button" data-act="edit" data-id="${t.id}">수정하고 재공개 요청</button></div>`;
  else if(t.status==='appeal')body=`<p class="reason warn">재공개 요청을 운영자가 검토하고 있습니다.</p>`;
  else body=`${slotsHtml(t)}<div class="actions"><button class="btn ghost sm" type="button" data-act="edit" data-id="${t.id}">수정</button><button class="btn ghost sm" type="button" data-act="toggle-close" data-id="${t.id}">${t.status==='open'?'모집 종료':'모집 재개'}</button></div>${reqsHtml(t)}<details class="res" ${t.feedbacks.length?'open':''}><summary>설문 결과 (${t.feedbacks.length}명)</summary>${summaryHtml(t)}</details>`;
  const rc=S.reports.filter(r=>r.testId===t.id&&r.status==='open').length;
  return `<article class="card"><div class="card-top mono"><span class="tag">${esc(t.build)}</span><span class="tag">${esc(t.platform)}</span><span class="sp pair">${visBadge(t.vis)}${tBadge(t.status)}</span></div>
    <div class="card-body"><h3 data-no-translate>${esc(t.title)}</h3><p class="teaser" data-no-translate>${esc(t.teaser)}</p><p class="meta">${esc(t.genre)} · 약 ${t.minutes}분 · 설문 ${t.survey.length}문항</p>${t.vis==='invite'?`<p class="meta">초대 코드 <span class="code">${esc(t.code)}</span></p>`:''}${rc?`<p class="meta">접수된 신고 ${rc}건 · 운영자가 확인 중</p>`:''}<div class="foot">${deadlineHtml(t)}${body}</div></div></article>`;
}
function renderDeveloper(){
  if(cloud&&!cloud.user)return '<section class="panel"><h2>개발자</h2><p>로그인하면 테스트를 등록하고 신청자와 피드백을 관리할 수 있습니다.</p><button type="button" class="btn" data-act="account-login">로그인</button></section>';
  const mine=S.tests.filter(t=>t.owner==='me');
  const tabs=`<div class="tabs" role="tablist">
    <button role="tab" type="button" data-act="tab-d" data-tab="mine" aria-selected="${ui.dTab==='mine'}">내 테스트 ${mine.length}</button>
    <button role="tab" type="button" data-act="tab-d" data-tab="new" aria-selected="${ui.dTab==='new'}">${ui.edit?'테스트 수정':'새 테스트 등록'}</button></div>`;
  const bugCount=S.bugs.filter(b=>mine.some(t=>t.id===b.testId)).length;
  const bugTab=`<button role="tab" type="button" data-act="tab-d" data-tab="bugs" aria-selected="${ui.dTab==='bugs'}">버그 제보 <span>${bugCount}</span></button>`;
  const head=`<div class="head"><h2>개발자</h2></div>${tabs.replace('</div>',bugTab+'</div>')}`;
  if(ui.dTab==='bugs')return head+(bugCount?mine.filter(t=>S.bugs.some(b=>b.testId===t.id)).map(t=>`<section class="panel"><h2 data-no-translate>${esc(t.title)}</h2>${bugListHtml(t,S.bugs,{developer:true})}</section>`).join(''):'<p class="empty">아직 버그 제보가 없습니다.</p>');
  if(ui.dTab==='new')return head+devForm();
  return head+(mine.length?`<div class="grid">${mine.map(myTestCard).join('')}</div>`:'<div class="empty">등록한 테스트가 없습니다. 새 테스트 등록 탭에서 첫 게임을 올려 보세요.</div>');
}

/* ---------- admin ---------- */
function testInfo(t){
  return `<div class="row"><div class="stack" style="gap:4px"><h3 data-no-translate>${esc(t.title)}</h3><p class="muted">${esc(t.team)} · ${esc(t.genre)} · ${esc(t.platform)} · <span class="mono">${esc(t.build)}</span></p></div><span class="pair">${visBadge(t.vis)}${tBadge(t.status)}</span></div>
    <p data-no-translate>${esc(t.teaser)}</p><dl class="facts"><dt>LINK</dt><dd class="mono">${esc(t.link)}</dd><dt>HOW</dt><dd>${esc(t.how)}</dd></dl>`;
}
function hideBox(t){
  return `<div class="field"><label for="hd-${t.id}">숨김 사유 (개발자에게 표시됩니다)</label><textarea id="hd-${t.id}" placeholder="무엇이 문제인지, 어떻게 고치면 되는지 적어 주세요."></textarea><p class="err" id="hd-err" role="alert"></p></div>
    <div class="actions"><button class="btn danger" type="button" data-act="hide-confirm" data-id="${t.id}">숨김 처리</button><button class="btn ghost" type="button" data-act="hide-cancel">취소</button></div>`;
}
function renderAdmin(){
  const rIds=reportedIds(),ap=appeals();
  const tabs=`<div class="tabs" role="tablist">
    <button role="tab" type="button" data-act="tab-a" data-tab="reports" aria-selected="${ui.aTab==='reports'}">신고 접수 ${rIds.length}</button>
    <button role="tab" type="button" data-act="tab-a" data-tab="appeals" aria-selected="${ui.aTab==='appeals'}">재공개 요청 ${ap.length}</button>
    <button role="tab" type="button" data-act="tab-a" data-tab="log" aria-selected="${ui.aTab==='log'}">처리 내역</button></div>`;
  let body;
  if(ui.aTab==='reports'){
    body=rIds.length?`<div class="stack">${rIds.map(id=>{
      const t=byId(id),rs=openReports().filter(r=>r.testId===id);
      return `<article class="panel"><div class="row"><span class="badge b-rejected">신고 ${rs.length}건</span></div>${testInfo(t)}
        <div class="stack">${rs.map(r=>`<div class="rep"><span class="mono">${esc(r.cat)} · ${esc(r.by)} · ${esc(r.date)}</span><span>${esc(r.detail||'(내용 없음)')}</span></div>`).join('')}</div>
        ${ui.hiding===id?hideBox(t):`<div class="actions"><button class="btn danger" type="button" data-act="hide-open" data-id="${id}">숨김 처리</button><button class="btn ghost" type="button" data-act="dismiss" data-id="${id}">신고 기각</button></div>`}</article>`;
    }).join('')}</div>`:'<div class="empty">확인할 신고가 없습니다.</div>';
  }else if(ui.aTab==='appeals'){
    body=ap.length?`<div class="stack">${ap.map(t=>`<article class="panel">${testInfo(t)}<p class="reason">이전 숨김 사유: ${esc(t.reason||'')}</p>
      ${ui.hiding===t.id?hideBox(t):`<div class="actions"><button class="btn" type="button" data-act="restore" data-id="${t.id}">재공개</button><button class="btn danger" type="button" data-act="hide-open" data-id="${t.id}">숨김 유지</button></div>`}</article>`).join('')}</div>`:'<div class="empty">대기 중인 재공개 요청이 없습니다.</div>';
  }else{
    body=`<div class="panel">${S.log.length?S.log.map(l=>`<div class="logrow"><span><strong>${esc(l.title)}</strong> <span class="muted">${esc(l.note)}</span></span><span class="pair"><span class="badge b-vis">${esc(l.action)}</span><span class="mono muted">${esc(l.date)}</span></span></div>`).join(''):'<p class="muted">아직 없습니다.</p>'}</div>`;
  }
  return `<div class="head"><h2>운영자</h2></div><p class="notice">테스트는 등록 즉시 공개되며, 운영자는 접수된 신고와 재공개 요청만 처리합니다.</p>${tabs}${body}`;
}

/* ---------- render & events ---------- */
function captureFeedbackDraft(){
 const form=$('form[data-form="feedback"]');if(!form)return;
 const test=byId(form.dataset.id);if(!test)return;
 const answers={};for(const q of test.survey){if(q.type==='text'){answers[q.id]=$('#a-'+q.id)?.value||'';}else{answers[q.id]=form.querySelector(`input[name="a-${q.id}"]:checked`)?.value||'';}}
 ui.feedbackDrafts[test.id]={answers,problemChoice:form.querySelector('[name="problem-choice"]:checked')?.value||'',bugIds:[...form.querySelectorAll('[name="linked-bugs"]:checked')].map(el=>el.value)};
}
function updateProblemGuidance(){const form=$('form[data-form="feedback"]');if(!form)return;const choice=form.querySelector('[name="problem-choice"]:checked')?.value;const links=$('#linked-bug-options'),newBug=$('#new-bug-guidance');if(links)links.hidden=choice!=='reported';if(newBug)newBug.hidden=choice!=='new';form.querySelectorAll('[data-legacy-bug-field]').forEach(el=>{el.hidden=choice==='reported'&&!el.querySelector('textarea').value;});}
function restoreFeedbackDraft(){
 const form=$('form[data-form="feedback"]');if(!form)return;
 const test=byId(form.dataset.id),draft=ui.feedbackDrafts[test.id];if(!draft){updateProblemGuidance();return;}
 for(const q of test.survey){if(q.type==='text'){const el=$('#a-'+q.id);if(el)el.value=draft.answers[q.id]||'';}else form.querySelectorAll(`input[name="a-${q.id}"]`).forEach(el=>el.checked=el.value===String(draft.answers[q.id]||''));}
 form.querySelectorAll('[name="problem-choice"]').forEach(el=>el.checked=el.value===draft.problemChoice);
 form.querySelectorAll('[name="linked-bugs"]').forEach(el=>el.checked=draft.bugIds.includes(el.value));updateProblemGuidance();
}
function openBugFromSurvey(){const panel=$('.bug-report-panel');if(panel){panel.open=true;panel.scrollIntoView({block:'start',behavior:'smooth'});$('#bug-title')?.focus({preventScroll:true});}}
function render(capture=true){
 if(capture)captureFeedbackDraft();
  syncDraft();
  renderMenu();
  const p=ui.page;
  $('#main').dataset.page=p;
  $('#main').innerHTML=p==='home'?renderHome():p==='tester'?renderTester():p==='developer'?renderDeveloper():(!cloud||cloud.canAdmin)?renderAdmin():'<p class="notice">운영자 권한이 필요합니다.</p>';
  restoreFeedbackDraft();
  mediaHydrator.hydrate($('#main'));
}
function nav(page,sub){
  syncDraft();
  clearUploads();
  ui.gallery=null;
  ui.page=PAGES.includes(page)?page:'home';
  ui.detail=null;ui.reporting=null;ui.hiding=null;ui.edit=null;ui.draft=null;
  if(ui.page==='tester')ui.tTab=sub||'open';
  if(ui.page==='developer')ui.dTab=sub||'mine';
  if(ui.page==='admin')ui.aTab=sub||'reports';
  try{if(location.hash!=='#'+ui.page)location.hash=ui.page}catch(e){}
  render();window.scrollTo(0,0);
}
function hashPage(){const h=(location.hash||'').slice(1);return PAGES.includes(h)?h:null}
function top(){const m=$('#main');if(m&&m.scrollIntoView)m.scrollIntoView({block:'start'})}

async function remoteCommand(action,payload){
 if(!cloud.requireUser()){toast('로그인이 필요합니다.');return false;}
 const userId=cloud.user.id;ui.saving=true;try{const next=await cloud.command(action,payload);if(cloud.user?.id!==userId){S=migrateFeatures(await cloud.snapshot());render();return false;}S=migrateFeatures(next);return true;}catch(error){toast(error.message);return false;}finally{ui.saving=false;}
}
async function handleCloudClick(action,button,event){
 const id=button.dataset.id;
 if(action==='account-login'){cloud.requireUser();return true;}
 if(action==='reset'){toast('실서비스 데이터는 초기화할 수 없습니다.');return true;}
 if(action==='open-notification'){const notice=allNotifications().find(n=>n.id===id);if(notice&&await remoteCommand('mark_read',{ids:[id]})){nav('tester','mine');ui.detail=notice.testId;render();}return true;}
 const handlers={
  'start-play':()=>['start_play',{testId:id}],
  'toggle-close':()=>['toggle_close',{testId:id}],
  'req-approve':()=>['review_application',{testId:id,testerId:button.dataset.req==='me'?cloud.user?.id:button.dataset.req,decision:'approve'}],
  'req-decline':()=>['review_application',{testId:id,testerId:button.dataset.req==='me'?cloud.user?.id:button.dataset.req,decision:'decline'}],
  'dismiss':()=>['dismiss',{testId:id}],
  'restore':()=>['restore',{testId:id}],
  'hide-confirm':()=>['hide',{testId:id,note:$('#hd-'+id).value.trim()}],
  'read-notifications':()=>['mark_read',{ids:allNotifications().map(n=>n.id)}]
 };
 if(!handlers[action])return false;event.preventDefault();const [command,payload]=handlers[action]();if(await remoteCommand(command,payload)){ui.hiding=null;render();}return true;
}
listen(document,'click',async e=>{
  const notifications=$('#notification-area details');if(notifications&&!notifications.contains(e.target))notifications.open=false;
  if(ui.saving&&e.target.closest('[data-nav],[data-act]')){e.preventDefault();return toast('저장 중입니다. 잠시 기다려 주세요.');}
  const n=e.target.closest('[data-nav]');
  if(n){e.preventDefault();return nav(n.dataset.nav,n.dataset.sub)}
  const b=e.target.closest('[data-act]');if(!b||b.disabled)return;
  const a=b.dataset.act,id=b.dataset.id;
  if(cloud&&await handleCloudClick(a,b,e))return;
  if(a==='cancel-application'){ui.cancelApplication=id;render(false);return;}
  if(a==='keep-application'){ui.cancelApplication=null;render(false);return;}
  if(a==='confirm-cancellation'){
    if(cloud){if(await remoteCommand('cancel_application',{testId:id})){ui.cancelApplication=null;delete ui.feedbackDrafts[id];render(false);toast('신청을 취소했습니다.');}return;}
    const t=byId(id),m=S.mine[id];if(!m||!['waiting','applied'].includes(m.status))return;
    const previous=clone(S);if(m.status==='applied')t.applicants=Math.max(0,t.applicants-1);t.requests=t.requests.filter(r=>r.id!=='me');delete S.mine[id];
    if(!save()){S=previous;return;}ui.cancelApplication=null;delete ui.feedbackDrafts[id];render(false);toast('신청을 취소했습니다.');return;
  }
  if(a==='open-bug-from-survey'){captureFeedbackDraft();openBugFromSurvey();return;}
  if(a==='media-remove'){const removed=ui.mediaDraft.find(m=>m.id===id);if(removed?.file)releaseStaged([removed]);ui.mediaDraft=ui.mediaDraft.filter(m=>m.id!==id);if(!ui.mediaDraft.some(m=>m.cover)){const first=ui.mediaDraft.find(m=>m.kind==='image');if(first)first.cover=true;}updateMediaEditor();return;}
  if(a==='bug-file-remove'){releaseStaged(ui.bugMedia);ui.bugMedia=[];updateBugPreview();return;}
  if(a==='media-select'){ui.gallery=id;const t=byId(ui.detail);const el=$('#detail-gallery');if(t&&el){el.outerHTML=galleryHtml(t,id);mediaHydrator.hydrate($('#main'));}return;}
  if(a==='start-play'){const m=S.mine[id];if(m?.status==='applied'){m.startedAt=new Date().toISOString();save();const el=$(`[data-progress-id="${id}"]`);if(el)el.outerHTML=progressHtml(byId(id),m);}return;}
  if(a==='read-notifications'){allNotifications().forEach(n=>S.readNotifications[n.id]=true);save();renderNotifications();return;}
  if(a==='open-notification'){const n=allNotifications().find(n=>n.id===id);if(n){S.readNotifications[id]=true;save();nav('tester','mine');ui.detail=n.testId;render();}return;}
  if(a==='home-genre' ||a==='catalog-genre'){ui.genre=b.dataset.genre;render();return;}
  if(a==='feature'){ui.featured=id;render();return;}
  if(a==='clear-filters'){ui.genre='전체';ui.search='';ui.platform='all';ui.sort='default';render();return;}
  if(a==='tab-t'){releaseStaged(ui.bugMedia);ui.bugMedia=[];ui.tTab=b.dataset.tab;ui.detail=null;return render()}
  if(a==='tab-d'){syncDraft();clearUploads();ui.dTab=b.dataset.tab;if(ui.dTab==='mine'){ui.edit=null;ui.draft=null}return render()}
  if(a==='tab-a'){ui.aTab=b.dataset.tab;ui.hiding=null;return render()}
  if(a==='genre'){ui.genre=b.dataset.genre;return render()}
  if(a==='open'){releaseStaged(ui.bugMedia);ui.bugMedia=[];ui.gallery=null;ui.page='tester';ui.detail=id;ui.reporting=null;render();return top()}
  if(a==='back'){ui.detail=null;ui.reporting=null;return render()}
  if(a==='report-open'){ui.reporting=id;return render()}
  if(a==='report-cancel'){ui.reporting=null;return render()}
  /* operator */
  if(a==='dismiss'){
    const t=byId(id),n=S.reports.filter(r=>r.testId===id&&r.status==='open');
    n.forEach(r=>r.status='dismissed');logAdd(t,'신고 기각',`신고 ${n.length}건, 정책 위반 아님`);save();render();return toast('신고를 기각했습니다.');
  }
  if(a==='hide-open'){ui.hiding=id;return render()}
  if(a==='hide-cancel'){ui.hiding=null;return render()}
  if(a==='hide-confirm'){
    const r=($('#hd-'+id).value||'').trim();
    if(r.length<4){$('#hd-err').textContent='숨김 사유를 4자 이상 입력해 주세요.';return}
    const t=byId(id),n=S.reports.filter(x=>x.testId===id&&x.status==='open');
    t.status='hidden';t.reason=r;n.forEach(x=>x.status='actioned');ui.hiding=null;
    logAdd(t,'숨김 처리',n.length?`신고 ${n.length}건 확인`:'재공개 요청 반려');save();render();return toast('숨김 처리했습니다. 개발자에게 사유가 표시됩니다.');
  }
  if(a==='restore'){const t=byId(id);t.status='open';delete t.reason;logAdd(t,'재공개','수정 내용 확인');save();render();return toast(`'${t.title}'을 다시 공개했습니다.`)}
  /* developer */
  if(a==='toggle-close'){const t=byId(id);t.status=t.status==='open'?'closed':'open';save();render();return toast(t.status==='open'?'모집을 재개했습니다.':'모집을 종료했습니다.')}
  if(a==='req-approve'||a==='req-decline'){
    const t=byId(id),r=(t.requests||[]).find(x=>x.id===b.dataset.req);if(!r)return;
    if(a==='req-approve'){
      if(deadlineState(t.deadline)==='overdue')return toast('마감일이 지났습니다. 먼저 기한을 연장해 주세요.');
      if(capacityFull(t))return toast('모집 인원이 가득 찼습니다.');
      r.status='approved';t.applicants++;
      if(r.id==='me'&&S.mine[t.id])S.mine[t.id].status='applied';
      save();render();return toast(`${r.name}님을 승인했습니다. 플레이 방법과 빌드 링크가 열립니다.`);
    }
    r.status='declined';
    if(r.id==='me'&&S.mine[t.id])S.mine[t.id].status='declined';
    save();render();return toast(`${r.name}님의 신청을 거절했습니다.`);
  }
  if(a==='q-add'){syncDraft();if(ui.draft.length<MAXQ)ui.draft.push(newQ('text'));return renderSurvey()}
  if(a==='q-del'){syncDraft();ui.draft.splice(+b.dataset.i,1);return renderSurvey()}
  if(a==='q-up'||a==='q-down'){
    syncDraft();const i=+b.dataset.i,j=a==='q-up'?i-1:i+1;
    if(j>=0&&j<ui.draft.length){const x=ui.draft[i];ui.draft[i]=ui.draft[j];ui.draft[j]=x}
    return renderSurvey();
  }
  if(a==='edit'){clearUploads();ui.edit=id;ui.draft=null;ui.dTab='new';render();return top()}
  if(a==='cancel-edit'){clearUploads();ui.edit=null;ui.draft=null;ui.dTab='mine';return render()}
  if(a==='reset'){const previous=S,ids=[...new Set([...S.tests.flatMap(t=>t.media.map(m=>m.id)),...S.bugs.flatMap(b=>(b.attachments||[]).map(m=>m.id))])];clearUploads();S=migrateFeatures(seed());if(!save()){S=previous;return;}removeMedia(ids).catch(()=>{});ui.detail=null;ui.reporting=null;ui.hiding=null;ui.edit=null;ui.draft=null;ui.tTab='open';ui.dTab='mine';ui.aTab='reports';ui.genre='전체';render();return toast('예시 데이터로 되돌렸습니다.')}
});

listen(document,'change',e=>{
  if(e.target.name==='problem-choice'){updateProblemGuidance();captureFeedbackDraft();if(e.target.value==='new')openBugFromSurvey();return;}
  if(e.target.name==='linked-bugs'){captureFeedbackDraft();return;}
  if(e.target.id==='f-media'||e.target.id==='bug-file'){
    const isBug=e.target.id==='bug-file',files=Array.from(e.target.files||[]),existing=isBug?ui.bugMedia:(ui.mediaDraft||[]);
    const error=validateMedia(existing,files,isBug?{imagesOnly:true,maxImages:1,maxVideos:0}:{});
    const err=$(isBug?'#bug-error':'#media-error');if(err)err.textContent=error;
    if(!error){const items=stageMedia(files);if(isBug)items.forEach(item=>item.scope='bug');if(isBug){ui.bugMedia.push(...items);updateBugPreview();}else{ui.mediaDraft.push(...items);if(!ui.mediaDraft.some(m=>m.cover)){const first=ui.mediaDraft.find(m=>m.kind==='image');if(first)first.cover=true;}updateMediaEditor();}}
    e.target.value='';return;
  }
  if(e.target.name==='cover-id'){ui.mediaDraft.forEach(m=>m.cover=m.id===e.target.value);return;}

  if(e.target.id==='platform-filter'){ui.platform=e.target.value;render();return;}
  if(e.target.id==='sort-filter'){ui.sort=e.target.value;render();return;}
  if(e.target.id==='f-vis'){
    const c=$('#code-field'),d=$('#vis-desc');
    if(c)c.hidden=e.target.value!=='invite';
    if(d)d.textContent=VIS_DESC[e.target.value]||'';
  }
  if(e.target.id==='f-unlimited'){
    $('#f-slots').disabled=e.target.checked;
  }
  if(e.target.classList&&e.target.classList.contains('q-type')){syncDraft();renderSurvey()}
});

listen(document,'submit',async e=>{
  const f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();
  if(f.dataset.form==='search'){ui.search=f.querySelector('input').value.trim();render();return;}
  if(cloud&&['report','apply','feedback','bug','bug-status','dev'].includes(f.dataset.form)&&!cloud.requireUser()){toast('로그인이 필요합니다.');return;}
  if(f.dataset.form==='report'){
    if(cloud){if(await remoteCommand('report',{testId:f.dataset.id,reason:$('#rp-cat').value,detail:$('#rp-detail').value.trim()})){ui.reporting=null;render();toast('신고를 접수했습니다. 운영자가 확인합니다.');}return;}
    const t=byId(f.dataset.id),cat=$('#rp-cat').value,detail=$('#rp-detail').value.trim(),err=$('#rp-err');
    if(cat==='기타'&&detail.length<5){err.textContent='기타 사유는 5자 이상 적어 주세요.';return}
    S.reports.push({id:'p'+Date.now(),testId:t.id,cat,detail,by:'나(테스터)',date:today(),status:'open'});
    S.myReports[t.id]=true;ui.reporting=null;save();render();
    return toast('신고를 접수했습니다. 운영자가 확인합니다.');
  }
  if(ui.saving)return;
  if(f.dataset.form==='apply'){
    if(cloud){if(await remoteCommand('apply',{testId:f.dataset.id,agreed:$('#ap-agree').checked,code:$('#ap-code')?.value.trim().toUpperCase()||''})){render();toast('신청을 저장했습니다.');}return;}
    const t=byId(f.dataset.id),err=$('#ap-err');
    if(t.status!=='open'||deadlineState(t.deadline)==='overdue'){err.textContent='모집이 종료되었습니다.';return}
    if(t.vis==='invite'){
      const c=($('#ap-code').value||'').trim().toUpperCase();
      if(!c||c!==String(t.code||'').toUpperCase()){err.textContent='초대 코드가 올바르지 않습니다.';return}
    }
    if(!$('#ap-agree').checked){err.textContent='이용 동의서에 동의해 주세요.';return}
    if(capacityFull(t)){err.textContent='모집이 마감되었습니다.';return}
    t.requests=t.requests||[];
    if(t.vis==='approval'){
      t.requests.push({id:'me',name:'나(테스터)',status:'waiting',agreed:true});
      S.mine[t.id]={status:'waiting',agreedAt:today()};save();render();
      return toast('승인 요청을 보냈습니다. 개발자가 승인하면 참여가 열립니다.');
    }
    t.applicants++;S.mine[t.id]={status:'applied',agreedAt:today()};save();render();
    return toast('신청했습니다. 빌드를 플레이한 뒤 설문에 답해 주세요.');
  }
  if(f.dataset.form==='bug'){
    captureFeedbackDraft();
    const t=byId(f.dataset.id),err=$('#bug-error'),application=S.mine[t?.id];
    if(!t||!['open','closed'].includes(t.status)||!application||!['applied','done'].includes(application.status)){err.textContent='참여가 승인된 테스트에서만 버그를 제보할 수 있습니다.';return;}
    const data={title:$('#bug-title').value.trim(),description:$('#bug-description').value.trim(),steps:$('#bug-steps').value.trim(),device:$('#bug-device').value.trim(),severity:$('#bug-severity').value};
    const validation=bugValidation(data);if(validation){err.textContent=validation;return;}
    ui.saving=true;const submit=f.querySelector('[type="submit"]');submit.disabled=true;
    const pending=[...ui.bugMedia],previous=clone(S);
    try{await saveMedia(pending);}catch{ui.saving=false;submit.disabled=false;err.textContent='첨부 파일을 저장하지 못했습니다. 저장 공간을 확인해 주세요.';return;}
    const date=new Date().toISOString();
    const bugId=crypto.randomUUID();
    if(cloud){ui.saving=false;const before=new Set(S.bugs.map(b=>b.id));if(await remoteCommand('bug',{testId:t.id,data:{...data,attachments:pending.map(mediaMetadata)}})){const newBug=S.bugs.find(b=>!before.has(b.id));const draft=ui.feedbackDrafts[t.id];if(draft&&newBug){draft.problemChoice='reported';draft.bugIds=[...new Set([...draft.bugIds,newBug.id])];}releaseStaged(ui.bugMedia);ui.bugMedia=[];render(false);toast('버그 제보를 저장했습니다. 개발자가 확인할 수 있습니다.');}else{submit.disabled=false;await removeMedia(pending.map(m=>mediaMetadata(m).id)).catch(()=>{});}return;}
    S.bugs.unshift({...data,id:bugId,testId:t.id,testerId:'me',build:t.build,status:'new',developerNote:'',attachments:pending.map(mediaMetadata),createdAt:date,updatedAt:date,history:[{status:'new',date,note:''}]});
    if(!save()){S=previous;ui.saving=false;submit.disabled=false;await removeMedia(pending.map(m=>m.id)).catch(()=>{});return;}
    ui.saving=false;releaseStaged(ui.bugMedia);ui.bugMedia=[];const draft=ui.feedbackDrafts[t.id];if(draft){draft.problemChoice='reported';draft.bugIds=[...new Set([...draft.bugIds,bugId])];}render(false);toast('버그 제보를 저장했습니다. 개발자가 확인할 수 있습니다.');return;
  }
  if(f.dataset.form==='bug-status'){
    const bug=S.bugs.find(b=>b.id===f.dataset.id),test=byId(bug?.testId);
    if(!bug||test?.owner!=='me')return toast('내 테스트의 버그만 처리할 수 있습니다.');
    const status=f.querySelector('[name="status"]').value,note=f.querySelector('[name="note"]').value.trim();
    if(!Object.hasOwn(BUG_STATUSES,status)||note.length>2000)return toast('처리 상태와 답변 내용을 확인해 주세요.');
    if(bug.status===status&&bug.developerNote===note)return toast('변경된 내용이 없습니다.');
    if(cloud){if(await remoteCommand('bug_status',{bugId:bug.id,status,note})){render();toast('버그 처리 내용을 저장했습니다.');}return;}
    const previous=clone(S),date=new Date().toISOString();
    bug.status=status;bug.developerNote=note;bug.updatedAt=date;bug.history.push({status,note,date});
    S.notifications.unshift({id:crypto.randomUUID(),type:'bug',testId:test.id,bugTitle:bug.title,bugId:bug.id,status,title:'버그 제보 처리 내용이 업데이트되었습니다.',date});S.notifications=S.notifications.slice(0,100);
    if(!save()){S=previous;return;}
    render();toast('버그 처리 내용을 저장했습니다.');return;
  }
  if(f.dataset.form==='feedback'){
    const t=byId(f.dataset.id),err=$('#fb-err'),answers={};
    if(!t||S.mine[t.id]?.status!=='applied'){err.textContent='참여 중인 테스트에서만 설문을 제출할 수 있습니다.';return;}
    const issueChoice=f.querySelector('[name="problem-choice"]:checked')?.value||'',bugIds=[...f.querySelectorAll('[name="linked-bugs"]:checked')].map(el=>el.value);
    const issueError=validateFeedbackIssue(issueChoice,bugIds,S.bugs,t.id);if(issueError){err.textContent=issueError;if(issueChoice==='new')openBugFromSurvey();return;}
    for(const q of t.survey){
      let val='';
      if(q.type==='text')val=($('#a-'+q.id).value||'').trim();
      else{const c=f.querySelector(`input[name="a-${q.id}"]:checked`);val=c?(q.type==='scale'?+c.value:c.value):''}
      if(q.required&&val===''){err.textContent='필수 문항에 답해 주세요: '+q.label;return}
      if(val!=='')answers[q.id]=val;
    }
    if(cloud){if(await remoteCommand('feedback',{testId:t.id,answers,issueStatus:issueChoice,bugIds:issueChoice==='reported'?bugIds:[]})){delete ui.feedbackDrafts[t.id];render(false);toast('설문을 제출했습니다.');}return;}
    const previous=clone(S);
    t.feedbacks.push({answers,issueStatus:issueChoice,bugIds:issueChoice==='reported'?bugIds:[]});
    S.mine[t.id]=Object.assign({},S.mine[t.id],{status:'done'});if(!save()){S=previous;return;}delete ui.feedbackDrafts[t.id];render(false);return toast('설문을 제출했습니다.');
  }
  if(f.dataset.form==='dev'){
    syncDraft();
    const g=id=>$('#'+id).value.trim(),err=$('#dev-err');
    const d={title:g('f-title'),team:g('f-team'),genre:g('f-genre'),platform:g('f-platform'),build:g('f-build'),minutes:+g('f-min'),slots:$('#f-unlimited').checked?null:+g('f-slots'),
      feedbackFocus:g('f-focus'),deadline:g('f-deadline'),vis:g('f-vis'),code:g('f-code').toUpperCase(),teaser:g('f-teaser'),link:g('f-link'),how:g('f-how')};
    if((!ui.edit||d.feedbackFocus)&& (d.feedbackFocus.length<10||d.feedbackFocus.length>600)){err.textContent='확인할 점은 10~600자로 입력해 주세요.';return;}
    const deadlineError=deadlineValidation(d.deadline,byId(ui.edit)?.createdDate||today(),byId(ui.edit)?.deadline);
    if(deadlineError){err.textContent=deadlineError;return;}
    if(!d.title||!d.team){err.textContent='게임 이름과 팀 이름을 입력해 주세요.';return}
    if(d.teaser.length<8){err.textContent='공개 소개를 8자 이상 적어 주세요.';return}
    if(d.vis==='invite'){if(!/^[A-Z0-9]{4,12}$/.test(d.code)){err.textContent='초대 코드는 영문과 숫자 4~12자로 입력해 주세요.';return}}else{d.code=''}
    if(!safeUrl(d.link)){err.textContent='빌드 링크는 https:// 로 시작해야 합니다.';return}
    if(d.how.length<10){err.textContent='플레이 방법을 10자 이상 적어 주세요.';return}
    if(!Number.isInteger(d.minutes)||d.minutes<5||d.minutes>120){err.textContent='소요 시간과 모집 인원을 확인해 주세요.';return}
    const capacityError=capacityValidation(d.slots,d.deadline,byId(ui.edit)?.applicants||0);
    if(capacityError){err.textContent=capacityError;return;}
    if(!ui.draft||!ui.draft.length){err.textContent='설문 질문을 한 개 이상 만들어 주세요.';return}
    const sv=[];
    for(let i=0;i<ui.draft.length;i++){
      const q=ui.draft[i],label=q.label.trim();
      if(label.length<2){err.textContent=`질문 ${i+1}번의 내용을 입력해 주세요.`;return}
      let options=[];
      if(q.type==='choice'){
        options=q.options.map(s=>s.trim()).filter(Boolean);
        if(options.length<2||options.length>6||new Set(options).size!==options.length){err.textContent=`질문 ${i+1}번의 보기는 서로 다른 2~6개가 필요합니다.`;return}
      }
      sv.push({id:q.id,type:q.type,label,options,required:!!q.required});
    }
    d.survey=sv;
    if(!$('#f-policy').checked){err.textContent='등록 기준을 확인하고 동의해 주세요.';return}
    let msg;
    const oldState=clone(S),pending=ui.mediaDraft.filter(m=>m.file),oldIds=(byId(ui.edit)?.media||[]).map(m=>m.id);
    d.media=ui.mediaDraft.map(mediaMetadata);
    ui.saving=true;const submit=f.querySelector('[type="submit"]');if(submit)submit.disabled=true;
    try{await saveMedia(pending);}catch(error){ui.saving=false;if(submit)submit.disabled=false;err.textContent='파일을 저장하지 못했습니다. 저장 공간과 브라우저 설정을 확인해 주세요.';return;}
    if(cloud){ui.saving=false;if(await remoteCommand('save_test',{testId:ui.edit,data:d})){clearUploads();ui.edit=null;ui.draft=null;ui.dTab='mine';render();top();toast('테스트를 저장했습니다.');await removeMedia(oldIds.filter(id=>!d.media.some(m=>m.id===id))).catch(()=>{});}else{if(submit)submit.disabled=false;await removeMedia(pending.map(m=>mediaMetadata(m).id)).catch(()=>{});}return;}
    if(ui.edit){
      const t=byId(ui.edit),was=t.status;Object.assign(t,d);
      if(was==='hidden'){t.status='appeal';msg='수정했습니다. 운영자가 재공개 여부를 검토합니다.'}else msg='수정 내용을 저장했습니다.';
    }else{
      S.tests.push(Object.assign({id:'t'+Date.now(),createdDate:today(),owner:'me',status:'open',applicants:0,feedbacks:[],requests:[]},d));
      msg='등록했습니다. 테스트가 바로 공개되었습니다.';
    }
    if(!save()){S=oldState;ui.saving=false;if(submit)submit.disabled=false;await removeMedia(pending.map(m=>m.id)).catch(()=>{});return;}
    ui.saving=false;clearUploads();ui.edit=null;ui.draft=null;ui.dTab='mine';render();top();toast(msg);
    await removeMedia(oldIds.filter(id=>!d.media.some(m=>m.id===id))).catch(()=>{});
  }
});

listen(window,'hashchange',()=>{if(ui.saving)return;const p=hashPage();if(p&&p!==ui.page)nav(p)});
let disposeAccount;
if(cloud){
 const footer=document.querySelector('footer p');if(footer)footer.textContent='PlayTest Match · 개발자와 플레이어가 함께 만드는 게임.';
 document.querySelector('footer [data-act="reset"]')?.remove();
 disposeAccount=cloud.mountAccount(async reset=>{if(reset){clearUploads();ui.feedbackDrafts={};ui.detail=null;ui.edit=null;ui.draft=null;ui.page='home';location.hash='#home';mediaHydrator.dispose();mediaHydrator=createMediaHydrator();S=migrateFeatures({tests:[]});render();}S=migrateFeatures(await cloud.snapshot());render();});
}
const h0=hashPage();if(h0)ui.page=h0;
render();
const deadlineTimer=typeof window.setInterval==='function'?window.setInterval(refreshDeadlines,60000):null;
listen(window,'focus',refreshDeadlines);
listen(document,'keydown',e=>{if(e.key==='Escape'){const el=$('#notification-area details');if(el?.open){el.open=false;el.querySelector('summary').focus();}}});
return ()=>{disposeAccount?.();controller.abort();if(deadlineTimer)clearInterval(deadlineTimer);clearUploads();mediaHydrator.dispose();};
}
