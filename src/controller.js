import {buildVersions,filterBuild,feedbackQuestions,versionValue} from './feedback-tools.js';
import {GENRES,OTHER_GENRE,gameGenreSelection,matchesGenre} from './genres.js';
import {developerDrafts,draftRecord,draftKey} from './developer-drafts.js';
import {surveyCsv,bugsCsv,downloadCsv} from './result-export.js';
import {dateAfterDays,seoulDate,deadlineTime,deadlineState,deadlineNotifications,migrateFeatures,bugValidation,validateFeedbackIssue,isLegacyBugQuestion,BUG_STATUSES,unlimitedCapacity,capacityFull,remainingCapacity,capacityValidation,maximumDeadline,deadlineValidation,recruitmentOpen} from './playtest-features.js';
import {validateMedia,stageMedia,saveMedia,removeMedia,mediaMetadata,releaseStaged,createMediaHydrator} from './media-store.js';
import {fileView,mediaEditor,galleryHtml,deadlineHtml,progressHtml,bugFormHtml,bugListHtml,notificationsHtml,focusHtml,problemChoiceHtml,playedBuildHtml,sharedBugOptionsHtml,duplicateBugHtml} from './feature-views.js';
export function initialize({cloud=null,initialState=null}={}){
const controller = new AbortController();
const listen=(target,type,handler)=>target.addEventListener(type,handler,{signal:controller.signal});

const KEY='playtest-match-project-v1';

const PLATFORMS=['WebGL','Windows','Android'];
const PAGES=['home','tester','developer','admin','guide'];
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
const ui={publishedGame:null,logGame:null,unresolvedBugGame:null,resultBuild:{},bugBuild:{},devFields:null,draftDirty:false,savedDrafts:[],draftStatus:'',draftDelete:null,draftReady:false,cancelApplication:null,feedbackDrafts:{},mediaDraft:null,bugMedia:[],saving:false,gallery:null,search:'',platform:'all',sort:'default',featured:null,page:'home',tTab:'mine',genre:'전체',detail:null,reporting:null,dTab:'mine',edit:null,draft:null,aTab:'reports',hiding:null};
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeUrl(value){
  if(typeof value!=='string'||value.length>2048||!/^https:\/\//i.test(value)||/[\s\\\x00-\x1f\x7f]/.test(value))return '';
  try{
    const url=new URL(value);
    return url.hostname&&!url.username&&!url.password?url.href:'';
  }catch{return '';}
}
const byId=id=>S.tests.find(t=>t.id===id);
const today=()=>seoulDate();
const allNotifications=()=>[...deadlineNotifications(S),...S.notifications].slice(0,100);
function renderNotifications(){const el=$('#notification-area');if(el){const open=el.querySelector('details')?.open;el.innerHTML=notificationsHtml(allNotifications(),S,{canRefresh:!!cloud?.user});if(open)el.querySelector('details').open=true;}}
function clearUploads(){releaseStaged((ui.mediaDraft||[]).filter(x=>x.file));releaseStaged(ui.bugMedia);ui.mediaDraft=null;ui.bugMedia=[];}
let draftTimer,draftRevision=0,draftPending=Promise.resolve(),draftOwner=cloud?.user?.id||(!cloud?'local':'');
const DEV_FIELDS=['f-title','f-team','f-other-genres','f-platform','f-build','f-min','f-slots','f-deadline','f-vis','f-code','f-focus','f-teaser','f-link','f-how'];
function currentDraftOwner(){return cloud?.user?.id||(!cloud?'local':'');}
function selectedGenres(){
  return [...document.querySelectorAll('[name="f-genres"]:checked')].map(input=>input.value);
}
function genreTags(genres){
  return genres.map(genre=>`<span>${esc(genre)}</span>`).join('');
}
function updateGenreSummary(){
  $('#selected-genre-tags').innerHTML=genreTags(selectedGenres());
}
function updateDevSelectors(){
  const unlimited=$('#f-unlimited').checked;
  $('#f-slots').disabled=unlimited;
  $('#capacity-stepper').hidden=unlimited;
  const other=$('#f-other').checked;
  $('#other-genre-field').hidden=!other;
  $('#f-other-genres').disabled=!other;
}
function captureDevFields(){
  if(!$('[data-form="dev"]'))return false;
  ui.devFields=Object.fromEntries(DEV_FIELDS.map(id=>[id,$('#'+id).value]));
  ui.devFields['f-genres']=selectedGenres();
  ui.devFields['f-unlimited']=$('#f-unlimited').checked;
  return true;
}
function restoreDevFields(){
  if(!ui.devFields||!$('[data-form="dev"]'))return;
  for(const id of DEV_FIELDS)if(Object.hasOwn(ui.devFields,id))$('#'+id).value=ui.devFields[id];
  const genres=ui.devFields['f-genres']??[ui.devFields['f-genre']];
  document.querySelectorAll('[name="f-genres"]').forEach(input=>{input.checked=genres.includes(input.value);});
  $('#f-unlimited').checked=!!ui.devFields['f-unlimited'];
  $('#f-limited').checked=!$('#f-unlimited').checked;
  updateDevSelectors();
  updateGenreSummary();
  $('#code-field').hidden=$('#f-vis').value!=='invite';
  $('#vis-desc').textContent=VIS_DESC[$('#f-vis').value]||'';
}
function draftStatus(message){ui.draftStatus=message;const node=$('#draft-status');if(node)node.textContent=message;}
async function loadDeveloperDrafts(){const owner=currentDraftOwner();if(!owner)return;try{const records=await developerDrafts.list(owner);if(owner!==currentDraftOwner())return;ui.savedDrafts=records.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}catch{ui.savedDrafts=[];}finally{ui.draftReady=true;}}
async function persistDeveloperDraft(force=false){clearTimeout(draftTimer);if(!force&&!ui.draftDirty)return true;if(!captureDevFields()||!currentDraftOwner())return true;syncDraft();const revision=draftRevision,owner=currentDraftOwner(),record=draftRecord(owner,ui.edit,ui.devFields,ui.draft||[],ui.mediaDraft||[]);draftStatus('임시 저장 중…');draftPending=draftPending.catch(()=>{}).then(()=>developerDrafts.save(record));try{await draftPending;if(owner!==currentDraftOwner())return;ui.savedDrafts=[record,...ui.savedDrafts.filter(d=>d.key!==record.key)];if(revision===draftRevision)ui.draftDirty=false;draftStatus('임시 저장 완료');return true;}catch{draftStatus('임시 저장에 실패했습니다. 저장 공간과 브라우저 설정을 확인해 주세요.');return false;}}
function queueDeveloperDraft(){if(!$('[data-form="dev"]'))return;ui.draftDirty=true;draftRevision++;draftStatus('저장 대기 중…');clearTimeout(draftTimer);draftTimer=setTimeout(()=>void persistDeveloperDraft(),400);}
async function startDeveloperEditor(edit=null){if(await persistDeveloperDraft()===false)return;await loadDeveloperDrafts();clearUploads();ui.edit=edit;ui.devFields=null;ui.draft=null;ui.draftStatus='';const record=ui.savedDrafts.find(d=>d.key===draftKey(currentDraftOwner(),edit));if(record){ui.devFields={...record.fields};ui.draft=clone(record.survey);ui.mediaDraft=record.media.map(item=>({...item,...(item.file?{url:URL.createObjectURL(item.file)}:{})}));ui.draftStatus='임시 저장한 내용을 불러왔습니다.';}ui.draftDirty=false;draftRevision++;ui.dTab='new';render(false);top();}
async function clearPublishedDraft(edit){clearTimeout(draftTimer);const owner=currentDraftOwner();try{await draftPending.catch(()=>{});await developerDrafts.remove(owner,edit);ui.savedDrafts=ui.savedDrafts.filter(d=>d.key!==draftKey(owner,edit));}catch{toast('등록은 완료했지만 임시 저장 정리에 실패했습니다. 임시 저장 목록을 확인해 주세요.');}ui.devFields=null;ui.draftStatus='';}
function draftsHtml(){return `<section class="panel"><h2>임시 저장</h2><p class="hint">같은 계정과 이 브라우저에서 이어서 작성할 수 있습니다. 브라우저 데이터를 지우면 삭제됩니다. 공개 등록 전에는 다른 사람에게 보이지 않습니다.</p>${!ui.draftReady?'<p>불러오는 중…</p>':!ui.savedDrafts.length?'<p class="empty">임시 저장한 게임이 없습니다.</p>':ui.savedDrafts.map(d=>`<article class="draft-row"><div><h3 data-no-translate>${esc(d.fields['f-title']||'제목 없는 게임')}</h3><p class="hint"><span>${d.edit?'수정 중':'새 게임'}</span> · <time>${esc(new Date(d.updatedAt).toLocaleString('ko-KR'))}</time></p></div><div class="actions"><button class="btn ghost sm" type="button" data-act="resume-draft" data-id="${esc(d.key)}">이어서 작성</button><button class="text-link" type="button" data-act="delete-draft" data-id="${esc(d.key)}">삭제</button>${ui.draftDelete===d.key?`<p>이 브라우저의 임시 저장과 첨부파일을 삭제합니다. 공개된 게임은 유지됩니다.</p><button class="btn danger sm" type="button" data-act="confirm-delete-draft" data-id="${esc(d.key)}">임시 저장 삭제 확정</button><button class="btn ghost sm" type="button" data-act="keep-draft">유지</button>`:''}</div></article>`).join('')}</section>`;}
function updateMediaEditor(){const el=$('#media-preview');if(el){el.innerHTML=mediaEditor(ui.mediaDraft||[]);mediaHydrator.hydrate(el);}}
function updateBugPreview(){const el=$('#bug-preview');if(el)el.innerHTML=ui.bugMedia.map(x=>fileView(x,{preview:true})+`<button class="text-link" type="button" data-act="bug-file-remove">삭제</button>`).join('');}
function refreshDeadlines(){renderNotifications();const main=$('#main');if(main?.querySelectorAll)main.querySelectorAll('[data-deadline-test]').forEach(el=>{const test=byId(el.dataset.deadlineTest);if(test)el.outerHTML=deadlineHtml(test);});if((ui.page==='home'||ui.page==='tester'&&ui.tTab==='open')&&main?.querySelector?.('.deadline-line.overdue'))render(false);}

const tBadge=s=>`<span class="badge b-${TBADGE[s]}">${TSTATUS[s]}</span>`;
const visBadge=v=>`<span class="badge b-vis">${VIS[v]||VIS.public}</span>`;
const openReports=()=>S.reports.filter(r=>r.status==='open');
const reportedIds=()=>[...new Set(openReports().map(r=>r.testId))].filter(id=>byId(id)&&['open','hidden'].includes(byId(id).status));
const appeals=()=>S.tests.filter(t=>t.status==='appeal');
const adminCount=()=>reportedIds().length+appeals().length;
const visibleTo=t=>t.status==='open'||t.owner==='me'||(t.status==='closed'&&(S.mine[t.id]||S.favorites.includes(t.id)));

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),2800)}
function logAdd(t,action,note,beforeStatus,actor='운영자'){
  S.log.unshift({testId:t.id,date:new Date().toISOString(),title:t.title,action,note,actor,beforeStatus,afterStatus:t.status});
}

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
function favoriteButton(t){const saved=S.favorites.includes(t.id);return `<button class="favorite-button ${saved?'saved':''}" type="button" data-act="favorite" data-id="${esc(t.id)}" aria-pressed="${saved}" aria-label="${saved?'찜 해제':'게임 찜'}"><span aria-hidden="true">${saved?'♥':'♡'}</span><span>${saved?'찜한 게임':'찜하기'}</span></button>`;}
function bugSummaries(){return cloud?S.bugSummaries:S.bugs.map(b=>({id:b.id,testId:b.testId,title:b.title,status:b.status,build:b.build,own:b.testerId==='me'}));}
function selectedBugIds(form){const choice=form.querySelector('[name="problem-choice"]:checked')?.value;return [...form.querySelectorAll(`[data-link-choice="${choice}"] [name="linked-bugs"]:checked`)].map(el=>el.value);}
function updateDuplicates(){const form=$('[data-form="bug"]'),node=$('#similar-bugs');if(form&&node)node.innerHTML=duplicateBugHtml($('#bug-title').value,bugSummaries(),form.dataset.id,$('#bug-build').value);}
function versionFilterHtml(t,kind){const selected=(kind==='survey'?ui.resultBuild:ui.bugBuild)[t.id]||'all',items=kind==='survey'?t.feedbacks:S.bugs.filter(b=>b.testId===t.id);return `<div class="version-filter"><label for="version-${kind}-${t.id}">빌드 버전별 보기</label><select id="version-${kind}-${t.id}" data-version-kind="${kind}" data-test-id="${t.id}"><option value="all" ${selected==='all'?'selected':''}>전체 버전</option>${buildVersions(t,S.bugs).map(v=>`<option value="${esc(versionValue(v))}" ${selected===versionValue(v)?'selected':''} data-no-translate>${esc(v)}</option>`).join('')}${items.some(item=>!item.build)?`<option value="legacy" ${selected==='legacy'?'selected':''}>버전 미기록</option>`:''}</select></div>`;}
function gameGenreHtml(t){
 const {genres,customGenres}=gameGenreSelection(t);
 return [...genres.map(genre=>`<span>${esc(genre)}</span>`),...customGenres.map(genre=>`<span data-no-translate>${esc(genre)}</span>`)].join('<span aria-hidden="true"> · </span>');
}
function gameCard(t){
 const m=S.mine[t.id],full=t.status!=='open'||capacityFull(t)||deadlineState(t.deadline)==='overdue';
 return `<article class="card game-card"><button class="cover-button" type="button" data-act="open" data-id="${t.id}" aria-label="${esc(t.title)} 테스트 살펴보기">${gameArt(t)}</button><div class="card-body"><div class="row"><span class="genre-label">${gameGenreHtml(t)}</span>${visBadge(t.vis)}</div>${favoriteButton(t)}<h3 data-no-translate>${esc(t.title)}</h3><p class="team" data-no-translate>${esc(t.team)}</p><p class="teaser" data-no-translate>${esc(t.teaser)}</p>${focusHtml(t,true)}<div class="card-meta"><span>${esc(t.platform)}</span><span>◷ ${t.minutes}분</span></div><div class="foot">${deadlineHtml(t)}${slotsHtml(t)}<button class="btn ghost card-join" type="button" data-act="open" data-id="${t.id}">${m?MINE_LABEL[m.status]:full?'모집 마감':'테스트 참여하기'} <span>→</span></button></div></div></article>`;
}
function filteredTests(list){
 let result=list.filter(t=>matchesGenre(t,ui.genre)&&(ui.platform==='all'||t.platform===ui.platform)&&(!ui.search||[t.title,t.team,t.teaser,...Object.values(gameGenreSelection(t)).flat(),t.feedbackFocus].join(' ').toLocaleLowerCase().includes(ui.search.toLocaleLowerCase())));
 if(ui.sort==='short')result.sort((a,b)=>a.minutes-b.minutes);
 if(ui.sort==='seats')result.sort((a,b)=>(remainingCapacity(b)-remainingCapacity(a))||0);
 if(ui.sort==='new')result.reverse();
 return result;
}
function catalogTools(){return `<div class="catalog-tools"><form data-form="search" class="search-form"><label class="sr-only" for="game-search">게임 검색</label><input id="game-search" type="search" name="search" value="${esc(ui.search)}" placeholder="게임, 개발팀 검색" autocomplete="off"><button type="submit" aria-label="검색">⌕</button></form><div class="catalog-selects"><label class="sr-only" for="platform-filter">플랫폼</label><select id="platform-filter"><option value="all" ${ui.platform==='all'?'selected':''}>모든 플랫폼</option>${PLATFORMS.map(p=>`<option value="${p}" ${ui.platform===p?'selected':''}>${p}</option>`).join('')}</select><label class="sr-only" for="sort-filter">정렬</label><select id="sort-filter">${[['default','등록 순'],['new','최근 등록 순'],['short','짧은 플레이 시간 순'],['seats','남은 자리 많은 순']].map(([v,l])=>`<option value="${v}" ${ui.sort===v?'selected':''}>${l}</option>`).join('')}</select></div></div>`;}
function homeGenresHtml(tests){const button=g=>`<button class="side-link ${ui.genre===g?'active':''}" type="button" data-act="catalog-genre" data-genre="${g}" aria-pressed="${ui.genre===g}">${g}<span>${tests.filter(t=>matchesGenre(t,g)).length}</span></button>`;return `<div class="home-genre-strip">${GENRES.slice(0,8).map(button).join('')}</div>`+`<details class="more-genres" ${[...GENRES.slice(8),OTHER_GENRE].includes(ui.genre)?'open':''}><summary>장르 더 보기</summary><div>${GENRES.slice(8).map(button).join('')}</div></details>${button(OTHER_GENRE)}`;}
function workspace(side,body){
 return `<div class="store-layout"><aside class="store-sidebar">${side}</aside><div class="store-content">${body}</div></div>`;
}
function islandArt(){return '<img class="island-art" src="/assets/playtest-island.jpg" alt="">';}
function sectionNav(label,action,selected,items){
 return `<h2>${label}</h2>${items.map(([key,title])=>`<button type="button" class="side-link ${key===selected?'active':''}" aria-pressed="${key===selected}" data-act="${action}" data-tab="${key}">${title}</button>`).join('')}`;
}
function featureQuestion(t){
 return t.feedbackFocus?`<div class="hero-question"><b>개발자의 질문</b><p data-no-translate>${esc(t.feedbackFocus)}</p></div>`:'';
}
function catalogRow(t){
 return `<article class="catalog-row"><button class="row-cover" data-act="open" data-id="${t.id}" aria-label="${esc(t.title)} 테스트 살펴보기">${gameArt(t)}</button><button class="row-title" data-act="open" data-id="${t.id}" data-no-translate>${esc(t.title)}</button><div class="row-facts"><span>${gameGenreHtml(t)}</span><span>${esc(t.platform)}</span><span>${t.minutes}분</span></div>${slotsHtml(t)}${deadlineHtml(t)}${favoriteButton(t)}</article>`;
}
function renderHome(){
 const tests=S.tests.filter(t=>recruitmentOpen(t));
 const featured=tests.find(t=>t.id===ui.featured)||tests[Math.floor(Math.random()*tests.length)];
 ui.featured=featured?.id??null;
 const featuredChoices=tests.slice(0,4);
 if(featured&&!featuredChoices.includes(featured))featuredChoices[featuredChoices.length-1]=featured;
 const list=filteredTests(tests);
 const side=`<h2>게임 둘러보기</h2><button class="side-link ${ui.genre==='전체'?'active':''}" data-act="catalog-genre" data-genre="전체">전체 게임</button><button class="side-link" data-act="show-favorites">찜한 게임</button><h3>장르</h3>${homeGenresHtml(tests)}`;
 const hero=featured?`<div><p class="genre-label">${gameGenreHtml(featured)} · ${esc(featured.platform)}</p><h1 data-no-translate>${esc(featured.title)}</h1>${featureQuestion(featured)}<div class="actions"><button class="btn" data-act="open" data-id="${featured.id}">테스트 살펴보기 →</button>${deadlineHtml(featured)}</div></div><div class="hero-artwork">${gameArt(featured)}</div>`:`<div><h1>PlayTest Match</h1><p>개발 중인 게임을 먼저 만나고, 피드백을 남겨주세요.</p><a class="btn" href="#developer" data-nav="developer" data-sub="new">테스트 등록하기 →</a></div>${islandArt()}`;
 const picks=tests.length>1?`<div class="feature-links">${featuredChoices.map(t=>`<button data-act="feature" data-id="${t.id}" aria-pressed="${featured.id===t.id}" data-no-translate>${esc(t.title)}</button>`).join('')}</div>`:'';
 return workspace(side,`<section class="spotlight" aria-label="인디게임 플레이테스트">${hero}</section>${picks}<section class="recruit-section"><div class="section-heading"><h2>모집 중인 테스트</h2><button class="text-link" data-act="clear-filters">필터 초기화</button></div>${catalogTools()}${list.length?list.map(catalogRow).join(''):`<div class="empty">${tests.length?'검색 조건에 맞는 테스트가 없습니다.':'현재 모집 중인 테스트가 없습니다.'}</div>`}</section>`);
}

