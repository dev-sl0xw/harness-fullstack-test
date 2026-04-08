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
