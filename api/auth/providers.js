export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 if(req.method!=='GET'){res.setHeader('Allow','GET');res.statusCode=405;return res.end(JSON.stringify({error:'method_not_allowed'}));}
 let google=false;
 try{const url=process.env.VITE_SUPABASE_URL;if(!/^https:\/\/[^/]+\.supabase\.co$/.test(url||''))throw new Error();const response=await fetch(url+'/auth/v1/settings',{headers:{apikey:process.env.VITE_SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(5000)});if(response.ok)google=(await response.json()).external?.google===true;}catch{}
 res.end(JSON.stringify({google,naver:process.env.NAVER_AUTH_ENABLED==='true'&&Boolean(process.env.NAVER_CLIENT_ID&&process.env.NAVER_CLIENT_SECRET)}));
}
