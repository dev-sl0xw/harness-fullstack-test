// =============================================================================
// UserDetailPage.tsx - 유저 상세/수정/삭제 페이지 컴포넌트
// =============================================================================
// URL 파라미터(:id)로 특정 유저의 정보를 조회하고,
// 수정(PUT)이나 삭제(DELETE) 기능을 제공하는 페이지이다.
//
// 동작 흐름:
//   1. URL에서 :id 파라미터 추출 (useParams)
//   2. GET /api/users/:id로 유저 정보 조회
//   3. 수정 폼 표시 (이름, 이메일)
//   4. 수정: PUT /api/users/:id → 성공 시 알림
//   5. 삭제: DELETE /api/users/:id → 성공 시 목록 페이지로 이동
// =============================================================================
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'
import type { User } from '../types'
import styles from './UserDetailPage.module.css'

export function UserDetailPage() {
  // useParams: URL의 동적 세그먼트(:id)를 추출하는 훅
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [user, setUser] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { token } = useAuth()

  // JWT 토큰에서 현재 사용자 ID를 추출한다.
  // 왜 필요한가? 본인이 아닌 유저의 수정/삭제 UI를 숨기기 위함이다.
  // 백엔드에서 403으로 차단하지만, 프론트에서도 UI를 숨겨 사용자가 불가능한 작업을 시도하지 않게 ���다.
  let currentUserId: number | null = null
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      currentUserId = payload.user_id ?? null
    } catch { /* 토큰 디코딩 실패는 무시 — 백엔드에서 검증 */ }
  }
  const isOwner = currentUserId !== null && currentUserId === Number(id)

  // 컴포넌트 마운트 시 유저 정보를 불러온다
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await apiClient.get<User>(`/api/users/${id}`)
        setUser(data)
        setName(data.name)
        setEmail(data.email)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [id])

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !email.trim()) {
      setError('이름과 이메일을 입력해주세요.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const updated = await apiClient.put<User>(`/api/users/${id}`, {
        name: name.trim(),
        email: email.trim(),
      })
      setUser(updated)
      alert('수정되었습니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    setDeleting(true)
    try {
      await apiClient.delete(`/api/users/${id}`)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className={styles.container}>로딩 중...</div>
  if (!user) return <div className={styles.container}>유저를 찾을 수 없습니다.</div>

  return (
    <div className={styles.container}>
      <Link to="/" className={styles.backLink}>
        ← 목록으로
      </Link>

      <h1>유저 상세</h1>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.info}>
        <p><strong>ID:</strong> {user.id}</p>
        <p><strong>가입일:</strong> {new Date(user.created_at).toLocaleString('ko-KR')}</p>
        <p><strong>수정일:</strong> {new Date(user.updated_at).toLocaleString('ko-KR')}</p>
      </div>

      {/* 본인일 때만 수정/삭제 UI를 표시한다.
          백엔드에서 403으로 차단하더라도, 프론트에서 UI 자체를 숨겨
          사용자가 불가능한 작업을 시도하는 혼란을 방지한다. */}
      {isOwner ? (
        <form onSubmit={handleUpdate} className={styles.form}>
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
          <div className={styles.actions}>
            <button type="submit" disabled={saving || deleting} className={styles.submitButton}>
              {saving ? '저장 중...' : '수정'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || deleting}
              className={styles.deleteButton}
            >
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.info}>본인 계정만 수정/삭제할 수 있습니다.</p>
      )}
    </div>
  )
}
