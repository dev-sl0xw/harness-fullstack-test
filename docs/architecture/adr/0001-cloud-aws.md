# ADR-0001: Cloud Provider -- AWS

<!-- 
  역할: 클라우드 플랫폼으로 AWS를 선택한 아키텍처 결정 기록
  시스템 내 위치: docs/architecture/adr/ — 최상위 의사결정 (다른 모든 ADR의 전제 조건)
  관련 파일: decisions.json (machine-readable 버전), 0002-iac-cdk.md (후속 결정)
  설계 의도: 비용(Free Tier), 학습 전이 가치, IaC 도구 호환성을 종합하여
            AWS가 이 프로젝트에 가장 적합한 플랫폼임을 논증한다.
-->

**Status:** Accepted
**Date:** 2026-04-12
**Deciders:** 프로젝트 팀

## Context

<!-- 결정이 필요했던 배경: 학습용 프로젝트에 클라우드 배포를 추가하는 맥락에서,
     비용 최소화와 실제 프로덕션 패턴 학습을 동시에 달성해야 한다. -->

학습용 풀스택 프로젝트에 클라우드 배포를 추가한다. 비용을 최소화(Free Tier 활용)하면서 실제 프로덕션 패턴을 학습할 수 있는 클라우드 플랫폼이 필요하다.

## Decision

<!-- 내린 결정: AWS를 선택한다. -->

**AWS**를 클라우드 플랫폼으로 선택한다.

## Consequences

### Positive

<!-- AWS 선택의 이점: Free Tier, 시장 점유율, CDK, SSM 무료 -->

- 12개월 Free Tier로 EC2 t3.micro + RDS db.t3.micro 무료 사용
- 시장 점유율 1위로 학습 투자 대비 활용 범위가 넓음
- CDK(TypeScript)로 IaC를 작성하여 프론트엔드 개발자도 접근 가능
- SSM Parameter Store Standard Tier 무료 (Secrets Manager $0.40/secret/월 절감)

### Negative

<!-- AWS 선택의 단점: Free Tier 기한 제한, 복잡한 콘솔 -->

- GCP의 Always Free Tier(f1-micro)와 달리 12개월 후 과금 시작 (~$25/월)
- AWS 콘솔 UI가 복잡하여 학습 진입 장벽이 높음

## Alternatives Considered

<!-- 검토했지만 기각한 대안들과 기각 사유. -->

| 대안 | 장점 | 단점 | 기각 사유 |
|------|------|------|----------|
| GCP | Always Free f1-micro, Firebase 연동 | Free Tier 스펙이 낮음 (0.6GB RAM), CDK 미지원 | CDK 사용 불가 |
| Azure | 12개월 Free, VS Code 연동 | Free Tier VM이 B1s(1vCPU/1GB)로 제한적 | 팀 경험 부족 |
| DigitalOcean/Fly.io | 단순한 배포 경험 | IaC 생태계 미약, 학습 전이 가치 낮음 | 프로덕션 패턴 학습 목적 불부합 |

## Evolution Path

<!-- 향후 변경이 필요할 때의 전환 경로. -->

- GCP/Azure 지원 시: `cloud-infra-build/references/gcp-*.md`, `aws-terraform.md` 스텁 활성화
- Multi-cloud 시: Terraform으로 전환 검토 (ADR 별도 작성)
