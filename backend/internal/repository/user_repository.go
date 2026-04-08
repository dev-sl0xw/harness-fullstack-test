// =============================================================================
// user_repository.go - User DB 접근 레이어
// =============================================================================
// 이 파일은 users 테이블에 대한 모든 SQL 쿼리를 담당한다.
// Service 레이어에서 호출되며, 비즈니스 로직은 포함하지 않는다.
//
// 계층 구조에서의 위치:
//   Handler → Service → [Repository] → PostgreSQL
//
// 왜 Repository를 분리하는가?
//   - DB 쿼리와 비즈니스 로직을 분리하면 테스트가 쉬워진다.
//   - 나중에 DB를 교체하더라도 Repository만 수정하면 된다.
//   - Service는 "무엇을 할지"에 집중, Repository는 "어떻게 저장할지"에 집중.
// =============================================================================
package repository

import (
	"database/sql"
	"time"

	"harness-fullstack-test/internal/model"
)

// UserRepository는 users 테이블에 접근하는 메서드를 제공한다.
// db 필드에 데이터베이스 연결 객체를 보관한다.
type UserRepository struct {
	db *sql.DB
}

// NewUserRepository는 UserRepository를 생성하는 팩토리 함수이다.
// main.go에서 DB 연결을 주입받아 생성한다.
func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create는 새로운 유저를 DB에 삽입하고, 생성된 유저 정보를 반환한다.
//
// 흐름: INSERT 쿼리 실행 → RETURNING으로 생성된 행의 전체 데이터를 받음
// 파라미터:
//   - email: 이메일 주소 (UNIQUE 제약조건)
//   - hashedPassword: bcrypt로 해시된 비밀번호 (평문 아님!)
//   - name: 사용자 표시 이름
//
// 에러 케이스: 이메일 중복 시 PostgreSQL UNIQUE 제약조건 위반 에러 발생
func (r *UserRepository) Create(email, hashedPassword, name string) (*model.User, error) {
	user := &model.User{}
	err := r.db.QueryRow(
		`INSERT INTO users (email, password, name, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, email, password, name, created_at, updated_at`,
		email, hashedPassword, name, time.Now(), time.Now(),
	).Scan(&user.ID, &user.Email, &user.Password, &user.Name, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

// FindByEmail은 이메일로 유저를 조회한다.
// 로그인 시 이메일로 유저를 찾고, 비밀번호를 검증하는 데 사용된다.
//
// 반환값:
//   - *model.User: 찾은 유저 (비밀번호 포함)
//   - error: sql.ErrNoRows면 해당 이메일의 유저가 없음
func (r *UserRepository) FindByEmail(email string) (*model.User, error) {
	user := &model.User{}
	err := r.db.QueryRow(
		`SELECT id, email, password, name, created_at, updated_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.Password, &user.Name, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

// FindByID는 ID로 유저를 조회한다.
// GET /api/users/:id 에서 사용된다.
func (r *UserRepository) FindByID(id int) (*model.User, error) {
	user := &model.User{}
	err := r.db.QueryRow(
		`SELECT id, email, password, name, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.Password, &user.Name, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

// FindAll은 모든 유저를 조회한다.
// GET /api/users 에서 사용된다.
// 프로덕션에서는 페이지네이션이 필요하지만, MVP에서는 전체 조회로 충분하다.
func (r *UserRepository) FindAll() ([]model.User, error) {
	rows, err := r.db.Query(
		`SELECT id, email, password, name, created_at, updated_at
		 FROM users ORDER BY id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var user model.User
		if err := rows.Scan(&user.ID, &user.Email, &user.Password, &user.Name, &user.CreatedAt, &user.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, nil
}

// Update는 유저 정보를 수정한다.
// PUT /api/users/:id 에서 사용된다.
// updated_at을 현재 시각으로 갱신한다.
func (r *UserRepository) Update(id int, email, name string) (*model.User, error) {
	user := &model.User{}
	err := r.db.QueryRow(
		`UPDATE users SET email = $1, name = $2, updated_at = $3
		 WHERE id = $4
		 RETURNING id, email, password, name, created_at, updated_at`,
		email, name, time.Now(), id,
	).Scan(&user.ID, &user.Email, &user.Password, &user.Name, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

// Delete는 유저를 삭제한다.
// DELETE /api/users/:id 에서 사용된다.
// 반환값으로 영향받은 행 수를 확인할 수 있다.
func (r *UserRepository) Delete(id int) error {
	result, err := r.db.Exec(`DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}
