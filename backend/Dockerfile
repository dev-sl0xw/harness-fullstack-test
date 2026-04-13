# =============================================================================
# Backend Dockerfile - 멀티스테이지 빌드
# =============================================================================
# 멀티스테이지 빌드란?
#   - 1단계(builder): Go 소스코드를 컴파일하여 바이너리 생성 + golang-migrate CLI 다운로드
#   - 2단계(runtime): 컴파일된 바이너리 + migrate CLI + migrations/ 파일만 최소 이미지에 복사
#   - 이점: 최종 이미지에 Go 컴파일러/소스코드가 없어 이미지 크기가 작음
#
# [로컬 Docker Compose vs AWS 배포 비교]
#   - 로컬(docker compose up): PostgreSQL 컨테이너의 docker-entrypoint-initdb.d/ 를 이용해
#     컨테이너 최초 기동 시 SQL 파일을 자동 실행한다. migrate CLI 불필요.
#   - AWS 배포(EC2 등): RDS나 외부 DB를 사용하므로 docker-entrypoint-initdb.d 기법이 작동하지 않는다.
#     이때 컨테이너 안의 migrate CLI로 마이그레이션을 직접 실행해야 한다.
#
# [golang-migrate 선택 이유]
#   - 순수 SQL 파일(*.sql)을 그대로 사용할 수 있어 기존 migrations/ 디렉토리와 완전 호환
#   - Go 라이브러리 또는 독립 CLI 둘 다 제공 → 컨테이너에 CLI만 번들하면 충분
#   - up/down 롤백, 버전 관리, 다양한 DB 드라이버 지원
#   - 오픈소스(MIT), 커뮤니티 활성, GitHub Star ~13k (2024 기준)
# =============================================================================

# --- 1단계: 빌드 ---
# go.mod 가 go 1.26.2 를 요구하므로 golang:1.26-alpine 사용
FROM golang:1.26-alpine AS builder

# golang-migrate CLI 버전을 ARG로 관리하여 업그레이드 시 한 곳만 수정
ARG MIGRATE_VERSION=v4.17.0

WORKDIR /app

# go.mod, go.sum을 먼저 복사하여 의존성을 캐싱한다.
# 소스코드가 변경되어도 의존성이 같으면 이 레이어는 캐시에서 재사용된다.
COPY go.mod go.sum ./
RUN go mod download

# 소스코드 복사 및 빌드
COPY . .
# -ldflags="-s -w": 디버그 심볼과 DWARF 정보를 제거하여 바이너리 크기를 줄인다.
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

# golang-migrate CLI 다운로드
# 왜 builder stage에서 curl로 다운로드하는가?
#   - golang:1.22-alpine 이미지에는 apk가 있어 curl 설치가 간단
#   - 다운로드한 바이너리를 runtime stage에 COPY --from=builder로 옮길 수 있어 레이어 분리 명확
#   - runtime 이미지(alpine:3.19)에 빌드 도구를 추가하지 않아도 됨 → 공격 표면 최소화
RUN apk add --no-cache curl \
    && curl -L "https://github.com/golang-migrate/migrate/releases/download/${MIGRATE_VERSION}/migrate.linux-amd64.tar.gz" \
       | tar -xz -C /usr/local/bin/ migrate

# --- 2단계: 실행 ---
FROM alpine:3.19

# CA 인증서 설치 (HTTPS 요청 시 필요)
RUN apk --no-cache add ca-certificates

# non-root 사용자를 생성하여 최소 권한으로 서버를 실행한다.
# 왜 root가 아닌가? API 서버가 root로 실행되면 취약점 악용 시 피해 범위가 커진다.
RUN adduser -D -u 10001 app

WORKDIR /app

# Go 서버 바이너리 복사
COPY --from=builder /server .

# golang-migrate CLI 복사
# AWS 배포 시 컨테이너 시작 스크립트 또는 ECS task definition에서
# /usr/local/bin/migrate -path ./migrations -database $DATABASE_URL up 형태로 호출
COPY --from=builder /usr/local/bin/migrate /usr/local/bin/migrate

# SQL 마이그레이션 파일 복사
# 로컬: docker-entrypoint-initdb.d 경유로 PostgreSQL이 자동 실행 (이 디렉토리는 직접 사용 안 함)
# AWS: migrate CLI가 이 경로의 SQL 파일을 읽어 순서대로 실행
COPY migrations/ ./migrations/

# /app 디렉토리 전체를 app 사용자 소유로 변경
# 이전에는 ./server 파일 하나만 chown 했으나,
# migrations/ 디렉토리 추가로 /app 전체를 chown -R 로 변경
RUN chown -R app:app /app

USER app

EXPOSE 8080

CMD ["./server"]
