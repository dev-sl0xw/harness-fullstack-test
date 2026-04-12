// =============================================================================
// errors.go - 서비스 레이어 도메인 에러 정의
// =============================================================================
// 이 파일은 서비스 레이어에서 발생하는 비즈니스 에러를 정의한다.
// DB 드라이버의 raw error를 그대로 상위로 올리면:
//   1. handler가 내부 구현 세부를 사용자에게 노출할 위험이 있다
//   2. handler가 DB별 에러 코드에 의존해야 한다 (레이어 경계 침범)
//
// 도메인 에러를 정의하면:
//   - service가 raw DB 에러를 의미 있는 비즈니스 에러로 변환
//   - handler는 errors.Is()로 깔끔하게 분기하여 적절한 HTTP 상태 코드를 반환
//   - 사용자에게는 안전한 메시지만 노출
//
// 사용 흐름:
//   Repository → raw error → Service(변환) → 도메인 에러 → Handler(분기) → HTTP 응답
// =============================================================================
package service

import "errors"

// ErrUserNotFound는 요청한 유저가 DB에 존재하지 않을 때 반환한다.
// sql.ErrNoRows를 service에서 이 에러로 변환한다.
// handler에서는 errors.Is(err, ErrUserNotFound) → 404 Not Found로 응답.
var ErrUserNotFound = errors.New("user not found")

// ErrEmailAlreadyExists는 이미 등록된 이메일로 회원가입을 시도할 때 반환한다.
// PostgreSQL UNIQUE 제약조건 위반(23505)을 service에서 이 에러로 변환한다.
// handler에서는 errors.Is(err, ErrEmailAlreadyExists) → 409 Conflict로 응답.
var ErrEmailAlreadyExists = errors.New("email already exists")

// ErrInvalidCredentials는 로그인 시 이메일/비밀번호가 일치하지 않을 때 반환한다.
// 이메일 미존재와 비밀번호 불일치를 구분하지 않는다 (보안 원칙).
var ErrInvalidCredentials = errors.New("invalid email or password")
