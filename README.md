# Harness Fullstack Test

React + Vite 프론트엔드와 Go(Gin) 백엔드, PostgreSQL을 조합한 풀스택 보일러플레이트 프로젝트.

MVP 우선 접근으로 **User CRUD + JWT 인증**을 구현하고, Docker Compose와 GitHub Actions CI를 포함한다. 모든 코드에는 한국어 학습용 상세 주석이 포함되어 있어, 파일별로 시스템 전체 흐름과 로직을 파악할 수 있다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | Go 1.22+ / Gin / lib/pq / golang-jwt / bcrypt |
| Frontend | React 18 / Vite / TypeScript / React Router v6 / CSS Modules |
| Database | PostgreSQL 16 |
| Infra | Docker Compose / GitHub Actions CI |

## 프로젝트 구조

```
harness-fullstack-test/
├── frontend/                 ← React + Vite + TypeScript
│   ├── src/
│   │   ├── components/       ← 재사용 UI 컴포넌트 (ProtectedRoute)
│   │   ├── pages/            ← 페이지 (Login, Register, UserList, UserDetail)
│   │   ├── hooks/            ← 커스텀 훅
│   │   ├── api/              ← API 클라이언트 (fetch wrapper)
│   │   ├── context/          ← React Context (AuthContext)
│   │   ├── App.tsx           ← 라우팅 설정
│   │   └── main.tsx          ← 엔트리포인트
│   ├── Dockerfile
│   └── package.json
│
├── backend/                  ← Go + Gin
│   ├── cmd/server/
│   │   └── main.go           ← 엔트리포인트
│   ├── internal/
│   │   ├── handler/          ← HTTP 핸들러 (auth, user)
│   │   ├── model/            ← 데이터 모델 (User 구조체)
│   │   ├── repository/       ← DB 접근 레이어 (CRUD 쿼리)
│   │   ├── service/          ← 비즈니스 로직 (인증, 유저 관리)
│   │   ├── middleware/       ← JWT 인증 미들웨어
│   │   └── config/           ← 환경변수 로드
│   ├── migrations/           ← SQL 마이그레이션 파일
│   ├── Dockerfile
│   └── go.mod
│
├── docker-compose.yml
├── .github/workflows/ci.yml
└── CLAUDE.md
```

## API 엔드포인트

### 인증 (공개)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/register` | 회원가입 (email, password, name) |
| POST | `/api/auth/login` | 로그인 → JWT 토큰 반환 |

### User CRUD (인증 필요)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/users` | 유저 목록 조회 |
| GET | `/api/users/:id` | 유저 상세 조회 |
| PUT | `/api/users/:id` | 유저 정보 수정 |
| DELETE | `/api/users/:id` | 유저 삭제 |

## 시작하기

### Docker Compose (권장)

```bash
docker compose up -d
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8080
- PostgreSQL: localhost:5432

### 개별 실행

```bash
# 백엔드
cd backend
go mod tidy
go build ./cmd/server
./server

# 프론트엔드
cd frontend
npm install
npm run dev
```

## 아키텍처

### 백엔드 레이어

```
HTTP 요청 → Router → Middleware(JWT 검증) → Handler → Service → Repository → DB
```

| 레이어 | 역할 |
|--------|------|
| Handler | HTTP 요청 파싱, 응답 생성 |
| Service | 비즈니스 로직 (비밀번호 해싱, 토큰 생성, 유효성 검사) |
| Repository | SQL 쿼리 실행 (database/sql + lib/pq) |
| Middleware | JWT 토큰 검증, 인증 정보를 Context에 저장 |

### 프론트엔드 인증 흐름

```
로그인 성공 → JWT를 localStorage 저장 → AuthContext 업데이트
  → API 호출 시 Authorization 헤더 자동 첨부
  → 토큰 만료/부재 시 /login 리다이렉트
```

## Claude Code 하네스

이 프로젝트는 [Claude Code](https://claude.com/claude-code) + [Harness 플러그인](https://github.com/anthropics/harness-marketplace)으로 에이전트 팀을 구성하여 병렬 개발할 수 있도록 설계되어 있다.

### 에이전트 팀

| 에이전트 | 역할 |
|---------|------|
| `backend-dev` | Go(Gin) 백엔드 전체 구현 |
| `frontend-dev` | React 프론트엔드 전체 구현 |
| `infra-dev` | Docker Compose, CI, 환경설정 |
| `qa-engineer` | 프론트↔백 정합성 검증, 빌드 확인 |

### 실행 방법

Claude Code에서 다음과 같이 요청하면 오케스트레이터가 에이전트 팀을 조율하여 전체 스택을 구축한다:

```
풀스택 구현해줘
```

부분 수정도 가능:

```
백엔드 API만 수정해줘
프론트엔드 로그인 페이지 보완해줘
```

## 설계 문서

- **설계 스펙**: [`docs/superpowers/specs/2026-04-08-fullstack-harness-design.md`](docs/superpowers/specs/2026-04-08-fullstack-harness-design.md)
- **구현 계획**: [`docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md`](docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md)

## 라이선스

MIT
