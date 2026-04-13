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

## RBAC (Role-Based Access Control)

백엔드의 역할 기반 접근 제어에 대응하여, 프론트엔드에서 역할별 UI 분기와 라우트 보호를 구현한다.

### 타입 확장

```typescript
// types.ts — User 타입에 role 추가
export interface User {
  id: number
  email: string
  name: string
  role: 'user' | 'admin'  // 역할 타입 추가
  created_at: string
  updated_at: string
}

// JWT 페이로드에서 추출하는 사용자 정보
export interface AuthUser {
  user_id: number
  email: string
  role: 'user' | 'admin'
}
```

### AuthContext 확장

```typescript
// context/AuthContext.tsx — 역할 정보를 Context에 포함
interface AuthContextType {
  token: string | null
  user: AuthUser | null       // JWT에서 디코딩한 사용자 정보
  isAuthenticated: boolean
  isAdmin: boolean            // 편의 getter: role === 'admin'
  hasRole: (role: string) => boolean  // 역할 체크 함수
  login: (token: string) => void
  logout: () => void
}

// JWT 디코딩 함수
function decodeToken(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return {
      user_id: payload.user_id,
      email: payload.email,
      role: payload.role || 'user',
    }
  } catch {
    return null
  }
}

// Provider 내부에서 token이 변경될 때 user를 재계산
const user = useMemo(() => token ? decodeToken(token) : null, [token])
const isAdmin = user?.role === 'admin'
const hasRole = useCallback((role: string) => user?.role === role, [user])
```

### RequireRole 라우트 가드

```typescript
// components/RequireRole.tsx
// 특정 역할을 가진 사용자만 접근할 수 있는 라우트 가드이다.
// ProtectedRoute(인증 여부)와 결합하여 사용한다.
//
// 사용 예시:
//   <ProtectedRoute>
//     <RequireRole role="admin">
//       <AdminPage />
//     </RequireRole>
//   </ProtectedRoute>

import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface RequireRoleProps {
  role: string
  children: ReactNode
  fallback?: string  // 권한 없을 때 이동할 경로 (기본: '/')
}

export function RequireRole({ role, children, fallback = '/' }: RequireRoleProps) {
  const { hasRole } = useAuth()

  if (!hasRole(role)) {
    return <Navigate to={fallback} replace />
  }

  return <>{children}</>
}
```

### 조건부 UI 렌더링 패턴

```tsx
// 역할에 따라 UI 요소를 표시/숨김한다.
// 백엔드에서 403으로 차단하더라도, 프론트에서 UI를 숨겨 사용자 혼란을 방지한다.

// 패턴 1: admin에게만 삭제 버튼 표시
{isAdmin && (
  <button onClick={handleDelete} className={styles.deleteButton}>
    삭제
  </button>
)}

// 패턴 2: 본인 또는 admin에게만 수정 폼 표시
{(isOwner || isAdmin) && (
  <form onSubmit={handleUpdate}>...</form>
)}

// 패턴 3: 역할에 따라 다른 네비게이션 메뉴
{isAdmin && <Link to="/admin">관리자 대시보드</Link>}
```

### UserDetailPage 수정 패턴

```tsx
// pages/UserDetailPage.tsx — isOwner 판단에 admin 역할 추가
const { user: authUser, isAdmin } = useAuth()
const isOwner = authUser?.user_id === Number(id)
const canEdit = isOwner || isAdmin  // 본인 또는 admin

// 수정/삭제 UI
{canEdit ? (
  <form onSubmit={handleUpdate}>
    {/* 수정 폼 */}
    {isAdmin && <button onClick={handleDelete}>삭제</button>}
  </form>
) : (
  <p>본인 또는 관리자만 수정할 수 있습니다.</p>
)}
```

### UserListPage 수정 패턴

```tsx
// pages/UserListPage.tsx — 테이블에 role 컬럼 추가
<thead>
  <tr>
    <th>ID</th>
    <th>이름</th>
    <th>이메일</th>
    <th>역할</th>       {/* 추가 */}
    <th>가입일</th>
  </tr>
</thead>
<tbody>
  {users.map((user) => (
    <tr key={user.id}>
      <td>{user.id}</td>
      <td><Link to={`/users/${user.id}`}>{user.name}</Link></td>
      <td>{user.email}</td>
      <td>{user.role}</td>  {/* 추가 */}
      <td>{new Date(user.created_at).toLocaleDateString('ko-KR')}</td>
    </tr>
  ))}
</tbody>
```

### App.tsx 라우팅 패턴

```tsx
// App.tsx — admin 전용 페이지 라우트 추가 (필요 시)
<Route path="/admin" element={
  <ProtectedRoute>
    <RequireRole role="admin">
      <AdminDashboardPage />
    </RequireRole>
  </ProtectedRoute>
} />
```
