---
name: cloud-infra-build
description: |
  cloud-infra-dev 에이전트가 IaC 코드를 생성할 때 사용하는 스킬.
  다음 키워드/상황에서 즉시 로드: 클라우드 IaC 코드 생성, CDK, Terraform,
  AWS, GCP, 인프라 코드, 배포 코드, IaC, cloud infrastructure, cloud deploy,
  CDK 프로젝트, IaC 구현, 클라우드 인프라 구현, infra/aws-cdk, cdk synth,
  cdk deploy, EC2 배포, 배포 workflow, OIDC, deploy-aws.yml.
  solution-architect의 decisions.json 을 입력으로 받아 cloud+IaC 조합에 맞는
  reference 를 선택하고 코드를 생성한다.
---

# cloud-infra-build Skill

## 개요

cloud-infra-dev 에이전트가 `decisions.json` 을 기반으로 IaC 코드를 생성할 때 따르는
공통 원칙과 cloud+IaC 조합별 상세 가이드를 제공하는 스킬.

**입력**: solution-architect 가 생성한 `decisions.json`
**출력**: `infra/{cloud}-{iac}/` 디렉토리 + GitHub Actions deploy workflow

`decisions.json` 의 `cloud_infra_dev.skill_refs` 필드가 어느 reference 파일을 읽을지
지정한다. cloud-infra-dev 는 해당 reference 를 로드하여 구체적인 구현 지침을 따른다.

---

## 공통 원칙 (cloud/IaC 무관)

모든 cloud+IaC 조합에 반드시 적용하는 원칙이다. reference 별 가이드보다 우선한다.

### 1. 환경 분리

- **권장**: 1 환경 = 1 AWS/GCP account (완전한 blast-radius 격리)
- **MVP 단계**: 단일 account + resource 이름/태그에 env prefix 적용으로 논리 분리
- dev/stg/prod 리소스 이름에 반드시 `{env}` 포함 (`hft-dev-vpc`, `hft-prod-ec2` 등)
- 환경 간 resource 공유 금지 (VPC, IAM Role, S3 Bucket 등)

### 2. Secret 관리

- IaC 코드(`.ts`, `.tf`, `cdk.json`)에 평문 secret 금지 (DB 패스워드, API 키 등)
- 항상 SSM Parameter Store 또는 Secrets Manager 를 참조로 사용
- SSM Parameter 경로 규칙: `/hft/{env}/{service}/{key}` (예: `/hft/prod/db/password`)
- CDK synth 시점에 실제 값을 읽지 않는다 — 런타임 참조만 생성

### 3. 태그 전파

모든 리소스에 다음 4개 태그를 반드시 전파한다:

```
Project:     hft (harness-fullstack-test)
Environment: dev | stg | prod
ManagedBy:   cdk | terraform
Owner:       cloud-infra-dev
```

CDK: `Tags.of(app).add(...)` 또는 `applyCommonTags()` 헬퍼 사용
Terraform: `default_tags` 블록 또는 모든 리소스에 `tags` 반복 지정

### 4. synth/plan vs deploy/apply 분리

| 단계 | 실행 | 승인 |
|------|------|------|
| `cdk synth` / `terraform plan` | CI 자동 실행 (PR/push) | 불필요 |
| `cdk deploy` / `terraform apply` | 수동 트리거 or 환경 게이트 | 필요 (stg/prod) |

GitHub Actions `environment` 게이트를 사용하여 stg/prod deploy 는 반드시 수동 승인 후 실행.

### 5. 한국어 학습용 상세 주석 (의무)

모든 `.ts` / `.tf` 파일에 다음을 포함한다:
- **파일 상단**: 역할, 시스템 내 위치, 다른 파일과의 관계
- **클래스/함수마다**: 목적, 파라미터, 반환값, 호출 흐름
- **설계 의도**: "왜 이렇게 하는지" 포함

주석이 없는 파일은 미완성으로 간주한다.

### 6. 비용 최적화 우선

Free Tier 를 최대한 활용한다. ALB/NAT Gateway/Fargate 는 사용하지 않는다 (결정된 경우).
decisions.json 의 `cost_strategy` 를 항상 확인하여 불필요한 리소스를 추가하지 않는다.

---

## Progressive Disclosure: reference 파일

`references/` 하위에 cloud+IaC 조합별 상세 가이드를 분리한다.
solution-architect 의 `decisions.json` 이 `cloud_infra_dev.skill_refs` 로 어느
reference 를 읽을지 지정한다.

### reference 파일 목록

| 파일 | 상태 | 대상 조합 |
|------|------|---------|
| `references/aws-cdk.md` | ★ 상세 구현 | AWS + CDK (TypeScript) |
| `references/aws-terraform.md` | 스텁 | AWS + Terraform (HCL) |
| `references/gcp-cdk.md` | 스텁 | GCP + CDK (CDKTF) |
| `references/gcp-terraform.md` | 스텁 | GCP + Terraform (HCL) |

### decisions.json 연동 방법

```json
{
  "cloud_infra_dev": {
    "skill_refs": ["references/aws-cdk.md"],
    "infra_dir": "infra/aws-cdk",
    "environments": ["dev", "stg", "prod"]
  }
}
```

cloud-infra-dev 는 `skill_refs` 배열에 나열된 reference 파일을 모두 읽고,
`infra_dir` 경로에 IaC 코드를 생성한다.

---

## 작업 흐름

cloud-infra-dev 가 이 스킬을 로드하면 다음 순서로 진행한다:

1. `decisions.json` 읽기 → `cloud_infra_dev` 섹션 파싱
2. `skill_refs` 에 지정된 reference 파일 로드
3. reference 가이드에 따라 IaC 코드 생성
4. 공통 원칙 준수 확인 (태그, secret, 주석, 환경 분리)
5. `cdk synth` (dev/stg/prod) 성공 확인
6. prod snapshot test 실행
7. deploy workflow 생성

---

## 종료 조건

다음을 모두 충족해야 작업 완료로 간주한다:

- [ ] `infra/{dir}/` 전체 생성 (bin/, lib/, shared/, test/, .github/workflows/)
- [ ] `cdk synth --context env=dev` 성공
- [ ] `cdk synth --context env=stg` 성공
- [ ] `cdk synth --context env=prod` 성공
- [ ] prod snapshot test (`npm test`) 통과
- [ ] `deploy-aws.yml` workflow 생성 (OIDC 인증, 환경 게이트 포함)
- [ ] `infra/{dir}/README.md` 생성 (배포 절차, 환경변수, 주의사항 포함)
- [ ] 모든 `.ts` 파일에 한국어 학습용 상세 주석 포함
