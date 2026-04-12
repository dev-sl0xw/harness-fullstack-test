// =============================================================================
// main.go - 애플리케이션 엔트리포인트
// =============================================================================
// 이 파일은 백엔드 서버의 시작점으로, 다음 작업을 순서대로 수행한다:
//   1. 환경변수에서 설정 로드 (config)
//   2. PostgreSQL 데이터베이스 연결 (database/sql)
//   3. 각 레이어 초기화: Repository → Service → Handler
//   4. Gin 라우터 설정 (공개 API + 보호된 API)
//   5. HTTP 서버 시작
//
// 전체 아키텍처 흐름:
//   [클라이언트] → Gin Router → Middleware → Handler → Service → Repository → [DB]
//
// 의존성 주입 패턴:
//   main()에서 모든 의존성을 생성하고 주입한다.
//   이렇게 하면 각 레이어가 독립적이고 테스트하기 쉽다.
//   예: Handler는 Service에만 의존, Service는 Repository에만 의존.
// =============================================================================
package main

import (
	"database/sql"
	"log"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq" // PostgreSQL 드라이버. 직접 호출하지 않지만 init()으로 등록됨.

	"harness-fullstack-test/internal/config"
	"harness-fullstack-test/internal/handler"
	"harness-fullstack-test/internal/middleware"
	"harness-fullstack-test/internal/repository"
	"harness-fullstack-test/internal/service"
)

func main() {
	// =========================================================================
	// 1단계: 설정 로드
	// =========================================================================
	// 환경변수에서 DB 접속정보, JWT 시크릿 등을 읽어온다.
	// 환경변수가 없으면 로컬 개발용 기본값을 사용한다.
	cfg := config.Load()

	// =========================================================================
	// 2단계: 데이터베이스 연결
	// =========================================================================
	// sql.Open()은 연결 풀(connection pool)을 생성한다.
	// 실제 연결은 첫 쿼리 실행 시 이루어지므로, db.Ping()으로 연결을 확인한다.
	// "postgres"는 lib/pq 드라이버가 등록한 드라이버 이름이다.
	db, err := sql.Open("postgres", cfg.DSN())
	if err != nil {
		log.Fatalf("DB 연결 실패: %v", err)
	}
	defer db.Close() // 프로그램 종료 시 DB 연결을 닫는다.

	// Ping으로 실제 DB 연결이 가능한지 확인한다.
	if err := db.Ping(); err != nil {
		log.Fatalf("DB 핑 실패: %v", err)
	}
	log.Println("데이터베이스 연결 성공")

	// =========================================================================
	// 3단계: 의존성 초기화 (Repository → Service → Handler)
	// =========================================================================
	// 각 레이어를 아래에서 위로 생성하며, 하위 레이어를 상위에 주입한다.

	// Repository: DB 접근 담당
	userRepo := repository.NewUserRepository(db)

	// Service: 비즈니스 로직 담당
	// NewAuthService는 JWT 시크릿이 32바이트 미만이면 에러를 반환한다.
	// 잘못된 시크릿으로 서버가 기동되는 것을 부팅 시점에서 차단한다 (fail-fast).
	authService, err := service.NewAuthService(userRepo, cfg.JWTSecret)
	if err != nil {
		log.Fatalf("인증 서비스 초기화 실패: %v", err)
	}
	userService := service.NewUserService(userRepo)

	// Handler: HTTP 요청 처리 담당
	authHandler := handler.NewAuthHandler(authService)
	userHandler := handler.NewUserHandler(userService)

	// =========================================================================
	// 4단계: Gin 라우터 설정
	// =========================================================================
	r := gin.Default()

	// 헬스체크: 서버 상태 확인용
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// API 그룹
	api := r.Group("/api")

	// --- 공개 API (인증 불필요) ---
	// 회원가입과 로그인은 토큰 없이 접근 가능해야 한다.
	auth := api.Group("/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
	}

	// --- 보호된 API (JWT 인증 필요) ---
	// AuthMiddleware를 거쳐야만 아래 핸들러에 도달할 수 있다.
	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware(authService))
	{
		protected.GET("/users", userHandler.GetAll)
		protected.GET("/users/:id", userHandler.GetByID)
		protected.PUT("/users/:id", userHandler.Update)
		protected.DELETE("/users/:id", userHandler.Delete)
	}

	// =========================================================================
	// 5단계: 서버 시작
	// =========================================================================
	log.Printf("서버를 시작합니다: http://localhost:%s", cfg.ServerPort)
	log.Fatal(r.Run(":" + cfg.ServerPort))
}
