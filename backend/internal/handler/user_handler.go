// =============================================================================
// user_handler.go - 유저 CRUD HTTP 핸들러
// =============================================================================
// 이 파일은 유저 목록 조회, 상세 조회, 수정, 삭제 API의 HTTP 핸들러를 정의한다.
// 모든 엔드포인트는 JWT 인증 미들웨어를 통과해야 접근 가능하다.
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
//
// URL 파라미터 추출:
//
//	c.Param("id")는 라우트 정의의 :id 부분에 해당하는 값을 문자열로 반환.
//	DB 조회를 위해 strconv.Atoi()로 정수로 변환한다.
func (h *UserHandler) GetByID(c *gin.Context) {
	// URL에서 :id 파라미터를 추출하고 정수로 변환
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
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
// URL 파라미터에서 id를, 바디에서 수정할 데이터를 추출한다.
func (h *UserHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
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
// 성공하면 204 No Content를 반환한다 (응답 바디 없음).
func (h *UserHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	if err := h.userService.Delete(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// 204 No Content: 삭제 성공, 반환할 데이터 없음
	c.Status(http.StatusNoContent)
}
