// =============================================================================
// UserListPage.tsx - 유저 목록 페이지 컴포넌트
// =============================================================================
// 등록된 모든 유저를 테이블 형태로 표시하는 페이지이다.
// 인증된 사용자만 접근 가능하다 (ProtectedRoute로 보호됨).
//
// 동작 흐름:
//   1. 컴포넌트 마운트 시 GET /api/users 호출 (useEffect)
//   2. 응답 데이터를 users 상태에 저장
//   3. 테이블로 렌더링
//   4. 유저 이름 클릭 → /users/:id 상세 페이지로 이동
//
// useEffect:
//   - 컴포넌트가 처음 렌더링된 후 실행되는 사이드 이펙트
//   - 빈 의존성 배열([])을 전달하면 마운트 시 1회만 실행
// =============================================================================
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'
import type { User } from '../types'
import styles from './UserListPage.module.css'

export function UserListPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { logout } = useAuth()

  // 컴포넌트 마운트 시 유저 목록을 불러온다
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await apiClient.get<User[]>('/api/users')
        setUsers(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load users')
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, []) // 빈 배열: 마운트 시 1회만 실행

  if (loading) return <div className={styles.container}>로딩 중...</div>

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>유저 목록</h1>
        <button onClick={logout} className={styles.logoutButton}>
          로그아웃
        </button>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {/* tableWrapper: 모바일에서 가로 오버플로 시 스크롤 허용 */}
      <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>이름</th>
            <th>이메일</th>
            <th>가입일</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>
                {/* 유저 이름을 클릭하면 상세 페이지로 이동 */}
                <Link to={`/users/${user.id}`}>{user.name}</Link>
              </td>
              <td>{user.email}</td>
              <td>{new Date(user.created_at).toLocaleDateString('ko-KR')}</td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={4} className={styles.empty}>
                등록된 유저가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}
