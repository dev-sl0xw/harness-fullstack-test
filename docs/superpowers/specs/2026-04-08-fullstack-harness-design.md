# Fullstack Test Harness - Design Spec

## 개요

React + Vite 프론트엔드와 Go(Gin) 백엔드, PostgreSQL을 조합한 풀스택 보일러플레이트 프로젝트.
MVP 우선 접근으로 User CRUD + JWT 인증을 먼저 구현하고, Docker Compose와 GitHub Actions CI를 포함한다.

모든 코드에는 학습용 한국어 상세 주석을 포함하여, 파일별로 시스템 전체 흐름과 로직을 파악할 수 있도록 한다.

---

## 1. 프로젝트 구조

```
harness-fullstack-test/
├── frontend/                 ← React + Vite + TypeScript
│   ├── src/
│   │   ├── components/       ← 재사용 UI 컴포넌트
│   │   ├── pages/            ← 페이지 컴포넌트 (Login, Register, UserList, UserDetail)
│   │   ├── hooks/            ← 커스텀 훅 (useAuth 등)
│   │   ├── api/              ← API 클라이언트 (fetch wrapper)
│   │   ├── context/          ← React Context (AuthContext)
│   │   ├── App.tsx           ← 라우팅 설정
│   │   └── main.tsx          ← 엔트리포인트
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend/                  ← Go + Gin
│   ├── cmd/server/
│   │   └── main.go           ← 엔트리포인트
│   ├── internal/
│   │   ├── handler/          ← HTTP 핸들러 (auth, user)
│   │   ├── model/            ← 데이터 모델 (User 구조체)
│   │   ├── repository/       ← DB 접근 레이어 (CRUD 쿼리)
│   │   ├── service/          ← 비즈니스 로직 (인증, 유저 관리)
│   │   └── middleware/       ← JWT 인증 미들웨어
│   ├── migrations/           ← SQL 마이그레이션 파일
│   ├── Dockerfile
│   ├── go.mod
│   └── go.sum
│
├── docker-compose.yml
├── .github/workflows/ci.yml
├── .claude/settings.json
└── CLAUDE.md
```

모노레포 관리 도구 없이 디렉토리 분리만으로 구성한다.

---

## 2. 데이터 모델

### users 테이블

```sql
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,       -- bcrypt 해시
    name        VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);
```

Go 모델:

```go
type User struct {
    ID        int       `json:"id"`
    Email     string    `json:"email"`
    Password  string    `json:"-"`           // JSON 응답에서 제외
    Name      string    `json:"name"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}
```

---

## 3. API 설계

### 인증 API (공개)

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/auth/register` | 회원가입: email, password, name → 201 + user 객체 |
| POST | `/api/auth/login` | 로그인: email, password → 200 + JWT 토큰 |

