// =============================================================================
// auth_middleware.go - JWT 인증 미들웨어
// =============================================================================
// 이 파일은 보호된 API 엔드포인트에 접근하기 전에
// JWT 토큰을 검증하는 미들웨어를 정의한다.
//
// 미들웨어란?
//   - HTTP 요청이 핸들러에 도달하기 전에 실행되는 중간 처리 함수
//   - 인증, 로깅, CORS 등 공통 처리를 핸들러마다 반복하지 않기 위해 사용
//
// 동작 흐름:
//   1. 요청의 Authorization 헤더에서 "Bearer <token>" 형식으로 토큰 추출
//   2. AuthService.ValidateToken()으로 토큰 검증
//   3. 검증 성공: 유저 정보를 Gin Context에 저장 → 다음 핸들러로 진행
//   4. 검증 실패: 401 Unauthorized 응답 반환 → 핸들러 실행 안 됨
//
// Gin Context 저장 값:
//   - "user_id": int - 현재 로그인한 유저의 ID
//   - "user_email": string - 현재 로그인한 유저의 이메일
// =============================================================================
package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"harness-fullstack-test/internal/service"
)

// AuthMiddleware는 JWT 인증을 수행하는 Gin 미들웨어를 반환한다.
// 라우터에 등록하면 해당 경로의 모든 요청에 대해 토큰 검증이 실행된다.
//
// 사용 예시:
//
//	protected := r.Group("/api")
//	protected.Use(middleware.AuthMiddleware(authService))
func AuthMiddleware(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1단계: Authorization 헤더에서 토큰 추출
		// 형식: "Bearer eyJhbGciOiJIUzI1NiIs..."
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort() // 이후 핸들러 실행 중단
			return
		}

		// "Bearer <token>" 형식에서 토큰을 추출한다.
		// strings.Cut은 Go 1.18+에서 도입된 함수로, SplitN보다 의도가 명확하다.
		// 빈 토큰("Bearer "만 있는 경우)도 형식 오류로 처리한다.
		scheme, tokenString, found := strings.Cut(authHeader, " ")
		tokenString = strings.TrimSpace(tokenString)
		if !found || scheme != "Bearer" || tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
			c.Abort()
			return
		}

		// 2단계: 토큰 검증
		claims, err := authService.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// 3단계: 검증 성공 → 유저 정보를 Context에 저장
		// 이후 핸들러에서 c.GetInt("user_id")로 접근 가능
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)

		// 다음 핸들러로 진행
		c.Next()
	}
}
