// =============================================================================
// auth_service.go - 인증 서비스
// =============================================================================
// 이 파일은 인증과 관련된 비즈니스 로직을 담당한다:
//   1. 회원가입: 비밀번호 해싱 → DB 저장
//   2. 로그인: 비밀번호 검증 → JWT 토큰 생성
//   3. JWT 토큰 검증 (미들웨어에서 호출)
//
// 계층 구조에서의 위치:
//   Handler → [Service] → Repository → PostgreSQL
//
// JWT(JSON Web Token) 동작 원리:
//   - 로그인 성공 시 서버가 토큰을 생성하여 클라이언트에 전달
//   - 토큰에는 user_id, email이 포함되어 있음 (Claims)
//   - 클라이언트는 이후 요청마다 Authorization 헤더에 토큰을 첨부
//   - 서버는 비밀키(JWT_SECRET)로 토큰의 위변조를 검증
//
// bcrypt 동작 원리:
//   - 비밀번호를 해시하여 저장 (원본 비밀번호는 어디에도 저장하지 않음)
//   - 로그인 시 입력된 비밀번호를 같은 알고리즘으로 해시하여 비교
//   - 해시에 salt가 포함되어 있어 같은 비밀번호도 다른 해시값이 나옴
// =============================================================================
package service

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"harness-fullstack-test/internal/model"
	"harness-fullstack-test/internal/repository"
)

// AuthService는 인증 관련 비즈니스 로직을 처리하는 구조체이다.
type AuthService struct {
	userRepo  *repository.UserRepository // DB 접근을 위한 Repository
	jwtSecret []byte                     // JWT 서명에 사용하는 비밀키
}

// JWTClaims는 JWT 토큰에 포함되는 데이터(클레임)를 정의한다.
// jwt.RegisteredClaims를 임베딩하여 표준 클레임(만료시간 등)을 포함한다.
type JWTClaims struct {
	UserID int    `json:"user_id"` // 유저 고유 ID
	Email  string `json:"email"`   // 유저 이메일
	jwt.RegisteredClaims            // 표준 클레임 (ExpiresAt, IssuedAt 등)
}

// NewAuthService는 AuthService를 생성하는 팩토리 함수이다.
func NewAuthService(userRepo *repository.UserRepository, jwtSecret string) *AuthService {
	return &AuthService{
		userRepo:  userRepo,
		jwtSecret: []byte(jwtSecret),
	}
}

// Register는 새로운 유저를 등록(회원가입)한다.
//
// 처리 흐름:
//   1. 비밀번호를 bcrypt로 해시한다 (cost=10, 보안과 성능의 균형)
//   2. Repository를 통해 DB에 유저를 저장한다
//   3. 생성된 유저 정보를 반환한다 (비밀번호는 json:"-"로 제외됨)
//
// 에러 케이스:
//   - 이메일 중복: Repository에서 UNIQUE 제약조건 위반 에러
//   - 해시 실패: bcrypt 라이브러리 에러 (매우 드묾)
func (s *AuthService) Register(req *model.RegisterRequest) (*model.User, error) {
	// bcrypt.GenerateFromPassword: 평문 비밀번호 → 해시 문자열
	// bcrypt.DefaultCost(10): 해시 연산 반복 횟수. 높을수록 안전하지만 느림.
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	return s.userRepo.Create(req.Email, string(hashedPassword), req.Name)
}

// Login은 이메일/비밀번호로 로그인하고 JWT 토큰을 반환한다.
//
// 처리 흐름:
//   1. 이메일로 DB에서 유저를 조회한다
//   2. 입력된 비밀번호와 저장된 해시를 비교한다
//   3. 일치하면 JWT 토큰을 생성하여 반환한다
//
// 보안 주의사항:
//   - "이메일이 없음"과 "비밀번호가 틀림"을 구분하지 않는다
//   - 공격자에게 어떤 이메일이 등록되어 있는지 알려주지 않기 위함
func (s *AuthService) Login(req *model.LoginRequest) (string, error) {
	// 1단계: 이메일로 유저 조회
	user, err := s.userRepo.FindByEmail(req.Email)
	if err != nil {
		return "", errors.New("invalid email or password")
	}

	// 2단계: 비밀번호 검증
	// bcrypt.CompareHashAndPassword: 저장된 해시와 입력된 평문 비밀번호를 비교
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		return "", errors.New("invalid email or password")
	}

	// 3단계: JWT 토큰 생성
	return s.generateToken(user)
}

// ValidateToken은 JWT 토큰 문자열을 검증하고 클레임을 반환한다.
// 미들웨어(auth_middleware.go)에서 호출된다.
//
// 처리 흐름:
//   1. 토큰 문자열을 파싱하고 서명을 검증한다
//   2. 만료 시간을 확인한다 (자동으로 처리됨)
//   3. 클레임(user_id, email)을 추출하여 반환한다
func (s *AuthService) ValidateToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// 서명 방식이 HMAC인지 확인 (다른 알고리즘으로 위조하는 것을 방지)
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

// generateToken은 유저 정보로 JWT 토큰을 생성하는 내부 함수이다.
//
// 토큰 구조: Header.Payload.Signature
//   - Header: 알고리즘(HS256) + 토큰 타입(JWT)
//   - Payload: user_id, email, 만료시간, 발급시간
//   - Signature: Header+Payload를 JWT_SECRET으로 서명
//
// 만료 시간: 24시간. 만료되면 다시 로그인해야 한다.
func (s *AuthService) generateToken(user *model.User) (string, error) {
	claims := &JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	// jwt.NewWithClaims: 클레임을 포함한 토큰 객체 생성
	// token.SignedString: 비밀키로 서명하여 최종 토큰 문자열 생성
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}
