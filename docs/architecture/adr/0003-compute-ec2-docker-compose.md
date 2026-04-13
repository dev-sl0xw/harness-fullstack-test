# ADR-0003: Compute Model -- EC2 + Docker Compose

<!-- 
  역할: 컴퓨팅 모델로 EC2 + Docker Compose를 선택한 아키텍처 결정 기록
  시스템 내 위치: docs/architecture/adr/ — 백엔드 실행 환경에 대한 핵심 결정
  관련 파일: decisions.json (compute 섹션), infra/aws-cdk/lib/ec2-app-stack.ts,
            docker-compose.yml (로컬 환경과의 대응)
  설계 의도: Free Tier 비용 0원을 달성하면서 로컬 개발 환경과 동일한 Docker Compose 구조를
            유지하여, 환경 간 차이로 인한 디버깅 비용을 제거한다.
-->

**Status:** Accepted
**Date:** 2026-04-12
**Deciders:** 프로젝트 팀

## Context

<!-- 결정이 필요했던 배경: Free Tier + 로컬 환경 동형성이 주요 제약 조건. -->

백엔드 API를 AWS에서 실행할 컴퓨팅 모델이 필요하다. Free Tier 비용 0원 근사치를 달성하면서 로컬 개발 환경(Docker Compose)과 최대한 동일한 구조를 유지해야 한다.

## Decision

<!-- 내린 결정: EC2 t3.micro + Docker Compose -->

**EC2 (t3.micro) + Docker Compose**로 백엔드를 실행한다.

## Consequences

### Positive

<!-- EC2 + Docker Compose 선택의 이점. -->

- 로컬 docker-compose.yml과 거의 동일한 구조 → 디버깅 용이
- t3.micro 12개월 무료, Elastic IP 무료 (인스턴스에 attach 시)
- SSM Session Manager로 SSH 없이 접속 가능
- ALB($16/월) 불필요 → Caddy가 TLS reverse proxy 담당

### Negative

<!-- EC2 + Docker Compose 선택의 단점. -->

- 단일 인스턴스이므로 장애 시 전면 다운 (ADR-0011 참조)
- 수동 OS 패치 필요 (ECS/Fargate는 managed)
- Docker Compose는 오케스트레이션 기능 제한적

## Alternatives Considered

<!-- 검토했지만 기각한 대안들과 기각 사유. -->

| 대안 | 장점 | 단점 | 기각 사유 |
|------|------|------|----------|
| ECS Fargate | Serverless, 관리 부담 없음 | $18/월 (512MB), Free Tier 없음 | 비용 초과 |
| ECS + EC2 | Free Tier 가능 | ALB 필수($16/월), 복잡한 설정 | ALB 비용 |
| Lambda + API Gateway | 완전 serverless | Go cold start, REST API 매핑 복잡 | 아키텍처 불일치 |

## Evolution Path

<!-- 향후 변경이 필요할 때의 전환 경로: 3단계 진화. -->

- Stage 2: ASG(Auto Scaling Group) + instance refresh로 무중단 배포
- Stage 3: ALB + 2개 ASG Blue/Green 배포
- 장기: ECS Fargate 전환 (비용 허용 시)
