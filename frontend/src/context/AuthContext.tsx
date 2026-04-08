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
import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

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
