import {createHash,createCipheriv,createDecipheriv,hkdfSync,randomBytes,timingSafeEqual} from 'node:crypto';

const lifetime=5*60*1000;
const hash=value=>createHash('sha256').update(value).digest('base64url');
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
function configuration(env){
 const site=new URL(env.AUTH_SITE_URL||'https://playtest-match.vercel.app');
 const supabase=new URL(env.VITE_SUPABASE_URL||'');
 if(site.protocol!=='https:'||supabase.protocol!=='https:'||!supabase.hostname.endsWith('.supabase.co')||!env.NAVER_CLIENT_ID||!env.NAVER_CLIENT_SECRET)throw new Error('not_configured');
 return {id:env.NAVER_CLIENT_ID,secret:env.NAVER_CLIENT_SECRET,callback:site.origin+'/api/auth/naver/callback',supabaseCallback:supabase.origin+'/auth/v1/callback',key:Buffer.from(hkdfSync('sha256',env.NAVER_CLIENT_SECRET,'playtest-match','naver-oauth-bridge-v1',32))};
}
function seal(value,type,config,now){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',config.key,iv);cipher.setAAD(Buffer.from(type));
 const bytes=Buffer.concat([cipher.update(JSON.stringify({...value,expires:now+lifetime}),'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64url');
}
function unseal(value,type,config,now){
 if(typeof value!=='string'||value.length<40||value.length>12000||!/^[\w-]+$/.test(value))throw new Error('invalid_state');
 const bytes=Buffer.from(value,'base64url'),cipher=createDecipheriv('aes-256-gcm',config.key,bytes.subarray(0,12));
 cipher.setAAD(Buffer.from(type));cipher.setAuthTag(bytes.subarray(12,28));
 const data=JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8'));
 if(!Number.isFinite(data.expires)||data.expires<=now||data.expires>now+lifetime)throw new Error('expired_state');
 return data;
}
async function formBody(req){
 if(req.body&&typeof req.body==='object')return new URLSearchParams(req.body);
 if(typeof req.body==='string'){if(req.body.length>16000)throw new Error('invalid_request');return new URLSearchParams(req.body);}
 let value='';for await(const chunk of req){value+=chunk;if(value.length>16000)throw new Error('invalid_request');}return new URLSearchParams(value);
}
function credentials(req,form){
 const header=req.headers.authorization||'';
 if(header.startsWith('Basic ')){const decoded=Buffer.from(header.slice(6),'base64').toString('utf8'),index=decoded.indexOf(':');if(index<0)throw new Error('invalid_client');return {id:decodeURIComponent(decoded.slice(0,index)),secret:decodeURIComponent(decoded.slice(index+1))};}
 return {id:form.get('client_id')||'',secret:form.get('client_secret')||''};
}
function output(res,status,value){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));}
function redirect(res,url){res.statusCode=302;res.setHeader('Location',url.toString());res.end();}

// Supabase remains responsible for member sessions and access control.
// This adapter preserves Naver's state parameter and normalizes its nested profile.
export function naverHandler(action,{env=process.env,fetcher=fetch,now=()=>Date.now()}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  const expected=action==='token'?'POST':'GET';if(req.method!==expected){res.setHeader('Allow',expected);return output(res,405,{error:'invalid_request'});}
  let config;try{config=configuration(env);}catch{return output(res,503,{error:'provider_not_configured'});}
  try{
   const url=new URL(req.url,'https://local.invalid'),params=url.searchParams;
   if(action==='authorize'){
    const state=params.get('state'),challenge=params.get('code_challenge');
    if(params.get('client_id')!==config.id||params.get('redirect_uri')!==config.supabaseCallback||params.get('response_type')!=='code'||!state||state.length>6000||params.get('code_challenge_method')!=='S256'||!challenge||!/^[-\w]{43}$/.test(challenge))throw new Error('invalid_request');
    const target=new URL('https://nid.naver.com/oauth2.0/authorize');
    target.search=new URLSearchParams({response_type:'code',client_id:config.id,redirect_uri:config.callback,state:seal({state,challenge},'state',config,now())}).toString();
    return redirect(res,target);
   }
   if(action==='callback'){
    const transaction=unseal(params.get('state'),'state',config,now());
    const target=new URL(config.supabaseCallback);target.searchParams.set('state',transaction.state);
    if(params.has('error')){target.searchParams.set('error','access_denied');return redirect(res,target);}
    const code=params.get('code');if(!code||code.length>3000)throw new Error('invalid_code');
    target.searchParams.set('code',seal({code,state:params.get('state'),challenge:transaction.challenge},'code',config,now()));
    return redirect(res,target);
   }
   if(action==='token'){
    const form=await formBody(req),client=credentials(req,form);
    if(!equal(client.id,config.id)||!equal(client.secret,config.secret))return output(res,401,{error:'invalid_client'});
    if(form.get('grant_type')!=='authorization_code'||form.get('redirect_uri')!==config.supabaseCallback)throw new Error('invalid_request');
    const transaction=unseal(form.get('code'),'code',config,now()),verifier=form.get('code_verifier')||'';
    if(!/^[\w.~\-]{43,128}$/.test(verifier)||!equal(hash(verifier),transaction.challenge))throw new Error('invalid_grant');
    const upstream=await fetcher('https://nid.naver.com/oauth2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:config.id,client_secret:config.secret,code:transaction.code,state:transaction.state,redirect_uri:config.callback}),signal:AbortSignal.timeout(8000)});
    const data=await upstream.json();if(!upstream.ok||data.error||typeof data.access_token!=='string')throw new Error('invalid_grant');
    return output(res,200,{access_token:data.access_token,token_type:'Bearer',expires_in:Number(data.expires_in)||3600});
   }
   if(action==='userinfo'){
    const authorization=req.headers.authorization||'';if(!/^Bearer [^\s]{1,8192}$/.test(authorization))return output(res,401,{error:'invalid_token'});
    const upstream=await fetcher('https://openapi.naver.com/v1/nid/me',{headers:{Authorization:authorization},signal:AbortSignal.timeout(8000)});
    const data=await upstream.json(),profile=data.response;
    if(!upstream.ok||data.resultcode!=='00'||typeof profile?.id!=='string'||!profile.id)return output(res,401,{error:'invalid_token'});
    // Naver does not supply an email_verified claim. Do not assert verification or
    // merge accounts by email. The custom provider must have email_optional=true.
    const name=typeof profile.nickname==='string'?profile.nickname.slice(0,40):'플레이어';
    return output(res,200,{sub:profile.id,name,preferred_username:name});
   }
   return output(res,404,{error:'not_found'});
  }catch{return output(res,400,{error:'invalid_request',error_description:'Naver sign-in could not be completed. Please retry.'});}
 };
}
