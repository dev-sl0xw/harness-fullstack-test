# ADR-0008: DB Schema Migration Strategy

<!-- 
  역할: AWS 환경에서의 DB 마이그레이션 실행 전략을 정의한 아키텍처 결정 기록
  시스템 내 위치: docs/architecture/adr/ — 배포 파이프라인의 일부
  관련 파일: backend/migrations/ (SQL 마이그레이션 파일), ADR-0009 (배포 전략),
            ADR-0010 (마이그레이션 호환성 규칙)
  설계 의도: RDS에 직접 파일 마운트가 불가하므로, EC2에서 SSM Run Command로
            golang-migrate CLI를 실행하는 방식을 채택한다.
-->

**Status:** Accepted
**Date:** 2026-04-12
**Deciders:** 프로젝트 팀

## Context

<!-- 결정이 필요했던 배경: 로컬과 달리 RDS에는 파일을 마운트할 수 없다. -->

현재 로컬에서는 `docker-entrypoint-initdb.d`에 SQL 파일을 마운트하여 마이그레이션을 실행한다. AWS에서는 RDS에 직접 파일을 마운트할 수 없으므로 별도의 마이그레이션 실행 방법이 필요하다.

## Decision

<!-- 내린 결정: SSM Run Command + golang-migrate CLI -->

**SSM Run Command**로 EC2에서 `docker compose exec -T backend ./migrate up`을 실행한다. Backend Docker 이미지에 마이그레이션 바이너리(golang-migrate CLI)를 번들한다.

## Consequences

### Positive

<!-- SSM Run Command + golang-migrate 선택의 이점. -->

- 별도의 마이그레이션 인프라(ECS Task, Lambda) 불필요
- SSM Run Command로 원격 실행 가능 (SSH 불필요)
- golang-migrate는 순수 SQL 파일 기반으로 기존 migrations/ 디렉토리와 호환

### Negative

<!-- SSM Run Command + golang-migrate 선택의 단점. -->

- Backend 이미지에 마이그레이션 바이너리가 포함되어 이미지 크기 증가 (~5MB)
- 마이그레이션 중 앱과 같은 컨테이너에서 실행됨

## Alternatives Considered

<!-- 검토했지만 기각한 대안들과 기각 사유. -->

| 대안 | 장점 | 단점 | 기각 사유 |
|------|------|------|----------|
| ECS Task | 앱과 분리된 실행 | ALB 또는 별도 Task 정의 필요, 비용 | 복잡도 |
| Lambda | Serverless | VPC 내 Lambda는 NAT 필요, cold start | NAT 비용 |
| SSH로 수동 실행 | 단순 | 보안 취약, 자동화 불가 | 보안/운영 |

## Evolution Path

<!-- 향후 변경이 필요할 때의 전환 경로. -->

- Stage 2: 전용 마이그레이션 ECS Task (앱과 분리)
- Stage 3: CI/CD 파이프라인 내에서 마이그레이션 자동 실행
