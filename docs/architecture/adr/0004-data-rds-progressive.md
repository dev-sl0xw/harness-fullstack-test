# ADR-0004: Data Store -- RDS PostgreSQL (Progressive)

<!-- 
  역할: 데이터 저장소로 RDS PostgreSQL을 선택한 아키텍처 결정 기록
  시스템 내 위치: docs/architecture/adr/ — 데이터 레이어에 대한 핵심 결정
  관련 파일: decisions.json (data 섹션), infra/aws-cdk/lib/database-stack.ts,
            ADR-0006 (DB 진화 경로와 연결)
  설계 의도: 로컬과 동일한 PostgreSQL 16 엔진을 AWS managed 서비스로 운영하여
            호환성을 보장하면서 백업/패치를 자동화한다.
-->

**Status:** Accepted
**Date:** 2026-04-12
**Deciders:** 프로젝트 팀

## Context

<!-- 결정이 필요했던 배경: 로컬 PostgreSQL과 동일 엔진의 managed 서비스 필요. -->

로컬에서 Docker Compose로 PostgreSQL 16을 사용 중이다. AWS 배포 시 동일 엔진의 managed 서비스가 필요하다.

## Decision

<!-- 내린 결정: RDS PostgreSQL 16, db.t3.micro, single-instance -->

**RDS PostgreSQL 16** (db.t3.micro, single-instance)을 사용한다. Free Tier 12개월 적용.

## Consequences

### Positive

<!-- RDS PostgreSQL 선택의 이점. -->

- 로컬과 동일 엔진(PostgreSQL 16)으로 호환성 보장
- db.t3.micro 12개월 무료, 20GB gp2 스토리지 무료
- 자동 백업 (retention: prod 7일, dev 1일)
- Isolated subnet에 배치하여 인터넷 접근 차단

### Negative

<!-- RDS PostgreSQL 선택의 단점. -->

- Single-instance이므로 AZ 장애 시 DB 다운
- Multi-AZ 전환 시 비용 2배 ($15 → $30/월)

## Alternatives Considered

<!-- 검토했지만 기각한 대안들과 기각 사유. -->

| 대안 | 장점 | 단점 | 기각 사유 |
|------|------|------|----------|
| Aurora Serverless v2 | Auto-scaling, 고가용성 | 최소 $43/월 (0.5 ACU) | Free Tier 초과 |
| EC2 자체 PostgreSQL | 완전 제어 | 관리 부담 (백업, 패치) | managed 서비스 활용 |
| DynamoDB | Serverless, 25GB 무료 | SQL 불가, 기존 코드 재작성 | 아키텍처 불일치 |

## Evolution Path

<!-- 향후 변경이 필요할 때의 4단계 전환 경로. -->

- Stage 1 (현재): single-instance, single-AZ
- Stage 2: Multi-AZ 활성화 (가용성 향상)
- Stage 3: Read Replica 추가 (읽기 부하 분산)
- Stage 4: Aurora PostgreSQL 전환 (auto-scaling)
