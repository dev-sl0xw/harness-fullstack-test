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
