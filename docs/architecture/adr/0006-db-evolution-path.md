# ADR-0006: Database Evolution Path

<!-- 
  역할: 데이터베이스의 4단계 진화 경로를 정의한 아키텍처 결정 기록
  시스템 내 위치: docs/architecture/adr/ — ADR-0004(RDS PostgreSQL)의 상세화
  관련 파일: decisions.json (data 섹션), ADR-0004 (현재 단계), ADR-0011 (가용성 제약)
  설계 의도: 현재는 Free Tier 단일 인스턴스로 충분하지만,
            성장 시 각 단계의 트리거 조건과 비용을 미리 명확히 하여
            "언제 무엇을 변경할지"를 사전에 합의한다.
-->

**Status:** Accepted
**Date:** 2026-04-12
**Deciders:** 프로젝트 팀

## Context

<!-- 결정이 필요했던 배경: 성장에 따른 DB 진화 경로를 미리 문서화해야 한다. -->

현재는 single-instance RDS로 충분하지만, 프로젝트가 성장하면 DB 고가용성과 성능이 필요해질 것이다. 진화 경로를 미리 문서화하여 각 단계의 트리거와 비용을 명확히 한다.

## Decision

<!-- 내린 결정: 4단계 진화 경로 정의. -->

4단계 진화 경로를 정의하고, 각 단계 전환의 트리거 조건을 명시한다.

## Consequences

### Evolution Stages

<!-- 각 단계의 구성, 트리거 조건, 예상 비용을 표로 정리한다. -->

| Stage | 구성 | 트리거 | 예상 비용 |
|-------|------|--------|----------|
| 1 (현재) | Single-instance, single-AZ | -- | Free → ~$15/월 |
| 2 | Multi-AZ | 가용성 SLA 99.9% 요구 | ~$30/월 |
| 3 | Multi-AZ + Read Replica | 읽기 QPS > 100 | ~$45/월 |
| 4 | Aurora PostgreSQL | 자동 스케일링 필요 | ~$50+/월 |

### Positive

<!-- 진화 경로를 정의한 이점. -->

- 각 단계에서 무엇을 변경하는지 명확
- 비용 증가를 사전에 예측 가능

### Negative

<!-- 진화 경로 정의의 한계. -->

- Stage 4 전환 시 endpoint 변경 필요 (CDK stack 수정)

## Evolution Path

<!-- 각 단계 전환 시 CDK에서 변경할 설정을 요약한다. -->

- Stage 1 → 2: `DatabaseStack`에서 `multiAz: true` 설정
- Stage 2 → 3: `DatabaseStack`에서 Read Replica 추가 + `DATABASE_READ_URL` 환경변수
- Stage 3 → 4: `DatabaseStack`을 Aurora 기반으로 교체, endpoint 마이그레이션
