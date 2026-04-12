// =============================================================================
// user_handler.go - 유저 CRUD HTTP 핸들러
// =============================================================================
// 이 파일은 유저 목록 조회, 상세 조회, 수정, 삭제 API의 HTTP 핸들러를 정의한다.
// 모든 엔드포인트는 JWT 인증 미들웨어를 통과해야 접근 가능하다.
//
// 인가(Authorization) 정책:
//   - GetAll: 인증된 사용자는 전체 목록 조회 가능 (학습용 보일러플레이트)
//   - GetByID, Update, Delete: 본인만 허용 (수평 권한 상승 방지)
//   - 향후 admin role 도입 시 GetByID를 열거나 role 기반 분기로 확장 가능
//
// 왜 본인 검증이 필요한가?
//   auth_middleware가 user_id를 Context에 넣어주지만, 핸들러가 이를 확인하지 않으면
//   로그인한 누구나 URL의 :id를 바꿔서 다른 사용자의 자원에 접근할 수 있다.
//   이를 수평 권한 상승(Horizontal Privilege Escalation)이라 한다.
//
// 계층 구조에서의 위치:
//   [Handler] → Service → Repository → PostgreSQL
// =============================================================================
package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"harness-fullstack-test/internal/model"
	"harness-fullstack-test/internal/service"
)

// UserHandler는 유저 CRUD HTTP 요청을 처리하는 구조체이다.
type UserHandler struct {
	userService *service.UserService
}

// NewUserHandler는 UserHandler를 생성하는 팩토리 함수이다.
func NewUserHandler(userService *service.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

// GetAll은 GET /api/users 요청을 처리한다.
// 모든 유저 목록을 JSON 배열로 반환한다.
func (h *UserHandler) GetAll(c *gin.Context) {
	users, err := h.userService.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, users)
}

// GetByID는 GET /api/users/:id 요청을 처리한다.
// URL 파라미터에서 id를 추출하여 해당 유저를 조회한다.
// 본인만 조회 가능 — 수평 권한 상승 방지를 위해 토큰의 user_id와 URL의 :id를 비교한다.
func (h *UserHandler) GetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// 본인 검증: auth_middleware가 Context에 넣어준 user_id와 요청 대상 id 비교
	if !isOwner(c, id) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		c.Abort()
		return
	}

	user, err := h.userService.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// Update는 PUT /api/users/:id 요청을 처리한다.
// 본인만 수정 가능 — 다른 사용자의 정보를 수정하려는 시도는 403으로 차단한다.
func (h *UserHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	if !isOwner(c, id) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		c.Abort()
		return
	}

	var req model.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.userService.Update(id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

// Delete는 DELETE /api/users/:id 요청을 처리한다.
// 본인만 삭제 가능. 성공하면 204 No Content를 반환한다.
func (h *UserHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	if !isOwner(c, id) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		c.Abort()
		return
	}

	if err := h.userService.Delete(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.Status(http.StatusNoContent)
}

// isOwner는 현재 인증된 사용자(토큰)가 요청 대상 리소스의 소유자인지 확인한다.
// auth_middleware가 Context에 저장한 "user_id"와 URL의 :id를 비교한다.
// 일치하면 true, 불일치하면 false를 반환한다.
// 향후 admin role이 도입되면 이 함수에 role 체크를 추가하면 된다.
func isOwner(c *gin.Context, resourceID int) bool {
	currentUserID, exists := c.Get("user_id")
	if !exists {
		return false
	}
	return currentUserID.(int) == resourceID
}
