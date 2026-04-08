# Fullstack Test Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** React + Vite 프론트엔드와 Go(Gin) 백엔드, PostgreSQL을 조합한 풀스택 보일러플레이트를 구축한다.

**Architecture:** 모노레포 디렉토리 분리 구조. 백엔드는 Handler → Service → Repository 레이어 패턴. 프론트엔드는 React Router + AuthContext로 JWT 인증 관리. Docker Compose로 전체 스택을 로컬에서 실행.

**Tech Stack:** Go 1.22+ / Gin / lib/pq / golang-jwt / React 18 / Vite / TypeScript / React Router v6 / PostgreSQL 16 / Docker Compose

**주석 규칙:** 모든 코드 파일에 한국어 학습용 상세 주석 포함. 파일 상단에 역할/위치 설명, 함수마다 목적/파라미터/흐름 설명, 설계 의도("왜 이렇게 하는지") 포함.

---

## File Structure

### Backend (`backend/`)

| Path | Responsibility |
|---|---|
| `backend/cmd/server/main.go` | 앱 엔트리포인트. DB 연결, 라우터 세팅, 서버 시작 |
| `backend/internal/model/user.go` | User 구조체, 요청/응답 DTO |
| `backend/internal/repository/user_repository.go` | PostgreSQL CRUD 쿼리 |
| `backend/internal/service/auth_service.go` | 비밀번호 해싱, JWT 생성/검증 |
| `backend/internal/service/user_service.go` | 유저 비즈니스 로직 |
| `backend/internal/handler/auth_handler.go` | 회원가입/로그인 HTTP 핸들러 |
| `backend/internal/handler/user_handler.go` | User CRUD HTTP 핸들러 |
| `backend/internal/middleware/auth_middleware.go` | JWT 검증 미들웨어 |
| `backend/internal/config/config.go` | 환경변수 로드 |
| `backend/migrations/001_create_users.sql` | users 테이블 생성 SQL |
| `backend/Dockerfile` | Go 멀티스테이지 빌드 |
| `backend/go.mod` | Go 모듈 정의 |

### Frontend (`frontend/`)

| Path | Responsibility |
|---|---|
| `frontend/src/main.tsx` | React 앱 엔트리포인트 |
| `frontend/src/App.tsx` | 라우팅 설정 |
| `frontend/src/context/AuthContext.tsx` | JWT 토큰 관리 Context |
| `frontend/src/api/client.ts` | fetch wrapper, 토큰 자동 첨부 |
| `frontend/src/pages/LoginPage.tsx` | 로그인 폼 |
| `frontend/src/pages/RegisterPage.tsx` | 회원가입 폼 |
| `frontend/src/pages/UserListPage.tsx` | 유저 목록 테이블 |
| `frontend/src/pages/UserDetailPage.tsx` | 유저 상세/수정/삭제 |
| `frontend/src/components/ProtectedRoute.tsx` | 인증 필요 라우트 가드 |
| `frontend/src/types.ts` | 공유 TypeScript 타입 |
| `frontend/Dockerfile` | Node 빌드 + nginx 서빙 |
| `frontend/vite.config.ts` | Vite 설정 (API 프록시 포함) |
| `frontend/tsconfig.json` | TypeScript 설정 |
| `frontend/package.json` | 의존성 정의 |

### Root

| Path | Responsibility |
|---|---|
| `docker-compose.yml` | PostgreSQL + Backend + Frontend 통합 실행 |
| `.github/workflows/ci.yml` | GitHub Actions CI (테스트/빌드) |
| `.claude/settings.json` | Claude Code 프로젝트 권한 설정 |
| `CLAUDE.md` | 프로젝트 컨텍스트 문서 |

---

## Task 1: 프로젝트 초기화 + Git + Go 환경 확인

**Files:**
- Create: `backend/go.mod`
- Create: `backend/cmd/server/main.go`
- Create: `.gitignore`

- [ ] **Step 1: Go 버전 확인 및 업그레이드**

현재 Go 1.19 설치됨. Gin v1.10+는 Go 1.22+가 필요하다.

Run: `go version`

Go 1.22 미만이면:
```bash
brew upgrade go
```

Expected: `go version go1.22.x` 이상

- [ ] **Step 2: Git 저장소 초기화**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git init
```

- [ ] **Step 3: .gitignore 생성**

```gitignore
# Go
backend/tmp/
backend/vendor/

# Node
frontend/node_modules/
frontend/dist/

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store

# Env
.env
.env.local

# Docker
pgdata/
```

- [ ] **Step 4: Go 모듈 초기화**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
mkdir -p backend/cmd/server
cd backend
go mod init harness-fullstack-test
```

- [ ] **Step 5: 최소 main.go 작성**

`backend/cmd/server/main.go`:
```go
// =============================================================================
// main.go - 애플리케이션 엔트리포인트
// =============================================================================
// 이 파일은 전체 백엔드 서버의 시작점이다.
// 현재는 최소한의 "Hello World" 서버만 실행하며,
// 이후 단계에서 DB 연결, 라우팅, 미들웨어가 추가된다.
//
// 실행 흐름: main() → Gin 엔진 생성 → 라우트 등록 → 서버 시작
// =============================================================================
package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	// Gin 엔진을 생성한다.
	// gin.Default()는 Logger와 Recovery 미들웨어가 포함된 기본 엔진이다.
	r := gin.Default()

	// 헬스체크 엔드포인트: 서버가 정상 동작하는지 확인하는 용도
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// 서버를 8080 포트에서 시작한다.
	// log.Fatal은 서버 시작에 실패하면 에러를 출력하고 프로그램을 종료한다.
	log.Println("서버를 시작합니다: http://localhost:8080")
	log.Fatal(r.Run(":8080"))
}
```

- [ ] **Step 6: Gin 의존성 설치**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test/backend
go get github.com/gin-gonic/gin
```

- [ ] **Step 7: 빌드 및 실행 확인**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test/backend
go build ./cmd/server
```

Expected: 에러 없이 `server` 바이너리 생성

- [ ] **Step 8: Commit**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add .gitignore backend/go.mod backend/go.sum backend/cmd/server/main.go
git commit -m "feat: 프로젝트 초기화 - Go 모듈 + 최소 서버"
```

---

## Task 2: Docker Compose + PostgreSQL 세팅

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/migrations/001_create_users.sql`
- Create: `backend/internal/config/config.go`

- [ ] **Step 1: docker-compose.yml 작성**

`docker-compose.yml`:
```yaml
# =============================================================================
# Docker Compose 설정 파일
# =============================================================================
# 이 파일은 개발 환경에서 전체 스택(DB + 백엔드 + 프론트엔드)을
# 한 명령으로 실행하기 위한 설정이다.
#
# 실행: docker compose up
# 종료: docker compose down
# DB 데이터 초기화: docker compose down -v
# =============================================================================

services:
  # ---------------------------------------------------------------------------
  # PostgreSQL 데이터베이스
  # ---------------------------------------------------------------------------
  # 유저 데이터를 저장하는 관계형 데이터베이스.
  # pgdata 볼륨을 사용해 컨테이너를 재시작해도 데이터가 유지된다.
  # migrations/ 폴더의 SQL 파일이 최초 실행 시 자동으로 실행된다.
  db:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: harness
      POSTGRES_USER: harness
      POSTGRES_PASSWORD: harness
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U harness"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ---------------------------------------------------------------------------
  # Go 백엔드 서버
  # ---------------------------------------------------------------------------
  # Gin 프레임워크 기반 REST API 서버.
  # DB 서비스가 healthy 상태가 된 후에 시작된다.
  backend:
    build: ./backend
    ports:
      - "8080:8080"
    depends_on:
      db:
        condition: service_healthy
    environment:
      DB_HOST: db
      DB_PORT: "5432"
      DB_USER: harness
      DB_PASSWORD: harness
      DB_NAME: harness
      JWT_SECRET: dev-secret-change-in-production

  # ---------------------------------------------------------------------------
  # React 프론트엔드
  # ---------------------------------------------------------------------------
  # Vite 개발 서버 또는 nginx로 정적 파일을 서빙한다.
  # 백엔드가 먼저 시작된 후에 실행된다.
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend

volumes:
  pgdata:
```

- [ ] **Step 2: 마이그레이션 SQL 작성**

`backend/migrations/001_create_users.sql`:
```sql
-- =============================================================================
-- 001_create_users.sql - users 테이블 생성
-- =============================================================================
-- 이 파일은 PostgreSQL 컨테이너가 최초 실행될 때 자동으로 실행된다.
-- docker-entrypoint-initdb.d 디렉토리에 마운트되어 있기 때문이다.
--
-- users 테이블은 애플리케이션의 핵심 테이블로,
-- 회원가입/로그인/유저 관리 기능에서 사용된다.
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    -- id: 자동 증가 정수 기본키. 각 유저를 고유하게 식별한다.
    id          SERIAL PRIMARY KEY,

    -- email: 로그인에 사용되는 이메일 주소. 중복 불가(UNIQUE).
    email       VARCHAR(255) UNIQUE NOT NULL,

    -- password: bcrypt로 해시된 비밀번호. 평문 비밀번호는 절대 저장하지 않는다.
    password    VARCHAR(255) NOT NULL,

    -- name: 사용자 표시 이름.
    name        VARCHAR(100) NOT NULL,

    -- created_at: 계정 생성 시각. 자동으로 현재 시각이 들어간다.
    created_at  TIMESTAMP DEFAULT NOW(),

    -- updated_at: 마지막 수정 시각. 업데이트할 때 애플리케이션에서 갱신한다.
    updated_at  TIMESTAMP DEFAULT NOW()
);
```

