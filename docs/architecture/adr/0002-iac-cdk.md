# ADR-0002: IaC Tool -- CDK (TypeScript)

<!-- 
  역할: IaC 도구로 AWS CDK(TypeScript)를 선택한 아키텍처 결정 기록
  시스템 내 위치: docs/architecture/adr/ — ADR-0001(AWS 선택)의 후속 결정
  관련 파일: decisions.json (iac 섹션), infra/aws-cdk/ (CDK 프로젝트 루트)
  설계 의도: 프론트엔드(TypeScript)와 동일한 언어로 인프라를 정의하여
            팀의 학습 부담을 최소화하고 타입 안전성을 확보한다.
-->

**Status:** Accepted
**Date:** 2026-04-12
**Deciders:** 프로젝트 팀

## Context

<!-- 결정이 필요했던 배경: AWS 인프라를 코드로 정의할 도구 선택.
     팀이 이미 TypeScript에 익숙한 점이 주요 제약 조건. -->

AWS 인프라를 코드로 정의할 IaC 도구가 필요하다. 프론트엔드(TypeScript)와 백엔드(Go) 스택에서 팀이 이미 TypeScript에 익숙하다.

## Decision

<!-- 내린 결정: CDK TypeScript를 선택한다. -->

**AWS CDK (TypeScript)**를 IaC 도구로 선택한다.

## Consequences

### Positive

<!-- CDK 선택의 이점: 타입 안전성, L2 construct, cdk synth, Jest snapshot -->

- TypeScript의 타입 안전성으로 CloudFormation YAML 실수 방지
- L2 construct로 보일러플레이트 감소 (VPC 생성이 3줄)
- `cdk synth`로 배포 없이 CloudFormation 템플릿 검증 가능
- Jest snapshot test로 인프라 변경을 코드 리뷰에서 감지

### Negative

<!-- CDK 선택의 단점: CloudFormation 의존, 잦은 업데이트 -->

- CloudFormation에 의존하므로 drift 감지/state 관리가 Terraform보다 약함
- CDK 버전 업데이트가 잦아 breaking change 위험

## Alternatives Considered

<!-- 검토했지만 기각한 대안들과 기각 사유. -->

| 대안 | 장점 | 단점 | 기각 사유 |
|------|------|------|----------|
| Terraform | Multi-cloud, 성숙한 생태계 | HCL 별도 학습 필요, 프론트엔드 개발자 접근성 낮음 | TypeScript 우선 |
| Pulumi | TypeScript 지원, Multi-cloud | 커뮤니티 규모 작음, state 관리 별도 | CDK 대비 이점 부족 |
| CloudFormation (YAML) | AWS native | 장황한 YAML, 타입 안전성 없음 | 생산성 낮음 |

## Evolution Path

<!-- 향후 변경이 필요할 때의 전환 경로. -->

- Terraform 전환 시: `cloud-infra-build/references/aws-terraform.md` 스텁 활성화
- CDK 메이저 업데이트 시: `docs/conventions/dependencies.md`의 CDK 핀 정책 참조
