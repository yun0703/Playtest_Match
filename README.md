# PlayTest Match

React로 만든 인디게임 플레이테스트 플랫폼입니다. Supabase Auth / PostgreSQL RPC / Storage를 사용하며 Vercel에서 정적 프론트엔드를 배포합니다.

## 실행

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Windows에서는 `.env.example`을 `.env.local`로 복사한 뒤 두 공개 환경 변수를 설정합니다.

- `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: 공개 publishable key. secret / service_role 키를 넣지 마세요.

환경 변수가 없으면 브라우저 전용 로컬 데모를 실행합니다. 연결 설정이 있는데 서버 요청이 실패하면 오류를 표시하며 로컬 데모로 조용히 전환하지 않습니다. Vercel에서는 환경 변수가 없으면 빌드가 실패합니다.

```sh
npm test
npm run build
npm run preview
```

개발은 Vite, 프로덕션 빌드는 `scripts/build.mjs`의 esbuild를 사용합니다. 결과는 `dist/`입니다. `.env*`, `.vercel`, `review/`, `node_modules`, `dist`는 Git에 저장하지 않습니다.

## 기능

- 게임 탐색 / 검색 / 장르·플랫폼 필터 / 정렬
- 신청 전 테스트 목표 공개, 공개 / 승인제 / 초대 전용
- 모집 인원과 마감일 관리, 신청·승인·플레이·피드백 단계
- 맞춤 설문, 기존 버그 제보 연결, 제보 작성 중 설문 답변 보존
- 스크린샷 6장(각 5MB), 영상 1개(50MB), 대표 이미지·갤러리
- 버그 제보·첨부·개발자 처리 상태·답변·이력
- 마감 / 버그 처리 알림함, 한국어 / 영어, 밝은 / 어두운 테마
- 운영자 신고 검토, 신고 3건 자동 임시 숨김, 복구 요청

마감 알림은 열린 페이지에서 계산하며 이메일 / OS 푸시는 구현하지 않았습니다. 마감은 KST 23:59 기준이며 기존 참여자는 기한 이후에도 제출할 수 있습니다. 게임 이름·소개·설문 등 사용자가 작성한 내용은 자동 번역하지 않습니다.

## 서버 구조

`supabase/migrations/` SQL을 순서대로 적용합니다. 현재 프로젝트에는 대시보드 SQL 편집기로 적용했습니다. CLI migration history를 자동 등록하지는 않았으므로 추후 CLI 도입 시 기존 적용 버전을 먼저 repair해야 합니다. 첫 마이그레이션을 기존 프로젝트에 다시 실행하지 마세요.

공개 소개(`pt_tests`)와 빌드 링크·초대 코드·플레이 방법·설문(`pt_secrets`)을 분리합니다. 모든 앱 테이블에 RLS를 켜고 anon / authenticated의 직접 테이블 접근을 차단했습니다. 클라이언트는 `pt_snapshot()`과 `pt_command()`만 사용합니다. 함수는 현재 로그인 사용자와 소유권·참여 상태·운영자 권한을 검사합니다.

공개 snapshot에는 소개만 포함합니다. 빌드와 설문은 소유자 / 승인된 참여자 / 운영자에게만 반환합니다. 피드백 결과와 신청자 목록은 해당 개발자만, 버그는 작성자와 해당 개발자만 볼 수 있습니다. 신청·승인은 테스트 행을 잠가 모집 인원 초과와 중복 제출을 막습니다.

파일은 비공개 `playtest-media` 버킷에 저장합니다. `game/<사용자ID>/<파일ID>`는 공개된 테스트에서 참조할 때 읽을 수 있고, `bug/<사용자ID>/<파일ID>`는 제보자와 해당 개발자만 읽을 수 있습니다. 브라우저에는 짧은 수명의 Blob URL로 표시합니다. 저장 전에 서버가 첨부 경로·형식·실제 크기를 검증합니다.

운영자는 클라이언트에서 스스로 지정할 수 없습니다. 필요한 계정의 `auth.users.id`를 확인한 후 프로젝트 관리자가 다음 SQL로 지정합니다.

```sql
insert into public.pt_admins(id) values ('YOUR_AUTH_USER_UUID');
```

## Vercel

이 GitHub 저장소를 Import한 뒤 다음 공개 환경 변수를 Production / Preview에 설정합니다.

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

`vercel.json`에 빌드 명령과 출력 디렉터리를 지정했습니다. 배포 URL이 정해지면 Supabase Auth의 Site URL과 허용 Redirect URL에 해당 URL을 추가합니다. 이메일 확인을 완료한 회원이 로그인할 수 있습니다.

기존 브라우저 데모 데이터나 첨부 파일을 서버로 자동 업로드하지 않습니다. 서버는 빈 데이터에서 시작하며 로그인한 사용자가 직접 테스트를 등록합니다.

## 검증

- `npm test`: 기본 화면, 설정 / 번역, 날짜 / 용량 / 버그 입력 / 연결 검증
- `supabase/security-tests.sql`: 롤백 기반 실제 DB 통합 검사(익명 정보 분리, 소유권, 승인, 모집 인원, 버그 권한, 설문 연결, 중복 제출, 운영자 권한)
- `node scripts/test-cloud-anonymous.mjs`: 실제 공개 API로 snapshot / 비공개 테이블 / 익명 변경 / 비공개 파일 접근 차단 검사. `.env.local` 필요

로컬 QA 이미지와 영상은 Git에 포함하지 않습니다. 기본 이미지 생성 프롬프트와 출처는 `ARTWORK.md`를 참고하세요. 실제 게임 스크린샷이 아닌 기본 콘셉트 아트에는 예시 표기를 유지합니다.
