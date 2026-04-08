// =============================================================================
// RegisterPage.tsx - 회원가입 페이지 컴포넌트
// =============================================================================
// 이름, 이메일, 비밀번호를 입력받아 회원가입 API를 호출하는 페이지이다.
//
// 동작 흐름:
//   1. 사용자가 이름/이메일/비밀번호 입력
//   2. 폼 제출 → handleSubmit 실행
//   3. POST /api/auth/register 호출
//   4. 성공: 로그인 페이지로 이동 (자동 로그인은 하지 않음)
//   5. 실패: 에러 메시지 표시 (이메일 중복 등)
// =============================================================================
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import type { User } from '../types'
import styles from './RegisterPage.module.css'

export function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 회원가입 API 호출
      await apiClient.post<User>('/api/auth/register', {
        email,
        password,
        name,
      })
      // 성공: 로그인 페이지로 이동
      // 자동 로그인을 하지 않는 이유: 사용자가 입력한 정보를 확인하게 하기 위함
      navigate('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <h1>회원가입</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.field}>
          <label htmlFor="name">이름</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
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
          <label htmlFor="password">비밀번호 (6자 이상)</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? '가입 중...' : '회원가입'}
        </button>
      </form>
      <p>
        이미 계정이 있으신가요? <Link to="/login">로그인</Link>
      </p>
    </div>
  )
}
