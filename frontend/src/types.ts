// =============================================================================
// types.ts - 공유 TypeScript 타입 정의
// =============================================================================
// 이 파일은 프론트엔드 전체에서 사용하는 타입을 정의한다.
// 백엔드 API의 요청/응답 형식과 일치하도록 한다.
//
// TypeScript 타입의 역할:
//   - 코드 작성 시 자동완성 지원
//   - 잘못된 필드 접근을 컴파일 타임에 감지
//   - API 응답 형식을 문서화하는 효과
// =============================================================================

// User는 백엔드 User 모델에 대응하는 타입이다.
// GET /api/users, GET /api/users/:id 응답에서 사용된다.
export interface User {
  id: number
  email: string
  name: string
  created_at: string  // ISO 8601 날짜 문자열 (예: "2026-04-09T12:00:00Z")
  updated_at: string
}

// LoginRequest는 POST /api/auth/login 요청 바디 타입이다.
export interface LoginRequest {
  email: string
  password: string
}

// RegisterRequest는 POST /api/auth/register 요청 바디 타입이다.
export interface RegisterRequest {
  email: string
  password: string
  name: string
}

// LoginResponse는 POST /api/auth/login 응답 타입이다.
export interface LoginResponse {
  token: string
}

// UpdateUserRequest는 PUT /api/users/:id 요청 바디 타입이다.
export interface UpdateUserRequest {
  email?: string
  name?: string
}
