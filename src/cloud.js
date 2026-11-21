import {createClient} from '@supabase/supabase-js';
import {accountHtml,authErrorMessage,oauthRequest,SOCIAL_PROVIDERS,socialAvailabilityNote} from './account.js';
import {createAccountService,accountTaskError} from './account-service.js';
export function cloudConfiguration(env){const url=env.VITE_SUPABASE_URL||'',key=env.VITE_SUPABASE_PUBLISHABLE_KEY||'';if(!url&&!key)return null;if(!/^https:\/\/[^/]+\.supabase\.co$/.test(url)||!key||key.startsWith('sb_secret_'))throw new Error('Supabase 공개 연결 설정을 확인해 주세요.');return {url,key};}
export async function createCloud(env){
 const config=cloudConfiguration(env);if(!config)return null;
 const client=createClient(config.url,config.key,{auth:{flowType:'pkce'},global:{fetch:(input,options={})=>{
  const url=typeof input==='string'?input:input.url||String(input);
  if(!url.includes('/auth/v1/'))return fetch(input,options);
  const timeout=AbortSignal.timeout(12000),signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
  return fetch(input,{...options,signal});
 }}});
 let recoverySession=false;
 const earlyAuth=client.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')recoverySession=true;});
 const currentUrl=new URL(location.href),callbackError=currentUrl.searchParams.has('error')||new URLSearchParams(currentUrl.hash.slice(1)).has('error');
 const {data:{session},error}=await client.auth.getSession();if(error&&!callbackError)throw error;
 let user=session?.user||null,viewer={},providers={google:false,naver:false},authStatus=callbackError?authErrorMessage({code:'access_denied'}):'';
 if(callbackError){for(const name of ['error','error_code','error_description'])currentUrl.searchParams.delete(name);if(new URLSearchParams(currentUrl.hash.slice(1)).has('error'))currentUrl.hash='';history.replaceState(null,'',currentUrl.pathname+currentUrl.search+currentUrl.hash);}
 const checked=result=>{if(result.error)throw result.error;return result.data;};
 const api={client,get user(){return user;},get canAdmin(){return !!viewer.admin;},adopt(state){viewer=state.viewer||{};return state;},
  async snapshot(){
   let identity=user?.id,response=await client.rpc(user?'pt_sync_profile':'pt_snapshot');
   if(response.error&&user){
    const preview=await client.rpc('pt_account_delete_preview');
    if(identity!==user?.id)throw new Error('계정이 변경되었습니다. 다시 시도해 주세요.');
    if(!preview.error&&preview.data.pending){const state=checked(await client.rpc('pt_snapshot'));if(identity!==user?.id)throw new Error('계정이 변경되었습니다. 다시 시도해 주세요.');state.viewer={...state.viewer,pendingDeletion:true,deletionPreview:preview.data};return api.adopt(state);}
    const verification=await client.auth.getUser();
    if(identity!==user?.id)throw new Error('계정이 변경되었습니다. 다시 시도해 주세요.');
    if([400,401,403,404].includes(verification.error?.status)||!verification.error&&!verification.data.user){await client.auth.signOut({scope:'local'});user=null;viewer={};identity=undefined;response=await client.rpc('pt_snapshot');}
   }
   const result=checked(response);if(identity!==user?.id)throw new Error('계정이 변경되었습니다. 다시 시도해 주세요.');return api.adopt(result);
  },
  async command(action,payload){if(!user)throw new Error('로그인이 필요합니다.');const identity=user.id;const result=checked(await client.rpc('pt_command',{action,payload}));if(identity!==user?.id)throw new Error('계정이 변경되었습니다. 다시 시도해 주세요.');return api.adopt(result);},
  requireUser(){if(user)return true;const details=document.querySelector('#account-area details');if(details){details.open=true;document.getElementById('account-email')?.focus();}return false;},
  pathFor(id,scope='game'){if(id.includes('/'))return id;if(!user)throw new Error('로그인이 필요합니다.');return `${scope}/${user.id}/${id}`;},
  async saveMedia(items){const uploaded=[];try{for(const item of items){const path=api.pathFor(item.id,item.scope);checked(await client.storage.from('playtest-media').upload(path,item.file,{contentType:item.type,upsert:false}));uploaded.push(path);}}catch(error){if(uploaded.length)await client.storage.from('playtest-media').remove(uploaded);throw error;}},
  async removeMedia(ids){if(ids.length)checked(await client.storage.from('playtest-media').remove(ids.map(id=>api.pathFor(id))));},
  async getMedia(id){return checked(await client.storage.from('playtest-media').download(id));},
  mountAccount(onRefresh){
   const root=document.getElementById('account-area');let disposed=false,manualAuth=false,refreshTimer;
   const service=createAccountService(client,location.origin);
   let mode=viewer.pendingDeletion?'delete':recoverySession?'recovery':currentUrl.searchParams.get('account')==='recovery'?'recover':'',deletion=viewer.deletionPreview||null,taskMessage=currentUrl.searchParams.get('account')==='recovery'&&callbackError?authErrorMessage({code:'otp_expired'}):'';
   function taskStatus(message){taskMessage=message;const el=document.getElementById('account-task-status');if(el)el.textContent=message;}
   function status(message){authStatus=message;const el=document.getElementById('account-status');if(el)el.textContent=message;}
   function render(){if(disposed)return;const open=root.querySelector('.account-menu')?.open;root.innerHTML=accountHtml(user,viewer,providers,authStatus,{mode,deletion,message:taskMessage});if(open||authStatus)root.querySelector('.account-menu')?.setAttribute('open','');const dialog=document.getElementById('account-dialog');if(dialog){dialog.showModal();dialog.addEventListener('cancel',event=>{event.preventDefault();if(!manualAuth){mode='';taskMessage='';render();}});}}
   function busy(value){root.querySelectorAll('[data-account-form] button,[data-account-task] button,[data-account],[data-social]').forEach(button=>{button.disabled=value||Boolean(button.dataset.social&&!providers[button.dataset.social]);});}
   async function loadProviders(){
    try{const response=await fetch('/api/auth/providers',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error();const data=await response.json();providers={google:data.google===true,naver:data.naver===true,testMode:data.testMode!==false};}catch{providers={google:false,naver:false};}
    if(disposed)return;
    const note=document.getElementById('social-availability');if(note)note.textContent=socialAvailabilityNote(providers);
    root.querySelectorAll('[data-social]').forEach(button=>{const enabled=providers[button.dataset.social];button.disabled=manualAuth||!enabled;button.querySelector('small')?.remove();if(!enabled){const note=document.createElement('small');note.textContent='연결 준비 중';button.append(note);}});
   }
   async function submit(event){
    const task=event.target.closest('[data-account-task]');
    if(task){event.preventDefault();if(manualAuth||!task.reportValidity())return;manualAuth=true;busy(true);taskStatus('처리 중입니다.');
     try{const data=Object.fromEntries(new FormData(task));
      if(task.dataset.accountTask==='recover'){await service.recover(String(data.email).trim());taskStatus('입력한 이메일로 복구 가능한 계정이 있으면 안내 메일을 보냅니다. 메일함과 스팸함을 확인해 주세요.');}
      if(task.dataset.accountTask==='profile'){api.adopt(await service.profile(data.nickname));await onRefresh(false);taskMessage='프로필을 저장했습니다.';render();}
      if(task.dataset.accountTask==='password'){const result=await service.password({...data,user,recovery:recoverySession});user=result.user;recoverySession=false;mode='settings';taskMessage='비밀번호를 저장했습니다.';const url=new URL(location.href);url.searchParams.delete('account');history.replaceState(null,'',url.pathname+url.search+url.hash);await onRefresh(false);render();}
      if(task.dataset.accountTask==='delete'){await service.deleteAccount(data.confirmation);user=null;viewer={};mode='';deletion=null;authStatus='회원 탈퇴가 완료되었습니다.';await onRefresh(true);render();}
     }catch(error){if(task.dataset.accountTask==='delete'){try{deletion=await service.deletionPreview();}catch{}render();}taskStatus(accountTaskError(error)||authErrorMessage(error));}
     finally{manualAuth=false;busy(false);}return;
    }
    const form=event.target.closest('[data-account-form]');if(!form)return;event.preventDefault();if(manualAuth||!form.reportValidity())return;
    manualAuth=true;busy(true);status('');
    try{const data=new FormData(form);if(event.submitter?.value==='signup'){
      const result=checked(await client.auth.signUp({email:data.get('email'),password:data.get('password'),options:{data:{nickname:String(data.get('nickname')||'플레이어').slice(0,40)},emailRedirectTo:location.origin}}));
      if(!result.session){status('인증 메일을 보냈습니다. 이메일에서 가입을 확인한 뒤 로그인해 주세요.');return;}user=result.user;
     }else user=checked(await client.auth.signInWithPassword({email:data.get('email'),password:data.get('password')})).user;
     mode='';recoverySession=false;await onRefresh(true);render();
    }catch(error){status(authErrorMessage(error));}finally{manualAuth=false;busy(false);}
   }
   async function click(event){
    const social=event.target.closest('[data-social]')?.dataset.social,action=event.target.closest('[data-account]')?.dataset.account;
    if((!social&&!action)||manualAuth)return;
    if(action==='close-dialog'){mode='';taskMessage='';render();return;}
    if(action==='settings'||action==='recover'){mode=action;taskMessage='';render();return;}
    if(action==='delete-preview'){manualAuth=true;busy(true);try{deletion=await service.deletionPreview();mode='delete';taskMessage='';render();}catch(error){taskStatus(accountTaskError(error)||authErrorMessage(error));}finally{manualAuth=false;busy(false);}return;}
    if(action==='reauthenticate'){manualAuth=true;busy(true);try{checked(await client.auth.reauthenticate());taskStatus('인증 코드를 보냈습니다. 이메일을 확인해 주세요.');}catch(error){taskStatus(authErrorMessage(error));}finally{manualAuth=false;busy(false);}return;}
    if(social){
     if(!providers[social]||!SOCIAL_PROVIDERS[social])return;
     manualAuth=true;busy(true);status('로그인 서비스로 이동합니다.');
     try{const data=checked(await client.auth.signInWithOAuth(oauthRequest(social,location.origin)));const destination=new URL(data.url);if(destination.origin!==config.url||destination.pathname!=='/auth/v1/authorize')throw new Error();location.assign(destination.href);}
     catch(error){status(authErrorMessage(error));manualAuth=false;busy(false);}return;
    }
    try{if(action==='providers'){await loadProviders();return;}if(action==='logout'){manualAuth=true;const result=await client.auth.signOut({scope:'local'});if(result.error&&user)throw result.error;user=null;viewer={};mode='';deletion=null;recoverySession=false;await onRefresh(true);render();}else {await onRefresh(false);render();}}
    catch(error){if(user)window.alert(authErrorMessage(error));else status(authErrorMessage(error));}finally{manualAuth=false;}
   }
   render();root.addEventListener('submit',submit);root.addEventListener('click',click);void loadProviders();
   const {data:{subscription}}=client.auth.onAuthStateChange((event,nextSession)=>{
    if(event==='PASSWORD_RECOVERY'){recoverySession=true;mode='recovery';}
    const previous=user?.id;user=nextSession?.user||null;const changed=previous!==user?.id;if(changed)viewer={};
    if(event==='SIGNED_OUT'){mode='';deletion=null;recoverySession=false;}
    if((manualAuth&&event!=='SIGNED_OUT')||disposed||(!changed&&!['USER_UPDATED','PASSWORD_RECOVERY'].includes(event)))return;
    // Leave the SDK's auth lock before issuing another authenticated request.
    clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{if(disposed)return;render();try{await onRefresh(changed);render();}catch(error){status(authErrorMessage(error));}},0);
   });
   earlyAuth.data.subscription.unsubscribe();
   return ()=>{disposed=true;clearTimeout(refreshTimer);root.removeEventListener('submit',submit);root.removeEventListener('click',click);subscription.unsubscribe();};
  }
 };
 return api;
}
