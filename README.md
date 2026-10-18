# 모아

실제 거래, 계좌, 예산을 한곳에서 관리하는 개인 가계부 서비스입니다.

**서비스:** [moa-budget.coders.kr](https://moa-budget.coders.kr)

## 핵심 기능

- Google 로그인 및 사용자별 데이터 분리
- 수입·지출 기록, 검색, 삭제
- 계좌·카드 등록과 순자산 확인
- CSV 거래 대량 가져오기 및 중복 방지
- 카테고리별 지출 분석
- 월별 예산 설정과 사용률 확인
- 모바일·데스크톱 반응형 UI

## 기술 구성

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Alembic
- Database: PostgreSQL
- Hosting: coders.kr

## 로컬 실행

Docker가 설치되어 있다면 다음 명령으로 전체 서비스를 실행할 수 있습니다.

```bash
docker compose up
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열면 됩니다.

## 프로젝트 구조

```text
frontend/   Next.js 웹 애플리케이션
backend/    FastAPI 서버와 DB 마이그레이션
coders.yaml 배포 구성
```

## 참고

### 개발과 운영 설정

Node.js 22와 패키지에 지정된 pnpm, Python 3.12·uv 또는 Docker Compose가 필요합니다.
프런트엔드는 `cd frontend && pnpm install --frozen-lockfile && pnpm dev`, 빌드는 `pnpm build`입니다.
백엔드는 `cd backend && uv sync --frozen --extra dev`, `uv run alembic upgrade head`, `uv run uvicorn app.main:app --reload` 순서로 실행합니다.
기존 백엔드 테스트는 `uv run pytest`입니다. 이번 UI 변경에서는 프런트엔드 빌드와 아래 브라우저 검증을 수행했습니다.
헬스 확인 경로는 백엔드 `/api/health`입니다. 구조와 플랫폼 인증·운영 지침은 [PLATFORM.md](PLATFORM.md)를 참고하세요.

| 환경변수 | 용도 | 설정 방법 |
| --- | --- | --- |
| DATABASE_URL | PostgreSQL 연결 | 로컬 Compose 또는 운영 DB의 승인된 연결 정보 |
| DEV_FAKE_USER | 로컬 개발 사용자 | backend/.env.example 참고. 운영에서는 설정하지 않음 |
| BACKEND_URL | 프런트 API 프록시 | 로컬 백엔드 또는 Compose 서비스 주소 |

운영 배포는 [Coders.kr 현재 문서](https://coders.kr/llms.txt)를 읽은 뒤 기존 프로젝트 `moa-budget`에 갱신합니다.
원본은 [boclair98/moa-budget](https://github.com/boclair98/moa-budget), 조직 미러는 실제 fork인 [coders-kr/moa-budget](https://github.com/coders-kr/moa-budget)입니다.
검증한 원본 main을 먼저 푸시하고 `gh repo sync coders-kr/moa-budget -b main`으로 동기화한 뒤 두 main의 전체 SHA를 비교합니다.
그다음 원본 URL로 기존 Coders 프로젝트를 배포하고 ready 상태와 운영 화면을 확인합니다.
배포 토큰과 개인 거래 CSV·DB는 Git에 넣지 않습니다. 현재 기능은 사용자가 등록한 기록 기반이며 은행 자동 연동은 별도 승인과 운영 인증정보가 필요합니다.
라이선스가 별도로 명시되기 전에는 재배포·상업적 사용 조건을 운영자에게 확인하세요.

은행 자동연결은 금융결제원 오픈뱅킹 이용기관 승인과 운영 인증정보가 준비된 경우 활성화할 수 있습니다. 현재는 계좌 직접 등록과 CSV 가져오기를 지원합니다.

<!-- openui-release:start -->
## UI 작업과 검증 (2026-10-18)

모아 개인 가계부: 실제 입력·가져온 계좌와 거래로 수입·지출·예산 확인.
기존 스택과 API·인증·라우팅을 유지하면서 기존 코랄 포인트와 차분한 가계부 작업 화면 방향으로 제목·본문·CTA·간격과 모바일 배치를 다듬었습니다.
구체적인 근거, 토큰, 수정 경로와 OpenUI 입력은 [design.md](design.md)에 있습니다.

- 빌드: `npm run build` 통과.
- 브라우저: 로컬 1440×900, 768×1024, 390×844, 360×800. 4크기 직접 검토; 모바일 상태 pill 폭 수정
- 기능·키보드: 메뉴 Escape 닫기·포커스 복귀 수정 확인, 거래추가 Enter로 실제 Google 로그인 화면 이동. 로그인 후 저장은 미확인
- 이번 변경에서 새로운 이용자 수·성과·고객 후기·공식 API 응답을 추가하지 않았습니다.

기존·신규 UI 작업에는 [AGENTS.md](AGENTS.md)의 조사 → design.md → 구현 → PC·모바일·키보드 검증 순서를 적용합니다.
OpenUI 원본은 [IamJimtheFish/openui](https://github.com/IamJimtheFish/openui), 이 저장소의 휴대 가능한 스킬은 `.agents/skills/openui/SKILL.md`입니다.
실행·환경변수·외부 API 설정은 이 README의 기존 절차를 따릅니다. 실제 비밀값은 커밋하지 않습니다.
<!-- openui-release:end -->
