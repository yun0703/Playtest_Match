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

