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
import { createContext, useContext, useState, useCallback, useMemo } from 'react'
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

  // useCallback으로 함수 참조를 안정화한다.
  // 이 함수들이 매 렌더마다 새로 생성되면 useMemo의 의존성이 바뀌어 효과가 없다.
  const login = useCallback((newToken: string) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
  }, [])

  // useMemo로 Provider value 객체 참조를 안정화한다.
  // 왜 필요한가? value={{...}}를 인라인으로 만들면 매 렌더마다 새 객체가 생성되어
  // Context를 구독하는 모든 컴포넌트가 불필요하게 리렌더된다.
  // token이 바뀔 때만 value 객체가 새로 생성되도록 한다.
  const value = useMemo(() => ({
    token,
    isAuthenticated: token !== null,
    login,
    logout,
  }), [token, login, logout])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// useAuth는 AuthContext에 접근하기 위한 커스텀 훅이다.
// 하위 컴포넌트에서 const { token, login, logout } = useAuth() 형태로 사용한다.
//
// Note: 이 파일은 컴포넌트(AuthProvider)와 훅(useAuth)을 함께 export 한다.
// react-refresh/only-export-components 룰은 이 패턴에서 HMR이 다소 제한될 수
// 있다고 경고하는데, 이는 개발 시 fast-refresh 동작상 이점이 줄어들 뿐
// 런타임 동작에는 영향이 없다. auth context는 React 커뮤니티에서 매우 흔한
// "Provider + use훅" 패턴이며, 학습 목적상 한 파일에 두는 것이 흐름 파악에
//유리하다고 판단하여 의도적으로 disable한다. 향후 fast-refresh 최적화가
// 필요하면 useAuth만 별도 파일로 분리할 수 있다.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
