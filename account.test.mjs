import assert from 'node:assert/strict';
import {accountHtml,memberName,oauthRequest,authErrorMessage,MEMBER_GUIDANCE} from './src/account.js';
import {createHash} from 'node:crypto';
import {naverHandler} from './server/naver-oauth.js';

const user={id:'member-1',user_metadata:{name:'Google player'}};
assert.equal(memberName(user),'Google player');
const member=accountHtml(user);assert.ok(member.includes('href="#tester"'));assert.ok(member.includes('href="#developer"'));assert.ok(member.includes(MEMBER_GUIDANCE));
assert.ok(!member.includes('#admin'));
assert.ok(accountHtml({...user,user_metadata:{name:'<img onerror=evil>'}}).includes('&lt;img'));
const ready=accountHtml(null,{}, {google:true,naver:false});
assert.match(ready,/data-social="google" >/);assert.match(ready,/data-social="naver" disabled/);
assert.ok(ready.includes('등록된 테스트 계정'));
assert.ok(!accountHtml(null,{}, {google:true,testMode:false}).includes('등록된 테스트 계정'));
assert.equal(oauthRequest('google','https://playtest-match.vercel.app/?next=https://evil.example').options.redirectTo,'https://playtest-match.vercel.app');
assert.equal(oauthRequest('naver','https://playtest-match.vercel.app').provider,'custom:naver');
assert.throws(()=>oauthRequest('unknown','https://playtest-match.vercel.app'));
assert.ok(!authErrorMessage({message:'secret provider response'}).includes('secret'));

const env={NAVER_CLIENT_ID:'test-client',NAVER_CLIENT_SECRET:'unit-test-only-secret',VITE_SUPABASE_URL:'https://test.supabase.co'};
const verifier='v'.repeat(64),challenge=createHash('sha256').update(verifier).digest('base64url');
let clock=100000,upstreamCalls=[];
const fetcher=async(url,options)=>{upstreamCalls.push({url,options});return {ok:true,json:async()=>url.includes('/token')?{access_token:'naver-token',token_type:'bearer',expires_in:'3600'}:{resultcode:'00',response:{id:'naver-subject',nickname:'테스터',email:'unverified@example.com',mobile:'private'}}};};
async function invoke(action,url,{method=action==='token'?'POST':'GET',body,headers={},configuration=env}={}){
 const result={headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=value;}};
 await naverHandler(action,{env:configuration,fetcher,now:()=>clock})({url,method,body,headers},result);return result;
}
const request='/api/auth/naver/authorize?'+new URLSearchParams({client_id:env.NAVER_CLIENT_ID,redirect_uri:env.VITE_SUPABASE_URL+'/auth/v1/callback',response_type:'code',state:'supabase-csrf-state',code_challenge:challenge,code_challenge_method:'S256'});
const auth=await invoke('authorize',request);assert.equal(auth.statusCode,302);
const nav=new URL(auth.headers.Location);assert.equal(nav.origin,'https://nid.naver.com');assert.equal(nav.searchParams.get('redirect_uri'),'https://playtest-match.vercel.app/api/auth/naver/callback');
const state=nav.searchParams.get('state');assert.ok(!state.includes('supabase-csrf-state'));
const callback=await invoke('callback','/api/auth/naver/callback?'+new URLSearchParams({state,code:'one-time-naver-code'}));
assert.equal(callback.statusCode,302);const supa=new URL(callback.headers.Location);assert.equal(supa.origin,env.VITE_SUPABASE_URL);assert.equal(supa.searchParams.get('state'),'supabase-csrf-state');
const form={grant_type:'authorization_code',redirect_uri:env.VITE_SUPABASE_URL+'/auth/v1/callback',code:supa.searchParams.get('code'),code_verifier:verifier};
const headers={authorization:'Basic '+Buffer.from(env.NAVER_CLIENT_ID+':'+env.NAVER_CLIENT_SECRET).toString('base64')};
const wrong=await invoke('token','/api/auth/naver/token',{body:{...form,code_verifier:'wrong'.repeat(16)},headers});assert.equal(wrong.statusCode,400);assert.equal(upstreamCalls.length,0);
const token=await invoke('token','/api/auth/naver/token',{body:form,headers});assert.equal(token.statusCode,200);assert.equal(JSON.parse(token.body).access_token,'naver-token');
assert.equal(upstreamCalls[0].options.body.get('state'),state);assert.equal(upstreamCalls[0].options.body.get('code'),'one-time-naver-code');
const info=await invoke('userinfo','/api/auth/naver/userinfo',{headers:{authorization:'Bearer naver-token'}});assert.deepEqual(JSON.parse(info.body),{sub:'naver-subject',name:'테스터',preferred_username:'테스터'});
const changed=state.slice(0,10)+(state[10]==='A'?'B':'A')+state.slice(11);
assert.equal((await invoke('callback','/?'+new URLSearchParams({state:changed,code:'code'}))).statusCode,400);
assert.equal((await invoke('authorize',request.replace(encodeURIComponent(env.VITE_SUPABASE_URL+'/auth/v1/callback'),encodeURIComponent('https://evil.example/callback')))).statusCode,400);
assert.equal((await invoke('token','/',{body:form,headers:{authorization:'Basic '+Buffer.from('test-client:wrong').toString('base64')}})).statusCode,401);
const denied=await invoke('callback','/?'+new URLSearchParams({state,error:'access_denied'}));assert.equal(new URL(denied.headers.Location).searchParams.get('error'),'access_denied');
clock+=300001;assert.equal((await invoke('callback','/?'+new URLSearchParams({state,code:'expired'}))).statusCode,400);
assert.equal((await invoke('userinfo','/',{configuration:{}})).statusCode,503);
console.log('PASS shared member access, safe OAuth redirects, Naver state/PKCE/client binding, expiry, cancellation and minimal profile');
