---
name: backend-build
description: "Go(Gin) + PostgreSQL 백엔드를 구현하는 스킬. User CRUD API, JWT 인증(bcrypt + golang-jwt), 미들웨어, DB 마이그레이션, Handler→Service→Repository 레이어 구조를 포함. 백엔드 구현, Go 서버 작성, API 개발, 인증 구현, DB 연동 요청 시 이 스킬을 사용. 백엔드 수정, API 보완, 서비스 로직 변경, 재빌드 요청에도 사용."
---

# Backend Build Skill

Go(Gin) 백엔드를 구현하는 전문 스킬. 설계 스펙과 구현 계획을 기반으로 체계적으로 코드를 작성한다.

## 구현 순서

다음 순서로 구현한다. 각 단계는 이전 단계에 의존하므로 순서를 지킨다:

1. **프로젝트 초기화**: go mod init, 디렉토리 구조, 최소 main.go
2. **환경설정 + 마이그레이션**: config.go (환경변수 로드), 001_create_users.sql
3. **데이터 모델**: model/user.go (User 구조체, DTO)
4. **Repository**: repository/user_repository.go (PostgreSQL CRUD 쿼리)
5. **Auth Service**: service/auth_service.go (bcrypt 해싱, JWT 생성/검증)
6. **User Service**: service/user_service.go (유저 비즈니스 로직)
7. **미들웨어**: middleware/auth_middleware.go (JWT 토큰 검증)
8. **핸들러**: handler/auth_handler.go + handler/user_handler.go
9. **main.go 완성**: DB 연결, 라우터 조립, 서버 시작

## 참조 문서

구현 전 반드시 다음 문서를 읽는다:
- 설계 스펙: `docs/superpowers/specs/2026-04-08-fullstack-harness-design.md`
- 구현 계획 (Task 1~7): `docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md`

구현 계획의 각 Step에 작성된 코드 예시와 주석을 정확히 따른다.

## 레이어 규칙

```
HTTP 요청 → Router → Middleware(JWT) → Handler → Service → Repository → DB
```

| 레이어 | 책임 | 금지 사항 |
|--------|------|----------|
| Handler | HTTP 파싱, 응답 생성 | 비즈니스 로직, SQL 쿼리 |
| Service | 비즈니스 로직, 유효성 검사 | HTTP 관련 코드, 직접 SQL |
| Repository | SQL 쿼리 실행 | 비즈니스 로직, HTTP 코드 |

## 주석 규칙

모든 코드 파일에 한국어 학습용 상세 주석을 포함한다:

- **파일 상단**: 해당 파일의 역할, 시스템 내 위치, 다른 파일과의 관계를 블록 주석으로 작성
- **함수마다**: 목적, 파라미터, 반환값, 호출 흐름을 주석으로 설명
- **인증/비즈니스 로직**: 단계별 흐름을 번호 매겨 설명
- **설계 의도**: "왜 이렇게 하는지"를 포함 (예: "bcrypt를 사용하는 이유는...")

## API 응답 형식

```go
// 성공 응답
c.JSON(http.StatusOK, user)           // 단일 객체
c.JSON(http.StatusOK, users)          // 배열
c.JSON(http.StatusCreated, user)      // 생성

// 에러 응답 — 항상 이 형태를 사용
c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 요청입니다"})
c.JSON(http.StatusUnauthorized, gin.H{"error": "인증이 필요합니다"})
```

## 빌드 확인

각 구현 단계 완료 후 빌드를 확인한다:

```bash
cd backend && go build ./cmd/server
```

에러 발생 시 수정 후 재빌드.

## RBAC (Role-Based Access Control)

역할 기반 접근 제어를 구현한다. 현재 `isOwner()` 단순 비교를 역할 기반 권한 체크로 확장한다.

### 역할 모델

```go
// model/role.go
type Role string

const (
    RoleUser  Role = "user"   // 기본 역할 — 본인 리소스만 접근
    RoleAdmin Role = "admin"  // 관리자 — 모든 유저 리소스 접근 가능
)
```

**설계 원칙:**
- **단순 역할 모델 우선**: users 테이블에 `role` 컬럼 추가 (VARCHAR, 기본값 `'user'`). 별도 roles 테이블이나 user_roles 조인 테이블은 역할이 3개 이상 필요해질 때 도입한다.
- **왜 조인 테이블이 아닌가?** 현재는 user/admin 2가지뿐이다. YAGNI 원칙에 따라 단순 컬럼으로 시작하고, 복합 권한이 필요해질 때 확장한다.

### DB 마이그레이션

```sql
-- migrations/003_add_role_to_users.sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';

-- 기존 유저는 모두 'user' 역할을 가진다.
-- 최초 admin은 DB에서 직접 UPDATE로 지정하거나, seed 스크립트를 사용한다.
-- ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
```

### JWT Claims 확장

