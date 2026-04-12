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
// URL 보존:
//   useLocation()으로 현재 위치를 읽어 state.from으로 /login에 전달한다.
//   로그인 성공 후 LoginPage가 state.from을 읽어 원래 목적지로 복귀시킨다.
//   예: /users/123 접근 → /login 리다이렉트 → 로그인 성공 → /users/123 복귀
//
// 사용 예시 (App.tsx):
//   <Route path="/" element={<ProtectedRoute><UserListPage /></ProtectedRoute>} />
// =============================================================================
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    // state.from에 현재 URL을 전달하여 로그인 후 복귀할 수 있게 한다.
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
