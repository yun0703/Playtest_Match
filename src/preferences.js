import {GENRES} from './genres.js';
import translations from './translations.js';
export const PREFERENCE_KEY='playtest-match-preferences-v1';
export function normalizePreferences(value){return {theme:value?.theme==='dark'?'dark':'light',language:value?.language==='en'?'en':'ko'};}
export function readPreferences(storage){try{return normalizePreferences(JSON.parse(storage.getItem(PREFERENCE_KEY)));}catch{return normalizePreferences(null);}}
const variableTranslations=[
 [/^승인 대기 (\d+)명$/,(_,n)=>`Awaiting approval · ${n}`],
 [/^(\s*)찜한 게임 (\d+)(\s*)$/,(_,a,n,b)=>`${a}Saved games ${n}${b}`],
 [/^(\s*)(\d+)명 참여(\s*)$/,(_,a,n,b)=>`${a}${n} participants${b}`],
 [/^미디어 (\d+)$/,(_,n)=>`Media ${n}`],
 [/^(\s*)모집 중 (\d+)(\s*)$/,(_,a,n,b)=>`${a}Open ${n}${b}`],
 [/^(\s*)내 참여 (\d+)(\s*)$/,(_,a,n,b)=>`${a}My participation ${n}${b}`],
 [/^(\s*)내 테스트 (\d+)(\s*)$/,(_,a,n,b)=>`${a}My playtests ${n}${b}`],
 [/^(\s*)신고 접수 (\d+)(\s*)$/,(_,a,n,b)=>`${a}Reports ${n}${b}`],
 [/^(\s*)재공개 요청 (\d+)(\s*)$/,(_,a,n,b)=>`${a}Republication requests ${n}${b}`],
 [/^(\s*)(?:◷ )?(?:약 )?(\d+)분(\s*)$/,(_,a,n,b)=>`${a}◷ ${n} min${b}`],
 [/^(\s*)(\d+)\/(\d+)명(\s*)$/,(_,a,n,m,b)=>`${a}${n}/${m} testers${b}`],
 [/^(\s*)(\d+)명 응답(\s*)$/,(_,a,n,b)=>`${a}${n} responses${b}`],
 [/^(\s*)(\d+)\/(\d+)문항(\s*)$/,(_,a,n,m,b)=>`${a}${n}/${m} questions${b}`],
 [/^질문 (\d+) (유형|위로|아래로|삭제|내용|보기)$/,(_,n,type)=>`Question ${n}: ${{유형:'type',위로:'move up',아래로:'move down',삭제:'delete',내용:'text',보기:'options'}[type]}`],
 [/^질문 (\d+)번의 내용을 입력해 주세요\.$/,(_,n)=>`Enter the text for question ${n}.`],
 [/^질문 (\d+)번의 보기는 서로 다른 2~6개가 필요합니다\.$/,(_,n)=>`Question ${n} needs 2–6 distinct options.`],
 [/^필수 문항에 답해 주세요: (.+)$/,(_,q)=>`Please answer the required question: ${q}`],
 [/^'(.+)'을 다시 공개했습니다\.$/,(_,title)=>`'${title}' has been republished.`],
 [/^(.+)님을 승인했습니다\. 플레이 방법과 빌드 링크가 열립니다\.$/,(_,name)=>`${name} was approved and can now access the build and instructions.`],
 [/^(.+)님의 신청을 거절했습니다\.$/,(_,name)=>`${name}'s application was declined.`],
];
export function translateText(value, language){
 if(language!=='en')return value;
 const trimmed=value.trim();
 if(translations[trimmed])return value.replace(trimmed,translations[trimmed]);
 for(const suffix of [' 예시 게임 아트워크',' 테스트 살펴보기']){
  if(value.endsWith(suffix))return value.slice(0,-suffix.length)+(suffix.includes('아트워크')?' — illustrative game artwork':' — view playtest');
 }
 if(new RegExp('^\\s*('+GENRES.join('|')+') ·').test(value))return value.replace(new RegExp(GENRES.join('|'),'g'),s=>translations[s]||s).replace(/약 (\d+)분/g,'about $1 min').replace(/설문 (\d+)문항/g,'$1 survey questions');
 if(/^\s*(WebGL|Windows|Android) 빌드 받기\s*$/.test(value))return value.replace('빌드 받기','— open build');
 if(/^이용 동의 \d{4}-\d{2}-\d{2}/.test(value))return value.replace('이용 동의','Agreed on').replace('공유와 재배포는 금지됩니다.','Sharing and redistribution are prohibited.');
 for(const [pattern,replace] of variableTranslations)if(pattern.test(value))return value.replace(pattern,replace);
 // Composite UI labels may combine numbers and translated status names.
 if(/^[\s\d/()·:*.,\-]+$/.test(value))return value;
 if(/^(신청자 관리|설문 결과|접수된 신고|신고 |공개 ·|승인제 ·|초대 전용 ·)/.test(trimmed)||/^\s*(5점 척도|객관식|주관식) ·/.test(value)){
  let result=value;
  for(const [ko,en] of Object.entries(translations).sort((a,b)=>b[0].length-a[0].length))result=result.replaceAll(ko,en);
  return result.replace(/(\d+)명/g,'$1 testers').replace(/(\d+)건/g,/(5점 척도|객관식|주관식)/.test(value)?'$1 responses':'$1 reports').replace(/(\d+)문항/g,'$1 questions');
 }
 if(/^\s*\d+(건|점)\s*$/.test(value))return value.replace('건',' responses').replace('점',' points');
 return value;
}
export function mountPreferences(){
 const prefs=readPreferences(localStorage);
 const originalText=new WeakMap(),originalAttributes=new WeakMap();
 const root=document.body;
 let observer;
 function localize(){
  observer?.disconnect();
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
   if(node.parentElement?.closest('script,style,textarea,[data-no-translate]'))continue;
   const old=originalText.get(node);
   const source=old&&old.last===node.nodeValue?old.source:node.nodeValue;
   let next=translateText(source,prefs.language);
   const action=node.parentElement?.closest('button')?.dataset.act;
   if(prefs.language==='en'&&action==='toggle-close')next=source==='모집 종료'?'Close recruitment':'Reopen recruitment';
   if(prefs.language==='en'&&action==='req-decline')next='Decline';
   if(node.nodeValue!==next)node.nodeValue=next;
   originalText.set(node,{source,last:next});
  }
  for(const element of root.querySelectorAll('[aria-label],[placeholder],[title],option')){
   // Keep form values in their original language; only visible option labels change.
   if(element.tagName==='OPTION'&&!element.hasAttribute('value'))element.setAttribute('value',originalText.get(element.firstChild)?.source||element.textContent);
   const cache=originalAttributes.get(element)||{};
   for(const attr of ['aria-label','placeholder','title']){
    if(!element.hasAttribute(attr))continue;
    const value=element.getAttribute(attr),old=cache[attr];
    const source=old&&old.last===value?old.source:value;
    const next=translateText(source,prefs.language);
    if(next!==value)element.setAttribute(attr,next);
    cache[attr]={source,last:next};
   }
   originalAttributes.set(element,cache);
  }
  observer?.observe(root,{subtree:true,childList:true,characterData:true});
 }
 function apply(){
  document.documentElement.dataset.theme=prefs.theme;
  document.documentElement.lang=prefs.language;
  document.title=prefs.language==='en'?'PlayTest Match — Indie game playtests':'PlayTest Match — 인디게임 플레이테스트';
  document.getElementById('theme-select').value=prefs.theme;
  document.getElementById('language-select').value=prefs.language;
  localize();
 }
 function onChange(event){
  if(event.target.id==='theme-select')prefs.theme=event.target.value;
  else if(event.target.id==='language-select')prefs.language=event.target.value;
  else return;
  try{localStorage.setItem(PREFERENCE_KEY,JSON.stringify(prefs));}catch{}
  apply();
 }
 function closeSettings(event){const login=document.querySelector('#login-area .account-menu');if(event.key==='Escape'&&login?.open&&!document.querySelector('dialog[open]')){login.open=false;login.querySelector('summary').focus();}const settings=document.getElementById('settings');if(event.key==='Escape'&&settings.open&&!document.querySelector('dialog[open]')){settings.open=false;settings.querySelector('summary').focus();}}
 function outsideClick(event){const login=document.querySelector('#login-area .account-menu');if(login?.open&&!event.composedPath().includes(login))login.open=false;const settings=document.getElementById('settings');if(settings.open&&(!event.composedPath().includes(settings)||event.target.closest('a[data-nav]')))settings.open=false;}
 observer=new MutationObserver(localize);
 apply();
 document.addEventListener('change',onChange);
 document.addEventListener('keydown',closeSettings);
 document.addEventListener('click',outsideClick);
 return ()=>{observer.disconnect();document.removeEventListener('change',onChange);document.removeEventListener('keydown',closeSettings);document.removeEventListener('click',outsideClick);};
}
