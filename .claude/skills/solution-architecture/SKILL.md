---
name: solution-architecture
description: "아키텍처 설계, 클라우드 의사결정, 배포 전략, AWS, GCP, CDK, Terraform, IaC, 리전 전략, ADR, 기술 스택 선택, 인프라 아키텍처, 배포 구조, 클라우드 마이그레이션, cloud architecture, infrastructure decision, 아키텍처 결정, 인프라 설계, 클라우드 배포 요청 시 반드시 이 스킬을 사용한다. solution-architect 에이전트가 사용자 요구사항 수집(Discovery Q&A), 아키텍처 의사결정(ADR 작성), 다이어그램 생성, decisions.json 기록까지의 전체 과정을 가이드하며, 후속 에이전트(project-architect, cloud-infra-dev)가 작업할 기반을 마련한다."
---

# Solution Architecture Skill

solution-architect 에이전트가 아키텍처 의사결정을 내리는 전체 과정을 가이드하는 스킬이다. 코드 스캔 → Gap 분석 → 사용자 Q&A → ADR 작성 → 다이어그램 생성 → decisions.json 기록 → 후속 에이전트 활성화 순으로 진행한다.

## 개요

이 스킬은 solution-architect 에이전트 전용 작업 가이드다. solution-architect 에이전트 정의(`.claude/agents/solution-architect.md`)가 역할·담당 영역·협업 프로토콜을 정의한다면, 이 스킬은 *어떻게 작업하는가*—구체적인 단계·질문 목록·결정 템플릿·종료 조건—을 제공한다.

**핵심 원칙:**
- 코드에서 자동 도출 가능한 정보는 질문하지 않는다
- 리더가 전달한 `initial_constraints`는 재질문 없이 그대로 적용한다
- 모든 주요 결정은 ADR로 추적한다
- `decisions.json`이 모든 후속 에이전트의 단일 진실원(single source of truth)이다

## 워크플로우 (9단계)

### Step 1: 선행 컨텍스트 수집

기존 코드를 스캔하고 리더로부터 전달받은 `initial_constraints`를 확인한다.

**코드 스캔 (자동 도출):**

```
backend/           → 백엔드 언어·프레임워크 확인
frontend/          → 프론트엔드 프레임워크 확인
docker-compose.yml → DB 종류·포트·볼륨 확인
backend/go.mod     → Go 버전·의존성 확인
frontend/package.json → Node 버전·빌드 도구 확인
docs/conventions/  → 기존 컨벤션 확인 (있는 경우)
_workspace/architecture/decisions.json → 기존 결정 확인 (있는 경우)
docs/architecture/ → 기존 다이어그램·ADR 확인 (있는 경우)
```

**initial_constraints 수신 형식 (리더로부터):**

```json
{
  "cloud": "aws",
  "iac": "cdk-ts",
  "region_primary": "ap-northeast-1",
  "compute": "ec2-docker-compose",
  "confirmed_by_user": true
}
```

`confirmed_by_user: true` 항목은 Step 3 Q&A에서 재질문하지 않는다.

### Step 2: Gap 분석

Step 1에서 수집한 정보를 바탕으로 미결정 항목을 도출한다.

**Gap 분석 매트릭스:**

| 항목 | 자동 도출 가능 | initial_constraints | 사용자 Q&A 필요 |
|------|-------------|--------------------|-----------------|
| 백엔드 언어 | O (코드 스캔) | — | — |
| 클라우드 공급자 | — | 있으면 확정 | 없으면 Q1 |
| 트래픽 규모 | — | 있으면 확정 | 없으면 Q2 |
| 가용성 요건 | — | 있으면 확정 | 없으면 Q3 |
| 리전 전략 | — | 있으면 확정 | 없으면 Q4 |
| 컴플라이언스 | — | 있으면 확정 | 없으면 Q5 |
| 컴퓨팅 모델 | — | 있으면 확정 | 필요 시 Q6 |
| IaC 도구 | — | 있으면 확정 | 필요 시 Q8 |

미결정 항목을 목록화하여 Step 3에서 batch 질문을 구성한다.

### Step 3: Discovery Q&A (사용자 대화)

미결정 항목을 사용자에게 batch로 3~5개씩 묻는다. 한 번에 전체를 쏟아붓지 않는다. 리더를 통해 사용자에게 전달한다.

