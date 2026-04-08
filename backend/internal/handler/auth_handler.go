// =============================================================================
// auth_handler.go - 인증 관련 HTTP 핸들러
// =============================================================================
// 이 파일은 회원가입(Register)과 로그인(Login) API의 HTTP 핸들러를 정의한다.
// Handler는 HTTP 요청을 파싱하고 응답을 생성하는 역할만 한다.
// 실제 비즈니스 로직은 AuthService에 위임한다.
//
// 계층 구조에서의 위치:
//   [Handler] → Service → Repository → PostgreSQL
//
// 핸들러의 책임:
//   1. 요청 바디를 구조체로 파싱 (JSON → Go struct)
//   2. Service 호출
//   3. 결과를 JSON 응답으로 반환
//   4. 에러 발생 시 적절한 HTTP 상태 코드 반환
// =============================================================================
package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"harness-fullstack-test/internal/model"
	"harness-fullstack-test/internal/service"
)

// AuthHandler는 인증 관련 HTTP 요청을 처리하는 구조체이다.
type AuthHandler struct {
	authService *service.AuthService
}

// NewAuthHandler는 AuthHandler를 생성하는 팩토리 함수이다.
func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Register는 POST /api/auth/register 요청을 처리한다.
//
// 요청 흐름:
//   1. JSON 바디를 RegisterRequest 구조체로 파싱
//   2. binding 태그로 유효성 검증 (email 형식, 비밀번호 6자 이상 등)
//   3. AuthService.Register() 호출하여 유저 생성
//   4. 성공: 201 Created + 생성된 유저 정보 반환
//   5. 실패: 400 Bad Request (유효성) 또는 500 Internal Server Error
//
// 요청 예시:
//
//	POST /api/auth/register
//	{"email": "user@example.com", "password": "123456", "name": "홍길동"}
func (h *AuthHandler) Register(c *gin.Context) {
	var req model.RegisterRequest

	// ShouldBindJSON: JSON 바디를 구조체로 파싱 + binding 태그 검증
	// 실패하면 어떤 필드가 잘못되었는지 에러 메시지를 반환한다.
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.authService.Register(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 201 Created: 리소스가 성공적으로 생성되었음을 나타내는 HTTP 상태 코드
	c.JSON(http.StatusCreated, user)
}

// Login은 POST /api/auth/login 요청을 처리한다.
//
// 요청 흐름:
//   1. JSON 바디를 LoginRequest 구조체로 파싱
//   2. AuthService.Login() 호출하여 인증 + JWT 토큰 생성
//   3. 성공: 200 OK + {"token": "eyJ..."} 반환
//   4. 실패: 401 Unauthorized (이메일/비밀번호 불일치)
//
// 요청 예시:
//
//	POST /api/auth/login
//	{"email": "user@example.com", "password": "123456"}
//
// 응답 예시:
//
//	{"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
func (h *AuthHandler) Login(c *gin.Context) {
	var req model.LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	token, err := h.authService.Login(&req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token})
}
