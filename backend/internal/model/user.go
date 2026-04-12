// =============================================================================
// user.go - User 데이터 모델 및 요청/응답 DTO
// =============================================================================
// 이 파일은 User와 관련된 모든 데이터 구조체를 정의한다.
//
// 구조체 종류:
//   - User: DB 테이블과 1:1 매핑되는 핵심 모델
//   - RegisterRequest: 회원가입 요청 바디
//   - LoginRequest: 로그인 요청 바디
//   - UpdateUserRequest: 유저 정보 수정 요청 바디
//
// JSON 태그 설명:
//   - `json:"필드명"`: JSON 직렬화/역직렬화 시 사용할 키 이름
//   - `json:"-"`: JSON 출력에서 제외 (비밀번호 같은 민감 정보)
//   - `binding:"required"`: Gin이 요청 바인딩 시 필수값 검증
// =============================================================================
package model

import "time"

// User는 데이터베이스의 users 테이블에 대응하는 구조체이다.
// 이 구조체는 Repository에서 DB 조회 결과를 담고,
// Handler에서 JSON 응답으로 변환할 때 사용된다.
type User struct {
	ID        int       `json:"id"`
	Email     string    `json:"email"`
	PasswordHash string `json:"-"` // bcrypt 해시값. 컬럼명 password_hash와 일치. JSON 응답에서 제외.
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// RegisterRequest는 POST /api/auth/register 요청의 바디 구조체이다.
// 클라이언트가 회원가입할 때 보내는 데이터를 담는다.
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`    // 이메일 형식 검증
	Password string `json:"password" binding:"required,min=6"` // 최소 6자
	Name     string `json:"name" binding:"required"`
}

// LoginRequest는 POST /api/auth/login 요청의 바디 구조체이다.
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// UpdateUserRequest는 PUT /api/users/:id 요청의 바디 구조체이다.
// 이메일과 이름만 수정 가능하다. 비밀번호 변경은 별도 API가 필요하다.
type UpdateUserRequest struct {
	Email string `json:"email" binding:"omitempty,email"` // 빈 값 허용, 있으면 이메일 형식
	Name  string `json:"name" binding:"omitempty"`
}