**질문 우선순위:** 무조건 질문하는 항목(Q1~Q5)을 먼저 묻고, 답변에 따라 조건부 항목(Q6~Q10)을 추가로 묻는다.

**상세 질문 목록 및 MVP 기본값:** `references/discovery-questions.md` 참조.

**batch 구성 예시:**

```
[1차 batch — 항상 묻는 5개]
Q1: 배포 대상 클라우드는? (AWS/GCP/Azure/on-prem/미정) [기본: AWS]
Q2: 예상 트래픽 규모는? (MVP/소규모/중규모/대규모) [기본: MVP]
Q3: 가용성 요건은? (best-effort/99%/99.9%/99.99%) [기본: best-effort]
Q4: 리전 전략은? (single-region/multi-region) [기본: single-region]
Q5: 컴플라이언스 요건은? (없음/HIPAA/PCI/GDPR) [기본: 없음]
```

사용자 답변 수신 후 조건부 질문(Q6~Q10) 필요 여부를 판단하여 2차 batch를 구성한다.

### Step 4: ADR 작성

주요 결정(클라우드/IaC/컴퓨트/DB/시크릿/리전/배포전략)마다 ADR 파일을 작성한다.

**저장 위치:** `docs/architecture/adr/`

**파일명 규칙:** `ADR-{NNNN}-{kebab-case-title}.md` (예: `ADR-0001-cloud-provider-aws.md`)

**ADR 템플릿:** `references/adr-template.md` 참조.

**ADR 작성 원칙:**
- "왜 이 결정인가"를 반드시 포함한다
- 검토한 대안과 기각 사유를 표로 정리한다
- 결정 번복 시 기존 ADR에 `Superseded by ADR-NNNN` 마커만 추가하고 새 ADR을 생성한다. 기존 ADR을 삭제·수정하지 않는다

**최소 ADR 목록 (이 프로젝트 기준):**

| ADR 번호 | 제목 | 결정 항목 |
|---------|------|---------|
| 0001 | 클라우드 공급자 선택 | AWS vs GCP vs Azure |
| 0002 | IaC 도구 선택 | CDK vs Terraform vs Pulumi |
| 0003 | 컴퓨팅 모델 선택 | EC2+Docker Compose vs ECS vs Lambda |
| 0004 | 데이터베이스 배포 전략 | RDS vs EC2+Managed vs CloudSQL |
| 0005 | 시크릿 관리 방식 | SSM Parameter Store vs SecretsManager |
| 0006 | 리전 전략 | Single-region vs Multi-region |
| 0007 | 배포 전략 | Blue-Green vs Rolling vs Canary |

### Step 5: 다이어그램 생성

`architecture-diagrams` 스킬을 호출하여 7종 다이어그램을 생성한다.

**호출 방식:** 리더에게 `architecture-diagrams` 스킬 활성화 요청 메시지를 보낸다.

**생성 대상 (7종):**

| 파일명 | 다이어그램 종류 | 설명 |
|--------|-------------|------|
| `system-context.mmd` | C4 Context | 시스템 전체 컨텍스트 |
| `container.mmd` | C4 Container | 컨테이너 구조 |
| `component.mmd` | C4 Component | 컴포넌트 상세 |
| `deployment.mmd` | Deployment | 배포 구조 (AWS 리소스) |
| `sequence-auth.mmd` | Sequence | JWT 인증 흐름 |
| `sequence-crud.mmd` | Sequence | User CRUD 흐름 |
| `er-diagram.mmd` | ER | 데이터베이스 스키마 |

각 `.mmd` 파일에는 동명의 `.md` wrapper 파일을 함께 생성한다. `.md` wrapper는 다이어그램 렌더링 + "왜 이 구조인가" 설명 + 코드 매핑 표를 포함한다.

**저장 위치:** `docs/architecture/`

**`docs/architecture/README.md` 생성:** 7개 다이어그램 + ADR 목록 + decisions.json 위치를 링크로 정리한 인덱스 파일.

### Step 6: decisions.json 작성

모든 아키텍처 결정을 구조화된 JSON으로 기록한다. 이 파일이 모든 후속 에이전트(cloud-infra-dev, project-architect)의 단일 진실원이다.

**저장 위치:** `_workspace/architecture/decisions.json`

**스키마 상세:** `docs/superpowers/specs/2026-04-11-infra-architect-harness-extension-design.md` 섹션 9.3 참조.