```go
// service/auth_service.go — JWTClaims에 Role 추가
type JWTClaims struct {
    UserID int    `json:"user_id"`
    Email  string `json:"email"`
    Role   string `json:"role"`    // 역할 정보 추가
    jwt.RegisteredClaims
}

// generateToken에서 Role을 포함시킨다
claims := &JWTClaims{
    UserID: user.ID,
    Email:  user.Email,
    Role:   string(user.Role),
    // ...
}
```

### RBAC 미들웨어

```go
// middleware/rbac_middleware.go

// RequireRole은 특정 역할을 가진 사용자만 접근할 수 있도록 하는 미들웨어이다.
// AuthMiddleware 이후에 체이닝하여 사용한다.
//
// 사용 예시:
//   adminOnly := protected.Group("")
//   adminOnly.Use(middleware.RequireRole("admin"))
//   adminOnly.DELETE("/users/:id", userHandler.Delete)
func RequireRole(roles ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userRole, exists := c.Get("user_role")
        if !exists {
            c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
            c.Abort()
            return
        }
        for _, r := range roles {
            if userRole.(string) == r {
                c.Next()
                return
            }
        }
        c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
        c.Abort()
    }
}

// RequireOwnerOrRole은 리소스 소유자이거나 특정 역할을 가진 사용자만 접근을 허용한다.
// URL 파라미터 :id와 토큰의 user_id를 비교하고, 불일치하면 역할을 확인한다.
// 이 패턴으로 "본인 또는 admin"을 구현한다.
func RequireOwnerOrRole(roles ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. 본인 확인
        id, _ := strconv.Atoi(c.Param("id"))
        currentUserID, _ := c.Get("user_id")
        if currentUserID.(int) == id {
            c.Next()
            return
        }
        // 2. 역할 확인 (본인이 아닌 경우)
        userRole, _ := c.Get("user_role")
        for _, r := range roles {
            if userRole.(string) == r {
                c.Next()
                return
            }
        }
        c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
        c.Abort()
    }
}
```

### AuthMiddleware 수정

```go
// auth_middleware.go — Context에 role도 저장한다
c.Set("user_id", claims.UserID)
c.Set("user_email", claims.Email)
c.Set("user_role", claims.Role)  // 역할 정보 추가
```

### 라우팅 패턴

```go
// main.go — 역할별 라우트 그룹
protected := api.Group("")
protected.Use(middleware.AuthMiddleware(authService))
{
    // 인증된 사용자 모두 접근 가능
    protected.GET("/users", userHandler.GetAll)
    protected.GET("/users/me", userHandler.GetMe)     // 본인 정보 조회

    // 본인 또는 admin만 접근 가능
    ownerOrAdmin := protected.Group("")
    ownerOrAdmin.Use(middleware.RequireOwnerOrRole("admin"))
    {
        ownerOrAdmin.GET("/users/:id", userHandler.GetByID)
        ownerOrAdmin.PUT("/users/:id", userHandler.Update)
    }

    // admin 전용
    adminOnly := protected.Group("")
    adminOnly.Use(middleware.RequireRole("admin"))
    {
        adminOnly.DELETE("/users/:id", userHandler.Delete)
    }
}
```

### User 모델 확장

```go
// model/user.go — Role 필드 추가
type User struct {
    ID           int       `json:"id"`
    Email        string    `json:"email"`
    PasswordHash string    `json:"-"`
    Name         string    `json:"name"`
    Role         Role      `json:"role"`     // 역할: "user" | "admin"
    CreatedAt    time.Time `json:"created_at"`
    UpdatedAt    time.Time `json:"updated_at"`
}
```

### Repository 쿼리 수정

모든 SELECT 쿼리에 `role` 컬럼을 포함하고, `Scan()`에서 `&user.Role`을 추가한다.
Register(Create)는 역할을 지정하지 않으면 DB 기본값(`'user'`)이 적용된다.

### API 응답에 role 포함

```json
// GET /api/users/:id 응답 예시
{
  "id": 1,
  "email": "admin@example.com",
  "name": "관리자",
  "role": "admin",
  "created_at": "2026-04-09T12:00:00Z",
  "updated_at": "2026-04-09T12:00:00Z"
}

// POST /api/auth/login 응답 — JWT에 role 포함
{
  "token": "eyJ..."  // payload에 role 클레임 포함
}
```

## 환경변수

| 변수 | 용도 | 기본값 |
|------|------|-------|
| DB_HOST | PostgreSQL 호스트 | localhost |
| DB_PORT | PostgreSQL 포트 | 5432 |
| DB_USER | DB 사용자 | harness |
| DB_PASSWORD | DB 비밀번호 | harness |
| DB_NAME | DB 이름 | harness |
| JWT_SECRET | JWT 서명 키 | dev-secret-key |
| SERVER_PORT | 서버 포트 | 8080 |