### User CRUD API (인증 필요)

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/users` | 유저 목록 조회 → 200 + user 배열 |
| GET | `/api/users/:id` | 유저 상세 조회 → 200 + user 객체 |
| PUT | `/api/users/:id` | 유저 정보 수정 → 200 + 수정된 user |
| DELETE | `/api/users/:id` | 유저 삭제 → 204 |

### 인증 흐름

1. 회원가입: 클라이언트 → POST /api/auth/register → 비밀번호 bcrypt 해시 → DB 저장 → user 반환
2. 로그인: 클라이언트 → POST /api/auth/login → 비밀번호 검증 → JWT 토큰 생성 → 토큰 반환
3. API 호출: 클라이언트 → Authorization: Bearer {token} → JWT 미들웨어 검증 → 핸들러 실행

JWT 토큰에는 user_id와 email을 포함하며, 만료 시간은 24시간으로 설정한다.

---

## 4. 백엔드 아키텍처 (Go + Gin)

### 레이어 구조

```
HTTP 요청 → Router → Middleware(JWT 검증) → Handler → Service → Repository → DB
```

- **handler/**: HTTP 요청 파싱, 응답 생성. 비즈니스 로직 없음.
- **service/**: 비즈니스 로직 처리 (비밀번호 해싱, 토큰 생성, 유효성 검사).
- **repository/**: SQL 쿼리 실행. database/sql + lib/pq 사용.
- **middleware/**: JWT 토큰 검증, 인증 정보를 Context에 저장.
- **model/**: 데이터 구조체 정의.

### 주요 라이브러리

- `gin-gonic/gin`: HTTP 프레임워크
- `lib/pq`: PostgreSQL 드라이버
- `golang-jwt/jwt/v5`: JWT 토큰 생성/검증
- `golang.org/x/crypto/bcrypt`: 비밀번호 해싱

---

## 5. 프론트엔드 (React + Vite + TypeScript)

### 페이지

| 페이지 | 경로 | 설명 |
|---|---|---|
| 로그인 | `/login` | 이메일 + 비밀번호 폼 |
| 회원가입 | `/register` | 이름 + 이메일 + 비밀번호 폼 |
| 유저 목록 | `/` | 테이블로 유저 리스트 표시 |
| 유저 상세 | `/users/:id` | 유저 정보 조회/수정/삭제 |

### 기술 선택

- **라우팅**: React Router v6
- **HTTP 클라이언트**: fetch wrapper (외부 라이브러리 없이)
- **상태 관리**: useState + useContext (AuthContext로 JWT 관리)
- **스타일링**: CSS Modules

### 프론트엔드 인증 흐름

1. 로그인 성공 → JWT를 localStorage에 저장 + AuthContext에 세팅
2. API 호출 시 → AuthContext에서 토큰 읽어 Authorization 헤더 추가
3. 토큰 없거나 만료 → /login으로 리다이렉트

### API 클라이언트

fetch를 래핑한 유틸리티 함수로, 토큰 자동 첨부와 에러 핸들링을 처리한다.

---

## 6. Docker Compose

```yaml
services:
  db:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: harness
      POSTGRES_USER: harness
      POSTGRES_PASSWORD: harness
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports: ["8080:8080"]
    depends_on: [db]
    environment:
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: harness
      DB_PASSWORD: harness
      DB_NAME: harness
      JWT_SECRET: dev-secret-key

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    depends_on: [backend]

volumes:
  pgdata:
```

---

## 7. GitHub Actions CI

트리거: main 브랜치에 push 또는 PR 생성 시.

### backend job
1. Go 환경 세팅
2. `go test ./...` 실행
3. `go build ./cmd/server` 빌드 확인

### frontend job
1. Node.js 환경 세팅
2. `npm ci` 의존성 설치
3. `npm run lint` 린트 검사
4. `npm run build` 빌드 확인

배포(CD)는 MVP 범위 밖.

---

## 8. Claude Code 설정

### .claude/settings.json

```json
{
  "permissions": {
    "allow": [
      "Bash(go:*)",
      "Bash(npm:*)",
      "Bash(docker:*)",
      "Bash(docker compose:*)"
    ]
  }
}
```

### CLAUDE.md

프로젝트 구조, 개발 명령어, 아키텍처 설명을 포함하여 Claude Code가 프로젝트를 이해할 수 있도록 한다.

---

## 9. 주석 규칙

모든 코드 파일에 학습용 한국어 상세 주석을 포함한다:

- 파일 상단: 해당 파일의 역할, 시스템 내 위치, 다른 파일과의 관계
- 함수마다: 목적, 파라미터, 반환값, 호출 흐름
- 인증/비즈니스 로직: 단계별 흐름 설명
- 설계 의도: "왜 이렇게 하는지" 포함

---

## 10. 구현 순서 (MVP 우선)

1. 프로젝트 초기 구조 생성 (디렉토리, 설정 파일)
2. Docker Compose + PostgreSQL 세팅
3. Go 백엔드: DB 연결 + User CRUD API
4. Go 백엔드: JWT 인증 (register, login, middleware)
5. React 프론트엔드: 프로젝트 세팅 + 라우팅
6. React 프론트엔드: 로그인/회원가입 페이지
7. React 프론트엔드: 유저 목록/상세 페이지
8. GitHub Actions CI 구성
9. Claude Code 설정 (.claude/settings.json, CLAUDE.md)