**필드 목록 (요약):**

| 필드 | 설명 | 예시값 |
|------|------|------|
| `schema_version` | 스키마 버전 | `"1.0"` |
| `cloud` | 클라우드 공급자·계정·리전 | `{provider, account_id, regions}` |
| `iac` | IaC 도구·언어·디렉토리 | `{tool, language, dir}` |
| `compute` | 컴퓨팅 모델·인스턴스 타입 | `{model, instance_type, orchestrator}` |
| `data` | DB 종류·HA 전략·마이그레이션 도구 | `{engine, ha_strategy, migration_tool}` |
| `networking` | VPC·서브넷·ALB·보안그룹 | `{vpc, subnets, alb, security_groups}` |
| `secrets` | 시크릿 관리 도구·네임스페이스 | `{tool, namespace, rotation}` |
| `observability` | 로그·메트릭·트레이싱 | `{logs, metrics, tracing}` |
| `backup` | 백업 전략·보존 기간 | `{strategy, retention_days}` |
| `cdn` | CDN 공급자·원본 | `{provider, origin}` |
| `dns` | DNS 서비스·도메인 | `{service, domain}` |
| `tls` | TLS 인증서 관리 | `{provider, auto_renew}` |
| `ecr` | 컨테이너 레지스트리 | `{registry, lifecycle_policy}` |
| `deployment` | 배포 전략·롤백 방식 | `{strategy, rollback}` |
| `cicd` | CI/CD 도구·OIDC 연동 | `{tool, oidc_role, pipeline}` |
| `cost_estimate` | 월 예상 비용·Free Tier 활용 | `{monthly_usd, free_tier}` |

**schema validation:**

```bash
# decisions.json이 생성되었는지 확인
test -f _workspace/architecture/decisions.json && echo "OK" || echo "FAIL"

# schema_version 필드 존재 확인
jq -e '.schema_version' _workspace/architecture/decisions.json && echo "OK" || echo "FAIL"

# cloud.provider 필드 존재 확인
jq -e '.cloud.provider' _workspace/architecture/decisions.json && echo "OK" || echo "FAIL"
```

### Step 7: project-architect 재활성화 요청

decisions.json 작성 완료 후, 리더에게 project-architect 재활성화를 요청한다.

**요청 메시지 형식:**

```
[solution-architect → 리더]

decisions.json 작성 완료. project-architect 재활성화를 요청한다.

재활성화 사유:
- decisions.json에 새로운 클라우드 결정이 기록됨
- secrets.md에 SSM Parameter Store 네임스페이스 규칙 추가 필요
- 12-factor.md에 클라우드 환경변수 분리 규칙 추가 필요
- ai-guardrails.md에 AWS 자격증명 관련 가드레일 보강 필요

decisions.json 경로: _workspace/architecture/decisions.json
```

project-architect는 decisions.json을 읽어 클라우드 특화 컨벤션을 `docs/conventions/`에 반영한다.

### Step 8: cloud-infra-dev 활성화 플래그 설정

decisions.json에 `cloud_infra_dev` 활성화 플래그를 기록하여 리더가 cloud-infra-dev를 스폰할 수 있도록 한다.

**decisions.json 내 플래그 위치:**

```json
{
  "cloud_infra_dev": {
    "activate": true,
    "trigger": "decisions.json schema validation 통과 후 자동 활성화",
    "skill_refs": ["cloud-infra-build"],
    "depends_on": [
      "docs/architecture/adr/ 존재",
      "_workspace/architecture/decisions.json 생성",
      "project-architect 컨벤션 갱신 완료"
    ]
  }
}
```

### Step 9: 완료 보고

리더에게 최종 완료 보고를 전송한다.

**보고 형식:**

```
[solution-architect → 리더] 완료 보고

## 생성 파일 목록

### docs/architecture/
- README.md (인덱스)
- system-context.mmd + system-context.md
- container.mmd + container.md
- component.mmd + component.md
- deployment.mmd + deployment.md
- sequence-auth.mmd + sequence-auth.md
- sequence-crud.mmd + sequence-crud.md
- er-diagram.mmd + er-diagram.md

### docs/architecture/adr/
- ADR-0001-cloud-provider-aws.md
- ADR-0002-iac-cdk-typescript.md
- (이하 생략)

### _workspace/architecture/
- decisions.json (schema v1.0)

## 결정 요약
- Cloud: AWS (ap-northeast-1)
- IaC: CDK TypeScript
- Compute: EC2 + Docker Compose
- Secrets: SSM Parameter Store
- Deployment: Rolling update

## 다음 단계
- project-architect 재활성화 완료 요청 (이미 Step 7에서 전송)
- cloud_infra_dev.activate = true (decisions.json 기록 완료)
```

