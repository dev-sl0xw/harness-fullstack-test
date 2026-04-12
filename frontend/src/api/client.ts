// =============================================================================
// client.ts - API 클라이언트 (fetch wrapper)
// =============================================================================
// 이 파일은 백엔드 API와 통신하는 함수들을 제공한다.
// 브라우저 내장 fetch API를 래핑하여 다음 기능을 추가한다:
//   - JWT 토큰 자동 첨부 (Authorization 헤더)
//   - JSON 요청/응답 자동 처리
//   - 에러 핸들링
//
// 왜 fetch를 직접 래핑하는가?
//   - axios 같은 외부 라이브러리 없이 최소 의존성으로 구현
//   - fetch는 브라우저 내장 API라 별도 설치가 필요 없음
//   - 프로젝트 규모가 작으므로 충분함
//
// 사용 예시:
//   const users = await apiClient.get<User[]>('/api/users')
//   const user = await apiClient.post<User>('/api/auth/register', { email, password, name })
// =============================================================================

// API_BASE는 API 요청의 기본 경로이다.
// Vite의 proxy 설정으로 /api 요청이 백엔드(localhost:8080)로 전달된다.
// 따라서 여기서는 상대 경로만 사용하면 된다.
const API_BASE = ''

// getToken은 localStorage에서 JWT 토큰을 읽는 헬퍼 함수이다.
// 로그인 시 저장한 토큰을 API 호출 시 가져온다.
function getToken(): string | null {
  return localStorage.getItem('token')
}

// request는 모든 API 호출의 공통 로직을 처리하는 내부 함수이다.
//
// 처리 흐름:
//   1. 기본 헤더 설정 (Content-Type: application/json)
//   2. 토큰이 있으면 Authorization 헤더 추가
//   3. fetch 실행
//   4. 응답이 에러(4xx, 5xx)이면 에러 객체를 throw
//   5. 응답이 성공이면 JSON 파싱하여 반환
//
// 제네릭 <T>:
//   호출하는 곳에서 응답 타입을 지정할 수 있다.
//   예: request<User[]>('/api/users') → User[] 타입 반환
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  // 토큰이 있으면 Authorization 헤더에 Bearer 토큰 추가
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  // HTTP 상태 코드가 2xx가 아니면 에러로 처리
  if (!response.ok) {
    // 401 Unauthorized: 토큰이 만료되었거나 무효한 경우.
    // 왜 즉시 토큰을 지우고 로그인 페이지로 이동하는가?
    //   토큰이 localStorage에 남아 있으면 ProtectedRoute가 "로그인됨"으로 판단하지만,
    //   실제 API 호출은 모두 401로 실패하는 "깨진 세션" 상태가 된다.
    //   토큰을 즉시 제거하고 페이지를 리로드하면 AuthContext가 비인증 상태로 초기화된다.
    // 단, 로그인 API 자체의 401(잘못된 비밀번호)은 redirect하면 안 되므로
    // /api/auth/ 경로는 제외한다.
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.')
    }

    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  // 204 No Content (DELETE 성공 등)는 빈 응답이므로 JSON 파싱하지 않음
  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

// apiClient는 HTTP 메서드별 편의 함수를 제공하는 객체이다.
// 각 페이지 컴포넌트에서 이 객체를 import하여 API를 호출한다.
export const apiClient = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
}
