# ADR-0005: Secret Management -- SSM Parameter Store

<!-- 
  역할: 비밀 관리 서비스로 SSM Parameter Store를 선택한 아키텍처 결정 기록
  시스템 내 위치: docs/architecture/adr/ — 보안 관련 의사결정
  관련 파일: decisions.json (secrets 섹션), docs/conventions/secrets.md (운영 가이드),
            infra/aws-cdk/lib/ec2-app-stack.ts (SSM 파라미터 생성)
  설계 의도: Standard Tier 무료 혜택을 활용하면서 IAM 기반 접근 제어로
            평문 시크릿 사용을 제거한다.
-->

**Status:** Accepted
**Date:** 2026-04-12
**Deciders:** 프로젝트 팀

## Context

<!-- 결정이 필요했던 배경: JWT_SECRET, DB 자격증명 등의 안전한 관리 필요. -->

JWT_SECRET, DB 자격증명 등의 민감 정보를 안전하게 관리해야 한다. AWS에서 제공하는 비밀 관리 서비스를 선택한다.

## Decision

<!-- 내린 결정: SSM Parameter Store Standard Tier.
     CDK 제약으로 String → SecureString 수동 전환 필요. -->

**SSM Parameter Store (Standard Tier)**를 사용한다. CDK에서 초기 placeholder를 String으로 생성하고, 사용자가 수동으로 SecureString으로 전환한다.

## Consequences

### Positive

<!-- SSM Parameter Store 선택의 이점. -->

- Standard Tier 완전 무료 (10,000개 파라미터까지)
- IAM 정책으로 접근 제어 (`/hft/{env}/*` 경로 기반)
- EC2의 Instance Profile로 자동 인증 (추가 자격증명 불필요)

### Negative

<!-- SSM Parameter Store 선택의 단점. -->

- CDK는 SecureString 직접 생성 불가 → 수동 전환 필요
- Secrets Manager 대비 자동 rotation 기능 없음

## Alternatives Considered

<!-- 검토했지만 기각한 대안들과 기각 사유. -->

| 대안 | 장점 | 단점 | 기각 사유 |
|------|------|------|----------|
| Secrets Manager | 자동 rotation, CDK 직접 지원 | $0.40/secret/월 | 비용 |
| .env 파일 in EC2 | 단순 | 버전 관리 불가, 접근 제어 약함 | 보안 |
| HashiCorp Vault | 강력한 기능 | 별도 인프라 필요, 복잡 | 오버엔지니어링 |

## Evolution Path

<!-- 향후 변경이 필요할 때의 전환 경로. -->

- 현재: String placeholder → 사용자 수동 SecureString 전환
- Stage 2: Secrets Manager로 전환 (자동 rotation 필요 시)
- 파라미터 경로 규칙: `/hft/{env}/{KEY}` (예: `/hft/prod/JWT_SECRET`)
