# ADR-0007: Region Strategy

<!-- 
  역할: AWS 리전 전략(3개 화이트리스트)을 정의한 아키텍처 결정 기록
  시스템 내 위치: docs/architecture/adr/ — 인프라 전반에 영향을 주는 횡단 결정
  관련 파일: decisions.json (non_functional.allowed_regions), 
            infra/aws-cdk/lib/guards.ts (리전 가드 구현),
            docs/conventions/principles.md (리전 화이트리스트 가드 패턴)
  설계 의도: 허용 리전을 명시적으로 제한하여 실수로 다른 리전에
            배포하는 사고를 CDK 레벨에서 차단한다.
-->

**Status:** Accepted
**Date:** 2026-04-12
**Deciders:** 프로젝트 팀

## Context

<!-- 결정이 필요했던 배경: 리전 선택이 지연시간, 비용, 규정 준수에 영향. -->

AWS 리전 선택은 지연시간, 비용, 규정 준수에 영향을 미친다. 학습 목적으로 리전 전략을 수립한다.

## Decision

<!-- 내린 결정: 3개 리전 화이트리스트 + CDK guards.ts에서 제한. -->

3개 리전 화이트리스트를 설정하고, CDK guards.ts에서 허용 리전 외 배포를 차단한다.

| 리전 | 역할 | MVP 사용 여부 |
|------|------|-------------|
| `ap-northeast-1` (도쿄) | Primary workload | Yes |
| `us-east-1` (버지니아) | Global services (CloudFront ACM 등) | No (MVP에서는 Let's Encrypt 사용) |
| `ap-northeast-3` (오사카) | Backup vault (DR) | No (Stage 2 이후) |

## Consequences

### Positive

<!-- 리전 전략의 이점. -->

- 도쿄 리전으로 한국/일본에서 낮은 지연시간
- 리전 가드로 실수로 다른 리전에 배포하는 사고 방지

### Negative

<!-- 리전 전략의 단점. -->

- us-east-1에 비해 일부 서비스 요금이 약간 높음 (~10%)

## Alternatives Considered

<!-- 검토했지만 기각한 대안들. -->

| 대안 | 장점 | 단점 | 기각 사유 |
|------|------|------|----------|
| us-east-1 단일 | 최저 비용, 최초 서비스 출시 리전 | 한국/일본에서 높은 지연시간 (~150ms) | 지연시간 |
| ap-southeast-1 (싱가포르) | 동남아시아 커버 | 한국/일본에서 도쿄보다 지연 | 주요 사용자 위치 불부합 |
| 리전 제한 없음 | 유연한 배포 | 실수로 잘못된 리전에 배포 위험 | 가드레일 부재 |

## Evolution Path

<!-- 향후 변경이 필요할 때의 전환 경로. -->

- Multi-region 배포 시: `ap-northeast-3`를 standby로 활성화
- Global 서비스 시: `us-east-1`에 CloudFront ACM 인증서 발급
