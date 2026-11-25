import {initialize} from './src/controller.js';
const elements=new Map(['#main','#menu','#toast'].map(k=>[k,{innerHTML:'',dataset:{},classList:{add(){},remove(){}},scrollIntoView(){}}]));
const handlers={};
globalThis.document={querySelector:s=>elements.get(s)||null};
globalThis.window={scrollTo(){}};
globalThis.location={hash:''};
globalThis.localStorage={getItem(){return null},setItem(){}};
for(const target of [document,window])target.addEventListener=(type,fn)=>{handlers[type]=fn};
const dispose=initialize();
for(const page of ['home','tester','developer','admin','guide']){location.hash='#'+page;handlers.hashchange();if(!elements.get('#main').innerHTML.length)throw Error('Empty '+page);console.log('PASS render '+page);}
if(!elements.get('#main').innerHTML.includes('id="guide-title"')||!elements.get('#main').innerHTML.includes('개발자로 모집하기'))throw Error('Usage guide missing');
location.hash='#developer';handlers.hashchange();
const openRequest={dataset:{section:'requests'}},restoredRequest={dataset:{section:'requests'},open:false};
const openGame={dataset:{game:'t1'},open:true,querySelectorAll:()=>[openRequest]};
const restoredGame={dataset:{game:'t1'},open:false,querySelectorAll:()=>[restoredRequest]};
let managedQueries=0;
document.querySelectorAll=selector=>selector==='.managed-entry'?[managedQueries++===0?openGame:restoredGame]:[];
await handlers.click({target:{closest:s=>s==='[data-act]'?{dataset:{act:'tab-d',tab:'mine'}}:null}});
if(!restoredGame.open||!restoredRequest.open)throw Error('Game management lost its expanded sections after rendering');
delete document.querySelectorAll;
location.hash='#tester';handlers.hashchange();
await handlers.click({target:{closest:s=>s==='[data-act]'?{dataset:{act:'tab-t',tab:'alerts'}}:null}});
if(!elements.get('#main').innerHTML.includes('notification-page'))throw Error('Tester alerts did not render in the main view');
location.hash='#home';handlers.hashchange();
const html=elements.get('#main').innerHTML;
const id=[...html.matchAll(/data-act="open" data-id="([^"]+)"/g)].map(match=>match[1]).find(id=>id==="t3");
const button={dataset:{act:'open',id},disabled:false};
handlers.click({target:{closest:s=>s==='[data-act]'?button:null}});
if(!elements.get('#main').innerHTML.includes('data-form="apply"'))throw Error('Detail missing application');
if(!elements.get('#main').innerHTML.includes('data-act="jump-participation"'))throw Error('Mobile detail missing its participation shortcut');
const ownButton={dataset:{act:'open',id:'t1'},disabled:false};
handlers.click({target:{closest:s=>s==='[data-act]'?ownButton:null}});
if(elements.get('#main').innerHTML.includes('data-form="apply"'))throw Error('Owner can apply to their own test');
console.log('PASS application for other games and owner exclusion');
dispose();

let refreshAccount;
const cloud={user:{id:'member'},canAdmin:false,mountAccount(fn){refreshAccount=fn;return ()=>{};},async snapshot(){return {tests:[]};}};
location.hash='#developer';
const disposeCloud=initialize({cloud,initialState:{tests:[]}});
await handlers.click({target:{closest:selector=>selector==='[data-act]'?{dataset:{act:'tab-d',tab:'new'},disabled:false}:null},preventDefault(){}});
if(!elements.get('#main').innerHTML.includes('data-form="dev"'))throw Error('Member cannot publish');
for(const mark of ['id="f-other"','id="f-other-genres"','id="f-limited"','id="f-unlimited"','data-act="capacity-step"']){
  if(!elements.get('#main').innerHTML.includes(mark))throw Error('Missing registration control: '+mark);
}
const goal='첫 배달 경로를 찾을 때 어디에서 막혔나요?';
let focusedQuestion=false;
elements.set('#f-focus',{value:goal});
elements.set('#survey-builder',{innerHTML:'',querySelectorAll:()=>[]});
elements.set('#survey-builder .qrow[data-i="3"] .q-label',{focus(){focusedQuestion=true;}});
if(!elements.get('#main').innerHTML.includes('data-act="q-add-goal"'))throw Error('Goal question guidance missing');
await handlers.click({target:{closest:s=>s==='[data-act]'?{dataset:{act:'q-add-goal'}}:null}});
if(!elements.get('#survey-builder').innerHTML.includes(`value="${goal}"`)||!focusedQuestion)throw Error('Goal question was not editable after adding it');
cloud.user=null;
await refreshAccount(true);
if(location.hash!=='#home')throw Error('Signed-out route disagrees with the screen');
if(elements.get('#main').innerHTML.includes('data-form="dev"'))throw Error('Developer form survived sign-out');
if(!elements.get('#main').innerHTML.includes('<h1>IndieTest</h1>'))throw Error('Signed-out page did not render');
disposeCloud();
console.log('PASS signed-in member publishing and account reset with empty private state');



// The spotlight draws from every eligible game and stays stable on filter changes.
const now=new Date();
const validDeadline=new Date(now.getTime()+86400000).toISOString().slice(0,10);
const expiredDeadline=new Date(now.getTime()-172800000).toISOString().slice(0,10);
const eligibleGames=Array.from({length:5},(_,i)=>({id:`featured-${i}`,title:`Featured ${i}`,status:'open',vis:'public',slots:5,applicants:0,genre:'퍼즐',platform:'WebGL',deadline:validDeadline}));
const tests=[...eligibleGames,{...eligibleGames[0],id:'expired',deadline:expiredDeadline},{...eligibleGames[0],id:'closed',status:'closed'}];
location.hash='#home';
const originalRandom=Math.random;
let disposeSpotlight;
try{
  Math.random=()=>0.99;
  disposeSpotlight=initialize({cloud,initialState:{tests}});
  const spotlight=()=>elements.get('#main').innerHTML;
  if(!spotlight().includes('data-id="featured-4" aria-pressed="true"'))throw Error('The spotlight must include eligible games outside the first four');
  Math.random=()=>0;
  await handlers.click({target:{closest:s=>s==='[data-act]'?{dataset:{act:'clear-filters'}}:null}});
  if(!spotlight().includes('data-id="featured-4" aria-pressed="true"'))throw Error('The spotlight changed during a filter update');
  location.hash='#tester';handlers.hashchange();
  location.hash='#home';handlers.hashchange();
  if(!spotlight().includes('data-id="featured-0" aria-pressed="true"'))throw Error('The spotlight was not selected again on return to Home');
}finally{
  Math.random=originalRandom;
  disposeSpotlight?.();
}
console.log('PASS randomized eligible spotlight and stable filters');
