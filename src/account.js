import {escapeHtml as e} from './feature-views.js';
export const MEMBER_GUIDANCE='하나의 계정으로 테스트 참여와 게임 등록을 모두 이용할 수 있습니다.';
export const SOCIAL_PROVIDERS={google:{provider:'google',label:'Google로 계속하기'},naver:{provider:'custom:naver',label:'네이버로 계속하기'}};
export function memberName(user,viewer={}){const m=user?.user_metadata||{};return viewer.nickname||m.nickname||m.preferred_username||m.full_name||m.name||'플레이어';}
export function authErrorMessage(error){
 const messages={email_address_invalid:'인증 메일을 받을 수 있는 올바른 이메일 주소를 입력해 주세요.',email_address_not_authorized:'현재 이메일 가입 발송 설정이 준비 중입니다. 소셜 로그인을 이용하거나 운영자에게 문의해 주세요.',over_email_send_rate_limit:'인증 메일 발송 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',invalid_credentials:'이메일 또는 비밀번호가 올바르지 않습니다.',email_not_confirmed:'이메일 인증을 완료한 뒤 로그인해 주세요.',access_denied:'소셜 로그인이 취소되었습니다. 다시 시도할 수 있습니다.',provider_disabled:'이 로그인 서비스는 아직 연결 준비 중입니다.'};
 return messages[error?.code]||'로그인 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}
export function oauthRequest(key,origin){
 const selected=SOCIAL_PROVIDERS[key];if(!selected)throw new Error('지원하지 않는 로그인 서비스입니다.');
 const url=new URL(origin);if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('로그인 복귀 주소를 확인해 주세요.');
 return {provider:selected.provider,options:{redirectTo:url.origin,skipBrowserRedirect:true}};
}
export function accountHtml(user,viewer={},providers={},status=''){
 if(user)return `<div class="account-signed-in"><span data-no-translate>${e(memberName(user,viewer))}</span><details class="member-spaces"><summary>내 활동</summary><div><p>${MEMBER_GUIDANCE}</p><a href="#tester" data-nav="tester" data-sub="mine">내 참여 현황</a><a href="#developer" data-nav="developer">내 게임 관리</a></div></details><button type="button" class="text-link" data-account="refresh">새로고침</button><button type="button" class="text-link" data-account="logout">로그아웃</button></div>`;
 return `<details class="account-menu"><summary>로그인</summary><div class="account-panel"><h2>로그인 / 회원가입</h2><p class="account-intro">${MEMBER_GUIDANCE}</p><div class="social-logins">${Object.entries(SOCIAL_PROVIDERS).map(([key,item])=>`<button type="button" class="social-login social-${key}" data-social="${key}" ${providers[key]?'':'disabled'}><span class="social-symbol" aria-hidden="true">${key==='google'?'G':'N'}</span><span>${item.label}</span>${providers[key]?'':'<small>연결 준비 중</small>'}</button>`).join('')}</div><p class="hint">처음 소셜 로그인하면 회원가입도 함께 진행됩니다.</p><div class="account-divider"><span>또는 이메일로 계속하기</span></div><form data-account-form><label for="account-nickname">닉네임 (회원가입)</label><input id="account-nickname" name="nickname" type="text" maxlength="40" autocomplete="nickname"><label for="account-email">이메일</label><input id="account-email" name="email" type="email" required autocomplete="email"><label for="account-password">비밀번호</label><input id="account-password" name="password" type="password" minlength="8" required autocomplete="current-password"><div class="actions"><button class="btn" type="submit" value="login">로그인</button><button class="btn ghost" type="submit" value="signup">회원가입</button></div><p class="hint">가입 후 이메일 인증을 완료해 주세요.</p></form><p role="status" aria-live="polite" id="account-status">${e(status)}</p><button type="button" class="text-link" data-account="providers">로그인 연결 상태 다시 확인</button></div></details>`;
}