/* ---------- tester ---------- */
function slotsHtml(t){
  if(unlimitedCapacity(t))return `<div class="slots"><span class="badge b-public">인원 제한 없음</span><span class="mono">${t.applicants}명 참여</span></div>`;
  const full=capacityFull(t),pct=Math.min(100,Math.round(t.applicants/t.slots*100));
  return `<div class="slots"><div class="bar ${full?'full':''}"><span style="width:${pct}%"></span></div><span class="mono">${t.applicants}/${t.slots}명</span></div>`;
}
function cancellationHtml(t,application){if(!application||!['waiting','applied'].includes(application.status))return '';const quitting=application.status==='applied',label=quitting?'참여 포기':'신청 취소';return `<section class="cancellation-panel">${ui.cancelApplication===t.id?`<p>${quitting?'참여를 포기하면 정원이 다시 열리고 빌드와 설문 접근이 종료됩니다.':'승인 대기 중인 신청을 취소합니다.'} 모집 중이면 다시 신청할 수 있으며, 기존 버그 제보는 유지됩니다.</p><div class="actions"><button type="button" class="btn danger" data-act="confirm-cancellation" data-id="${t.id}">${label} 확정</button><button type="button" class="btn ghost" data-act="keep-application">참여 유지</button></div>`:`<button type="button" class="text-link" data-act="cancel-application" data-id="${t.id}">${label}</button>`}</section>`;}
function renderTester(){
  if(ui.detail){const d=byId(ui.detail);if(d&&visibleTo(d))return renderDetail(d)}
  const open=S.tests.filter(t=>recruitmentOpen(t));
  const mineList=S.tests.filter(t=>t.owner!=='me'&&S.mine[t.id]),favorites=S.tests.filter(t=>S.favorites.includes(t.id)&&['open','closed'].includes(t.status));
  const genres=['전체',...GENRES.filter(g=>open.some(t=>matchesGenre(t,g))),OTHER_GENRE];
  const list=ui.tTab==='mine'?mineList:filteredTests(ui.tTab==='saved'?favorites:open);
  const side=sectionNav('테스터 메뉴','tab-t',ui.tTab,[['mine','내 참여 현황'],['saved','찜한 게임'],['open','모집 중'],['alerts','알림']]);
  if(ui.tTab==='alerts')return workspace(side,notificationsHtml(allNotifications(),S,{page:true,canRefresh:!!cloud?.user}));
  const chips=ui.tTab==='open'?`<div class="sub" aria-label="장르 필터">${genres.map(g=>`<button type="button" class="chip" data-act="genre" data-genre="${g}" aria-pressed="${ui.genre===g}">${g}</button>`).join('')}</div>`:'';
  const cards=list.map(t=>ui.tTab==='mine'?`<article class="participation-card panel"><div class="participant-art">${gameArt(t)}</div><div class="row"><h2 data-no-translate>${esc(t.title)}</h2><span class="badge b-vis">${MINE_LABEL[S.mine[t.id].status]}</span></div>${progressHtml(t,S.mine[t.id])}${t.status==='hidden'||t.status==='appeal'?'<p class="notice">이 테스트는 현재 숨김 상태입니다.</p>':`<button class="btn ghost" type="button" data-act="open" data-id="${t.id}">참여 화면 열기 →</button>`}${cancellationHtml(t,S.mine[t.id])}<details><summary>내 버그 제보</summary>${bugListHtml(t,S.bugs)}</details></article>`:gameCard(t)).join('');
  const empty=ui.tTab==='saved'?'찜한 게임이 없습니다. 게임 카드의 하트를 눌러 모아보세요.':ui.tTab==='mine'?'아직 신청한 테스트가 없습니다. 모집 중 탭에서 플레이해 보고 싶은 게임을 골라 보세요.':'조건에 맞는 테스트가 없습니다.';
  const next=mineList.filter(t=>visibleTo(t)&&S.mine[t.id].status==='applied').sort((a,b)=>(a.deadline||'').localeCompare(b.deadline||''))[0];
  const hero=ui.tTab==='mine'&&next?`<section class="spotlight"><div><b>다음 플레이테스트</b><h2 data-no-translate>${esc(next.title)}</h2>${featureQuestion(next)}<div class="actions"><button class="btn" data-act="play-next" data-id="${next.id}">${S.mine[next.id].startedAt?'참여 화면 열기 →':'플레이 시작'}</button>${deadlineHtml(next)}</div></div><div class="hero-artwork">${gameArt(next)}</div></section>`:'';
  const title=ui.tTab==='mine'?'내 참여 현황':ui.tTab==='saved'?'찜한 게임':'게임 둘러보기';
  return workspace(side,`<h1>${title}</h1>${hero}${chips}${ui.tTab==='mine'?'':catalogTools()}${ui.tTab==='saved'&&S.favorites.some(id=>!favorites.some(t=>t.id===id))?`<section class="notice"><p>지금 볼 수 없는 찜 게임이 있습니다.</p>${S.favorites.filter(id=>!favorites.some(t=>t.id===id)).map(id=>`<button type="button" class="text-link" data-act="favorite" data-id="${esc(id)}">찜 해제</button>`).join('')}</section>`:''}${list.length?`<div class="grid">${cards}</div>` :`<div class="empty">${empty}${ui.tTab==='mine'?'<p><button class="btn" data-act="tab-t" data-tab="open">게임 둘러보기</button></p>':''}</div>`}`);
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
  const own=t.owner==='me',m=own?null:S.mine[t.id],st=m&&m.status,access=st==='applied'||st==='done',closed=t.status!=='open'||deadlineState(t.deadline)==='overdue',full=capacityFull(t),url=safeUrl(t.link);
  const guarded=access
    ?`<div><h3>플레이 방법</h3><p style="margin-top:6px">${esc(t.how)}</p></div>
      <div><h3>이 설문에 답해 주세요</h3><ol class="qs" style="margin-top:6px">${t.survey.map(q=>`<li>${esc(q.label)} <span class="mono muted">${QTYPE[q.type]}</span></li>`).join('')}</ol></div>`
    :`<div class="lock"><span class="mono">LOCKED</span><p>플레이 방법, 설문 문항, 빌드 링크는 이용 동의 후 참여가 열리면 공개됩니다.</p></div>`;
  const info=`${progressHtml(t,m)}${focusHtml(t)}${t.media.length?galleryHtml(t,ui.gallery):`<div class="detail-cover">${gameArt(t)}</div>`}<div class="panel"><div class="row"><div class="stack" style="gap:4px"><h2 data-no-translate>${esc(t.title)}</h2><p class="muted">${esc(t.team)}</p></div><span class="pair">${own?'<span class="badge b-mine">내 테스트</span>':''}${t.status!=='open'?tBadge(t.status):''}${visBadge(t.vis)}</span></div>
    ${favoriteButton(t)}<p data-no-translate>${esc(t.teaser)}</p>
    <dl class="facts"><dt>BUILD</dt><dd class="mono">${esc(t.build)}</dd><dt>PLATFORM</dt><dd>${esc(t.platform)}</dd><dt>GENRE</dt><dd>${gameGenreHtml(t)}</dd><dt>TIME</dt><dd>약 ${t.minutes}분</dd><dt>SLOTS</dt><dd>${slotsHtml(t)}</dd><dt>ACCESS</dt><dd>${VIS[t.vis]} · ${VIS_DESC[t.vis]}</dd></dl>
    ${deadlineHtml(t)}${guarded}</div>`;
  let side;
  if(own)side='<div class="notice">내가 등록한 게임에는 테스터로 참여할 수 없습니다.</div>';
  else if(!m){
    const btn=t.vis==='approval'?'동의하고 승인 요청':'동의하고 신청';
    side=`<div class="panel"><h3>참여하기</h3>
      <form data-form="apply" data-id="${t.id}" novalidate>
        ${t.vis==='invite'?`<div class="field"><label for="ap-code">초대 코드</label><input type="text" id="ap-code" autocomplete="off" maxlength="12"><span class="hint">개발자에게 받은 코드를 입력해 주세요.</span></div>`:''}
        <div class="terms"><p class="mono">이용 동의서</p><ol class="qs">${TERMS.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>
        <label class="check"><input type="checkbox" id="ap-agree"><span>위 내용을 읽고 동의합니다.</span></label>
        <p class="err" id="ap-err" role="alert"></p>
        <button class="btn" type="submit" ${(full||closed)?'disabled':''}>${closed?'모집 종료':full?'모집 마감':btn}</button></form></div>`;
  }else if(st==='waiting'){
    side=`<div class="panel" id="participation-next" tabindex="-1"><h3>신청이 접수되었습니다</h3><p>개발자가 승인하면 이 화면에서 빌드를 열 수 있습니다. 나중에는 테스터 메뉴의 ‘내 참여 현황’에서 이 테스트를 다시 열 수 있습니다.</p><div class="actions">${cloud?'<button class="btn ghost" type="button" data-act="refresh-flow">승인 상태 확인</button>':''}<button class="text-link" type="button" data-act="tab-t" data-tab="mine">내 참여 현황</button></div></div>`;
  }else if(st==='declined'){
    side=`<div class="panel"><h3>이번 테스트에는 참여할 수 없습니다</h3><p class="muted">개발자가 신청을 받지 않았습니다. 다른 테스트를 둘러보세요.</p></div>`;
  }else if(st==='applied'){
    side=`<div class="panel" id="participation-next" tabindex="-1"><h3>1. 빌드 열기</h3>${url?`<a class="btn" id="playtest-build-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t.platform)} 빌드 받기</a><p class="hint" data-no-translate>${esc(new URL(url).hostname)}</p>`:'<p class="err">빌드 링크 형식이 올바르지 않습니다.</p>'}
      <p class="hint">빌드는 새 탭에서 열립니다. 플레이를 마치면 이 탭으로 돌아와 아래 설문을 작성해 주세요.</p>
      <p class="mono muted">이용 동의 ${esc(m.agreedAt||'')} · 공유와 재배포는 금지됩니다.</p>
      <form data-form="feedback" data-id="${t.id}" novalidate>
        <h3>2. 피드백 작성</h3>
        <p class="hint">* 표시는 필수 문항입니다.</p>
        ${playedBuildHtml(t,m,'feedback-build')}${t.survey.map(questionHtml).join('')}${problemChoiceHtml(t,S.bugs,bugSummaries(),m.playedBuild||t.build)}
        <p class="err" id="fb-err" role="alert"></p>
        <button class="btn" type="submit">설문 제출</button></form></div>`;
  }else{
    side=`<div class="panel" id="participation-next" tabindex="-1"><h3>설문을 제출했습니다</h3><p>개발자가 결과를 확인할 수 있습니다. 제보한 버그의 상태와 개발자 답변은 ‘내 버그 제보’에서 확인하세요.</p><div class="actions"><button class="btn ghost" type="button" data-act="show-own-bugs">내 버그 제보 보기</button><button class="text-link" type="button" data-act="tab-t" data-tab="mine">내 참여 현황</button></div></div>`;
  }
  const cancellation=cancellationHtml(t,S.mine[t.id]);
  const mobileTask=own?'':st==='applied'?'빌드 및 피드백':st==='done'?'제출 결과 보기':m?'신청 상태 보기':'참여하기';
  return `<div class="detail-navigation"><button class="back" type="button" data-act="back">← 목록으로</button>${mobileTask?`<button class="btn ghost mobile-task" type="button" data-act="jump-participation">${mobileTask}</button>`:''}</div><div class="cols"><div class="stack">${info}</div><div class="col-side" id="participation-actions" tabindex="-1">${side}${cancellation}${bugFormHtml(t,m)}${m&&['applied','done'].includes(m.status)?`<section class="panel" id="own-bugs" tabindex="-1"><h3>내 버그 제보</h3>${bugListHtml(t,S.bugs)}</section>`:''}${reportPanel(t)}</div></div>`;
}

/* ---------- developer ---------- */
const bar=(l,n,tot)=>`<div><span>${esc(l)}</span><div class="bar"><span style="width:${tot?Math.round(n/tot*100):0}%"></span></div><span class="mono">${n}</span></div>`;
function summaryHtml(t){
  const f=filterBuild(t.feedbacks,ui.resultBuild[t.id]||'all');
  if(!f.length)return '<p class="muted" style="margin-top:8px">아직 제출된 응답이 없습니다.</p>';
  const linkedIds=[...new Set(f.flatMap(item=>item.bugIds||[]))],linked=S.bugs.filter(b=>linkedIds.includes(b.id)&&b.testId===t.id);
  return `<p class="mono muted" style="margin:8px 0">${f.length}명 응답</p><div class="stack">${feedbackQuestions(t,f).map(({question:q,values:vals})=>{
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
function gameRequests(t){return (t.requests||[]).filter(request=>request.id!=='me'&&request.id!==cloud?.user?.id);}
function reqsHtml(t){
  const r=gameRequests(t);
  if(!r.length)return '';
  const w=r.filter(x=>x.status==='waiting').length;
  return `<details class="res" data-section="requests" ${w?'open':''}><summary>신청자 관리 (${r.length}${w?` · 대기 ${w}`:''})</summary><ul class="reqs">${r.map(x=>`<li><span>${esc(x.name)} ${x.agreed?'<span class="ck">동의 완료</span>':''}</span>${x.status==='waiting'
    ?`<span class="actions"><button class="btn sm" type="button" data-act="req-approve" data-id="${t.id}" data-req="${esc(x.id)}">승인</button><button class="btn ghost sm" type="button" data-act="req-decline" data-id="${t.id}" data-req="${esc(x.id)}">거절</button></span>`
    :`<span class="badge b-${REQ[x.status][1]}">${REQ[x.status][0]}</span>`}</li>`).join('')}</ul></details>`;
}
function surveyBuilderHtml(){
  const d=ui.draft;
  return `<div class="survey-goal-guide">
    <h3>테스트 목표에 답하는 문항</h3>
    <p>이번 테스트에서 확인할 점에 직접 답할 수 있는 질문을 하나 넣어 보세요.</p>
    <p class="hint">경로를 쉽게 찾는지 확인하려면 “첫 배달 경로를 찾을 때 어디에서 막혔나요?”처럼 물어보세요.</p>
    <button class="btn ghost sm" type="button" data-act="q-add-goal" ${d.length>=MAXQ?'disabled':''}>테스트 목표로 문항 추가</button>
  </div><div class="stack">${d.map((q,i)=>`<div class="qrow" data-i="${i}">
    <div class="qhead"><span class="qno">Q${i+1}</span>
      <select class="q-type" aria-label="질문 ${i+1} 유형">${Object.keys(QTYPE).map(k=>`<option value="${k}" ${k===q.type?'selected':''}>${QTYPE[k]}</option>`).join('')}</select>
      <label class="check small"><input type="checkbox" class="q-req" ${q.required?'checked':''}>필수</label>
      <span class="actions"><button class="btn ghost sm" type="button" data-act="q-up" data-i="${i}" ${i===0?'disabled':''} aria-label="질문 ${i+1} 위로">위로</button><button class="btn ghost sm" type="button" data-act="q-down" data-i="${i}" ${i===d.length-1?'disabled':''} aria-label="질문 ${i+1} 아래로">아래로</button><button class="btn danger sm" type="button" data-act="q-del" data-i="${i}" aria-label="질문 ${i+1} 삭제">삭제</button></span></div>
    <input type="text" class="q-label" maxlength="80" value="${esc(q.label)}" placeholder="질문을 입력하세요" aria-label="질문 ${i+1} 내용">
    ${q.type==='choice'?`<div class="choice-editor">${q.options.map((option,j)=>`<div><label>선택지 ${j+1}<input type="text" class="q-option" value="${esc(option)}"></label><button class="btn ghost sm" type="button" data-act="option-remove" data-i="${i}" data-option="${j}" ${q.options.length<=2?'disabled':''}>삭제</button></div>`).join('')}<button class="btn ghost sm" type="button" data-act="option-add" data-i="${i}" ${q.options.length>=6?'disabled':''}>+ 선택지 추가</button></div>`:''}
    ${q.type==='scale'?'<p class="hint">테스터가 1점(별로예요)부터 5점(아주 좋아요)까지 고릅니다. 결과는 평균과 분포로 보입니다.</p>':''}
    ${q.type==='text'?'<p class="hint">테스터가 자유롭게 적습니다. 결과는 응답 목록으로 보입니다.</p>':''}
  </div>`).join('')}</div>
  <div class="actions" style="align-items:center"><button class="btn ghost sm" type="button" data-act="q-add" ${d.length>=MAXQ?'disabled':''}>질문 추가</button><span class="hint">${d.length}/${MAXQ}문항</span></div>`;
}
function renderSurvey(){const c=$('#survey-builder');if(c&&ui.draft)c.innerHTML=surveyBuilderHtml();queueDeveloperDraft();}
function syncDraft(){
  captureDevFields();
  const c=$('#survey-builder');if(!c||!ui.draft)return;
  c.querySelectorAll('.qrow').forEach((r,i)=>{
    const q=ui.draft[i];if(!q)return;
    q.label=r.querySelector('.q-label').value;
    q.type=r.querySelector('.q-type').value;
    q.required=r.querySelector('.q-req').checked;
    const options=[...r.querySelectorAll('.q-option')];
    if(options.length)q.options=options.map(input=>input.value);
    else if(q.type==='choice'&&!q.options.length)q.options=['',''];
    if(q.type!=='choice')q.options=[];
  });
}
function devForm(){
  const e=ui.edit?byId(ui.edit):null;
  const {genres,customGenres}=gameGenreSelection(e);
  const unlimited=!!e&&unlimitedCapacity(e);
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
    <div class="draft-toolbar"><p class="hint">작성 내용과 첨부파일은 이 브라우저에 자동 임시 저장됩니다.</p><button class="btn ghost sm" type="button" data-act="save-draft">임시 저장</button><p id="draft-status" role="status" aria-live="polite">${esc(ui.draftStatus)}</p></div><form data-form="dev" novalidate>
      <fieldset class="group"><legend>기본 정보</legend><div class="fields">
        <div class="field"><label for="f-title">게임 이름</label><input type="text" id="f-title" value="${v('title')}" maxlength="40"></div>
        <div class="field"><label for="f-team">팀 이름</label><input type="text" id="f-team" value="${v('team')}" maxlength="40"></div>
        <fieldset class="field">
          <legend>장르</legend>
          <details class="genre-picker" id="genre-picker">
            <summary>
              <span>장르 선택</span>
              <span class="genre-chevron" aria-hidden="true">⌄</span>
            </summary>
            <div class="genre-dropdown">
              <div class="genre-options">
                ${[...GENRES,OTHER_GENRE].map(genre=>`<label class="check"><input type="checkbox" name="f-genres" ${genre===OTHER_GENRE?'id="f-other"':''} value="${genre}" ${(genre===OTHER_GENRE?customGenres.length:genres.includes(genre))?'checked':''}><span>${genre}</span></label>`).join('')}
              </div>
              <div class="field" id="other-genre-field" ${customGenres.length?'':'hidden'}>
                <label for="f-other-genres">장르 직접 입력</label>
                <input type="text" id="f-other-genres" value="${esc(customGenres.join(', '))}" aria-describedby="genre-hint" ${customGenres.length?'':'disabled'}>
                <p id="genre-hint" class="hint">여러 장르는 쉼표로 구분해 주세요. 최대 5개, 각 24자까지 입력할 수 있습니다.</p>
              </div>
              <div class="genre-dropdown-actions"><button class="btn ghost sm" type="button" data-act="close-genre-picker">선택 완료</button></div>
            </div>
          </details>
          <div class="selected-genre-tags" id="selected-genre-tags" aria-live="polite">${genreTags(customGenres.length?[...genres,OTHER_GENRE]:genres)}</div>
        </fieldset>
        <div class="field"><label for="f-platform">플랫폼</label><select id="f-platform">${opts(PLATFORMS,e&&e.platform)}</select></div>
        <div class="field"><label for="f-build">빌드 버전</label><input type="text" id="f-build" value="${e?esc(e.build):'v0.1.0'}" maxlength="16"></div>
        <div class="field"><label for="f-min">예상 소요 시간 (분)</label><input type="number" id="f-min" min="5" max="120" value="${e?e.minutes:20}"></div>
        <fieldset class="field"><legend>모집 인원</legend><div class="capacity-modes"><label class="check"><input type="radio" name="capacity-mode" id="f-limited" ${unlimited?'':'checked'}><span>인원 지정</span></label><label class="check"><input type="radio" name="capacity-mode" id="f-unlimited" ${unlimited?'checked':''}><span>인원 제한 없음</span></label></div><div class="capacity-stepper" id="capacity-stepper" ${unlimited?'hidden':''}><button class="btn ghost" type="button" data-act="capacity-step" data-step="-1" aria-label="인원 줄이기">−</button><input type="number" id="f-slots" aria-label="모집 인원" min="1" max="50" step="1" value="${e?.slots??5}" ${unlimited?'disabled':''} aria-describedby="capacity-hint"><button class="btn ghost" type="button" data-act="capacity-step" data-step="1" aria-label="인원 늘리기">+</button></div><p class="hint" id="capacity-hint">인원 지정 시 1~50명 · 제한이 없으면 마감일까지 신청을 받습니다.</p></fieldset>
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
function surveyResultsHtml(t){
  const selected=filterBuild(t.feedbacks,ui.resultBuild[t.id]||'all');
  const hasNew=selected.some(item=>!item.reviewed);
  return `<div class="survey-results">
    <div class="survey-results-question">
      <h3>개발자의 질문</h3>
      ${t.feedbackFocus?`<p data-no-translate>${esc(t.feedbackFocus)}</p><p class="hint">현재 등록된 테스트 목표입니다.</p>`:'<p class="hint">등록된 질문이 없습니다.</p>'}
    </div>
    <div class="survey-results-data">
      ${versionFilterHtml(t,'survey')}
      <div class="actions">
        <button class="btn ghost sm" type="button" data-act="export-survey" data-id="${t.id}">설문 CSV 다운로드</button>
        ${hasNew?`<button class="btn sm" type="button" data-act="review-feedback" data-id="${t.id}">표시된 응답 확인 완료</button>`:''}
      </div>
      ${summaryHtml(t)}
    </div>
  </div>`;
}
function unresolvedBug(bug){return ['new','review','planned'].includes(bug.status);}
function developerBugs(t){
  const bugs=filterBuild(S.bugs.filter(bug=>bug.testId===t.id),ui.bugBuild[t.id]||'all');
  return ui.unresolvedBugGame===t.id?bugs.filter(unresolvedBug):bugs;
}
function managedActionsHtml(t){
  const waiting=gameRequests(t).filter(request=>request.status==='waiting').length;
  const unread=t.feedbacks.filter(item=>!item.reviewed).length;
  const unresolved=S.bugs.filter(bug=>bug.testId===t.id&&unresolvedBug(bug)).length;
  const canReviewRequests=['open','closed'].includes(t.status);
  const items=[
    ['requests','승인 대기',waiting,canReviewRequests&&waiting>0],
    ['results','새 설문',unread,true],
    ['bugs','미해결 버그',unresolved,S.bugs.some(bug=>bug.testId===t.id)]
  ];
  return `<div class="game-work-items">${items.map(([section,label,count,available])=>available
    ?`<button class="work-count" type="button" data-act="game-work" data-section="${section}" data-id="${t.id}"><span>${label}</span><strong>${count}</strong><span aria-hidden="true">↗</span></button>`
    :`<span class="work-count"><span>${label}</span><strong>${count}</strong></span>`).join('')}</div>`;
}
function myTestCard(t){
  const remove=`<button class="btn danger" type="button" data-act="delete-game" data-id="${t.id}">${t.deleting?'삭제 다시 시도':'게임 삭제'}</button>`;
  if(t.deleting)return `<article class="panel"><h2 data-no-translate>${esc(t.title)}</h2><p>게임 삭제를 완료하려면 다시 시도해 주세요.</p>${remove}</article>`;
  let body='';
  if(t.status==='hidden')body=`<p class="reason">운영자가 숨김 처리했습니다. ${esc(t.reason||'')}</p><div class="actions"><button class="btn sm" type="button" data-act="edit" data-id="${t.id}">수정하고 재공개 요청</button></div>`;
  else if(t.status==='appeal')body=`<p class="reason warn">재공개 요청을 운영자가 검토하고 있습니다.</p>`;
  else body=`${slotsHtml(t)}<div class="actions"><button class="btn" type="button" data-act="edit" data-id="${t.id}">수정</button><button class="btn ghost recruitment-control" type="button" data-act="toggle-close" data-id="${t.id}">${t.status==='open'?'모집 종료':'모집 재개'}</button></div>${reqsHtml(t)}<details class="res" data-section="results" ${t.feedbacks.length?'open':''}><summary>설문 결과 (${t.feedbacks.length}명)</summary>${surveyResultsHtml(t)}<button class="btn ghost sm" type="button" data-act="export-bugs" data-id="${t.id}">버그 CSV 다운로드</button></details>`;
  const rc=S.reports.filter(r=>r.testId===t.id&&r.status==='open').length;
  return `<article class="managed-row"><details class="managed-entry" data-game="${t.id}"><summary><div class="managed-thumb">${gameArt(t)}</div><strong data-no-translate>${esc(t.title)}</strong>${tBadge(t.status)}<span class="game-disclosure" aria-hidden="true">⌄</span></summary><article class="card managed-game"><div class="managed-art">${gameArt(t)}</div><div class="card-top mono"><span class="tag">${esc(t.build)}</span><span class="tag">${esc(t.platform)}</span><span class="sp pair">${visBadge(t.vis)}${tBadge(t.status)}</span></div>
    <div class="card-body"><h3 data-no-translate>${esc(t.title)}</h3><p class="teaser" data-no-translate>${esc(t.teaser)}</p><p class="meta">${gameGenreHtml(t)} · 약 ${t.minutes}분 · 설문 ${t.survey.length}문항</p>${t.vis==='invite'?`<p class="meta">초대 코드 <span class="code">${esc(t.code)}</span></p>`:''}${rc?`<p class="meta">접수된 신고 ${rc}건 · 운영자가 확인 중</p>`:''}<div class="managed-deadline">${deadlineHtml(t)}</div></div><div class="foot manage-controls">${body}<div class="actions game-delete-actions">${remove}</div></div></article></details>${managedActionsHtml(t)}</article>`;
}
function renderDeveloper(){
  const mine=S.tests.filter(t=>t.owner==='me');
  const items=[['mine','내 게임 관리'],['new',ui.edit?'테스트 수정':'게임 등록'],['drafts','임시 저장'],['results','설문 결과'],['bugs','버그 제보']];
  const side=sectionNav('개발자 메뉴','tab-d',ui.dTab,items);
  const head=`<div class="dashboard-heading"><h1>${items.find(([key])=>key===ui.dTab)?.[1]||'내 게임 관리'}</h1>${ui.dTab==='mine'&&(!cloud||cloud.user)?`<div class="actions">${cloud?'<button class="btn ghost" type="button" data-act="refresh-flow">신청 현황 새로고침</button>':''}<button class="btn" data-act="tab-d" data-tab="new">+ 게임 등록</button></div>`:''}</div>`;
  const page=body=>workspace(side,head+body);
  if(cloud&&!cloud.user)return page('<section class="spotlight"><div><p>로그인하면 테스트를 등록하고 신청자와 피드백을 관리할 수 있습니다.</p><button type="button" class="btn" data-act="account-login">로그인</button></div>'+islandArt()+'</section>');
  const bugCount=S.bugs.filter(b=>mine.some(t=>t.id===b.testId)).length;
  if(ui.dTab==='results')return page(mine.length?mine.map(t=>`<section class="panel" data-dev-results="${t.id}" tabindex="-1"><h2 data-no-translate>${esc(t.title)}</h2>${surveyResultsHtml(t)}</section>`).join(''):'<p class="empty">등록한 테스트가 없습니다.</p>');
  if(ui.dTab==='drafts')return page(draftsHtml());
  if(ui.dTab==='bugs')return page(bugCount?mine.filter(t=>S.bugs.some(b=>b.testId===t.id)).map(t=>`<section class="panel" data-dev-bugs="${t.id}" tabindex="-1"><h2 data-no-translate>${esc(t.title)}</h2>${versionFilterHtml(t,'bugs')}<button class="btn ghost sm" type="button" data-act="export-bugs" data-id="${t.id}">버그 CSV 다운로드</button><button class="btn ghost sm" type="button" data-act="toggle-unresolved" data-id="${t.id}" aria-pressed="${ui.unresolvedBugGame===t.id}">미해결 버그만</button>${bugListHtml(t,developerBugs(t),{developer:true})}</section>`).join(''):'<p class="empty">아직 버그 제보가 없습니다.</p>');
  if(ui.dTab==='new')return page(devForm());
  const published=mine.find(t=>t.id===ui.publishedGame&&t.status==='open');
  return page(mine.length?`${published?'<p class="notice" id="published-notice" tabindex="-1">게임을 공개했습니다. 이 목록에서 신청을 확인하고 게임을 관리할 수 있습니다.</p>':''}<div class="managed-games">${mine.map(myTestCard).join('')}</div>`:'<div class="spotlight"><p>등록한 테스트가 없습니다. 새 테스트 등록 탭에서 첫 게임을 올려 보세요.</p>'+islandArt()+'</div>');
}

/* ---------- admin ---------- */
function testInfo(t){
  return `<div class="row"><div class="stack" style="gap:4px"><h3 data-no-translate>${esc(t.title)}</h3><p class="muted">${esc(t.team)} · ${gameGenreHtml(t)} · ${esc(t.platform)} · <span class="mono">${esc(t.build)}</span></p></div><span class="pair">${visBadge(t.vis)}${tBadge(t.status)}</span></div>
    <p data-no-translate>${esc(t.teaser)}</p><dl class="facts"><dt>LINK</dt><dd class="mono">${esc(t.link)}</dd><dt>HOW</dt><dd>${esc(t.how)}</dd></dl>`;
}
const moderationLabels={dismiss:'신고 기각',hide:'숨김 처리',restore:'재공개',auto_hide:'자동 숨김'};
function moderationControls(t,actions){
  const pending=ui.hiding;
  if(pending?.id===t.id){
    const action=pending.action;
    return `<div class="field"><label for="moderation-reason">${action==='hide'?'숨김 사유 (개발자에게 표시됩니다)':'처리 사유 (운영자에게만 표시됩니다)'}</label>
      <textarea id="moderation-reason" minlength="4" maxlength="4000" required aria-describedby="moderation-error"></textarea>
      <p class="err" id="moderation-error" role="alert"></p></div>
      <div class="actions"><button class="btn ${action==='hide'?'danger':''}" type="button" data-act="moderation-confirm" data-id="${t.id}">${moderationLabels[action]}</button><button class="btn ghost" type="button" data-act="moderation-cancel">취소</button></div>`;
  }
  return `<div class="actions">
    ${actions.map(([action,label])=>`<button class="btn ${action==='hide'?'danger':action==='dismiss'?'ghost':''}" type="button" data-act="moderation-open" data-operation="${action}" data-id="${t.id}">${label}</button>`).join('')}
    <button class="btn ghost" type="button" data-act="game-moderation-history" data-id="${t.id}">이 게임의 처리 내역</button>
  </div>`;
}
function moderationHistory(){
  const gameKey=record=>record.testId?`id:${record.testId}`:`title:${record.title}`;
  const games=new Map(S.log.map(record=>[gameKey(record),record.title]));
  if(ui.logGame?.startsWith('id:')){
    const game=byId(ui.logGame.slice(3));
    if(game&&!games.has(ui.logGame))games.set(ui.logGame,game.title);
  }
  const filter=games.has(ui.logGame)?ui.logGame:null;
  const history=filter?S.log.filter(record=>gameKey(record)===filter):S.log;
  return `<section class="panel moderation-history">
    <div class="field"><label for="moderation-game-filter">게임별 처리 내역</label>
      <select id="moderation-game-filter"><option value="">모든 게임</option>
        ${[...games].map(([key,title])=>`<option value="${esc(key)}" ${filter===key?'selected':''} data-no-translate>${esc(title)}</option>`).join('')}
      </select>
    </div>
    ${history.length?`<ul>${history.map(record=>{
      const date=record.date||'';
      const time=date.includes('T')?new Date(date).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})+' KST':date;
      const state=record.beforeStatus&&record.afterStatus?`<p class="moderation-transition"><span>${TSTATUS[record.beforeStatus]||''}</span> → <span>${TSTATUS[record.afterStatus]||''}</span></p>`:'';
      return `<li><div class="row"><strong data-no-translate>${esc(record.title)}</strong>
        <span class="badge b-vis">${esc(moderationLabels[record.action]||record.action)}</span></div>
        <p class="moderation-meta"><span ${record.actor&&record.actor!=='시스템'?'data-no-translate':''}>${esc(record.actor||'담당자 미기록')}</span><time datetime="${esc(date)}">${esc(time)}</time></p>
        ${state}<p class="moderation-note" ${record.note&&record.action!=='auto_hide'?'data-no-translate':''}>${esc(record.note||'사유가 기록되지 않았습니다.')}</p></li>`;
    }).join('')}</ul>`:'<p class="empty">처리 내역이 없습니다.</p>'}
  </section>`;
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
        ${moderationControls(t,[['hide','숨김 처리'],['dismiss','신고 기각']])}</article>`;
    }).join('')}</div>`:'<div class="empty">확인할 신고가 없습니다.</div>';
  }else if(ui.aTab==='appeals'){
    body=ap.length?`<div class="stack">${ap.map(t=>`<article class="panel">${testInfo(t)}<p class="reason">이전 숨김 사유: ${esc(t.reason||'')}</p>
      ${moderationControls(t,[['restore','재공개'],['hide','숨김 유지']])}</article>`).join('')}</div>`:'<div class="empty">대기 중인 재공개 요청이 없습니다.</div>';
  }else{
    body=moderationHistory();
  }
  return `<div class="head"><h2>운영자</h2></div><p class="notice">테스트는 등록 즉시 공개되며, 운영자는 접수된 신고와 재공개 요청만 처리합니다.</p>${tabs}${body}`;
}

/* ---------- render & events ---------- */
function captureFeedbackDraft(){
 const form=$('form[data-form="feedback"]');if(!form)return;
 const test=byId(form.dataset.id);if(!test)return;
 const answers={};for(const q of test.survey){if(q.type==='text'){answers[q.id]=$('#a-'+q.id)?.value||'';}else{answers[q.id]=form.querySelector(`input[name="a-${q.id}"]:checked`)?.value||'';}}
 ui.feedbackDrafts[test.id]={answers,build:$('#feedback-build')?.value,problemChoice:form.querySelector('[name="problem-choice"]:checked')?.value||'',bugIds:selectedBugIds(form)};
}
function updateProblemGuidance(){const form=$('form[data-form="feedback"]');if(!form)return;const choice=form.querySelector('[name="problem-choice"]:checked')?.value;const links=$('#linked-bug-options'),newBug=$('#new-bug-guidance');if(links)links.hidden=choice!=='reported';if(newBug)newBug.hidden=choice!=='new';const shared=$('#shared-bug-options');if(shared)shared.hidden=choice!=='existing';form.querySelectorAll('[data-legacy-bug-field]').forEach(el=>{el.hidden=['reported','existing'].includes(choice)&&!el.querySelector('textarea').value;});}
function restoreFeedbackDraft(){
 const form=$('form[data-form="feedback"]');if(!form)return;
 const test=byId(form.dataset.id),draft=ui.feedbackDrafts[test.id];if(!draft){updateProblemGuidance();return;}
 if(draft.build&&$('#feedback-build'))$('#feedback-build').value=draft.build;const shared=$('#shared-bug-options');if(shared)shared.innerHTML=sharedBugOptionsHtml(test,bugSummaries(),$('#feedback-build').value);
 for(const q of test.survey){if(q.type==='text'){const el=$('#a-'+q.id);if(el)el.value=draft.answers[q.id]||'';}else form.querySelectorAll(`input[name="a-${q.id}"]`).forEach(el=>el.checked=el.value===String(draft.answers[q.id]||''));}
 form.querySelectorAll('[name="problem-choice"]').forEach(el=>el.checked=el.value===draft.problemChoice);
 form.querySelectorAll('[name="linked-bugs"]').forEach(el=>el.checked=draft.bugIds.includes(el.value));updateProblemGuidance();
}
function openBugFromSurvey(){const panel=$('.bug-report-panel');if(panel){panel.open=true;panel.scrollIntoView({block:'start',behavior:'smooth'});$('#bug-title')?.focus({preventScroll:true});}}
function renderGuide(){
 const testerSteps=[
  '홈에서 장르를 고르거나 게임과 개발팀 이름을 검색하세요.',
  '게임 상세에서 테스트 목표와 마감일을 확인하고 참여를 신청하세요.',
  '승인제 테스트는 ‘테스터 → 알림’에서 승인 소식을 확인할 수 있습니다. 알림을 열면 빌드 버튼으로 이동합니다.',
  '플레이를 마치면 참여 화면으로 돌아와 설문을 제출하세요. 발견한 문제는 버그로 제보하고 설문에 연결할 수 있습니다.'
 ];
 const developerSteps=[
  '‘개발자 → 게임 등록’에서 게임 소개, 테스트 목표, 빌드 링크, 모집 조건과 설문을 작성하세요.',
  '‘내 게임 관리’에서 승인 대기 신청을 처리하고, 새 설문과 미해결 버그를 확인하세요.',
  '설문 결과에서 개발자의 질문과 응답을 함께 보고, 필요하면 빌드별로 필터링하거나 CSV로 내려받으세요.',
  '버그의 처리 상태나 답변을 저장하면 제보한 테스터가 알림에서 확인할 수 있습니다.'
 ];
 const steps=items=>`<ol>${items.map(step=>`<li>${step}</li>`).join('')}</ol>`;
 return `<section class="usage-guide" aria-labelledby="guide-title">
   <h1 id="guide-title" tabindex="-1">사용법</h1>
   <p>한 계정으로 게임 테스트에 참여하고, 내 게임의 테스터도 모집할 수 있습니다.</p>
   <div class="guide-columns">
     <section class="panel"><h2>테스터로 참여하기</h2>${steps(testerSteps)}<a class="btn" href="#home" data-nav="home">게임 둘러보기</a></section>
     <section class="panel"><h2>개발자로 모집하기</h2>${steps(developerSteps)}<a class="btn" href="#developer" data-nav="developer">개발자 화면 열기</a></section>
   </div>
   <p class="hint">신청 내역과 찜한 게임은 테스터 메뉴에서, 화면 테마와 언어는 상단 메뉴의 설정에서 바꿀 수 있습니다.</p>
 </section>`;
}
function render(capture=true){
 const expanded=new Map();
 for(const game of document.querySelectorAll?.('.managed-entry')||[]){
  expanded.set(game.dataset.game,game.open?[...game.querySelectorAll('[data-section][open]')].map(section=>section.dataset.section):null);
 }
 if(capture){captureFeedbackDraft();syncDraft();}
  renderMenu();
  const p=ui.page;
  $('#main').dataset.page=p;
  $('#main').innerHTML=p==='home'?renderHome():p==='tester'?renderTester():p==='developer'?renderDeveloper():p==='guide'?renderGuide():(!cloud||cloud.canAdmin)?renderAdmin():'<p class="notice">운영자 권한이 필요합니다.</p>';
  for(const game of document.querySelectorAll?.('.managed-entry')||[]){
    const sections=expanded.get(game.dataset.game);
    if(!expanded.has(game.dataset.game)&&ui.publishedGame===game.dataset.game)game.open=true;
    if(!sections)continue;
    game.open=true;
    for(const section of game.querySelectorAll('[data-section]')){
      if(sections.includes(section.dataset.section))section.open=true;
    }
  }
  restoreDevFields();
  restoreFeedbackDraft();
  mediaHydrator.hydrate($('#main'));
}
function nav(page,sub,saved=false){
  if(!saved&&$('[data-form="dev"]')){void persistDeveloperDraft().then(ok=>{if(ok!==false)nav(page,sub,true);});return;}
  syncDraft();
  clearUploads();
  ui.gallery=null;
  ui.publishedGame=null;
  ui.unresolvedBugGame=null;
  if(page==='home'&&ui.page!=='home')ui.featured=null;
  ui.page=PAGES.includes(page)?page:'home';
  ui.detail=null;ui.reporting=null;ui.hiding=null;ui.edit=null;ui.draft=null;ui.devFields=null;ui.draftStatus='';
  if(ui.page==='tester')ui.tTab=sub||'mine';
  if(ui.page==='developer')ui.dTab=sub==='new'?'mine':sub||'mine';
  if(ui.page==='admin')ui.aTab=sub||'reports';
  try{if(location.hash!=='#'+ui.page)location.hash=ui.page}catch(e){}
  render(false);window.scrollTo(0,0);if(ui.page==='guide')$('#guide-title')?.focus();if(ui.page==='developer'&&sub==='new')void startDeveloperEditor();
}
function hashPage(){const h=(location.hash||'').slice(1);return PAGES.includes(h)?h:null}
function top(){const m=$('#main');if(m&&m.scrollIntoView)m.scrollIntoView({block:'start'})}

// Use the state returned by mark_read so an old approval never opens a
// removed game or bypasses the user's current participation status.
function showNotificationTarget(notice){
 const test=byId(notice.testId);
 if(!test||!visibleTo(test)){
   render();
   toast('이 테스트는 현재 열 수 없습니다.');
   return;
 }
 const returnTab=ui.page==='tester'&&ui.tTab==='alerts'?'alerts':'mine';
 nav('tester',returnTab,true);
 ui.detail=test.id;
 render(false);
 if(notice.type==='approval')($('#playtest-build-link')||$('#participation-next'))?.focus();
}

async function remoteCommand(action,payload){
 if(!cloud.requireUser()){toast('로그인이 필요합니다.');return false;}
 const userId=cloud.user.id;ui.saving=true;try{const next=await cloud.command(action,payload);if(cloud.user?.id!==userId){S=migrateFeatures(await cloud.snapshot());render();return false;}S=migrateFeatures(next);return true;}catch(error){toast(error.message);return false;}finally{ui.saving=false;}
}
async function handleCloudClick(action,button,event){
 const id=button.dataset.id;
 if(action==='account-login'){cloud.requireUser();return true;}
 if(action==='reset'){toast('실서비스 데이터는 초기화할 수 없습니다.');return true;}
 if(action==='open-notification'){
  const notice=allNotifications().find(n=>n.id===id);
  if(!notice||await persistDeveloperDraft()===false)return true;
  if(await remoteCommand('mark_read',{ids:[id]}))showNotificationTarget(notice);
  return true;
 }
 const handlers={
  'start-play':()=>['start_play',{testId:id}],
  'toggle-close':()=>['toggle_close',{testId:id}],
  'req-approve':()=>['review_application',{testId:id,testerId:button.dataset.req==='me'?cloud.user?.id:button.dataset.req,decision:'approve'}],
  'req-decline':()=>['review_application',{testId:id,testerId:button.dataset.req==='me'?cloud.user?.id:button.dataset.req,decision:'decline'}],
  'read-notifications':()=>['mark_read',{ids:allNotifications().map(n=>n.id)}]
 };
 if(!handlers[action])return false;event.preventDefault();const [command,payload]=handlers[action]();if(await remoteCommand(command,payload)){ui.hiding=null;render();}return true;
}
listen(document,'click',async e=>{
  const notifications=$('#notification-area details');if(notifications&&!notifications.contains(e.target))notifications.open=false;
  const genrePicker=$('#genre-picker');
  if(genrePicker?.open&&!genrePicker.contains(e.target))genrePicker.open=false;
  if(ui.saving&&e.target.closest('[data-nav],[data-act]')){e.preventDefault();return toast('저장 중입니다. 잠시 기다려 주세요.');}
  const n=e.target.closest('[data-nav]');
  if(n){e.preventDefault();return nav(n.dataset.nav,n.dataset.sub)}
  const b=e.target.closest('[data-act]');if(!b||b.disabled)return;
  const a=b.dataset.act,id=b.dataset.id;
  if(a==='jump-participation'){$('#participation-actions')?.focus();return;}
  if(a==='show-own-bugs'){$('#own-bugs')?.focus();return;}
  if(a==='refresh-flow'&&cloud){
    const identity=cloud.user?.id;
    const fromHeader=!!b.closest('#notification-area');
    const fromInbox=!!b.closest('.notification-page');
    ui.saving=true;b.disabled=true;
    try{
      const snapshot=await cloud.snapshot();
      if(identity!==cloud.user?.id)return;
      if(fromHeader){
        S.notifications=snapshot.notifications||[];
        S.readNotifications=snapshot.readNotifications||{};
        renderNotifications();
      }else{
        S=migrateFeatures(snapshot);
        render();
      }
      const source=fromHeader?'#notification-area ':fromInbox?'.notification-page ':'';
      ($(source+'[data-act="refresh-flow"]')||$('#participation-next'))?.focus();
      toast('최신 상태를 확인했습니다.');
    }catch{toast('상태를 확인하지 못했습니다. 다시 시도해 주세요.');}
    finally{ui.saving=false;b.disabled=false;}
    return;
  }
  if(a==='play-next'){
    const application=S.mine[id];if(!application||application.status!=='applied')return;
    if(!application.startedAt){
      if(cloud){if(!await remoteCommand('start_play',{testId:id}))return;}
      else{application.startedAt=new Date().toISOString();application.playedBuild=byId(id).build;save();}
    }
    ui.detail=id;render();top();return;
  }
  if(a==='start-play'&&byId(id)?.owner==='me')return;
  if(cloud&&await handleCloudClick(a,b,e))return;
  if(a==='show-favorites'){if(cloud&&!cloud.requireUser())return;return nav('tester','saved');}
  if(a==='favorite'){if(cloud&&!cloud.requireUser())return;const saved=!S.favorites.includes(id);if(cloud){if(!await remoteCommand('favorite',{testId:id,saved}))return;}else{const previous=[...S.favorites];S.favorites=saved?[...S.favorites,id]:S.favorites.filter(value=>value!==id);if(!save()){S.favorites=previous;return;}}if(ui.detail&&byId(id)){document.querySelectorAll('[data-act="favorite"]').forEach(node=>{if(node.dataset.id===id)node.outerHTML=favoriteButton(byId(id));});}else render();return toast(saved?'게임을 찜했습니다.':'찜을 해제했습니다.');}
  if(a==='delete-draft'){ui.draftDelete=id;render(false);return;}
  if(a==='keep-draft'){ui.draftDelete=null;render(false);return;}
  if(a==='confirm-delete-draft'){const record=ui.savedDrafts.find(d=>d.key===id);if(!record)return;try{await developerDrafts.remove(currentDraftOwner(),record.edit);ui.savedDrafts=ui.savedDrafts.filter(d=>d.key!==id);ui.draftDelete=null;render(false);}catch{toast('임시 저장을 삭제하지 못했습니다.');}return;}
  if(a==='save-draft'){await persistDeveloperDraft(true);return;}
  if(a==='resume-draft'){const record=ui.savedDrafts.find(d=>d.key===id);if(!record)return;if(record.edit&&byId(record.edit)?.owner!=='me')return toast('원본 테스트에 접근할 수 없습니다.');return startDeveloperEditor(record.edit);}
  if(a==='game-work'){
    const test=byId(id),section=b.dataset.section;
    if(test?.owner!=='me')return;
    if(section==='requests'){
      const card=b.closest('.managed-row').querySelector('.managed-entry');
      const requests=card.querySelector('[data-section="requests"]');
      if(requests){card.open=true;requests.open=true;requests.querySelector('summary').focus();}
      return;
    }
    const results=section==='results';
    if(results)ui.resultBuild[id]='all';
    else{ui.bugBuild[id]='all';ui.unresolvedBugGame=id;}
    ui.dTab=section;
    render(false);
    const target=[...document.querySelectorAll(results?'[data-dev-results]':'[data-dev-bugs]')]
      .find(node=>(results?node.dataset.devResults:node.dataset.devBugs)===id);
    target?.focus();
    return;
  }
  if(a==='review-feedback'){
    const test=byId(id);
    if(test?.owner!=='me')return;
    const selection=ui.resultBuild[id]||'all';
    const reviewed=filterBuild(test.feedbacks,selection).filter(item=>!item.reviewed);
    if(cloud){
      const responseIds=reviewed.map(item=>item.responseId).filter(Boolean);
      if(!responseIds.length||!await remoteCommand('review_feedback',{testId:id,responseIds}))return;
    }else{
      reviewed.forEach(item=>{item.reviewed=true;});
      if(!save()){reviewed.forEach(item=>{delete item.reviewed;});return;}
    }
    render(false);
    document.getElementById(`version-survey-${id}`)?.focus();
    toast('표시된 설문 응답을 확인했습니다.');
    return;
  }
  if(a==='toggle-unresolved'){
    if(byId(id)?.owner!=='me')return;
    ui.unresolvedBugGame=ui.unresolvedBugGame===id?null:id;
    render(false);
    [...document.querySelectorAll('[data-act="toggle-unresolved"]')].find(node=>node.dataset.id===id)?.focus();
    return;
  }
  if(a==='export-survey'||a==='export-bugs'){const t=byId(id);try{downloadCsv(a==='export-survey'?surveyCsv(t,ui.resultBuild[id]||'all'):ui.dTab==='bugs'?bugsCsv(t,developerBugs(t),'all'):bugsCsv(t,S.bugs,ui.resultBuild[id]||'all'),t.title,a==='export-survey'?'survey':'bugs');toast('CSV 파일을 다운로드했습니다.');}catch(error){toast(error.message);}return;}
  if(a==='cancel-application'){ui.cancelApplication=id;render(false);return;}
  if(a==='keep-application'){ui.cancelApplication=null;render(false);return;}
  if(a==='confirm-cancellation'){
    if(cloud){if(await remoteCommand('cancel_application',{testId:id})){ui.cancelApplication=null;delete ui.feedbackDrafts[id];render(false);toast('참여를 취소했습니다. 모집 인원이 갱신되었습니다.');}return;}
    const t=byId(id),m=S.mine[id];if(!m||!['waiting','applied'].includes(m.status))return;
    const previous=clone(S);if(m.status==='applied')t.applicants=Math.max(0,t.applicants-1);t.requests=t.requests.filter(r=>r.id!=='me');delete S.mine[id];
    if(!save()){S=previous;return;}ui.cancelApplication=null;delete ui.feedbackDrafts[id];render(false);toast('참여를 취소했습니다. 모집 인원이 갱신되었습니다.');return;
  }
  if(a==='open-bug-from-survey'){captureFeedbackDraft();openBugFromSurvey();return;}
  if(a==='media-remove'){const removed=ui.mediaDraft.find(m=>m.id===id);if(removed?.file)releaseStaged([removed]);ui.mediaDraft=ui.mediaDraft.filter(m=>m.id!==id);if(!ui.mediaDraft.some(m=>m.cover)){const first=ui.mediaDraft.find(m=>m.kind==='image');if(first)first.cover=true;}updateMediaEditor();queueDeveloperDraft();return;}
  if(a==='bug-file-remove'){releaseStaged(ui.bugMedia);ui.bugMedia=[];updateBugPreview();return;}
  if(a==='media-select'){ui.gallery=id;const t=byId(ui.detail);const el=$('#detail-gallery');if(t&&el){el.outerHTML=galleryHtml(t,id);mediaHydrator.hydrate($('#main'));}return;}
  if(a==='start-play'){const m=S.mine[id];if(m?.status==='applied'){m.startedAt=new Date().toISOString();m.playedBuild=byId(id).build;save();const el=$(`[data-progress-id="${id}"]`);if(el)el.outerHTML=progressHtml(byId(id),m);}return;}
  if(a==='read-notifications'){allNotifications().forEach(n=>S.readNotifications[n.id]=true);save();render();return;}
  if(a==='open-notification'){const n=allNotifications().find(n=>n.id===id);if(n&&await persistDeveloperDraft()!==false){S.readNotifications[id]=true;save();showNotificationTarget(n);}return;}
  if(a==='home-genre' ||a==='catalog-genre'){ui.genre=b.dataset.genre;render();return;}
  if(a==='feature'){ui.featured=id;render();return;}
  if(a==='clear-filters'){ui.genre='전체';ui.search='';ui.platform='all';ui.sort='default';render();return;}
  if(a==='tab-t'){
    if(b.dataset.tab==='saved'&&cloud&&!cloud.requireUser())return;
    releaseStaged(ui.bugMedia);ui.bugMedia=[];ui.tTab=b.dataset.tab;ui.detail=null;
    render();
    if(ui.tTab==='alerts'&&cloud?.user){
      const previous=S,identity=cloud.user.id;
      try{
        const snapshot=await cloud.snapshot();
        if(!ui.saving&&S===previous&&cloud.user?.id===identity&&ui.page==='tester'&&ui.tTab==='alerts'&&!ui.detail){
          S=migrateFeatures(snapshot);
          render(false);
        }
      }catch{toast('알림을 새로고침하지 못했습니다.');}
    }
    return;
  }
  if(a==='tab-d'){if(cloud&&!cloud.user){cloud.requireUser();return;}if(b.dataset.tab==='new')return startDeveloperEditor(ui.edit);if(await persistDeveloperDraft()===false)return;syncDraft();clearUploads();ui.publishedGame=null;ui.unresolvedBugGame=null;ui.dTab=b.dataset.tab;ui.edit=null;ui.draft=null;ui.devFields=null;if(ui.dTab==='drafts')await loadDeveloperDrafts();return render(false)}
  if(a==='tab-a'){ui.aTab=b.dataset.tab;ui.hiding=null;ui.logGame=null;return render()}
  if(a==='genre'){ui.genre=b.dataset.genre;return render()}
  if(a==='open'){releaseStaged(ui.bugMedia);ui.bugMedia=[];ui.gallery=null;ui.page='tester';ui.detail=id;ui.reporting=null;render();return top()}
  if(a==='back'){ui.detail=null;ui.reporting=null;return render()}
  if(a==='report-open'){ui.reporting=id;return render()}
  if(a==='report-cancel'){ui.reporting=null;return render()}
  /* operator */
  if(a==='game-moderation-history'){
    ui.aTab='log';ui.logGame=`id:${id}`;ui.hiding=null;
    render();$('#moderation-game-filter')?.focus();return;
  }
  if(a==='moderation-open'){
    ui.hiding={id,action:b.dataset.operation};
    render();$('#moderation-reason')?.focus();return;
  }
  if(a==='moderation-cancel'){ui.hiding=null;return render();}
  if(a==='moderation-confirm'){
    const action=ui.hiding?.id===id?ui.hiding.action:null,t=byId(id);
    if(!t||!['dismiss','hide','restore'].includes(action))return;
    const note=$('#moderation-reason').value.trim();
    if(note.length<4||note.length>4000){
      $('#moderation-error').textContent='처리 사유를 4~4000자로 입력해 주세요.';
      $('#moderation-reason').focus();
      return;
    }
    if(cloud){
      if(!await remoteCommand(action,{testId:id,note}))return;
    }else{
      const previous=clone(S),before=t.status;
      const reports=openReports().filter(report=>report.testId===id);
      if(action==='hide'){
        if(['open','closed'].includes(t.status))t.priorStatus=t.status;
        t.status='hidden';t.hiddenBy='admin';t.reason=note;
        reports.forEach(report=>{report.status='actioned';});
      }else if(action==='restore'||t.hiddenBy==='auto'){
        t.status=t.priorStatus||'open';delete t.reason;delete t.hiddenBy;
      }
      if(action==='dismiss')reports.forEach(report=>{report.status='dismissed';});
      logAdd(t,action,note,before);
      if(!save()){S=previous;return;}
    }
    ui.hiding=null;ui.aTab='log';ui.logGame=`id:${id}`;
    render();$('#moderation-game-filter')?.focus();
    return toast('처리 내역을 저장했습니다.');
  }
  /* developer */
  if(a==='delete-game'){
    const t=byId(id);
    if(t?.owner!=='me'||!window.confirm(`‘${t.title}’ 게임을 영구 삭제할까요?
게임 정보, 신청 기록, 설문 응답, 버그 제보, 첨부파일과 찜 기록이 삭제되며 복구할 수 없습니다.`))return;
    ui.saving=true;
    try{
      if(cloud){
        S=migrateFeatures(await cloud.deleteGame(id));
      }else{
        const previous=clone(S);
        const files=[...t.media,...S.bugs.filter(bug=>bug.testId===id).flatMap(bug=>bug.attachments||[])];
        S.tests=S.tests.filter(test=>test.id!==id);
        for(const key of ['reports','bugs','notifications'])S[key]=S[key].filter(item=>item.testId!==id);
        S.favorites=S.favorites.filter(testId=>testId!==id);
        delete S.mine[id];delete S.myReports[id];
        if(!save()){S=previous;return;}
        await removeMedia(files.map(file=>file.id));
      }
      await clearPublishedDraft(id);
      render(false);toast('게임을 삭제했습니다.');
    }catch(error){
      if(cloud){try{S=migrateFeatures(await cloud.snapshot());render(false);}catch{}}
      toast(error.message);
    }finally{ui.saving=false;}
    return;
  }
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
  if(a==='close-genre-picker'){
    genrePicker.open=false;
    genrePicker.querySelector('summary').focus();
    return;
  }
  if(a==='capacity-step'){
    const input=$('#f-slots');
    if(!input||input.disabled)return;
    const current=Math.trunc(input.valueAsNumber||1);
    input.value=String(Math.min(50,Math.max(1,current+Number(b.dataset.step))));
    queueDeveloperDraft();
    return;
  }
  if(a==='option-add'||a==='option-remove'){
    syncDraft();
    const options=ui.draft[+b.dataset.i].options;
    if(a==='option-add'&&options.length<6)options.push('');
    if(a==='option-remove'&&options.length>2)options.splice(+b.dataset.option,1);
    renderSurvey();
    if(a==='option-add')document.querySelectorAll(`.qrow[data-i="${b.dataset.i}"] .q-option`)[options.length-1]?.focus();
    return;
  }
  if(a==='q-add-goal'){
    const goal=$('#f-focus');
    const label=goal?.value.trim().replace(/\s+/g,' ')||'';
    if(!label){
      goal?.focus();
      toast('먼저 이번 테스트에서 확인할 점을 작성해 주세요.');
      return;
    }
    syncDraft();
    if(!ui.draft||ui.draft.length>=MAXQ)return;
    const question=newQ('text');
    question.label=label.length<=80?label:'';
    ui.draft.push(question);
    renderSurvey();
    $(`#survey-builder .qrow[data-i="${ui.draft.length-1}"] .q-label`)?.focus();
    if(!question.label)toast('목표를 참고해 80자 이내의 질문을 작성해 주세요.');
    return;
  }
  if(a==='q-add'){syncDraft();if(ui.draft.length<MAXQ)ui.draft.push(newQ('text'));return renderSurvey()}
  if(a==='q-del'){syncDraft();ui.draft.splice(+b.dataset.i,1);return renderSurvey()}
  if(a==='q-up'||a==='q-down'){
    syncDraft();const i=+b.dataset.i,j=a==='q-up'?i-1:i+1;
    if(j>=0&&j<ui.draft.length){const x=ui.draft[i];ui.draft[i]=ui.draft[j];ui.draft[j]=x}
    return renderSurvey();
  }
  if(a==='edit')return startDeveloperEditor(id);
  if(a==='cancel-edit'){if(await persistDeveloperDraft()===false)return;clearUploads();ui.edit=null;ui.draft=null;ui.devFields=null;ui.dTab='mine';return render(false)}
  if(a==='reset'){const previous=S,ids=[...new Set([...S.tests.flatMap(t=>t.media.map(m=>m.id)),...S.bugs.flatMap(b=>(b.attachments||[]).map(m=>m.id))])];clearUploads();S=migrateFeatures(seed());if(!save()){S=previous;return;}removeMedia(ids).catch(()=>{});ui.detail=null;ui.reporting=null;ui.hiding=null;ui.edit=null;ui.draft=null;ui.tTab='open';ui.dTab='mine';ui.aTab='reports';ui.genre='전체';render();return toast('예시 데이터로 되돌렸습니다.')}
});

listen(document,'input',e=>{if(e.target.id==='bug-title')updateDuplicates();if(e.target.closest('[data-form="dev"]')&&e.target.type!=='file')queueDeveloperDraft();});
listen(document,'change',e=>{
  if(e.target.id==='moderation-game-filter'){ui.logGame=e.target.value||null;render();$('#moderation-game-filter')?.focus();return;}
  if(e.target.dataset?.versionKind){const map=e.target.dataset.versionKind==='survey'?ui.resultBuild:ui.bugBuild;map[e.target.dataset.testId]=e.target.value;render(false);return;}
  if(e.target.id==='bug-build'){updateDuplicates();return;}
  if(e.target.id==='feedback-build'){captureFeedbackDraft();const t=byId(e.target.closest('form').dataset.id);$('#shared-bug-options').innerHTML=sharedBugOptionsHtml(t,bugSummaries(),e.target.value);return;}
  if(e.target.closest('[data-form="dev"]')&&e.target.type!=='file')queueDeveloperDraft();
  if(e.target.name==='problem-choice'){updateProblemGuidance();captureFeedbackDraft();if(e.target.value==='new')openBugFromSurvey();return;}
  if(e.target.name==='linked-bugs'){captureFeedbackDraft();return;}
  if(e.target.id==='f-media'||e.target.id==='bug-file'){
    const isBug=e.target.id==='bug-file',files=Array.from(e.target.files||[]),existing=isBug?ui.bugMedia:(ui.mediaDraft||[]);
    const error=validateMedia(existing,files,isBug?{imagesOnly:true,maxImages:1,maxVideos:0}:{});
    const err=$(isBug?'#bug-error':'#media-error');if(err)err.textContent=error;
    if(!error){const items=stageMedia(files);if(isBug)items.forEach(item=>item.scope='bug');if(isBug){ui.bugMedia.push(...items);updateBugPreview();}else{ui.mediaDraft.push(...items);if(!ui.mediaDraft.some(m=>m.cover)){const first=ui.mediaDraft.find(m=>m.kind==='image');if(first)first.cover=true;}updateMediaEditor();}}
    e.target.value='';if(!isBug)queueDeveloperDraft();return;
  }
  if(e.target.name==='cover-id'){ui.mediaDraft.forEach(m=>m.cover=m.id===e.target.value);queueDeveloperDraft();return;}

  if(e.target.id==='platform-filter'){ui.platform=e.target.value;render();return;}
  if(e.target.id==='sort-filter'){ui.sort=e.target.value;render();return;}
  if(e.target.id==='f-vis'){
    const c=$('#code-field'),d=$('#vis-desc');
    if(c)c.hidden=e.target.value!=='invite';
    if(d)d.textContent=VIS_DESC[e.target.value]||'';
  }
  if(e.target.name==='capacity-mode'||e.target.id==='f-other')updateDevSelectors();
  if(e.target.name==='f-genres')updateGenreSummary();
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
  if(['apply','feedback','bug'].includes(f.dataset.form)&&byId(f.dataset.id)?.owner==='me')return;
  if(f.dataset.form==='apply'){
    if(cloud){if(await remoteCommand('apply',{testId:f.dataset.id,agreed:$('#ap-agree').checked,code:$('#ap-code')?.value.trim().toUpperCase()||''})){render();$('#participation-next')?.focus();toast('신청을 저장했습니다.');}return;}
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
    const data={build:$('#bug-build').value,title:$('#bug-title').value.trim(),description:$('#bug-description').value.trim(),steps:$('#bug-steps').value.trim(),device:$('#bug-device').value.trim(),severity:$('#bug-severity').value};
    const validation=bugValidation(data);if(validation){err.textContent=validation;return;}
    ui.saving=true;const submit=f.querySelector('[type="submit"]');submit.disabled=true;
    const pending=[...ui.bugMedia],previous=clone(S);
    try{await saveMedia(pending);}catch{ui.saving=false;submit.disabled=false;err.textContent='첨부 파일을 저장하지 못했습니다. 저장 공간을 확인해 주세요.';return;}
    const date=new Date().toISOString();
    const bugId=crypto.randomUUID();
    if(cloud){ui.saving=false;const before=new Set(S.bugs.map(b=>b.id));if(await remoteCommand('bug',{testId:t.id,data:{...data,attachments:pending.map(mediaMetadata)}})){const newBug=S.bugs.find(b=>!before.has(b.id));const draft=ui.feedbackDrafts[t.id];if(draft&&newBug){draft.problemChoice='reported';draft.bugIds=[...new Set([...draft.bugIds,newBug.id])];}releaseStaged(ui.bugMedia);ui.bugMedia=[];render(false);toast('버그 제보를 저장했습니다. 개발자가 확인할 수 있습니다.');}else{submit.disabled=false;await removeMedia(pending.map(m=>mediaMetadata(m).id)).catch(()=>{});}return;}
    S.bugs.unshift({...data,id:bugId,testId:t.id,testerId:'me',build:data.build,status:'new',developerNote:'',attachments:pending.map(mediaMetadata),createdAt:date,updatedAt:date,history:[{status:'new',date,note:''}]});
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
    const issueChoice=f.querySelector('[name="problem-choice"]:checked')?.value||'',bugIds=selectedBugIds(f),build=$('#feedback-build').value;
    const issueError=validateFeedbackIssue(issueChoice,bugIds,S.bugs,t.id,bugSummaries());if(issueError){err.textContent=issueError;if(issueChoice==='new')openBugFromSurvey();return;}
    for(const q of t.survey){
      let val='';
      if(q.type==='text')val=($('#a-'+q.id).value||'').trim();
      else{const c=f.querySelector(`input[name="a-${q.id}"]:checked`);val=c?(q.type==='scale'?+c.value:c.value):''}
      if(q.required&&val===''){err.textContent='필수 문항에 답해 주세요: '+q.label;return}
      if(val!=='')answers[q.id]=val;
    }
    if(cloud){if(await remoteCommand('feedback',{testId:t.id,answers,build,issueStatus:issueChoice,bugIds:['reported','existing'].includes(issueChoice)?bugIds:[]})){delete ui.feedbackDrafts[t.id];render(false);$('#participation-next')?.focus();toast('설문을 제출했습니다.');}return;}
    const previous=clone(S);
    t.feedbacks.push({answers,build,surveySnapshot:clone(t.survey),issueStatus:issueChoice,bugIds:['reported','existing'].includes(issueChoice)?bugIds:[]});
    S.mine[t.id]=Object.assign({},S.mine[t.id],{status:'done'});if(!save()){S=previous;return;}delete ui.feedbackDrafts[t.id];render(false);return toast('설문을 제출했습니다.');
  }
  if(f.dataset.form==='dev'){
    await persistDeveloperDraft();
    syncDraft();
    const g=id=>$('#'+id).value.trim(),err=$('#dev-err');
    const selection=selectedGenres();
    const genres=selection.filter(genre=>genre!==OTHER_GENRE);
    const customGenres=$('#f-other').checked?g('f-other-genres').split(',').map(value=>value.trim()).filter(Boolean):[];
    if(!genres.length&&!customGenres.length||$('#f-other').checked&&!customGenres.length){
      $('#genre-picker').open=true;
      err.textContent='장르를 선택하고, 그 외를 선택했다면 장르를 직접 입력해 주세요.';
      if($('#f-other').checked)$('#f-other-genres').focus();
      else $('#genre-picker summary').focus();
      return;
    }
    if(customGenres.length>5||customGenres.some(genre=>[...genre].length>24||/[\x00-\x1f\x7f]/.test(genre)||GENRES.includes(genre)||genre===OTHER_GENRE)||new Set(customGenres.map(genre=>genre.toLowerCase())).size!==customGenres.length){
      err.textContent='기본 장르와 겹치지 않는 서로 다른 장르를 최대 5개, 각 24자까지 입력해 주세요.';return;
    }
    const d={title:g('f-title'),team:g('f-team'),genre:genres[0]||OTHER_GENRE,genres,customGenres,platform:g('f-platform'),build:g('f-build'),minutes:+g('f-min'),slots:$('#f-unlimited').checked?null:+g('f-slots'),
      feedbackFocus:g('f-focus'),deadline:g('f-deadline'),vis:g('f-vis'),code:g('f-code').toUpperCase(),teaser:g('f-teaser'),link:g('f-link'),how:g('f-how')};
    if((!ui.edit||d.feedbackFocus)&& (d.feedbackFocus.length<10||d.feedbackFocus.length>600)){err.textContent='확인할 점은 10~600자로 입력해 주세요.';return;}
    const deadlineError=deadlineValidation(d.deadline,byId(ui.edit)?.createdDate||today(),byId(ui.edit)?.deadline);
    if(deadlineError){err.textContent=deadlineError;return;}
    if(!d.build||d.build.length>16){err.textContent='빌드 버전은 1~16자로 입력해 주세요.';return;}
    if(!d.title||!d.team){err.textContent='게임 이름과 팀 이름을 입력해 주세요.';return}
    if(d.teaser.length<8){err.textContent='공개 소개를 8자 이상 적어 주세요.';return}
    if(d.vis==='invite'){if(!/^[A-Z0-9]{4,12}$/.test(d.code)){err.textContent='초대 코드는 영문과 숫자 4~12자로 입력해 주세요.';return}}else{d.code=''}
    d.link=safeUrl(d.link);
    if(!d.link){err.textContent='사용자 이름이나 비밀번호가 없는 유효한 HTTPS 빌드 링크를 입력해 주세요.';return}
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
    if(cloud){ui.saving=false;if(await remoteCommand('save_test',{testId:ui.edit,data:d})){const previousGameIds=new Set(oldState.tests.map(t=>t.id));ui.publishedGame=ui.edit?null:S.tests.find(t=>t.owner==='me'&&!previousGameIds.has(t.id))?.id;await clearPublishedDraft(ui.edit);clearUploads();ui.edit=null;ui.draft=null;ui.dTab='mine';render(false);top();$('#published-notice')?.focus();toast('테스트를 저장했습니다.');await removeMedia(oldIds.filter(id=>!d.media.some(m=>m.id===id))).catch(()=>{});}else{if(submit)submit.disabled=false;await removeMedia(pending.map(m=>mediaMetadata(m).id)).catch(()=>{});}return;}
    if(ui.edit){
      ui.publishedGame=null;
      const t=byId(ui.edit),was=t.status;d.builds=[...new Set([...(t.builds||[]),t.build,d.build].filter(Boolean))];Object.assign(t,d);
      if(was==='hidden'){t.status='appeal';msg='수정했습니다. 운영자가 재공개 여부를 검토합니다.'}else msg='수정 내용을 저장했습니다.';
    }else{
      ui.publishedGame='t'+Date.now();
      S.tests.push(Object.assign({id:ui.publishedGame,createdDate:today(),owner:'me',status:'open',applicants:0,feedbacks:[],requests:[],builds:[d.build]},d));
      msg='등록했습니다. 테스트가 바로 공개되었습니다.';
    }
    if(!save()){S=oldState;ui.saving=false;if(submit)submit.disabled=false;await removeMedia(pending.map(m=>m.id)).catch(()=>{});return;}
    await clearPublishedDraft(ui.edit);ui.saving=false;clearUploads();ui.edit=null;ui.draft=null;ui.dTab='mine';render(false);top();toast(msg);
    await removeMedia(oldIds.filter(id=>!d.media.some(m=>m.id===id))).catch(()=>{});
  }
});

listen(window,'hashchange',()=>{if(ui.saving)return;const p=hashPage();if(p&&p!==ui.page)nav(p)});
let disposeAccount;
if(cloud){
 const footer=document.querySelector('footer p');if(footer)footer.textContent='PlayTest Match · 개발자와 플레이어가 함께 만드는 게임.';
 document.querySelector('footer [data-act="reset"]')?.remove();
 disposeAccount=cloud.mountAccount(async reset=>{if(reset){if(draftOwner===currentDraftOwner())await persistDeveloperDraft();draftOwner=currentDraftOwner();clearTimeout(draftTimer);ui.devFields=null;ui.savedDrafts=[];ui.draftReady=false;clearUploads();ui.feedbackDrafts={};ui.detail=null;ui.edit=null;ui.draft=null;ui.page='home';location.hash='#home';mediaHydrator.dispose();mediaHydrator=createMediaHydrator();ui.publishedGame=null;S=migrateFeatures({tests:[]});render();}S=migrateFeatures(await cloud.snapshot());await loadDeveloperDrafts();render();});
}
const h0=hashPage();if(h0)ui.page=h0;
render();
if(globalThis.indexedDB)void loadDeveloperDrafts().then(()=>{if(!controller.signal.aborted&&ui.page==='developer'&&ui.dTab!=='new')render();});
listen(window,'pagehide',()=>{void persistDeveloperDraft();});
listen(document,'visibilitychange',()=>{if(document.visibilityState==='hidden')void persistDeveloperDraft();});
const deadlineTimer=typeof window.setInterval==='function'?window.setInterval(refreshDeadlines,60000):null;
listen(window,'focus',refreshDeadlines);
listen(document,'keydown',e=>{
  if(e.key!=='Escape')return;
  const picker=e.target.closest?.('#genre-picker[open]');
  if(picker){
    e.preventDefault();
    picker.open=false;
    picker.querySelector('summary').focus();
    return;
  }
  const notifications=$('#notification-area details');
  if(notifications?.open){notifications.open=false;notifications.querySelector('summary').focus();}
});
return ()=>{void persistDeveloperDraft();clearTimeout(draftTimer);disposeAccount?.();controller.abort();if(deadlineTimer)clearInterval(deadlineTimer);clearUploads();mediaHydrator.dispose();};
}
