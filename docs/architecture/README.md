# Architecture Documentation

<!-- 
  역할: docs/architecture/ 디렉토리의 인덱스이자 진입점
  시스템 내 위치: docs/architecture/README.md — 다이어그램, ADR, decisions.json을 한곳에서 탐색 가능
  관련 파일: 모든 .mmd, .md, adr/*.md, _workspace/architecture/decisions.json
  설계 의도: 학습자가 아키텍처 문서를 탐색하는 시작점으로 사용하며,
            비용 추정까지 포함하여 "얼마에 이 구조를 운영할 수 있는가"를 바로 파악하게 한다.
-->

이 디렉토리는 harness-fullstack-test 프로젝트의 아키텍처 설계 문서를 포함한다.

## 다이어그램 (7개)

<!-- 모든 다이어그램은 .mmd(순수 Mermaid)와 .md(Markdown wrapper) 이중 저장.
     GitHub에서 .md 파일을 열면 Mermaid 다이어그램이 자동 렌더링된다.
     .mmd 파일은 CI lint 등 도구에서 사용할 수 있다. -->

모든 다이어그램은 Mermaid 형식(`.mmd`)과 Markdown wrapper(`.md`)로 이중 저장된다.
GitHub에서 `.md` 파일을 열면 Mermaid 다이어그램이 자동 렌더링된다.

| # | 파일 | 종류 | 설명 |
|---|------|------|------|
| 1 | [context.md](context.md) | C4 Context (L1) | 시스템 바운더리 -- 사용자, GitHub, AWS와의 관계 |
| 2 | [container.md](container.md) | C4 Container (L2) | 실행 단위 -- SPA, API, DB, AWS 서비스 |
| 3 | [component-frontend.md](component-frontend.md) | C4 Component (L3) | React 내부 -- Pages, AuthContext, Router, API Client |
| 4 | [component-backend.md](component-backend.md) | C4 Component (L3) | Go 백엔드 레이어 -- Handler → Service → Repository |
| 5 | [deployment-aws.md](deployment-aws.md) | Deployment | AWS Free Tier 토폴로지 -- EC2, RDS, S3, CloudFront |
| 6 | [sequence-auth.md](sequence-auth.md) | Sequence | JWT 발급/검증 플로우 |
| 7 | [er-schema.md](er-schema.md) | ER | DB 스키마 + 향후 확장 지점 |

## ADR (Architecture Decision Records)

<!-- ADR은 "왜 이렇게 결정했는가"를 기록하는 문서로, 
     미래의 팀원(또는 미래의 자신)이 결정의 맥락을 이해할 수 있게 한다.
     모든 ADR은 동일한 구조: Context, Decision, Consequences, Alternatives, Evolution Path -->

| # | 파일 | 결정 사항 |
|---|------|----------|
| 0001 | [adr/0001-cloud-aws.md](adr/0001-cloud-aws.md) | Cloud Provider: AWS |
| 0002 | [adr/0002-iac-cdk.md](adr/0002-iac-cdk.md) | IaC Tool: CDK (TypeScript) |
| 0003 | [adr/0003-compute-ec2-docker-compose.md](adr/0003-compute-ec2-docker-compose.md) | Compute: EC2 + Docker Compose |
| 0004 | [adr/0004-data-rds-progressive.md](adr/0004-data-rds-progressive.md) | Data: RDS PostgreSQL (progressive) |
| 0005 | [adr/0005-secrets-ssm-parameter-store.md](adr/0005-secrets-ssm-parameter-store.md) | Secrets: SSM Parameter Store |
| 0006 | [adr/0006-db-evolution-path.md](adr/0006-db-evolution-path.md) | DB 진화 경로 |
| 0007 | [adr/0007-region-strategy.md](adr/0007-region-strategy.md) | 리전 전략 (3개 화이트리스트) |
| 0008 | [adr/0008-db-schema-migration-strategy.md](adr/0008-db-schema-migration-strategy.md) | 마이그레이션: SSM Run Command |
| 0009 | [adr/0009-deployment-strategy.md](adr/0009-deployment-strategy.md) | 배포 전략: restart → ASG → Blue/Green |
| 0010 | [adr/0010-schema-migration-compatibility.md](adr/0010-schema-migration-compatibility.md) | 마이그레이션 backward-compatibility 규칙 |
| 0011 | [adr/0011-single-ec2-availability.md](adr/0011-single-ec2-availability.md) | 단일 EC2 가용성 (best-effort) |

## decisions.json

<!-- decisions.json은 아키텍처 결정의 machine-readable 버전으로,
     CDK 코드와 conventions 문서가 참조하는 단일 진실원(Single Source of Truth)이다. -->

아키텍처 결정의 machine-readable 버전: [`_workspace/architecture/decisions.json`](../../_workspace/architecture/decisions.json)

이 파일은 CDK 코드(`infra/aws-cdk/`)와 conventions 문서(`docs/conventions/`)가 참조하는 단일 진실원(Single Source of Truth)이다.

## 비용 추정

<!-- Free Tier 12개월 기준과 이후 비용을 비교하여,
     이 아키텍처의 운영 비용을 사전에 파악할 수 있게 한다. -->

| 항목 | Free Tier (12개월) | Free Tier 이후 |
|------|-------------------|---------------|
| EC2 t3.micro | 무료 | ~$8/월 |
| RDS db.t3.micro | 무료 | ~$15/월 |
| Route 53 Hosted Zone | $0.50/월 | $0.50/월 |
| S3 + CloudFront | 무료 (5GB + 1TB) | 무료 수준 |
| SSM Parameter Store | 무료 (Standard) | 무료 |
| CloudWatch Logs | 무료 (<5GB) | 무료 수준 |
| ECR | 무료 (<500MB) | 무료 수준 |
| **합계** | **~$0.50/월** | **~$25/월** |
