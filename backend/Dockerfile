# =============================================================================
# Backend Dockerfile - 멀티스테이지 빌드
# =============================================================================
# 멀티스테이지 빌드란?
#   - 1단계(builder): Go 소스코드를 컴파일하여 바이너리 생성
#   - 2단계(runtime): 컴파일된 바이너리만 최소 이미지에 복사
#   - 이점: 최종 이미지에 Go 컴파일러/소스코드가 없어 이미지 크기가 작음
# =============================================================================

# --- 1단계: 빌드 ---
FROM golang:1.22-alpine AS builder

WORKDIR /app

# go.mod, go.sum을 먼저 복사하여 의존성을 캐싱한다.
# 소스코드가 변경되어도 의존성이 같으면 이 레이어는 캐시에서 재사용된다.
COPY go.mod go.sum ./
RUN go mod download

# 소스코드 복사 및 빌드
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

# --- 2단계: 실행 ---
FROM alpine:3.19

# CA 인증서 설치 (HTTPS 요청 시 필요)
RUN apk --no-cache add ca-certificates

WORKDIR /app
COPY --from=builder /server .

EXPOSE 8080

CMD ["./server"]