- [ ] **Step 3: config.go 작성**

`backend/internal/config/config.go`:
```go
// =============================================================================
// config.go - 환경변수 설정 로더
// =============================================================================
// 이 파일은 환경변수에서 애플리케이션 설정값을 읽어오는 역할을 한다.
// Docker Compose의 environment 섹션에서 설정한 값들이 여기서 읽힌다.
//
// 사용 흐름: main.go에서 config.Load() 호출 → Config 구조체 반환
//           → DB 연결, JWT 시크릿 등에 사용
// =============================================================================
package config

import (
	"fmt"
	"os"
)

// Config는 애플리케이션 전체에서 사용하는 설정값을 담는 구조체이다.
// 환경변수에서 읽어온 값을 여기에 저장하고, 각 레이어에 전달한다.
type Config struct {
	DBHost     string // PostgreSQL 호스트 (예: "db" 또는 "localhost")
	DBPort     string // PostgreSQL 포트 (기본값: "5432")
	DBUser     string // PostgreSQL 사용자명
	DBPassword string // PostgreSQL 비밀번호
	DBName     string // PostgreSQL 데이터베이스명
	JWTSecret  string // JWT 토큰 서명에 사용하는 비밀키
	ServerPort string // HTTP 서버 포트 (기본값: "8080")
}

// Load는 환경변수에서 설정값을 읽어 Config 구조체를 반환한다.
// 환경변수가 없으면 기본값(로컬 개발용)을 사용한다.
func Load() *Config {
	return &Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "harness"),
		DBPassword: getEnv("DB_PASSWORD", "harness"),
		DBName:     getEnv("DB_NAME", "harness"),
		JWTSecret:  getEnv("JWT_SECRET", "dev-secret-change-in-production"),
		ServerPort: getEnv("SERVER_PORT", "8080"),
	}
}

// DSN은 PostgreSQL 접속 문자열(Data Source Name)을 생성한다.
// database/sql의 sql.Open()에서 사용하는 형식이다.
// 예: "host=localhost port=5432 user=harness password=harness dbname=harness sslmode=disable"
func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName,
	)
}

// getEnv는 환경변수를 읽되, 값이 없으면 fallback(기본값)을 반환하는 헬퍼 함수이다.
// os.Getenv()는 환경변수가 없으면 빈 문자열을 반환하므로,
// 이 함수로 기본값을 지정할 수 있다.
func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
```

- [ ] **Step 4: Docker Compose로 DB 실행 확인**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
docker compose up db -d
```

Expected: PostgreSQL 컨테이너 시작

```bash
docker compose exec db psql -U harness -d harness -c "\dt"
```

Expected: `users` 테이블이 표시됨

```bash
docker compose down
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add docker-compose.yml backend/migrations/ backend/internal/config/
git commit -m "feat: Docker Compose + PostgreSQL + 환경설정"
```

---

## Task 3: User 모델 + Repository (DB CRUD)

**Files:**
- Create: `backend/internal/model/user.go`
- Create: `backend/internal/repository/user_repository.go`

- [ ] **Step 1: User 모델 작성**

`backend/internal/model/user.go`:
```go
// =============================================================================
// user.go - User 데이터 모델 및 요청/응답 DTO
// =============================================================================
// 이 파일은 User와 관련된 모든 데이터 구조체를 정의한다.
//
// 구조체 종류:
//   - User: DB 테이블과 1:1 매핑되는 핵심 모델
//   - RegisterRequest: 회원가입 요청 바디
//   - LoginRequest: 로그인 요청 바디
//   - UpdateUserRequest: 유저 정보 수정 요청 바디
//
// JSON 태그 설명:
//   - `json:"필드명"`: JSON 직렬화/역직렬화 시 사용할 키 이름
//   - `json:"-"`: JSON 출력에서 제외 (비밀번호 같은 민감 정보)
//   - `binding:"required"`: Gin이 요청 바인딩 시 필수값 검증
// =============================================================================
package model

import "time"

