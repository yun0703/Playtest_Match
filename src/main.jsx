import React, {useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import shell from './shell.html?raw';
import signupShell from './signup-shell.html?raw';
const signupPage=/^\/signup\/?$/.test(location.pathname);
import {mountPreferences} from './preferences.js';
import {createCloud} from './cloud.js';
import {configureRemoteMedia} from './media-store.js';
import {initialize} from './controller.js';
import './base.css';
import './design.css';
import './workspace.css';
function App(){useEffect(()=>{let dispose,disposePreferences=mountPreferences(),stopped=false;
(async()=>{try{const cloud=await createCloud({VITE_SUPABASE_URL:import.meta.env.VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY});if(signupPage){if(stopped)return;if(!cloud){document.getElementById('account-area').innerHTML='<p role="alert">회원가입 연결을 확인해 주세요.</p>';return;}dispose=cloud.mountAccount(async()=>{}, {signupPage:true});return;}const initialState=cloud?await cloud.snapshot():null;if(stopped)return;configureRemoteMedia(cloud);dispose=initialize({cloud,initialState});}catch{if(stopped)return;const node=document.getElementById('main');node.innerHTML='<section class="panel"><h1>서비스 연결을 확인해 주세요</h1><p id="startup-error" role="alert"></p><button type="button" id="startup-retry">다시 시도</button></section>';document.getElementById('startup-error').textContent='잠시 후 다시 시도해 주세요.';document.getElementById('startup-retry').addEventListener('click',()=>location.reload());}})();return ()=>{stopped=true;disposePreferences();dispose?.();configureRemoteMedia(null);};},[]);return <div dangerouslySetInnerHTML={{__html:signupPage?signupShell:shell}}/>;}
createRoot(document.getElementById('root')).render(<App/>);
