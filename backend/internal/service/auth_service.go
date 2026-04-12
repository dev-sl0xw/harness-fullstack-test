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
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"

	"harness-fullstack-test/internal/model"
	"harness-fullstack-test/internal/repository"
)

// jwtSecretMinLength は JWT 시크릿의 최소 바이트 수이다.
// HMAC-SHA256의 안전한 키 길이는 32바이트 이상이 권장된다.
const jwtSecretMinLength = 32

// dummyHash는 timing attack 방지용 더미 bcrypt 해시이다.
// 존재하지 않는 이메일로 로그인할 때도 bcrypt 비교를 수행하여
// 응답 시간이 일정하게 만든다 (이메일 존재 여부 추론 차단).
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("dummy-timing-equalizer"), bcrypt.DefaultCost)

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
// jwtSecret이 공백이거나 32바이트 미만이면 에러를 반환하여 서버 부팅을 차단한다.
// 왜 부팅 시점에 검증하는가?
//   운영 환경에서 환경변수 주입이 누락되어도 서버가 조용히 기동되면,
//   짧거나 예측 가능한 시크릿으로 JWT가 서명되어 인증 체계가 무력화된다.
//   fail-fast 원칙: 잘못된 설정은 가능한 빨리, 가능한 시끄럽게 실패해야 한다.
func NewAuthService(userRepo *repository.UserRepository, jwtSecret string) (*AuthService, error) {
	trimmed := strings.TrimSpace(jwtSecret)
	if len(trimmed) < jwtSecretMinLength {
		return nil, fmt.Errorf("jwt secret must be at least %d bytes (got %d)", jwtSecretMinLength, len(trimmed))
	}
	return &AuthService{
		userRepo:  userRepo,
		jwtSecret: []byte(trimmed),
	}, nil
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

	user, err := s.userRepo.Create(req.Email, string(hashedPassword), req.Name)
	if err != nil {
		// PostgreSQL UNIQUE 제약조건 위반(코드 23505)을 도메인 에러로 변환한다.
		// raw DB 에러를 그대로 반환하면 handler가 DB 구현 세부를 사용자에게 노출할 위험이 있다.
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return nil, ErrEmailAlreadyExists
		}
		return nil, err
	}
	return user, nil
}

// Login은 이메일/비밀번호로 로그인하고 JWT 토큰을 반환한다.
//
// 처리 흐름:
//   1. 이메일로 DB에서 유저를 조회한다
//   2. 입력된 비밀번호와 저장된 해시를 비교한다
//   3. 일치하면 JWT 토큰을 생성하여 반환한다
//
// 보안 주의사항:
//   - "이메일이 없음"과 "비밀번호가 틀림"을 구분하지 않는다 (에러 메시지 통일)
//   - 이메일이 없을 때도 dummyHash로 bcrypt 비교를 수행하여 응답 시간을 일정하게 만든다
//   - 이를 통해 timing attack으로 이메일 존재 여부를 추론하는 것을 차단한다
func (s *AuthService) Login(req *model.LoginRequest) (string, error) {
	// 1단계: 이메일로 유저 조회
	user, err := s.userRepo.FindByEmail(req.Email)
	if err != nil {
		// 이메일이 없어도 bcrypt 비교를 수행하여 응답 시간을 일정하게 만든다 (timing attack 방지).
		// dummyHash는 패키지 초기화 시 미리 생성해둔 더미 해시이다.
		//nolint:errcheck
		bcrypt.CompareHashAndPassword(dummyHash, []byte(req.Password))
		return "", ErrInvalidCredentials
	}

	// 2단계: 비밀번호 검증
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		return "", ErrInvalidCredentials
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
		// 서명 방식이 정확히 HS256인지 확인한다.
		// 이전에는 HMAC 계열(HS256/HS384/HS512) 전체를 허용했으나,
		// 발급은 HS256으로 고정하면서 검증은 더 느슨하면 정책이 불일치한다.
		// none 알고리즘 공격 + 알고리즘 다운그레이드 공격을 모두 차단한다.
		if token.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
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
