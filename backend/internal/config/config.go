// =============================================================================
// config.go - 환경변수 설정 로더
// =============================================================================
// 이 파일은 환경변수에서 애플리케이션 설정값을 읽어오는 역할을 한다.
// Docker Compose의 environment 섹션에서 설정한 값들이 여기서 읽힌다.
//
// 사용 흐름: main.go에서 config.Load() 호출 → Config 구조체 반환
//           → DB 연결, JWT 시크릿 등에 사용
// =============================================================================
package config

import (
	"fmt"
	"os"
)

// Config는 애플리케이션 전체에서 사용하는 설정값을 담는 구조체이다.
// 환경변수에서 읽어온 값을 여기에 저장하고, 각 레이어에 전달한다.
type Config struct {
	DBHost     string // PostgreSQL 호스트 (예: "db" 또는 "localhost")
	DBPort     string // PostgreSQL 포트 (기본값: "5432")
	DBUser     string // PostgreSQL 사용자명
	DBPassword string // PostgreSQL 비밀번호
	DBName     string // PostgreSQL 데이터베이스명
	JWTSecret  string // JWT 토큰 서명에 사용하는 비밀키
	ServerPort string // HTTP 서버 포트 (기본값: "8080")
}

// Load는 환경변수에서 설정값을 읽어 Config 구조체를 반환한다.
// 환경변수가 없으면 기본값(로컬 개발용)을 사용한다.
func Load() *Config {
	return &Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "harness"),
		DBPassword: getEnv("DB_PASSWORD", "harness"),
		DBName:     getEnv("DB_NAME", "harness"),
		JWTSecret:  getEnv("JWT_SECRET", "dev-secret-change-in-production!!"),
		ServerPort: getEnv("SERVER_PORT", "8080"),
	}
}

// DSN은 PostgreSQL 접속 문자열(Data Source Name)을 생성한다.
// database/sql의 sql.Open()에서 사용하는 형식이다.
// 예: "host=localhost port=5432 user=harness password=harness dbname=harness sslmode=disable"
func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName,
	)
}

// getEnv는 환경변수를 읽되, 값이 없으면 fallback(기본값)을 반환하는 헬퍼 함수이다.
// os.Getenv()는 환경변수가 없으면 빈 문자열을 반환하므로,
// 이 함수로 기본값을 지정할 수 있다.
func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
