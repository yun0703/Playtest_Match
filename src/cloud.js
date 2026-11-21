import {createClient} from '@supabase/supabase-js';
import {accountHtml,authErrorMessage,oauthRequest,SOCIAL_PROVIDERS} from './account.js';
export function cloudConfiguration(env){const url=env.VITE_SUPABASE_URL||'',key=env.VITE_SUPABASE_PUBLISHABLE_KEY||'';if(!url&&!key)return null;if(!/^https:\/\/[^/]+\.supabase\.co$/.test(url)||!key||key.startsWith('sb_secret_'))throw new Error('Supabase 공개 연결 설정을 확인해 주세요.');return {url,key};}
export async function createCloud(env){
 const config=cloudConfiguration(env);if(!config)return null;
 const client=createClient(config.url,config.key,{auth:{flowType:'pkce'}});
 const currentUrl=new URL(location.href),callbackError=currentUrl.searchParams.has('error')||new URLSearchParams(currentUrl.hash.slice(1)).has('error');
 const {data:{session},error}=await client.auth.getSession();if(error&&!callbackError)throw error;
 let user=session?.user||null,viewer={},providers={google:false,naver:false},authStatus=callbackError?authErrorMessage({code:'access_denied'}):'';
 if(callbackError){for(const name of ['error','error_code','error_description'])currentUrl.searchParams.delete(name);if(new URLSearchParams(currentUrl.hash.slice(1)).has('error'))currentUrl.hash='';history.replaceState(null,'',currentUrl.pathname+currentUrl.search+currentUrl.hash);}
 const checked=result=>{if(result.error)throw result.error;return result.data;};
 const api={client,get user(){return user;},get canAdmin(){return !!viewer.admin;},adopt(state){viewer=state.viewer||{};return state;},
  async snapshot(){const identity=user?.id;const result=checked(await client.rpc(user?'pt_sync_profile':'pt_snapshot'));if(identity!==user?.id)throw new Error('계정이 변경되었습니다. 다시 시도해 주세요.');return api.adopt(result);},
  async command(action,payload){if(!user)throw new Error('로그인이 필요합니다.');const identity=user.id;const result=checked(await client.rpc('pt_command',{action,payload}));if(identity!==user?.id)throw new Error('계정이 변경되었습니다. 다시 시도해 주세요.');return api.adopt(result);},
  requireUser(){if(user)return true;const details=document.querySelector('#account-area details');if(details){details.open=true;document.getElementById('account-email')?.focus();}return false;},
  pathFor(id,scope='game'){if(id.includes('/'))return id;if(!user)throw new Error('로그인이 필요합니다.');return `${scope}/${user.id}/${id}`;},
  async saveMedia(items){const uploaded=[];try{for(const item of items){const path=api.pathFor(item.id,item.scope);checked(await client.storage.from('playtest-media').upload(path,item.file,{contentType:item.type,upsert:false}));uploaded.push(path);}}catch(error){if(uploaded.length)await client.storage.from('playtest-media').remove(uploaded);throw error;}},
  async removeMedia(ids){if(ids.length)checked(await client.storage.from('playtest-media').remove(ids.map(id=>api.pathFor(id))));},
  async getMedia(id){return checked(await client.storage.from('playtest-media').download(id));},
  mountAccount(onRefresh){
   const root=document.getElementById('account-area');let disposed=false,manualAuth=false,refreshTimer;
   function status(message){authStatus=message;const el=document.getElementById('account-status');if(el)el.textContent=message;}
   function render(){if(disposed)return;const open=root.querySelector('.account-menu')?.open;root.innerHTML=accountHtml(user,viewer,providers,authStatus);if(open||authStatus)root.querySelector('.account-menu')?.setAttribute('open','');}
   function busy(value){root.querySelectorAll('[data-account-form] button,[data-social]').forEach(button=>{button.disabled=value||Boolean(button.dataset.social&&!providers[button.dataset.social]);});}
   async function loadProviders(){
    try{const response=await fetch('/api/auth/providers',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error();const data=await response.json();providers={google:data.google===true,naver:data.naver===true};}catch{providers={google:false,naver:false};}
    if(disposed)return;
    root.querySelectorAll('[data-social]').forEach(button=>{const enabled=providers[button.dataset.social];button.disabled=!enabled;button.querySelector('small')?.remove();if(!enabled){const note=document.createElement('small');note.textContent='연결 준비 중';button.append(note);}});
   }
   async function submit(event){
    const form=event.target.closest('[data-account-form]');if(!form)return;event.preventDefault();if(manualAuth||!form.reportValidity())return;
    manualAuth=true;busy(true);status('');
    try{const data=new FormData(form);if(event.submitter?.value==='signup'){
      const result=checked(await client.auth.signUp({email:data.get('email'),password:data.get('password'),options:{data:{nickname:String(data.get('nickname')||'플레이어').slice(0,40)},emailRedirectTo:location.origin}}));
      if(!result.session){status('인증 메일을 보냈습니다. 이메일에서 가입을 확인한 뒤 로그인해 주세요.');return;}user=result.user;
     }else user=checked(await client.auth.signInWithPassword({email:data.get('email'),password:data.get('password')})).user;
     await onRefresh(true);render();
    }catch(error){status(authErrorMessage(error));}finally{manualAuth=false;busy(false);}
   }
   async function click(event){
    const social=event.target.closest('[data-social]')?.dataset.social,action=event.target.closest('[data-account]')?.dataset.account;
    if((!social&&!action)||manualAuth)return;
    if(social){
     if(!providers[social]||!SOCIAL_PROVIDERS[social])return;
     manualAuth=true;busy(true);status('로그인 서비스로 이동합니다.');
     try{const data=checked(await client.auth.signInWithOAuth(oauthRequest(social,location.origin)));const destination=new URL(data.url);if(destination.origin!==config.url||destination.pathname!=='/auth/v1/authorize')throw new Error();location.assign(destination.href);}
     catch(error){status(authErrorMessage(error));manualAuth=false;busy(false);}return;
    }
    try{if(action==='providers'){await loadProviders();return;}if(action==='logout'){manualAuth=true;checked(await client.auth.signOut());user=null;viewer={};await onRefresh(true);render();}else {await onRefresh(false);render();}}
    catch(error){if(user)window.alert(authErrorMessage(error));else status(authErrorMessage(error));}finally{manualAuth=false;}
   }
   render();root.addEventListener('submit',submit);root.addEventListener('click',click);void loadProviders();
   const {data:{subscription}}=client.auth.onAuthStateChange((event,nextSession)=>{
    const previous=user?.id;user=nextSession?.user||null;const changed=previous!==user?.id;if(changed)viewer={};
    if(manualAuth||disposed||(!changed&&event!=='USER_UPDATED'))return;
    // Leave the SDK's auth lock before issuing another authenticated request.
    clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{if(disposed)return;render();try{await onRefresh(changed);render();}catch(error){status(authErrorMessage(error));}},0);
   });
   return ()=>{disposed=true;clearTimeout(refreshTimer);root.removeEventListener('submit',submit);root.removeEventListener('click',click);subscription.unsubscribe();};
  }
 };
 return api;
}
