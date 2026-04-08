---
name: qa-verify
description: "풀스택 프로젝트의 통합 정합성을 검증하는 QA 스킬. 백엔드 API 응답 shape과 프론트 타입 교차 비교, URL 라우트 매핑, 인증 흐름 완전성, 빌드 확인, 주석 검증을 수행. QA 검증, 통합 테스트, 정합성 확인, 빌드 확인 요청 시 이 스킬을 사용. 코드 검수, 크로스 체크, 버그 찾기 요청에도 사용."
---

# QA Verification Skill

풀스택 프로젝트의 통합 정합성을 검증하는 전문 스킬. "존재 확인"이 아니라 **경계면 교차 비교**를 핵심으로 한다.

## 검증 순서

1. **빌드 검증**: Go 백엔드 빌드, React 프론트엔드 빌드
2. **API 경계면 검증**: 백엔드 응답 shape ↔ 프론트 타입/호출
3. **인증 흐름 검증**: 전체 인증 경로의 연속성
4. **URL 라우트 검증**: React Router ↔ 실제 페이지 ↔ 링크
5. **주석 검증**: 한국어 학습용 주석 포함 여부
6. **인프라 검증**: Docker Compose, CI 설정 일관성

## 핵심 원칙: 경계면 교차 비교

개별 파일이 "올바른지"가 아니라, 두 파일이 만나는 지점에서 계약이 일치하는지 검증한다.

**올바른 검증:**
```
Backend handler/auth_handler.go:
  c.JSON(200, gin.H{"token": token})
                         ↕ 비교
Frontend context/AuthContext.tsx:
  const { token } = await response.json()
```

**잘못된 검증:**
```
"auth_handler.go가 존재하는가?" ← 이것은 QA가 아니다
```

## 1. 빌드 검증

```bash
# 백엔드
cd backend && go build ./cmd/server

# 프론트엔드
cd frontend && npm run build
```

빌드 실패 시 에러 메시지를 보고서에 기록하고, 담당 에이전트에게 수정 요청.

## 2. API 경계면 검증

### 2-1. API 응답 shape ↔ 프론트 타입

각 API 엔드포인트에 대해:

1. `backend/internal/handler/`에서 `c.JSON()` 호출부 찾기
2. 반환하는 데이터의 필드명과 타입 추출
3. `frontend/src/types.ts`의 대응 타입 정의와 비교
4. `frontend/src/api/client.ts`의 호출 URL과 매칭

**확인 항목:**
- 필드명 대소문자 일치 (Go의 `json:"name"` 태그 ↔ TS 타입의 `name`)
- 배열/객체 래핑 여부 (API가 배열 직접 반환 vs `{data: [...]}` 래핑)
- 숫자/문자열 타입 일치

### 2-2. API 엔드포인트 ↔ 프론트 호출 1:1 매핑

| 백엔드 라우트 | 프론트 호출 위치 | 매핑 상태 |
|-------------|---------------|----------|
| POST /api/auth/register | RegisterPage → api/client | ? |
| POST /api/auth/login | LoginPage → api/client | ? |
| GET /api/users | UserListPage → api/client | ? |
| GET /api/users/:id | UserDetailPage → api/client | ? |
| PUT /api/users/:id | UserDetailPage → api/client | ? |
| DELETE /api/users/:id | UserDetailPage → api/client | ? |

## 3. 인증 흐름 검증

연속된 5단계를 추적한다:

```
1. RegisterPage 폼 데이터 → POST /api/auth/register 요청 body shape 일치?
2. LoginPage 폼 데이터 → POST /api/auth/login 요청 body shape 일치?
3. 로그인 응답의 token 필드 → AuthContext가 읽는 필드명 일치?
4. AuthContext → localStorage 저장 → api/client.ts의 토큰 읽기 경로 연속?
5. api/client.ts Authorization 헤더 형식 → middleware/auth_middleware.go 파싱 형식 일치?
```

하나라도 끊기면 인증이 실패한다. 각 단계의 코드 위치(파일:줄)를 명시하여 보고.

## 4. URL 라우트 검증

1. `App.tsx`의 Route path 목록 추출
2. 각 path에 대응하는 페이지 컴포넌트 확인
3. 코드 내 모든 `navigate()`, `<Link to="">` 값이 실제 Route와 매칭되는지
4. ProtectedRoute가 인증 필요 페이지에 적용되어 있는지

## 5. 주석 검증

모든 `.go`, `.ts`, `.tsx` 파일에 대해:

- [ ] 파일 상단 블록 주석 (역할, 위치, 관계)
- [ ] 함수/컴포넌트별 주석 (목적, 파라미터, 흐름)
- [ ] 설계 의도 주석 ("왜 이렇게 하는지")

주석이 없는 파일 목록을 보고서에 기록.

## 6. 인프라 검증

- docker-compose.yml의 환경변수 ↔ config.go의 환경변수 목록 일치?
- Dockerfile의 COPY 경로 ↔ 실제 파일 구조 일치?
- CI의 빌드 명령어 ↔ 실제 빌드 명령어 일치?

## 보고서 형식

보고서를 `_workspace/qa_report.md`에 작성한다:

```markdown
# QA 검증 보고서

## 빌드 검증
- Backend: PASS/FAIL (에러 메시지)
- Frontend: PASS/FAIL (에러 메시지)

## API 경계면 검증
| 엔드포인트 | 백엔드 shape | 프론트 타입 | 일치 | 불일치 상세 |
|-----------|-------------|-----------|------|-----------|

## 인증 흐름 검증
| 단계 | 소스 파일:줄 | 대상 파일:줄 | 일치 | 불일치 상세 |
|------|-----------|-----------|------|-----------|

## URL 라우트 검증
| 라우트 | 페이지 | ProtectedRoute | 링크 매칭 |
|--------|--------|---------------|----------|

## 주석 검증
- 주석 누락 파일: [목록]

## 인프라 검증
- Docker: PASS/FAIL
- CI: PASS/FAIL

## 요약
- 발견된 불일치: N건
- 수정 필요 항목: [목록]
```
