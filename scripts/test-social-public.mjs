import assert from 'node:assert/strict';
const origin='https://playtest-match.vercel.app';
for(const [path,status,options] of [
 ['/api/auth/providers',200,{}],
 ['/api/auth/naver/authorize',400,{}],
 ['/api/auth/naver/callback?state=invalid&code=invalid',400,{}],
 ['/api/auth/naver/token',401,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=authorization_code'}],
 ['/api/auth/naver/userinfo',401,{}],
]){
 const response=await fetch(origin+path,{...options,redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,status,path);assert.match(response.headers.get('cache-control')||'',/no-store/);
 const data=await response.json();
 if(path.endsWith('providers')){assert.equal(typeof data.google,'boolean');assert.equal(typeof data.naver,'boolean');assert.deepEqual(Object.keys(data).sort(),['google','naver']);console.log('Public provider availability:',data);}
 else assert.ok(data.error,path);
 console.log('PASS',path.split('?')[0],status);
}
