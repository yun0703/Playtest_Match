export const PASSWORD_GUIDANCE='비밀번호는 8자 이상, UTF-8 기준 72바이트 이하로 입력해 주세요.';

export function passwordValidation(password,confirmation,mismatch='새 비밀번호가 일치하지 않습니다.'){
 if(typeof password!=='string'||[...password].length<8||new TextEncoder().encode(password).length>72)return PASSWORD_GUIDANCE;
 if(password!==confirmation)return mismatch;
 return '';
}
export function nicknameValidation(name){return typeof name==='string'&&name.trim().length>=1&&name.trim().length<=40&&!/[\u0000-\u001f\u007f]/.test(name)?'':'닉네임은 공백만 제외한 1~40자로 입력해 주세요.';}
export const hasPasswordLogin=user=>(user?.identities||[]).some(identity=>identity.provider==='email');
export function accountTaskError(error){
 const allowed=[PASSWORD_GUIDANCE,'새 비밀번호가 일치하지 않습니다.','복구 링크를 다시 열거나 로그인해 주세요.','현재 비밀번호를 입력해 주세요.','계정이 변경되었습니다. 다시 시도해 주세요.','닉네임은 공백만 제외한 1~40자로 입력해 주세요.','올바른 이메일 주소를 입력해 주세요.','확인란에 탈퇴를 입력해 주세요.','탈퇴하려면 로그아웃 후 다시 로그인해 주세요. 최근 15분 이내 로그인이 필요합니다.','첨부파일을 모두 삭제하지 못했습니다. 탈퇴를 다시 시도해 주세요.'];
 return allowed.includes(error?.message)?error.message:'';
}
export function createAccountService(client,origin){
 const checked=result=>{if(result.error)throw result.error;return result.data;};
 return {
  async recover(email){
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('올바른 이메일 주소를 입력해 주세요.');
   checked(await client.auth.resetPasswordForEmail(email,{redirectTo:new URL('/?account=recovery',origin).href}));
  },
  async password({user,current,password,confirmation,recovery=false,nonce}){
   const error=passwordValidation(password,confirmation);if(error)throw Error(error);
   if(!user)throw Error('복구 링크를 다시 열거나 로그인해 주세요.');
   if(!recovery){
    if(!hasPasswordLogin(user)||!current)throw Error('현재 비밀번호를 입력해 주세요.');
    const result=checked(await client.auth.signInWithPassword({email:user.email,password:current}));
    if(result.user.id!==user.id)throw Error('계정이 변경되었습니다. 다시 시도해 주세요.');
   }
   return checked(await client.auth.updateUser({password,...(!recovery?{current_password:current}:{}),...(nonce?{nonce}:{})}));
  },
  async profile(nickname){const error=nicknameValidation(nickname);if(error)throw Error(error);return checked(await client.rpc('pt_update_profile',{nickname:nickname.trim()}));},
  async deletionPreview(){return checked(await client.rpc('pt_account_delete_preview'));},
  async deleteAccount(confirmation){
   if(confirmation!=='탈퇴')throw Error('확인란에 탈퇴를 입력해 주세요.');
   const pending=checked(await client.rpc('pt_begin_account_delete',{confirmation}));
   for(let i=0;i<pending.files.length;i+=100)checked(await client.storage.from('playtest-media').remove(pending.files.slice(i,i+100)));
   checked(await client.rpc('pt_finish_account_delete'));
   // The deleted auth record cannot refresh. Also clear this browser's session.
   await client.auth.signOut({scope:'local'});
  }
 };
}