// User는 데이터베이스의 users 테이블에 대응하는 구조체이다.
// 이 구조체는 Repository에서 DB 조회 결과를 담고,
// Handler에서 JSON 응답으로 변환할 때 사용된다.
type User struct {
	ID        int       `json:"id"`
	Email     string    `json:"email"`
	Password  string    `json:"-"`           // JSON 응답에서 제외. 비밀번호 노출 방지.
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// RegisterRequest는 POST /api/auth/register 요청의 바디 구조체이다.
// 클라이언트가 회원가입할 때 보내는 데이터를 담는다.
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`    // 이메일 형식 검증
	Password string `json:"password" binding:"required,min=6"` // 최소 6자
	Name     string `json:"name" binding:"required"`
}

// LoginRequest는 POST /api/auth/login 요청의 바디 구조체이다.
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// UpdateUserRequest는 PUT /api/users/:id 요청의 바디 구조체이다.
// 이메일과 이름만 수정 가능하다. 비밀번호 변경은 별도 API가 필요하다.
type UpdateUserRequest struct {
	Email string `json:"email" binding:"omitempty,email"` // 빈 값 허용, 있으면 이메일 형식
	Name  string `json:"name" binding:"omitempty"`
}
```

- [ ] **Step 2: UserRepository 작성**

`backend/internal/repository/user_repository.go`:
```go
// =============================================================================
// user_repository.go - User DB 접근 레이어
// =============================================================================
// 이 파일은 users 테이블에 대한 모든 SQL 쿼리를 담당한다.
// Service 레이어에서 호출되며, 비즈니스 로직은 포함하지 않는다.
//
// 계층 구조에서의 위치:
//   Handler → Service → [Repository] → PostgreSQL
//
// 왜 Repository를 분리하는가?
//   - DB 쿼리와 비즈니스 로직을 분리하면 테스트가 쉬워진다.
//   - 나중에 DB를 교체하더라도 Repository만 수정하면 된다.
//   - Service는 "무엇을 할지"에 집중, Repository는 "어떻게 저장할지"에 집중.
// =============================================================================
package repository

import (
	"database/sql"
	"time"

	"harness-fullstack-test/internal/model"
)

// UserRepository는 users 테이블에 접근하는 메서드를 제공한다.
// db 필드에 데이터베이스 연결 객체를 보관한다.
type UserRepository struct {
	db *sql.DB
}

// NewUserRepository는 UserRepository를 생성하는 팩토리 함수이다.
// main.go에서 DB 연결을 주입받아 생성한다.
func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create는 새로운 유저를 DB에 삽입하고, 생성된 유저 정보를 반환한다.
//
// 흐름: INSERT 쿼리 실행 → RETURNING으로 생성된 행의 전체 데이터를 받음
// 파라미터:
//   - email: 이메일 주소 (UNIQUE 제약조건)
//   - hashedPassword: bcrypt로 해시된 비밀번호 (평문 아님!)
//   - name: 사용자 표시 이름
//
// 에러 케이스: 이메일 중복 시 PostgreSQL UNIQUE 제약조건 위반 에러 발생
func (r *UserRepository) Create(email, hashedPassword, name string) (*model.User, error) {
	user := &model.User{}
	err := r.db.QueryRow(
		`INSERT INTO users (email, password, name, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, email, password, name, created_at, updated_at`,
		email, hashedPassword, name, time.Now(), time.Now(),
	).Scan(&user.ID, &user.Email, &user.Password, &user.Name, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

// FindByEmail은 이메일로 유저를 조회한다.
// 로그인 시 이메일로 유저를 찾고, 비밀번호를 검증하는 데 사용된다.
//
// 반환값:
//   - *model.User: 찾은 유저 (비밀번호 포함)
//   - error: sql.ErrNoRows면 해당 이메일의 유저가 없음
func (r *UserRepository) FindByEmail(email string) (*model.User, error) {
	user := &model.User{}
	err := r.db.QueryRow(
		`SELECT id, email, password, name, created_at, updated_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.Password, &user.Name, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

// FindByID는 ID로 유저를 조회한다.
// GET /api/users/:id 에서 사용된다.
func (r *UserRepository) FindByID(id int) (*model.User, error) {
	user := &model.User{}
	err := r.db.QueryRow(
		`SELECT id, email, password, name, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.Password, &user.Name, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

// FindAll은 모든 유저를 조회한다.
// GET /api/users 에서 사용된다.
// 프로덕션에서는 페이지네이션이 필요하지만, MVP에서는 전체 조회로 충분하다.
func (r *UserRepository) FindAll() ([]model.User, error) {
	rows, err := r.db.Query(
		`SELECT id, email, password, name, created_at, updated_at
		 FROM users ORDER BY id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var user model.User
		if err := rows.Scan(&user.ID, &user.Email, &user.Password, &user.Name, &user.CreatedAt, &user.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, nil
}

// Update는 유저 정보를 수정한다.
// PUT /api/users/:id 에서 사용된다.
// updated_at을 현재 시각으로 갱신한다.
func (r *UserRepository) Update(id int, email, name string) (*model.User, error) {
	user := &model.User{}
	err := r.db.QueryRow(
		`UPDATE users SET email = $1, name = $2, updated_at = $3
		 WHERE id = $4
		 RETURNING id, email, password, name, created_at, updated_at`,
		email, name, time.Now(), id,
	).Scan(&user.ID, &user.Email, &user.Password, &user.Name, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

// Delete는 유저를 삭제한다.
// DELETE /api/users/:id 에서 사용된다.
// 반환값으로 영향받은 행 수를 확인할 수 있다.
func (r *UserRepository) Delete(id int) error {
	result, err := r.db.Exec(`DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}
```

- [ ] **Step 3: lib/pq 의존성 설치**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test/backend
go get github.com/lib/pq
```

- [ ] **Step 4: 빌드 확인**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test/backend
go build ./...
```

Expected: 에러 없이 빌드 성공

- [ ] **Step 5: Commit**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add backend/internal/model/ backend/internal/repository/
git commit -m "feat: User 모델 + Repository (CRUD 쿼리)"
```

---

## Task 4: Auth Service (JWT + bcrypt)

**Files:**
- Create: `backend/internal/service/auth_service.go`

- [ ] **Step 1: JWT + bcrypt 의존성 설치**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test/backend
go get github.com/golang-jwt/jwt/v5
go get golang.org/x/crypto/bcrypt
```

- [ ] **Step 2: AuthService 작성**

`backend/internal/service/auth_service.go`:
```go
// =============================================================================
// auth_service.go - 인증 서비스
// =============================================================================
// 이 파일은 인증과 관련된 비즈니스 로직을 담당한다:
//   1. 회원가입: 비밀번호 해싱 → DB 저장
//   2. 로그인: 비밀번호 검증 → JWT 토큰 생성
//   3. JWT 토큰 검증 (미들웨어에서 호출)
//
// 계층 구조에서의 위치:
//   Handler → [Service] → Repository → PostgreSQL
//
// JWT(JSON Web Token) 동작 원리:
//   - 로그인 성공 시 서버가 토큰을 생성하여 클라이언트에 전달
//   - 토큰에는 user_id, email이 포함되어 있음 (Claims)
//   - 클라이언트는 이후 요청마다 Authorization 헤더에 토큰을 첨부
//   - 서버는 비밀키(JWT_SECRET)로 토큰의 위변조를 검증
//
// bcrypt 동작 원리:
//   - 비밀번호를 해시하여 저장 (원본 비밀번호는 어디에도 저장하지 않음)
//   - 로그인 시 입력된 비밀번호를 같은 알고리즘으로 해시하여 비교
//   - 해시에 salt가 포함되어 있어 같은 비밀번호도 다른 해시값이 나옴
// =============================================================================
package service

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"harness-fullstack-test/internal/model"
	"harness-fullstack-test/internal/repository"
)

// AuthService는 인증 관련 비즈니스 로직을 처리하는 구조체이다.
type AuthService struct {
	userRepo  *repository.UserRepository // DB 접근을 위한 Repository
	jwtSecret []byte                     // JWT 서명에 사용하는 비밀키
}

// JWTClaims는 JWT 토큰에 포함되는 데이터(클레임)를 정의한다.
// jwt.RegisteredClaims를 임베딩하여 표준 클레임(만료시간 등)을 포함한다.
type JWTClaims struct {
	UserID int    `json:"user_id"` // 유저 고유 ID
	Email  string `json:"email"`   // 유저 이메일
	jwt.RegisteredClaims          // 표준 클레임 (ExpiresAt, IssuedAt 등)
}

// NewAuthService는 AuthService를 생성하는 팩토리 함수이다.
func NewAuthService(userRepo *repository.UserRepository, jwtSecret string) *AuthService {
	return &AuthService{
		userRepo:  userRepo,
		jwtSecret: []byte(jwtSecret),
	}
}

// Register는 새로운 유저를 등록(회원가입)한다.
//
// 처리 흐름:
//   1. 비밀번호를 bcrypt로 해시한다 (cost=10, 보안과 성능의 균형)
//   2. Repository를 통해 DB에 유저를 저장한다
//   3. 생성된 유저 정보를 반환한다 (비밀번호는 json:"-"로 제외됨)
//
// 에러 케이스:
//   - 이메일 중복: Repository에서 UNIQUE 제약조건 위반 에러
//   - 해시 실패: bcrypt 라이브러리 에러 (매우 드묾)
func (s *AuthService) Register(req *model.RegisterRequest) (*model.User, error) {
	// bcrypt.GenerateFromPassword: 평문 비밀번호 → 해시 문자열
	// bcrypt.DefaultCost(10): 해시 연산 반복 횟수. 높을수록 안전하지만 느림.
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	return s.userRepo.Create(req.Email, string(hashedPassword), req.Name)
}

// Login은 이메일/비밀번호로 로그인하고 JWT 토큰을 반환한다.
//
// 처리 흐름:
//   1. 이메일로 DB에서 유저를 조회한다
//   2. 입력된 비밀번호와 저장된 해시를 비교한다
//   3. 일치하면 JWT 토큰을 생성하여 반환한다
//
// 보안 주의사항:
//   - "이메일이 없음"과 "비밀번호가 틀림"을 구분하지 않는다
//   - 공격자에게 어떤 이메일이 등록되어 있는지 알려주지 않기 위함
func (s *AuthService) Login(req *model.LoginRequest) (string, error) {
	// 1단계: 이메일로 유저 조회
	user, err := s.userRepo.FindByEmail(req.Email)
	if err != nil {
		return "", errors.New("invalid email or password")
	}

	// 2단계: 비밀번호 검증
	// bcrypt.CompareHashAndPassword: 저장된 해시와 입력된 평문 비밀번호를 비교
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		return "", errors.New("invalid email or password")
	}

	// 3단계: JWT 토큰 생성
	return s.generateToken(user)
}

// ValidateToken은 JWT 토큰 문자열을 검증하고 클레임을 반환한다.
// 미들웨어(auth_middleware.go)에서 호출된다.
//
// 처리 흐름:
//   1. 토큰 문자열을 파싱하고 서명을 검증한다
//   2. 만료 시간을 확인한다 (자동으로 처리됨)
//   3. 클레임(user_id, email)을 추출하여 반환한다
func (s *AuthService) ValidateToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// 서명 방식이 HMAC인지 확인 (다른 알고리즘으로 위조하는 것을 방지)
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

// generateToken은 유저 정보로 JWT 토큰을 생성하는 내부 함수이다.
//
// 토큰 구조: Header.Payload.Signature
//   - Header: 알고리즘(HS256) + 토큰 타입(JWT)
//   - Payload: user_id, email, 만료시간, 발급시간
//   - Signature: Header+Payload를 JWT_SECRET으로 서명
//
// 만료 시간: 24시간. 만료되면 다시 로그인해야 한다.
func (s *AuthService) generateToken(user *model.User) (string, error) {
	claims := &JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	// jwt.NewWithClaims: 클레임을 포함한 토큰 객체 생성
	// token.SignedString: 비밀키로 서명하여 최종 토큰 문자열 생성
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}
```

- [ ] **Step 3: 빌드 확인**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test/backend
go build ./...
```

Expected: 에러 없이 빌드 성공

- [ ] **Step 4: Commit**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add backend/internal/service/ backend/go.mod backend/go.sum
git commit -m "feat: AuthService - JWT 토큰 생성/검증 + bcrypt 비밀번호 해싱"
```

---

## Task 5: User Service

**Files:**
- Create: `backend/internal/service/user_service.go`

- [ ] **Step 1: UserService 작성**

`backend/internal/service/user_service.go`:
```go
// =============================================================================
// user_service.go - 유저 비즈니스 로직 서비스
// =============================================================================
// 이 파일은 유저 CRUD에 대한 비즈니스 로직을 담당한다.
// Repository를 호출하여 DB 작업을 수행하고,
// 필요한 경우 추가적인 검증이나 변환을 처리한다.
//
// 계층 구조에서의 위치:
//   Handler → [Service] → Repository → PostgreSQL
//
// 왜 Service를 별도로 두는가?
//   - Handler는 HTTP 요청/응답만 담당 (웹 프레임워크에 의존)
//   - Service는 순수 비즈니스 로직 (프레임워크 독립적)
//   - 같은 비즈니스 로직을 CLI, gRPC 등 다른 인터페이스에서도 재사용 가능
// =============================================================================
package service

import (
	"harness-fullstack-test/internal/model"
	"harness-fullstack-test/internal/repository"
)

// UserService는 유저 관련 비즈니스 로직을 처리하는 구조체이다.
type UserService struct {
	userRepo *repository.UserRepository
}

// NewUserService는 UserService를 생성하는 팩토리 함수이다.
func NewUserService(userRepo *repository.UserRepository) *UserService {
	return &UserService{userRepo: userRepo}
}

// GetAll은 모든 유저 목록을 조회한다.
// GET /api/users 핸들러에서 호출된다.
func (s *UserService) GetAll() ([]model.User, error) {
	return s.userRepo.FindAll()
}

// GetByID는 ID로 특정 유저를 조회한다.
// GET /api/users/:id 핸들러에서 호출된다.
func (s *UserService) GetByID(id int) (*model.User, error) {
	return s.userRepo.FindByID(id)
}

// Update는 유저 정보를 수정한다.
// PUT /api/users/:id 핸들러에서 호출된다.
//
// 처리 흐름:
//   1. 기존 유저 정보를 조회한다
//   2. 요청에 포함된 필드만 업데이트한다 (빈 값이면 기존값 유지)
//   3. Repository를 통해 DB에 저장한다
func (s *UserService) Update(id int, req *model.UpdateUserRequest) (*model.User, error) {
	// 기존 유저 정보를 먼저 조회한다.
	// 요청에 빈 값이 있으면 기존값을 유지하기 위함이다.
	existing, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, err
	}

	// 요청에 값이 있으면 새 값 사용, 없으면 기존값 유지
	email := existing.Email
	if req.Email != "" {
		email = req.Email
	}
	name := existing.Name
	if req.Name != "" {
		name = req.Name
	}

	return s.userRepo.Update(id, email, name)
}

// Delete는 유저를 삭제한다.
// DELETE /api/users/:id 핸들러에서 호출된다.
func (s *UserService) Delete(id int) error {
	return s.userRepo.Delete(id)
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test/backend
go build ./...
```

Expected: 에러 없이 빌드 성공

- [ ] **Step 3: Commit**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add backend/internal/service/user_service.go
git commit -m "feat: UserService - 유저 CRUD 비즈니스 로직"
```

---

## Task 6: Auth Middleware + Handlers

**Files:**
- Create: `backend/internal/middleware/auth_middleware.go`
- Create: `backend/internal/handler/auth_handler.go`
- Create: `backend/internal/handler/user_handler.go`

- [ ] **Step 1: JWT 인증 미들웨어 작성**

`backend/internal/middleware/auth_middleware.go`:
```go
// =============================================================================
// auth_middleware.go - JWT 인증 미들웨어
// =============================================================================
// 이 파일은 보호된 API 엔드포인트에 접근하기 전에
// JWT 토큰을 검증하는 미들웨어를 정의한다.
//
// 미들웨어란?
//   - HTTP 요청이 핸들러에 도달하기 전에 실행되는 중간 처리 함수
//   - 인증, 로깅, CORS 등 공통 처리를 핸들러마다 반복하지 않기 위해 사용
//
// 동작 흐름:
//   1. 요청의 Authorization 헤더에서 "Bearer <token>" 형식으로 토큰 추출
//   2. AuthService.ValidateToken()으로 토큰 검증
//   3. 검증 성공: 유저 정보를 Gin Context에 저장 → 다음 핸들러로 진행
//   4. 검증 실패: 401 Unauthorized 응답 반환 → 핸들러 실행 안 됨
//
// Gin Context 저장 값:
//   - "user_id": int - 현재 로그인한 유저의 ID
//   - "user_email": string - 현재 로그인한 유저의 이메일
// =============================================================================
package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"harness-fullstack-test/internal/service"
)

// AuthMiddleware는 JWT 인증을 수행하는 Gin 미들웨어를 반환한다.
// 라우터에 등록하면 해당 경로의 모든 요청에 대해 토큰 검증이 실행된다.
//
// 사용 예시:
//   protected := r.Group("/api")
//   protected.Use(middleware.AuthMiddleware(authService))
func AuthMiddleware(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1단계: Authorization 헤더에서 토큰 추출
		// 형식: "Bearer eyJhbGciOiJIUzI1NiIs..."
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort() // 이후 핸들러 실행 중단
			return
		}

		// "Bearer " 접두사를 제거하여 순수 토큰 문자열만 추출
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
			c.Abort()
			return
		}
		tokenString := parts[1]

		// 2단계: 토큰 검증
		claims, err := authService.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// 3단계: 검증 성공 → 유저 정보를 Context에 저장
		// 이후 핸들러에서 c.GetInt("user_id")로 접근 가능
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)

		// 다음 핸들러로 진행
		c.Next()
	}
}
```

- [ ] **Step 2: Auth Handler 작성**

`backend/internal/handler/auth_handler.go`:
```go
// =============================================================================
// auth_handler.go - 인증 관련 HTTP 핸들러
// =============================================================================
// 이 파일은 회원가입(Register)과 로그인(Login) API의 HTTP 핸들러를 정의한다.
// Handler는 HTTP 요청을 파싱하고 응답을 생성하는 역할만 한다.
// 실제 비즈니스 로직은 AuthService에 위임한다.
//
// 계층 구조에서의 위치:
//   [Handler] → Service → Repository → PostgreSQL
//
// 핸들러의 책임:
//   1. 요청 바디를 구조체로 파싱 (JSON → Go struct)
//   2. Service 호출
//   3. 결과를 JSON 응답으로 반환
//   4. 에러 발생 시 적절한 HTTP 상태 코드 반환
// =============================================================================
package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"harness-fullstack-test/internal/model"
	"harness-fullstack-test/internal/service"
)

// AuthHandler는 인증 관련 HTTP 요청을 처리하는 구조체이다.
type AuthHandler struct {
	authService *service.AuthService
}

// NewAuthHandler는 AuthHandler를 생성하는 팩토리 함수이다.
func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Register는 POST /api/auth/register 요청을 처리한다.
//
// 요청 흐름:
//   1. JSON 바디를 RegisterRequest 구조체로 파싱
//   2. binding 태그로 유효성 검증 (email 형식, 비밀번호 6자 이상 등)
//   3. AuthService.Register() 호출하여 유저 생성
//   4. 성공: 201 Created + 생성된 유저 정보 반환
//   5. 실패: 400 Bad Request (유효성) 또는 500 Internal Server Error
//
// 요청 예시:
//   POST /api/auth/register
//   {"email": "user@example.com", "password": "123456", "name": "홍길동"}
func (h *AuthHandler) Register(c *gin.Context) {
	var req model.RegisterRequest

	// ShouldBindJSON: JSON 바디를 구조체로 파싱 + binding 태그 검증
	// 실패하면 어떤 필드가 잘못되었는지 에러 메시지를 반환한다.
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.authService.Register(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 201 Created: 리소스가 성공적으로 생성되었음을 나타내는 HTTP 상태 코드
	c.JSON(http.StatusCreated, user)
}

// Login은 POST /api/auth/login 요청을 처리한다.
//
// 요청 흐름:
//   1. JSON 바디를 LoginRequest 구조체로 파싱
//   2. AuthService.Login() 호출하여 인증 + JWT 토큰 생성
//   3. 성공: 200 OK + {"token": "eyJ..."} 반환
//   4. 실패: 401 Unauthorized (이메일/비밀번호 불일치)
//
// 요청 예시:
//   POST /api/auth/login
//   {"email": "user@example.com", "password": "123456"}
//
// 응답 예시:
//   {"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
func (h *AuthHandler) Login(c *gin.Context) {
	var req model.LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	token, err := h.authService.Login(&req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token})
}
```

- [ ] **Step 3: User Handler 작성**

`backend/internal/handler/user_handler.go`:
```go
// =============================================================================
// user_handler.go - 유저 CRUD HTTP 핸들러
// =============================================================================
// 이 파일은 유저 목록 조회, 상세 조회, 수정, 삭제 API의 HTTP 핸들러를 정의한다.
// 모든 엔드포인트는 JWT 인증 미들웨어를 통과해야 접근 가능하다.
//
// 계층 구조에서의 위치:
//   [Handler] → Service → Repository → PostgreSQL
// =============================================================================
package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"harness-fullstack-test/internal/model"
	"harness-fullstack-test/internal/service"
)

// UserHandler는 유저 CRUD HTTP 요청을 처리하는 구조체이다.
type UserHandler struct {
	userService *service.UserService
}

// NewUserHandler는 UserHandler를 생성하는 팩토리 함수이다.
func NewUserHandler(userService *service.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

// GetAll은 GET /api/users 요청을 처리한다.
// 모든 유저 목록을 JSON 배열로 반환한다.
func (h *UserHandler) GetAll(c *gin.Context) {
	users, err := h.userService.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, users)
}

// GetByID는 GET /api/users/:id 요청을 처리한다.
// URL 파라미터에서 id를 추출하여 해당 유저를 조회한다.
//
// URL 파라미터 추출:
//   c.Param("id")는 라우트 정의의 :id 부분에 해당하는 값을 문자열로 반환.
//   DB 조회를 위해 strconv.Atoi()로 정수로 변환한다.
func (h *UserHandler) GetByID(c *gin.Context) {
	// URL에서 :id 파라미터를 추출하고 정수로 변환
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, err := h.userService.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// Update는 PUT /api/users/:id 요청을 처리한다.
// URL 파라미터에서 id를, 바디에서 수정할 데이터를 추출한다.
func (h *UserHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req model.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.userService.Update(id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

// Delete는 DELETE /api/users/:id 요청을 처리한다.
// 성공하면 204 No Content를 반환한다 (응답 바디 없음).
func (h *UserHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	if err := h.userService.Delete(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// 204 No Content: 삭제 성공, 반환할 데이터 없음
	c.Status(http.StatusNoContent)
}
```

- [ ] **Step 4: 빌드 확인**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test/backend
go build ./...
```

Expected: 에러 없이 빌드 성공

- [ ] **Step 5: Commit**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add backend/internal/middleware/ backend/internal/handler/
git commit -m "feat: Auth 미들웨어 + Auth/User HTTP 핸들러"
```

---

## Task 7: main.go 완성 (라우팅 + DB 연결)

**Files:**
- Modify: `backend/cmd/server/main.go`

- [ ] **Step 1: main.go를 완전한 서버로 업데이트**

`backend/cmd/server/main.go` 전체 교체:
```go
// =============================================================================
// main.go - 애플리케이션 엔트리포인트
// =============================================================================
// 이 파일은 백엔드 서버의 시작점으로, 다음 작업을 순서대로 수행한다:
//   1. 환경변수에서 설정 로드 (config)
//   2. PostgreSQL 데이터베이스 연결 (database/sql)
//   3. 각 레이어 초기화: Repository → Service → Handler
//   4. Gin 라우터 설정 (공개 API + 보호된 API)
//   5. HTTP 서버 시작
//
// 전체 아키텍처 흐름:
//   [클라이언트] → Gin Router → Middleware → Handler → Service → Repository → [DB]
//
// 의존성 주입 패턴:
//   main()에서 모든 의존성을 생성하고 주입한다.
//   이렇게 하면 각 레이어가 독립적이고 테스트하기 쉽다.
//   예: Handler는 Service에만 의존, Service는 Repository에만 의존.
// =============================================================================
package main

import (
	"database/sql"
	"log"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq" // PostgreSQL 드라이버. 직접 호출하지 않지만 init()으로 등록됨.

	"harness-fullstack-test/internal/config"
	"harness-fullstack-test/internal/handler"
	"harness-fullstack-test/internal/middleware"
	"harness-fullstack-test/internal/repository"
	"harness-fullstack-test/internal/service"
)

func main() {
	// =========================================================================
	// 1단계: 설정 로드
	// =========================================================================
	// 환경변수에서 DB 접속정보, JWT 시크릿 등을 읽어온다.
	// 환경변수가 없으면 로컬 개발용 기본값을 사용한다.
	cfg := config.Load()

	// =========================================================================
	// 2단계: 데이터베이스 연결
	// =========================================================================
	// sql.Open()은 연결 풀(connection pool)을 생성한다.
	// 실제 연결은 첫 쿼리 실행 시 이루어지므로, db.Ping()으로 연결을 확인한다.
	// "postgres"는 lib/pq 드라이버가 등록한 드라이버 이름이다.
	db, err := sql.Open("postgres", cfg.DSN())
	if err != nil {
		log.Fatalf("DB 연결 실패: %v", err)
	}
	defer db.Close() // 프로그램 종료 시 DB 연결을 닫는다.

	// Ping으로 실제 DB 연결이 가능한지 확인한다.
	if err := db.Ping(); err != nil {
		log.Fatalf("DB 핑 실패: %v", err)
	}
	log.Println("데이터베이스 연결 성공")

	// =========================================================================
	// 3단계: 의존성 초기화 (Repository → Service → Handler)
	// =========================================================================
	// 각 레이어를 아래에서 위로 생성하며, 하위 레이어를 상위에 주입한다.

	// Repository: DB 접근 담당
	userRepo := repository.NewUserRepository(db)

	// Service: 비즈니스 로직 담당
	authService := service.NewAuthService(userRepo, cfg.JWTSecret)
	userService := service.NewUserService(userRepo)

	// Handler: HTTP 요청 처리 담당
	authHandler := handler.NewAuthHandler(authService)
	userHandler := handler.NewUserHandler(userService)

	// =========================================================================
	// 4단계: Gin 라우터 설정
	// =========================================================================
	r := gin.Default()

	// 헬스체크: 서버 상태 확인용
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// API 그룹
	api := r.Group("/api")

	// --- 공개 API (인증 불필요) ---
	// 회원가입과 로그인은 토큰 없이 접근 가능해야 한다.
	auth := api.Group("/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
	}

	// --- 보호된 API (JWT 인증 필요) ---
	// AuthMiddleware를 거쳐야만 아래 핸들러에 도달할 수 있다.
	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware(authService))
	{
		protected.GET("/users", userHandler.GetAll)
		protected.GET("/users/:id", userHandler.GetByID)
		protected.PUT("/users/:id", userHandler.Update)
		protected.DELETE("/users/:id", userHandler.Delete)
	}

	// =========================================================================
	// 5단계: 서버 시작
	// =========================================================================
	log.Printf("서버를 시작합니다: http://localhost:%s", cfg.ServerPort)
	log.Fatal(r.Run(":" + cfg.ServerPort))
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test/backend
go build ./cmd/server
```

Expected: 에러 없이 빌드 성공

- [ ] **Step 3: Backend Dockerfile 작성**

`backend/Dockerfile`:
```dockerfile
# =============================================================================
# Backend Dockerfile - 멀티스테이지 빌드
# =============================================================================
# 멀티스테이지 빌드란?
#   - 1단계(builder): Go 소스코드를 컴파일하여 바이너리 생성
#   - 2단계(runtime): 컴파일된 바이너리만 최소 이미지에 복사
#   - 이점: 최종 이미지에 Go 컴파일러/소스코드가 없어 이미지 크기가 작음
# =============================================================================

# --- 1단계: 빌드 ---
FROM golang:1.22-alpine AS builder

WORKDIR /app

# go.mod, go.sum을 먼저 복사하여 의존성을 캐싱한다.
# 소스코드가 변경되어도 의존성이 같으면 이 레이어는 캐시에서 재사용된다.
COPY go.mod go.sum ./
RUN go mod download

# 소스코드 복사 및 빌드
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

# --- 2단계: 실행 ---
FROM alpine:3.19

# CA 인증서 설치 (HTTPS 요청 시 필요)
RUN apk --no-cache add ca-certificates

WORKDIR /app
COPY --from=builder /server .

EXPOSE 8080

CMD ["./server"]
```

- [ ] **Step 4: Docker로 백엔드 빌드 확인**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
docker compose build backend
```

Expected: 빌드 성공

- [ ] **Step 5: 전체 스택(DB + 백엔드) 실행 확인**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
docker compose up db backend -d
```

잠시 후:
```bash
curl http://localhost:8080/health
```

Expected: `{"status":"ok"}`

```bash
docker compose down
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add backend/cmd/server/main.go backend/Dockerfile
git commit -m "feat: main.go 완성 - 라우팅, DB 연결, 의존성 주입 + Dockerfile"
```

---

## Task 8: React 프로젝트 초기화 + 라우팅

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/types.ts`

- [ ] **Step 1: React + Vite 프로젝트 생성**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
npm create vite@latest frontend -- --template react-ts
```

- [ ] **Step 2: 의존성 설치**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test/frontend
npm install
npm install react-router-dom
```

- [ ] **Step 3: Vite 설정 (API 프록시)**

`frontend/vite.config.ts`:
```ts
// =============================================================================
// vite.config.ts - Vite 빌드 도구 설정
// =============================================================================
// Vite는 프론트엔드 개발 서버 + 빌드 도구이다.
//
// proxy 설정이 중요한 이유:
//   - 프론트엔드 (localhost:5173)에서 백엔드 (localhost:8080)로 API 호출 시
//     브라우저의 CORS(Cross-Origin Resource Sharing) 정책에 의해 차단될 수 있다.
//   - proxy를 설정하면 프론트엔드 서버가 API 요청을 백엔드로 대신 전달해준다.
//   - 브라우저 입장에서는 같은 출처(localhost:5173)로 요청하는 것이므로 CORS 문제 없음.
//
// 요청 흐름:
//   브라우저 → localhost:5173/api/users → Vite 프록시 → localhost:8080/api/users
// =============================================================================
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Docker 컨테이너에서 접근 가능하도록 모든 인터페이스에 바인딩
    port: 5173,
    proxy: {
      // /api로 시작하는 요청을 백엔드 서버로 프록시
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 4: 공유 타입 정의**

`frontend/src/types.ts`:
```ts
// =============================================================================
// types.ts - 공유 TypeScript 타입 정의
// =============================================================================
// 이 파일은 프론트엔드 전체에서 사용하는 타입을 정의한다.
// 백엔드 API의 요청/응답 형식과 일치하도록 한다.
//
// TypeScript 타입의 역할:
//   - 코드 작성 시 자동완성 지원
//   - 잘못된 필드 접근을 컴파일 타임에 감지
//   - API 응답 형식을 문서화하는 효과
// =============================================================================

// User는 백엔드 User 모델에 대응하는 타입이다.
// GET /api/users, GET /api/users/:id 응답에서 사용된다.
export interface User {
  id: number
  email: string
  name: string
  created_at: string  // ISO 8601 날짜 문자열 (예: "2026-04-09T12:00:00Z")
  updated_at: string
}

// LoginRequest는 POST /api/auth/login 요청 바디 타입이다.
export interface LoginRequest {
  email: string
  password: string
}

// RegisterRequest는 POST /api/auth/register 요청 바디 타입이다.
export interface RegisterRequest {
  email: string
  password: string
  name: string
}

// LoginResponse는 POST /api/auth/login 응답 타입이다.
export interface LoginResponse {
  token: string
}

// UpdateUserRequest는 PUT /api/users/:id 요청 바디 타입이다.
export interface UpdateUserRequest {
  email?: string
  name?: string
}
```

- [ ] **Step 5: App.tsx 라우팅 설정**

`frontend/src/App.tsx`:
```tsx
// =============================================================================
// App.tsx - 애플리케이션 최상위 컴포넌트 + 라우팅 설정
// =============================================================================
// 이 파일은 React 앱의 페이지 라우팅(URL → 컴포넌트 매핑)을 설정한다.
//
// React Router 동작 원리:
//   - BrowserRouter: HTML5 History API를 사용하여 URL을 관리
//   - Routes: 현재 URL에 맞는 Route를 찾아 해당 컴포넌트를 렌더링
//   - Route: path(URL 패턴)와 element(렌더링할 컴포넌트)를 매핑
//
// 라우트 구조:
//   /login     → LoginPage (공개)
//   /register  → RegisterPage (공개)
//   /          → UserListPage (인증 필요 - ProtectedRoute로 감싸짐)
//   /users/:id → UserDetailPage (인증 필요)
// =============================================================================
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { UserListPage } from './pages/UserListPage'
import { UserDetailPage } from './pages/UserDetailPage'

function App() {
  return (
    // AuthProvider: 전체 앱에 인증 상태(토큰, 로그인 여부)를 제공
    // BrowserRouter: URL 변경을 감지하여 해당 컴포넌트를 렌더링
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 공개 라우트: 로그인하지 않아도 접근 가능 */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* 보호된 라우트: 로그인해야 접근 가능 */}
          {/* ProtectedRoute가 토큰이 없으면 /login으로 리다이렉트 */}
          <Route path="/" element={<ProtectedRoute><UserListPage /></ProtectedRoute>} />
          <Route path="/users/:id" element={<ProtectedRoute><UserDetailPage /></ProtectedRoute>} />

          {/* 정의되지 않은 경로는 메인 페이지로 리다이렉트 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 6: 빌드 확인**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test/frontend
npm run build
```

Expected: 아직 import한 컴포넌트들이 없으므로 빌드 에러 발생. 이것은 예상된 동작이다. 다음 Task에서 컴포넌트를 생성한다.

- [ ] **Step 7: Commit (현재까지 작성한 파일만)**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/tsconfig.json frontend/tsconfig.app.json frontend/tsconfig.node.json frontend/index.html frontend/src/main.tsx frontend/src/App.tsx frontend/src/types.ts frontend/eslint.config.js
git commit -m "feat: React + Vite 프로젝트 초기화 + 라우팅 설정"
```

---

## Task 9: AuthContext + API Client + ProtectedRoute

**Files:**
- Create: `frontend/src/context/AuthContext.tsx`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/components/ProtectedRoute.tsx`

- [ ] **Step 1: API Client 작성**

`frontend/src/api/client.ts`:
```ts
// =============================================================================
// client.ts - API 클라이언트 (fetch wrapper)
// =============================================================================
// 이 파일은 백엔드 API와 통신하는 함수들을 제공한다.
// 브라우저 내장 fetch API를 래핑하여 다음 기능을 추가한다:
//   - JWT 토큰 자동 첨부 (Authorization 헤더)
//   - JSON 요청/응답 자동 처리
//   - 에러 핸들링
//
// 왜 fetch를 직접 래핑하는가?
//   - axios 같은 외부 라이브러리 없이 최소 의존성으로 구현
//   - fetch는 브라우저 내장 API라 별도 설치가 필요 없음
//   - 프로젝트 규모가 작으므로 충분함
//
// 사용 예시:
//   const users = await apiClient.get<User[]>('/api/users')
//   const user = await apiClient.post<User>('/api/auth/register', { email, password, name })
// =============================================================================

// API_BASE는 API 요청의 기본 경로이다.
// Vite의 proxy 설정으로 /api 요청이 백엔드(localhost:8080)로 전달된다.
// 따라서 여기서는 상대 경로만 사용하면 된다.
const API_BASE = ''

// getToken은 localStorage에서 JWT 토큰을 읽는 헬퍼 함수이다.
// 로그인 시 저장한 토큰을 API 호출 시 가져온다.
function getToken(): string | null {
  return localStorage.getItem('token')
}

// request는 모든 API 호출의 공통 로직을 처리하는 내부 함수이다.
//
// 처리 흐름:
//   1. 기본 헤더 설정 (Content-Type: application/json)
//   2. 토큰이 있으면 Authorization 헤더 추가
//   3. fetch 실행
//   4. 응답이 에러(4xx, 5xx)이면 에러 객체를 throw
//   5. 응답이 성공이면 JSON 파싱하여 반환
//
// 제네릭 <T>:
//   호출하는 곳에서 응답 타입을 지정할 수 있다.
//   예: request<User[]>('/api/users') → User[] 타입 반환
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  // 토큰이 있으면 Authorization 헤더에 Bearer 토큰 추가
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  // HTTP 상태 코드가 2xx가 아니면 에러로 처리
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  // 204 No Content (DELETE 성공 등)는 빈 응답이므로 JSON 파싱하지 않음
  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

// apiClient는 HTTP 메서드별 편의 함수를 제공하는 객체이다.
// 각 페이지 컴포넌트에서 이 객체를 import하여 API를 호출한다.
export const apiClient = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
}
```

- [ ] **Step 2: AuthContext 작성**

`frontend/src/context/AuthContext.tsx`:
```tsx
// =============================================================================
// AuthContext.tsx - 인증 상태 관리 Context
// =============================================================================
// 이 파일은 React Context API를 사용하여 앱 전체에서
// 인증 상태(로그인 여부, 토큰)를 공유하는 기능을 제공한다.
//
// React Context란?
//   - 컴포넌트 트리 전체에서 데이터를 공유하는 메커니즘
//   - props로 일일이 전달하지 않아도 어떤 컴포넌트에서든 접근 가능
//   - 인증 상태처럼 앱 전역에서 필요한 데이터에 적합
//
// 사용 방법:
//   1. AuthProvider로 앱을 감싸기 (App.tsx에서)
//   2. 하위 컴포넌트에서 useAuth() 훅으로 인증 상태에 접근
//
// 인증 흐름:
//   로그인 → login(token) 호출 → localStorage에 저장 + 상태 업데이트
//   로그아웃 → logout() 호출 → localStorage에서 제거 + 상태 초기화
//   앱 시작 → localStorage에서 토큰 복원 → 로그인 상태 유지
// =============================================================================
import { createContext, useContext, useState, ReactNode } from 'react'

// AuthContextType: Context가 제공하는 값의 타입 정의
interface AuthContextType {
  token: string | null    // JWT 토큰 (null이면 미로그인)
  isAuthenticated: boolean // 로그인 상태 여부
  login: (token: string) => void   // 로그인 처리 함수
  logout: () => void               // 로그아웃 처리 함수
}

// createContext로 Context 객체 생성
// null은 Provider 바깥에서 사용될 때의 기본값 (실제로는 사용되지 않음)
const AuthContext = createContext<AuthContextType | null>(null)

// AuthProvider는 인증 상태를 관리하고 하위 컴포넌트에 제공하는 컴포넌트이다.
// App.tsx에서 전체 앱을 감싸서 사용한다.
export function AuthProvider({ children }: { children: ReactNode }) {
  // localStorage에서 기존 토큰을 읽어 초기값으로 설정
  // 이렇게 하면 페이지를 새로고침해도 로그인 상태가 유지된다.
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token')
  )

  // login: 로그인 성공 시 호출. 토큰을 저장한다.
  const login = (newToken: string) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
  }

  // logout: 로그아웃 시 호출. 토큰을 제거한다.
  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: token !== null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// useAuth는 AuthContext에 접근하기 위한 커스텀 훅이다.
// 하위 컴포넌트에서 const { token, login, logout } = useAuth() 형태로 사용한다.
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

- [ ] **Step 3: ProtectedRoute 작성**

`frontend/src/components/ProtectedRoute.tsx`:
```tsx
// =============================================================================
// ProtectedRoute.tsx - 인증 필요 라우트 가드 컴포넌트
// =============================================================================
// 이 컴포넌트는 로그인하지 않은 사용자가 보호된 페이지에 접근하는 것을 막는다.
//
// 동작 원리:
//   - AuthContext에서 로그인 상태를 확인한다
//   - 로그인됨: children(감싸진 컴포넌트)을 그대로 렌더링
//   - 미로그인: /login 페이지로 리다이렉트
//
// 사용 예시 (App.tsx):
//   <Route path="/" element={<ProtectedRoute><UserListPage /></ProtectedRoute>} />
// =============================================================================
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ReactNode } from 'react'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()

  // 인증되지 않았으면 로그인 페이지로 리다이렉트
  // replace: 브라우저 히스토리에 현재 URL을 남기지 않음
  //          (뒤로가기 시 보호된 페이지로 돌아가지 않도록)
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // 인증되었으면 자식 컴포넌트를 그대로 렌더링
  return <>{children}</>
}
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add frontend/src/api/ frontend/src/context/ frontend/src/components/
git commit -m "feat: AuthContext + API Client + ProtectedRoute"
```

---

## Task 10: 로그인/회원가입 페이지

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/RegisterPage.tsx`
- Create: `frontend/src/pages/LoginPage.module.css`
- Create: `frontend/src/pages/RegisterPage.module.css`

- [ ] **Step 1: LoginPage 작성**

`frontend/src/pages/LoginPage.tsx`:
```tsx
// =============================================================================
// LoginPage.tsx - 로그인 페이지 컴포넌트
// =============================================================================
// 이메일과 비밀번호를 입력받아 로그인 API를 호출하는 페이지이다.
//
// 동작 흐름:
//   1. 사용자가 이메일/비밀번호 입력
//   2. 폼 제출(submit) → handleSubmit 실행
//   3. POST /api/auth/login 호출
//   4. 성공: JWT 토큰을 AuthContext에 저장 → 메인 페이지(/)로 이동
//   5. 실패: 에러 메시지 표시
//
// React 상태 관리:
//   - useState: 폼 입력값, 에러 메시지, 로딩 상태를 관리
//   - useNavigate: 프로그래밍 방식으로 페이지 이동
// =============================================================================
import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'
import { LoginResponse } from '../types'
import styles from './LoginPage.module.css'

export function LoginPage() {
  // 폼 입력값 상태
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // 에러 메시지 상태 (로그인 실패 시 표시)
  const [error, setError] = useState('')
  // 로딩 상태 (API 호출 중 버튼 비활성화)
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  // handleSubmit: 폼 제출 시 실행되는 함수
  // FormEvent: HTML form 태그의 submit 이벤트 타입
  const handleSubmit = async (e: FormEvent) => {
    // 기본 폼 제출 동작(페이지 새로고침)을 막는다
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 백엔드 로그인 API 호출
      const data = await apiClient.post<LoginResponse>('/api/auth/login', {
        email,
        password,
      })
      // AuthContext에 토큰 저장 (localStorage + 상태 업데이트)
      login(data.token)
      // 메인 페이지로 이동
      navigate('/')
    } catch (err) {
      // 에러 메시지 표시
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <h1>로그인</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.field}>
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
      <p>
        계정이 없으신가요? <Link to="/register">회원가입</Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 2: LoginPage CSS 작성**

`frontend/src/pages/LoginPage.module.css`:
```css
/* LoginPage.module.css - 로그인 페이지 스타일 */
/* CSS Modules: 클래스명이 자동으로 고유하게 변환되어 다른 컴포넌트와 충돌하지 않음 */

.container {
  max-width: 400px;
  margin: 80px auto;
  padding: 24px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field label {
  font-weight: 600;
  font-size: 14px;
}

.field input {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 16px;
}

.error {
  color: #e53e3e;
  background: #fff5f5;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
}

button {
  padding: 10px;
  background: #3182ce;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

- [ ] **Step 3: RegisterPage 작성**

`frontend/src/pages/RegisterPage.tsx`:
```tsx
// =============================================================================
// RegisterPage.tsx - 회원가입 페이지 컴포넌트
// =============================================================================
// 이름, 이메일, 비밀번호를 입력받아 회원가입 API를 호출하는 페이지이다.
//
// 동작 흐름:
//   1. 사용자가 이름/이메일/비밀번호 입력
//   2. 폼 제출 → handleSubmit 실행
//   3. POST /api/auth/register 호출
//   4. 성공: 로그인 페이지로 이동 (자동 로그인은 하지 않음)
//   5. 실패: 에러 메시지 표시 (이메일 중복 등)
// =============================================================================
import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import { User } from '../types'
import styles from './RegisterPage.module.css'

export function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await apiClient.post<User>('/api/auth/register', {
        email,
        password,
        name,
      })
      // 회원가입 성공 → 로그인 페이지로 이동
      // 자동 로그인 대신 직접 로그인하게 함 (보안상 더 안전한 패턴)
      navigate('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <h1>회원가입</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.field}>
          <label htmlFor="name">이름</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? '가입 중...' : '회원가입'}
        </button>
      </form>
      <p>
        이미 계정이 있으신가요? <Link to="/login">로그인</Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 4: RegisterPage CSS 작성**

`frontend/src/pages/RegisterPage.module.css`:
```css
/* RegisterPage.module.css - 회원가입 페이지 스타일 */
/* LoginPage와 동일한 구조. 일관된 UX를 위해 같은 레이아웃 사용. */

.container {
  max-width: 400px;
  margin: 80px auto;
  padding: 24px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field label {
  font-weight: 600;
  font-size: 14px;
}

.field input {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 16px;
}

.error {
  color: #e53e3e;
  background: #fff5f5;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
}

button {
  padding: 10px;
  background: #3182ce;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/LoginPage.module.css frontend/src/pages/RegisterPage.tsx frontend/src/pages/RegisterPage.module.css
git commit -m "feat: 로그인/회원가입 페이지"
```

---

## Task 11: 유저 목록/상세 페이지

**Files:**
- Create: `frontend/src/pages/UserListPage.tsx`
- Create: `frontend/src/pages/UserListPage.module.css`
- Create: `frontend/src/pages/UserDetailPage.tsx`
- Create: `frontend/src/pages/UserDetailPage.module.css`

- [ ] **Step 1: UserListPage 작성**

`frontend/src/pages/UserListPage.tsx`:
```tsx
// =============================================================================
// UserListPage.tsx - 유저 목록 페이지
// =============================================================================
// 로그인한 사용자가 볼 수 있는 메인 페이지이다.
// 모든 유저를 테이블 형태로 표시하고, 각 유저를 클릭하면 상세 페이지로 이동한다.
//
// React 생명주기:
//   1. 컴포넌트 마운트 → useEffect 실행 → API 호출
//   2. API 응답 → useState로 유저 목록 저장 → 화면 렌더링
//   3. 유저 클릭 → navigate()로 상세 페이지 이동
//
// useEffect란?
//   컴포넌트가 화면에 나타난 후(마운트) 실행되는 함수.
//   API 호출 같은 부수 효과(side effect)를 처리하는 데 사용한다.
//   빈 배열([])을 전달하면 최초 1회만 실행된다.
// =============================================================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'
import { User } from '../types'
import styles from './UserListPage.module.css'

export function UserListPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const { logout } = useAuth()
  const navigate = useNavigate()

  // 컴포넌트 마운트 시 유저 목록을 API에서 가져온다
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await apiClient.get<User[]>('/api/users')
        setUsers(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users')
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, []) // 빈 배열: 최초 1회만 실행

  if (loading) return <div className={styles.container}>로딩 중...</div>
  if (error) return <div className={styles.container}>에러: {error}</div>

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>유저 목록</h1>
        <button onClick={logout} className={styles.logoutBtn}>로그아웃</button>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>이름</th>
            <th>이메일</th>
            <th>가입일</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              onClick={() => navigate(`/users/${user.id}`)}
              className={styles.row}
            >
              <td>{user.id}</td>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr><td colSpan={4}>유저가 없습니다.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: UserListPage CSS 작성**

`frontend/src/pages/UserListPage.module.css`:
```css
.container {
  max-width: 800px;
  margin: 40px auto;
  padding: 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.logoutBtn {
  background: #e53e3e;
  padding: 8px 16px;
  font-size: 14px;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.table th {
  background: #f7fafc;
  font-weight: 600;
}

.row {
  cursor: pointer;
}

.row:hover {
  background: #edf2f7;
}
```

- [ ] **Step 3: UserDetailPage 작성**

`frontend/src/pages/UserDetailPage.tsx`:
```tsx
// =============================================================================
// UserDetailPage.tsx - 유저 상세/수정/삭제 페이지
// =============================================================================
// 특정 유저의 정보를 조회하고, 수정하거나 삭제할 수 있는 페이지이다.
//
// URL 파라미터:
//   /users/:id에서 :id 부분을 useParams() 훅으로 추출한다.
//
// 동작 모드:
//   - 조회 모드: 유저 정보를 읽기 전용으로 표시
//   - 수정 모드: editing 상태가 true일 때 입력 필드 활성화
//
// 수정 흐름: 수정 버튼 → 입력 필드 활성화 → 저장 → PUT API 호출 → 결과 반영
// 삭제 흐름: 삭제 버튼 → confirm 확인 → DELETE API 호출 → 목록 페이지로 이동
// =============================================================================
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import { User } from '../types'
import styles from './UserDetailPage.module.css'

export function UserDetailPage() {
  // useParams: URL에서 :id 파라미터 추출
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 수정 모드 상태
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')

  // 컴포넌트 마운트 시 유저 정보 조회
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await apiClient.get<User>(`/api/users/${id}`)
        setUser(data)
        setEditName(data.name)
        setEditEmail(data.email)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch user')
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [id])

  // handleUpdate: 유저 정보 수정
  const handleUpdate = async () => {
    try {
      const updated = await apiClient.put<User>(`/api/users/${id}`, {
        name: editName,
        email: editEmail,
      })
      setUser(updated)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    }
  }

  // handleDelete: 유저 삭제
  const handleDelete = async () => {
    // confirm: 브라우저 기본 확인 다이얼로그
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      await apiClient.delete(`/api/users/${id}`)
      navigate('/') // 목록 페이지로 이동
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  if (loading) return <div className={styles.container}>로딩 중...</div>
  if (error) return <div className={styles.container}>에러: {error}</div>
  if (!user) return <div className={styles.container}>유저를 찾을 수 없습니다.</div>

  return (
    <div className={styles.container}>
      <button onClick={() => navigate('/')} className={styles.backBtn}>
        ← 목록으로
      </button>

      <h1>유저 상세</h1>

      {editing ? (
        // 수정 모드: 입력 필드 표시
        <div className={styles.form}>
          <div className={styles.field}>
            <label>이름</label>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>이메일</label>
            <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
          </div>
          <div className={styles.actions}>
            <button onClick={handleUpdate}>저장</button>
            <button onClick={() => setEditing(false)} className={styles.cancelBtn}>취소</button>
          </div>
        </div>
      ) : (
        // 조회 모드: 읽기 전용 표시
        <div className={styles.info}>
          <p><strong>ID:</strong> {user.id}</p>
          <p><strong>이름:</strong> {user.name}</p>
          <p><strong>이메일:</strong> {user.email}</p>
          <p><strong>가입일:</strong> {new Date(user.created_at).toLocaleString()}</p>
          <p><strong>수정일:</strong> {new Date(user.updated_at).toLocaleString()}</p>
          <div className={styles.actions}>
            <button onClick={() => setEditing(true)}>수정</button>
            <button onClick={handleDelete} className={styles.deleteBtn}>삭제</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: UserDetailPage CSS 작성**

`frontend/src/pages/UserDetailPage.module.css`:
```css
.container {
  max-width: 600px;
  margin: 40px auto;
  padding: 24px;
}

.backBtn {
  background: none;
  color: #3182ce;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  margin-bottom: 16px;
}

.info p {
  margin: 8px 0;
  font-size: 16px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field label {
  font-weight: 600;
  font-size: 14px;
}

.field input {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 16px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.cancelBtn {
  background: #718096;
}

.deleteBtn {
  background: #e53e3e;
}
```

- [ ] **Step 5: 프론트엔드 빌드 확인**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test/frontend
npm run build
```

Expected: 빌드 성공 (dist/ 디렉토리 생성)

- [ ] **Step 6: Commit**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add frontend/src/pages/
git commit -m "feat: 유저 목록/상세 페이지"
```

---

## Task 12: Frontend Dockerfile + Vite 기본 파일 정리

**Files:**
- Create: `frontend/Dockerfile`
- Modify: cleanup Vite default files

- [ ] **Step 1: Frontend Dockerfile 작성**

`frontend/Dockerfile`:
```dockerfile
# =============================================================================
# Frontend Dockerfile
# =============================================================================
# 개발 모드: Vite dev server로 HMR(Hot Module Replacement) 지원
# 프로덕션: npm run build → nginx로 정적 파일 서빙
#
# 이 Dockerfile은 개발 모드용이다.
# 프로덕션용은 별도의 Dockerfile.prod를 만들 수 있다.
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# 의존성 먼저 설치 (캐싱 최적화)
COPY package.json package-lock.json ./
RUN npm ci

# 소스코드 복사
COPY . .

EXPOSE 5173

# Vite 개발 서버 실행
# --host: Docker 컨테이너 밖에서 접근 가능하도록 모든 인터페이스에 바인딩
CMD ["npm", "run", "dev", "--", "--host"]
```

- [ ] **Step 2: Vite 기본 파일 정리**

Vite가 생성한 기본 CSS/SVG 파일을 정리한다:
- `frontend/src/App.css` 삭제
- `frontend/src/index.css`는 기본 리셋 스타일만 남김
- `frontend/src/assets/react.svg` 삭제

`frontend/src/index.css`:
```css
/* =============================================================================
   index.css - 글로벌 리셋 및 기본 스타일
   ============================================================================= */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #1a202c;
  background: #ffffff;
}

a {
  color: #3182ce;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
```

- [ ] **Step 3: 빌드 확인**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test/frontend
npm run build
```

Expected: 빌드 성공

- [ ] **Step 4: Commit**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add frontend/Dockerfile frontend/src/index.css
git rm frontend/src/App.css frontend/src/assets/react.svg 2>/dev/null || true
git commit -m "feat: Frontend Dockerfile + 기본 파일 정리"
```

---

## Task 13: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: CI 워크플로우 작성**

`.github/workflows/ci.yml`:
```yaml
# =============================================================================
# GitHub Actions CI 워크플로우
# =============================================================================
# 이 파일은 코드가 push되거나 PR이 생성될 때 자동으로 테스트와 빌드를 실행한다.
#
# GitHub Actions란?
#   - GitHub에서 제공하는 CI/CD 서비스
#   - 코드 변경 시 자동으로 테스트, 빌드, 배포 등을 실행
#   - .github/workflows/ 디렉토리의 YAML 파일로 설정
#
# 트리거: main 브랜치에 push 또는 PR 생성/업데이트 시
# =============================================================================

name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # ---------------------------------------------------------------------------
  # 백엔드 (Go) 테스트 및 빌드
  # ---------------------------------------------------------------------------
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./backend

    steps:
      - uses: actions/checkout@v4

      - name: Go 환경 설정
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: 의존성 다운로드
        run: go mod download

      - name: 테스트 실행
        run: go test ./... -v

      - name: 빌드 확인
        run: go build ./cmd/server

  # ---------------------------------------------------------------------------
  # 프론트엔드 (React) 린트 및 빌드
  # ---------------------------------------------------------------------------
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./frontend

    steps:
      - uses: actions/checkout@v4

      - name: Node.js 환경 설정
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: 의존성 설치
        run: npm ci

      - name: 린트 검사
        run: npm run lint

      - name: 빌드 확인
        run: npm run build
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add .github/workflows/ci.yml
git commit -m "feat: GitHub Actions CI 워크플로우"
```

---

## Task 14: Claude Code 설정 + CLAUDE.md

**Files:**
- Create: `.claude/settings.json`
- Create: `CLAUDE.md`

- [ ] **Step 1: .claude/settings.json 작성**

```bash
mkdir -p /Volumes/data/claude-vibe-workspace/harness-fullstack-test/.claude
```

`.claude/settings.json`:
```json
{
  "permissions": {
    "allow": [
      "Bash(go:*)",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(docker:*)",
      "Bash(docker compose:*)",
      "Bash(curl:*)",
      "Bash(mkdir:*)",
      "Bash(ls:*)"
    ]
  }
}
```

- [ ] **Step 2: CLAUDE.md 작성**

`CLAUDE.md`:
```markdown
# Harness Fullstack Test

풀스택 보일러플레이트 프로젝트: React + Vite (프론트엔드) + Go + Gin (백엔드) + PostgreSQL.

## 프로젝트 구조

- `frontend/` - React + Vite + TypeScript (SPA)
- `backend/` - Go + Gin (REST API)
- `docker-compose.yml` - 전체 스택 로컬 실행

## 개발 명령어

### 백엔드
- `cd backend && go run ./cmd/server` - 서버 실행
- `cd backend && go test ./...` - 테스트 실행
- `cd backend && go build ./cmd/server` - 빌드

### 프론트엔드
- `cd frontend && npm run dev` - 개발 서버
- `cd frontend && npm run build` - 프로덕션 빌드
- `cd frontend && npm run lint` - 린트

### Docker
- `docker compose up` - 전체 스택 실행
- `docker compose up db -d` - DB만 실행
- `docker compose down` - 종료
- `docker compose down -v` - 종료 + 데이터 삭제

## 아키텍처

```
[React SPA] → /api/* → [Vite Proxy] → [Gin Server] → [PostgreSQL]
```

백엔드 레이어: Handler → Service → Repository → DB

## API

- `POST /api/auth/register` - 회원가입 (공개)
- `POST /api/auth/login` - 로그인 → JWT (공개)
- `GET /api/users` - 유저 목록 (인증)
- `GET /api/users/:id` - 유저 상세 (인증)
- `PUT /api/users/:id` - 유저 수정 (인증)
- `DELETE /api/users/:id` - 유저 삭제 (인증)

## 주석 규칙

모든 코드에 한국어 학습용 상세 주석 포함:
- 파일 상단: 역할, 시스템 내 위치
- 함수: 목적, 파라미터, 흐름
- 설계 의도: "왜 이렇게 하는지"
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add .claude/settings.json CLAUDE.md
git commit -m "feat: Claude Code 설정 + CLAUDE.md 프로젝트 문서"
```

---

## Task 15: 전체 스택 통합 테스트

**Files:** 없음 (실행 + 검증)

- [ ] **Step 1: 전체 스택 Docker Compose 실행**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
docker compose up --build -d
```

Expected: db, backend, frontend 3개 서비스 모두 실행

- [ ] **Step 2: 헬스체크**

```bash
curl http://localhost:8080/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: 회원가입 테스트**

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456","name":"테스트유저"}'
```

Expected: 201 + user 객체

- [ ] **Step 4: 로그인 테스트**

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'
```

Expected: 200 + `{"token":"eyJ..."}`

- [ ] **Step 5: 인증된 API 테스트**

토큰을 사용하여 유저 목록 조회:
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}' | jq -r '.token')

curl http://localhost:8080/api/users -H "Authorization: Bearer $TOKEN"
```

Expected: 200 + 유저 배열

- [ ] **Step 6: 프론트엔드 접속 확인**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

Expected: 200

- [ ] **Step 7: 정리**

```bash
docker compose down
```

- [ ] **Step 8: 최종 Commit**

```bash
cd /Volumes/data/claude-vibe-workspace/harness-fullstack-test
git add -A
git commit -m "chore: 전체 스택 통합 테스트 완료"
```
