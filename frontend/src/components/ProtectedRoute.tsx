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
import type { ReactNode } from 'react'

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
