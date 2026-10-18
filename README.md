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

은행 자동연결은 금융결제원 오픈뱅킹 이용기관 승인과 운영 인증정보가 준비된 경우 활성화할 수 있습니다. 현재는 계좌 직접 등록과 CSV 가져오기를 지원합니다.
