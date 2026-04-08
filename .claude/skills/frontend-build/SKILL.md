---
name: frontend-build
description: "React + Vite + TypeScript 프론트엔드를 구현하는 스킬. JWT 인증(AuthContext + localStorage), React Router v6, fetch wrapper API 클라이언트, CSS Modules, 로그인/회원가입/유저목록/유저상세 페이지를 포함. 프론트엔드 구현, React 페이지 작성, 인증 UI, 유저 관리 UI 요청 시 이 스킬을 사용. 프론트엔드 수정, 페이지 보완, 스타일 변경 요청에도 사용."
---

# Frontend Build Skill

React + Vite + TypeScript 프론트엔드를 구현하는 전문 스킬. 설계 스펙과 구현 계획을 기반으로 체계적으로 코드를 작성한다.

## 구현 순서

다음 순서로 구현한다:

1. **프로젝트 초기화**: Vite + React + TypeScript, 의존성 설치
2. **기본 설정**: vite.config.ts (API 프록시), tsconfig.json
3. **타입 정의**: types.ts (User, AuthResponse, LoginRequest 등)
4. **API 클라이언트**: api/client.ts (fetch wrapper + 토큰 자동 첨부)
5. **AuthContext**: context/AuthContext.tsx (JWT 관리, 로그인/로그아웃)
6. **ProtectedRoute**: components/ProtectedRoute.tsx (인증 라우트 가드)
7. **라우팅**: App.tsx (React Router v6 설정)
8. **로그인/회원가입 페이지**: pages/LoginPage.tsx, RegisterPage.tsx
9. **유저 목록/상세 페이지**: pages/UserListPage.tsx, UserDetailPage.tsx
10. **엔트리포인트**: main.tsx

## 참조 문서

구현 전 반드시 다음 문서를 읽는다:
- 설계 스펙: `docs/superpowers/specs/2026-04-08-fullstack-harness-design.md`
- 구현 계획 (Task 8~12): `docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md`

구현 계획의 각 Step에 작성된 코드 예시와 주석을 정확히 따른다.

## 기술 선택

| 영역 | 선택 | 이유 |
|------|------|------|
| 라우팅 | React Router v6 | 선언적 라우팅, 중첩 라우트 지원 |
| HTTP | fetch wrapper (직접 구현) | 외부 의존성 최소화, 학습 목적 |
| 상태 관리 | useState + useContext | 소규모 앱에 적합, Redux 불필요 |
| 스타일 | CSS Modules | 스코프 격리, 클래스 충돌 방지 |
| 토큰 저장 | localStorage | 단순 구현, 학습 목적 |

## 인증 흐름

```
1. 로그인 성공 → JWT를 localStorage에 저장 + AuthContext 업데이트
2. API 호출 시 → api/client.ts에서 자동으로 Authorization: Bearer {token} 첨부
3. 토큰 없거나 API 401 응답 → /login으로 리다이렉트
4. 로그아웃 → localStorage에서 토큰 삭제 + AuthContext 초기화
```

## 주석 규칙

모든 코드 파일에 한국어 학습용 상세 주석을 포함한다:

- **파일 상단**: 해당 파일의 역할, 시스템 내 위치, 다른 파일과의 관계
- **컴포넌트마다**: 목적, props, 상태 관리 방식, 렌더링 흐름
- **훅/유틸리티**: 목적, 파라미터, 반환값, 사용 예시
- **설계 의도**: "왜 이렇게 하는지" 포함

## API 클라이언트 패턴

```typescript
// api/client.ts — 이 파일에서만 fetch를 호출한다
// 모든 API 호출은 이 래퍼를 통해 이루어지므로,
// 토큰 첨부와 에러 처리가 한 곳에서 관리된다

const API_BASE = '/api';  // Vite 프록시가 백엔드로 전달

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  // 1. 토큰이 있으면 Authorization 헤더에 첨부
  // 2. fetch 실행
  // 3. 응답 상태에 따라 에러 처리 (401 → 리다이렉트)
  // 4. JSON 파싱 후 반환
}
```

## 빌드 확인

구현 완료 후 빌드를 확인한다:

```bash
cd frontend && npm run build
```

에러 발생 시 수정 후 재빌드.

## 백엔드 API 의존성

프론트엔드가 호출하는 API 목록 (설계 스펙 기준):

| Method | Path | 용도 |
|--------|------|------|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 → JWT 반환 |
| GET | `/api/users` | 유저 목록 |
| GET | `/api/users/:id` | 유저 상세 |
| PUT | `/api/users/:id` | 유저 수정 |
| DELETE | `/api/users/:id` | 유저 삭제 |

backend-dev로부터 정확한 요청/응답 shape을 SendMessage로 확인한 뒤 구현한다. 미수신 시 설계 스펙을 참조하되, 수정 가능하도록 api/client.ts에 집중 관리한다.
