# ADR-0009: Deployment Strategy

<!-- 
  역할: 배포 전략(restart → ASG → Blue/Green)을 정의한 아키텍처 결정 기록
  시스템 내 위치: docs/architecture/adr/ — CI/CD 파이프라인 관련 결정
  관련 파일: decisions.json (deployment 섹션), ADR-0003 (EC2 컴퓨팅 모델),
            ADR-0011 (단일 EC2 가용성과 연결)
  설계 의도: Free Tier에서 추가 인프라 없이 동작하는 가장 단순한 배포 전략을 채택하고,
            향후 성장에 따라 단계적으로 복잡도를 올리는 경로를 정의한다.
-->

**Status:** Accepted
**Date:** 2026-04-12
**Deciders:** 프로젝트 팀

## Context

<!-- 결정이 필요했던 배경: Free Tier 범위에서 동작하는 배포 전략 필요. -->

새 코드를 EC2에 배포하는 전략이 필요하다. Free Tier 범위에서 복잡한 배포 인프라(ALB, ASG) 없이 동작해야 한다.

## Decision

<!-- 내린 결정: 전 환경에서 restart 전략. -->

전 환경에서 **restart** 전략을 사용한다: `docker compose pull && docker compose up -d`

## Consequences

### Positive

<!-- restart 전략의 이점. -->

- 추가 인프라 비용 없음
- 로컬과 동일한 배포 경험
- GitHub Actions workflow_dispatch로 수동 트리거

### Negative

<!-- restart 전략의 단점. -->

- 배포 중 수 초간 서비스 중단 (downtime)
- 롤백 시 이전 이미지 태그로 수동 재배포 필요

## Stages

<!-- 배포 전략의 3단계 진화 경로를 표로 정리한다. -->

| Stage | 전략 | 구성 | 다운타임 |
|-------|------|------|---------|
| 1 (현재) | restart | 단일 EC2, docker compose up -d | 수 초 |
| 2 | ASG instance refresh | ASG (min=1), rolling update | 무중단 |
| 3 | Blue/Green | ALB + 2 ASG | 무중단 |

## Alternatives Considered

<!-- 검토했지만 기각한 대안들. -->

| 대안 | 장점 | 단점 | 기각 사유 |
|------|------|------|----------|
| CodeDeploy in-place | 표준 AWS 배포 도구 | CodeDeploy agent 관리, 복잡 | 오버엔지니어링 |
| ECS rolling update | Managed 배포 | ECS + ALB 필요 | 비용 |
| 수동 SSH 배포 | 단순 | 보안 취약, 재현성 없음 | 보안/운영 |

## Evolution Path

<!-- 향후 변경이 필요할 때의 전환 경로. -->

- Stage 1 → 2: CDK에 ASG 추가, GitHub Actions에서 instance refresh 트리거
- Stage 2 → 3: ALB 추가, 두 번째 ASG를 Blue/Green 타겟으로 구성
