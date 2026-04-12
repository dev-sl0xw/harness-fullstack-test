// =============================================================================
// LoginPage.tsx - 로그인 페이지 컴포넌트
// =============================================================================
// 이메일과 비밀번호를 입력받아 로그인 API를 호출하는 페이지이다.
//
// 동작 흐름:
//   1. 사용자가 이메일/비밀번호 입력
//   2. 폼 제출(submit) → handleSubmit 실행
//   3. POST /api/auth/login 호출
//   4. 성공: JWT 토큰을 AuthContext에 저장 → 메인 페이지(/)로 이동
//   5. 실패: 에러 메시지 표시
//
// React 상태 관리:
//   - useState: 폼 입력값, 에러 메시지, 로딩 상태를 관리
//   - useNavigate: 프로그래밍 방식으로 페이지 이동
// =============================================================================
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'
import type { LoginResponse } from '../types'
import styles from './LoginPage.module.css'

export function LoginPage() {
  // 폼 입력값 상태
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // 에러 메시지 상태 (로그인 실패 시 표시)
  const [error, setError] = useState('')
  // 로딩 상태 (API 호출 중 버튼 비활성화)
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // ProtectedRoute가 state.from으로 전달한 원래 URL. 없으면 '/'로 이동.
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // trim 검증: 공백-only 입력을 서버로 보내기 전에 차단.
    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const data = await apiClient.post<LoginResponse>('/api/auth/login', {
        email: email.trim(),
        password,
      })
      login(data.token)
      // 로그인 성공 후 원래 목적지로 복귀
      navigate(from, { replace: true })
    } catch (err) {
      // 에러 메시지 표시
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <h1>로그인</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.field}>
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading} aria-busy={loading} className={styles.submitButton}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
      <p>
        계정이 없으신가요? <Link to="/register">회원가입</Link>
      </p>
    </div>
  )
}
