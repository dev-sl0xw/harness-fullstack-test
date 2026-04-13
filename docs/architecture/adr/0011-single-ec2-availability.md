# ADR-0011: Single EC2 Availability

<!-- 
  역할: 단일 EC2 인스턴스의 가용성 제약을 수용하는 아키텍처 결정 기록
  시스템 내 위치: docs/architecture/adr/ — ADR-0003(EC2 컴퓨팅 모델)의 가용성 관련 상세화
  관련 파일: decisions.json (non_functional.availability_target_current: "best-effort"),
            ADR-0003 (EC2 선택), ADR-0009 (배포 전략)
  설계 의도: 학습용 프로젝트에서 고가용성보다 비용 절감을 의식적으로 우선하며,
            리스크 시나리오와 대응을 명시하여 "알고 수용한 결정"임을 기록한다.
-->

**Status:** Accepted
**Date:** 2026-04-12
**Deciders:** 프로젝트 팀

## Context

<!-- 결정이 필요했던 배경: 단일 인스턴스의 장애 시 전체 다운 리스크. -->

Free Tier에서 단일 EC2 인스턴스를 사용한다. 이 인스턴스가 실패하면 전체 API가 다운된다.

## Decision

<!-- 내린 결정: best-effort SLA를 수용한다. -->

**best-effort SLA**를 수용한다. 학습용 프로젝트이므로 고가용성보다 비용 절감을 우선한다.

## Consequences

### Risk Scenarios

<!-- 발생 가능한 장애 시나리오와 대응을 표로 정리한다. -->

| 시나리오 | 영향 | 대응 |
|---------|------|------|
| EC2 인스턴스 장애 | API 전면 다운 | 수동 재시작 또는 AMI에서 새 인스턴스 생성 |
| AZ 장애 | EC2 + RDS 모두 다운 | Multi-AZ 전환 (Stage 2) |
| EC2 과부하 | 응답 지연/실패 | 인스턴스 타입 업그레이드 |

### Positive

<!-- best-effort SLA 수용의 이점. -->

- 추가 비용 없음
- 단순한 아키텍처로 학습 용이

### Negative

<!-- best-effort SLA 수용의 단점. -->

- 프로덕션 워크로드에는 부적합

## Alternatives Considered

<!-- 검토했지만 기각한 대안들. -->

| 대안 | 장점 | 단점 | 기각 사유 |
|------|------|------|----------|
| ASG (min=1) + health check | 자동 복구 | 비용 동일하나 설정 복잡도 증가 | MVP 단순성 |
| Multi-AZ ASG + ALB | 99.9% 가용성 | ALB $16/월, 복잡한 설정 | 비용 |
| ECS Fargate | Managed HA | $18/월+ | 비용 초과 |

## Evolution Path

<!-- 향후 변경이 필요할 때의 전환 경로. -->

- Stage 2: ASG (min=1, max=2) + health check → 자동 복구
- Stage 3: Multi-AZ ASG + ALB → 99.9% 가용성
