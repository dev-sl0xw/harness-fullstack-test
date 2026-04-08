---
name: infra-setup
description: "Docker Compose, Dockerfile, GitHub Actions CI, 환경설정을 구성하는 스킬. PostgreSQL 컨테이너, Go 멀티스테이지 빌드, Node+nginx 빌드, CI 파이프라인(go test/build, npm ci/lint/build)을 포함. 인프라 구성, Docker 설정, CI 파이프라인, 환경변수 설정, 마이그레이션, CLAUDE.md 작성 요청 시 이 스킬을 사용. 인프라 수정, CI 보완, Docker 재설정 요청에도 사용."
---

# Infrastructure Setup Skill

Docker Compose, Dockerfile, GitHub Actions CI, 프로젝트 설정 파일을 구성하는 전문 스킬.

## 구현 순서

1. **DB 마이그레이션**: backend/migrations/001_create_users.sql
2. **환경설정**: backend/internal/config/config.go
3. **Docker Compose**: docker-compose.yml (PostgreSQL + Backend + Frontend)
4. **Backend Dockerfile**: backend/Dockerfile (Go 멀티스테이지 빌드)
5. **Frontend Dockerfile**: frontend/Dockerfile (Node 빌드 + nginx)
6. **GitHub Actions CI**: .github/workflows/ci.yml
7. **CLAUDE.md**: 프로젝트 컨텍스트 문서

## 참조 문서

구현 전 반드시 다음 문서를 읽는다:
- 설계 스펙: `docs/superpowers/specs/2026-04-08-fullstack-harness-design.md`
- 구현 계획 (Task 2, 13, 14): `docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md`

## Docker Compose 구조

```yaml
services:
  db:        # PostgreSQL 16, 포트 5432
  backend:   # Go 서버, 포트 8080, depends_on: [db]
  frontend:  # Vite/nginx, 포트 5173, depends_on: [backend]
volumes:
  pgdata:    # PostgreSQL 데이터 영속화
```

## Dockerfile 패턴

### Backend (Go 멀티스테이지)

```dockerfile
# 1단계: 빌드 — Go 소스를 컴파일하여 바이너리 생성
FROM golang:1.22-alpine AS builder
# 2단계: 실행 — 경량 알파인 이미지에 바이너리만 복사
FROM alpine:3.19
```

멀티스테이지 빌드를 사용하는 이유: 빌드 도구(Go 컴파일러 등)를 최종 이미지에서 제거하여 이미지 크기를 최소화한다.

### Frontend (Node + nginx)

```dockerfile
# 1단계: 빌드 — npm 빌드로 정적 파일 생성
FROM node:20-alpine AS builder
# 2단계: 서빙 — nginx로 정적 파일 제공
FROM nginx:alpine
```

## GitHub Actions CI

```yaml
# 트리거: main 브랜치 push 또는 PR
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:   # go test ./... → go build ./cmd/server
  frontend:  # npm ci → npm run lint → npm run build
```

두 job은 독립적으로 병렬 실행된다.

## 환경변수 목록

| 변수 | 서비스 | 기본값 |
|------|--------|-------|
| POSTGRES_DB | db | harness |
| POSTGRES_USER | db | harness |
| POSTGRES_PASSWORD | db | harness |
| DB_HOST | backend | db |
| DB_PORT | backend | 5432 |
| DB_USER | backend | harness |
| DB_PASSWORD | backend | harness |
| DB_NAME | backend | harness |
| JWT_SECRET | backend | dev-secret-key |

## 주석 규칙

docker-compose.yml, Dockerfile, ci.yml에도 한국어 주석을 포함한다:
- 각 서비스/단계의 목적과 이유
- 환경변수의 용도
- 빌드 순서와 의존 관계

## 검증

- `docker compose config`로 YAML 문법 검증
- Dockerfile의 COPY 경로가 실제 파일 구조와 일치하는지 확인