## decisions.json 스키마 포인터

전체 스키마(필드 타입·허용값·검증 규칙)는 설계 스펙 `docs/superpowers/specs/2026-04-11-infra-architect-harness-extension-design.md` 섹션 9.3 참조.

이 SKILL.md에는 필드 목록만 요약하며, 스키마 변경 시 설계 스펙을 먼저 갱신한 뒤 이 파일을 업데이트한다.

## 종료 조건 (5개 모두 충족 시 완료)

| # | 조건 | 검증 방법 |
|---|------|---------|
| 1 | `docs/architecture/README.md` 생성 | `test -f docs/architecture/README.md` |
| 2 | 7개 `.mmd` + 7개 `.md` wrapper 존재 | `ls docs/architecture/*.mmd \| wc -l` → 7 |
| 3 | ADR 파일 1개 이상 존재 | `ls docs/architecture/adr/*.md \| wc -l` → 1 이상 |
| 4 | `decisions.json` 생성 + schema validation 통과 | `jq -e '.schema_version, .cloud.provider' _workspace/architecture/decisions.json` |
| 5 | project-architect 재활성화 요청 메시지 전송 완료 | 리더 확인 |

## 에러 핸들링

| 에러 케이스 | 감지 조건 | 처리 방법 |
|-----------|---------|---------|
| **사용자 잠수** | Discovery Q&A 응답 없음 (reminder 3회 후) | MVP 기본값으로 자동 진행. decisions.json에 `"auto_default": true` 플래그 기록. PR body에 "기본값 자동 적용 항목" 명시 |
| **constraints 불일치** | `initial_constraints`와 코드 스캔 결과가 충돌 | 자동 선택 금지. 사용자에게 두 값을 제시하고 판단 위임. 결정날 때까지 해당 항목 보류 |
| **결정 번복** | 사용자가 이미 확정된 결정을 변경 요청 | 기존 ADR에 `Superseded by ADR-NNNN` 마커 추가 (파일 삭제 금지). 새 ADR 생성. decisions.json 갱신 |
| **mermaid 렌더 실패** | `.mmd` 파일 구문 오류 | 텍스트 소스만 유지 (GitHub이 자동 렌더). `.md` wrapper에 "렌더 확인 필요" 주석 추가. 리더에게 보고 |
| **AWS 계정 ID 모름** | 사용자 미제공 | decisions.json의 `cloud.account_id` 필드에 `"TBD"` placeholder 사용. ADR에도 TBD 명시. cloud-infra-dev에게 배포 전 확인 항목으로 전달 |

## 트리거 매트릭스 (참조)

상세 트리거 조건(리더가 이 스킬을 언제 활성화하는가)은 `fullstack-orchestrator` SKILL.md의 Phase 0-0 참조.

**빠른 참조 — 이 스킬이 활성화되는 주요 상황:**

- 사용자가 클라우드 배포 추가를 요청할 때
- 사용자가 AWS/GCP/IaC/리전/배포 전략 관련 결정을 요청할 때
- `_workspace/architecture/decisions.json`이 없고 배포 구성이 필요할 때
- ADR 작성 또는 아키텍처 문서화 요청 시
- 기존 decisions.json 갱신(리전 추가, 컴퓨팅 모델 변경 등) 요청 시

## 참조 파일

| 파일 | 용도 |
|------|------|
| `references/discovery-questions.md` | Discovery Q&A 질문 목록 + 선택지 + MVP 기본값 |
| `references/architecture-patterns.md` | 5개 아키텍처 패턴 + AWS 서비스 매핑 |
| `references/cloud-tradeoffs.md` | AWS vs GCP 비교 표 + 이 프로젝트의 선택 근거 |
| `references/iac-tradeoffs.md` | CDK vs Terraform vs Pulumi 비교 표 + 선택 근거 |
| `references/adr-template.md` | ADR 파일 작성 템플릿 |
