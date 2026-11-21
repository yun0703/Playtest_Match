export const DEADLINE_WINDOW=48*60*60*1000;
export const BUG_STATUSES={new:'접수됨',review:'확인 중',planned:'수정 예정',fixed:'수정 완료',unreproduced:'재현 불가'};
export const SEVERITIES={minor:'경미',normal:'보통',critical:'진행 불가'};
export function seoulDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function dateAfterDays(days,now=new Date()){return seoulDate(new Date(now.getTime()+days*86400000));}
export function deadlineTime(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return NaN;
 const time=Date.parse(`${date}T23:59:59.999+09:00`);
 return Number.isFinite(time)&&seoulDate(new Date(time))===date?time:NaN;
}
export function deadlineState(date,now=Date.now()){
 const due=deadlineTime(date);
 if(!Number.isFinite(due))return 'none';
 if(now>due)return 'overdue';
 return due-now<=DEADLINE_WINDOW?'soon':'open';
}
export function participationStep(application){if(!application)return 0;if(application.status==='done')return 4;if(application.status==='applied')return application.startedAt?3:2;return 1;}
export function deadlineNotifications(state,now=Date.now()){
 return state.tests.flatMap(test=>{
  const application=state.mine[test.id];
  if(!application||application.status!=='applied'||!['open','closed'].includes(test.status))return [];
  const kind=deadlineState(test.deadline,now);
  if(!['soon','overdue'].includes(kind))return [];
  return [{id:`deadline:${test.id}:${test.deadline}:${kind}`,testId:test.id,type:kind,title:kind==='soon'?'피드백 마감이 다가옵니다.':'피드백 제출 기한이 지났습니다.',date:test.deadline}];
 });
}
export function bugValidation(data){
 if(data.title.trim().length<3||data.title.length>100)return '버그 제목은 3~100자로 입력해 주세요.';
 if(data.description.trim().length<10||data.description.length>4000)return '발생 상황은 10~4000자로 입력해 주세요.';
 if(data.steps.trim().length<5||data.steps.length>4000)return '재현 순서는 5~4000자로 입력해 주세요.';
 if(!data.device.trim()||data.device.length>200)return '기기와 운영체제를 입력해 주세요.';
 if(!Object.hasOwn(SEVERITIES,data.severity))return '심각도를 선택해 주세요.';
 return '';
}
export function migrateFeatures(state){for(const key of ['tests','reports','log','bugs','notifications'])state[key]=Array.isArray(state[key])?state[key]:[];for(const key of ['mine','myReports','readNotifications'])state[key]=state[key]||{};state.tests.forEach(t=>{t.media=Array.isArray(t.media)?t.media:[];t.deadline=t.deadline||'';t.feedbackFocus=typeof t.feedbackFocus==='string'?t.feedbackFocus:'';});return state;}

export function validateFeedbackIssue(choice,ids,bugs,testId){
 if(!['none','reported','new'].includes(choice))return '문제 발견 여부를 선택해 주세요.';
 if(choice==='new')return '새 버그 제보를 먼저 저장해 주세요. 설문 답변은 유지됩니다.';
 if(choice==='reported'&&(!ids.length||ids.some(id=>!bugs.some(b=>b.id===id&&b.testId===testId&&b.testerId==='me'))))return '연결할 내 버그 제보를 선택해 주세요.';
 return '';
}

export function isLegacyBugQuestion(question){return question.type==='text'&&!question.required&&['발견한 버그나 하고 싶은 말을 적어 주세요.','발견한 버그가 있다면 적어 주세요.'].includes(question.label);}
