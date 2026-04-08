// =============================================================================
// user_service.go - 유저 비즈니스 로직 서비스
// =============================================================================
// 이 파일은 유저 CRUD에 대한 비즈니스 로직을 담당한다.
// Repository를 호출하여 DB 작업을 수행하고,
// 필요한 경우 추가적인 검증이나 변환을 처리한다.
//
// 계층 구조에서의 위치:
//   Handler → [Service] → Repository → PostgreSQL
//
// 왜 Service를 별도로 두는가?
//   - Handler는 HTTP 요청/응답만 담당 (웹 프레임워크에 의존)
//   - Service는 순수 비즈니스 로직 (프레임워크 독립적)
//   - 같은 비즈니스 로직을 CLI, gRPC 등 다른 인터페이스에서도 재사용 가능
// =============================================================================
package service

import (
	"harness-fullstack-test/internal/model"
	"harness-fullstack-test/internal/repository"
)

// UserService는 유저 관련 비즈니스 로직을 처리하는 구조체이다.
type UserService struct {
	userRepo *repository.UserRepository
}

// NewUserService는 UserService를 생성하는 팩토리 함수이다.
func NewUserService(userRepo *repository.UserRepository) *UserService {
	return &UserService{userRepo: userRepo}
}

// GetAll은 모든 유저 목록을 조회한다.
// GET /api/users 핸들러에서 호출된다.
func (s *UserService) GetAll() ([]model.User, error) {
	return s.userRepo.FindAll()
}

// GetByID는 ID로 특정 유저를 조회한다.
// GET /api/users/:id 핸들러에서 호출된다.
func (s *UserService) GetByID(id int) (*model.User, error) {
	return s.userRepo.FindByID(id)
}

// Update는 유저 정보를 수정한다.
// PUT /api/users/:id 핸들러에서 호출된다.
//
// 처리 흐름:
//   1. 기존 유저 정보를 조회한다
//   2. 요청에 포함된 필드만 업데이트한다 (빈 값이면 기존값 유지)
//   3. Repository를 통해 DB에 저장한다
func (s *UserService) Update(id int, req *model.UpdateUserRequest) (*model.User, error) {
	// 기존 유저 정보를 먼저 조회한다.
	// 요청에 빈 값이 있으면 기존값을 유지하기 위함이다.
	existing, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, err
	}

	// 요청에 값이 있으면 새 값 사용, 없으면 기존값 유지
	email := existing.Email
	if req.Email != "" {
		email = req.Email
	}
	name := existing.Name
	if req.Name != "" {
		name = req.Name
	}

	return s.userRepo.Update(id, email, name)
}

// Delete는 유저를 삭제한다.
// DELETE /api/users/:id 핸들러에서 호출된다.
func (s *UserService) Delete(id int) error {
	return s.userRepo.Delete(id)
}
