import {initialize} from './src/controller.js';
const elements=new Map(['#main','#menu','#toast'].map(k=>[k,{innerHTML:'',dataset:{},classList:{add(){},remove(){}},scrollIntoView(){}}]));
const handlers={};
globalThis.document={querySelector:s=>elements.get(s)||null};
globalThis.window={scrollTo(){}};
globalThis.location={hash:''};
globalThis.localStorage={getItem(){return null},setItem(){}};
for(const target of [document,window])target.addEventListener=(type,fn)=>{handlers[type]=fn};
const dispose=initialize();
for(const page of ['home','tester','developer','admin']){location.hash='#'+page;handlers.hashchange();if(!elements.get('#main').innerHTML.length)throw Error('Empty '+page);console.log('PASS render '+page);}
location.hash='#home';handlers.hashchange();
const html=elements.get('#main').innerHTML;
const id=html.match(/data-act="open" data-id="([^"]+)"/)[1];
const button={dataset:{act:'open',id},disabled:false};
handlers.click({target:{closest:s=>s==='[data-act]'?button:null}});
if(!elements.get('#main').innerHTML.includes('data-form="apply"'))throw Error('Detail missing application');
console.log('PASS featured detail and application form');
dispose();

let refreshAccount;
const cloud={user:{id:'member'},canAdmin:false,mountAccount(fn){refreshAccount=fn;return ()=>{};},async snapshot(){return {tests:[]};}};
location.hash='#developer';
const disposeCloud=initialize({cloud,initialState:{tests:[]}});
await handlers.click({target:{closest:selector=>selector==='[data-act]'?{dataset:{act:'tab-d',tab:'new'},disabled:false}:null},preventDefault(){}});
if(!elements.get('#main').innerHTML.includes('data-form="dev"'))throw Error('Member cannot publish');
cloud.user=null;
await refreshAccount(true);
if(location.hash!=='#home')throw Error('Signed-out route disagrees with the screen');
if(elements.get('#main').innerHTML.includes('data-form="dev"'))throw Error('Developer form survived sign-out');
if(!elements.get('#main').innerHTML.includes('인디게임 플레이테스트'))throw Error('Signed-out page did not render');
disposeCloud();
console.log('PASS signed-in member publishing and account reset with empty private state');

