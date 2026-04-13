# Infra Architect Harness Extension — Design Spec

**Date:** 2026-04-11
**Status:** Draft — awaiting user review
**Related prior docs:**
- `docs/superpowers/specs/2026-04-08-fullstack-harness-design.md` — 원본 풀스택 하네스 설계
- `docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md` — 원본 구현 계획
- `CLAUDE.md` — 하네스 포인터 및 변경 이력

## 1. Purpose & Background

### 1.1 배경

현재 `harness-fullstack-test` 의 하네스(6 에이전트 + 7 스킬)는 **로컬 개발 중심**으로 설계되었다. `infra-dev` 는 Docker Compose 와 GitHub Actions CI 만 담당하며, 다음 역량이 부재하다:

- **아키텍처 설계·시각화** — C4 다이어그램, Deployment diagram, Sequence diagram, ER diagram, ADR 작성
- **클라우드 의사결정** — AWS/GCP 등 cloud provider 선택, 서비스 매핑, 리전 전략
- **IaC(Infrastructure as Code)** — CDK/Terraform 등 도구 기반 인프라 코드 생성
- **Free Tier 범위 내 배포 참조 구현** — 비용 0 원 근사치에서 학습 가능한 실제 AWS 배포 템플릿

또한 사용자는 *이후 신규 프로젝트* 에서 하네스를 재사용할 때, 프로젝트 주제/요구사항에 따라 *에이전트 구성이 동적으로 조립*되는 패턴을 원한다. 즉 "클라우드 없는 프로젝트" 와 "클라우드 배포가 필요한 프로젝트" 에 대해 같은 하네스가 상이한 팀 구성으로 반응해야 한다.

### 1.2 목적

1. **하네스 확장**: 아키텍처 설계·클라우드 IaC 역량을 전담할 에이전트·스킬·템플릿을 추가한다
2. **조건부 활성화**: 새 역량은 사용자 요청에 클라우드/배포 키워드가 포함될 때만 자동 트리거되며, 로컬 전용 프로젝트에는 영향이 없어야 한다
3. **현재 프로젝트 reference 구현**: `harness-fullstack-test` 자체를 첫 번째 대상 프로젝트로 하여, AWS Free Tier 범위에서 비용 0 원에 가깝게 동작하는 실제 reference 구현(`infra/aws-cdk/`) 과 병행 학습 자료(`docs/architecture/` 15 파일 + 11 개 ADR) 을 생성한다
4. **재사용 가능한 템플릿 패턴**: 이후 신규 프로젝트에서 "주제/기술 스택 결정 → 팀 조립 → 구현 → 검증" 이라는 dynamic harness 사이클이 동작하도록 기반을 마련한다

### 1.3 범위에서 제외되는 것

- 실제 AWS 계정 배포(cdk deploy/apply) — 사용자 수동 승인 단계로 분리, 이번 PR 에서는 `cdk synth` 검증만 수행
- GCP / Azure / Terraform / Pulumi / CDKTF 상세 구현 — 관련 reference 파일은 스텁(header + TODO)만 생성. 실제 구현은 추후 요청 시
- 배포 이후의 O&M 자동화 (on-call, runbook, incident response)
- Aurora DB 전환, Multi-region, Disaster Recovery 실구현 — ADR 의 진화 경로로만 기록

## 2. Scope

### 2.1 전달물 구분

이 설계는 **두 개의 PR 로 분할 전달** 된다:

**PR 1 — 하네스 확장 (구조만):**
- `.claude/agents/solution-architect.md` (신규)
- `.claude/agents/cloud-infra-dev.md` (신규)
- `.claude/agents/infra-dev.md` (기존, 범위 축소 문구)
- `.claude/skills/solution-architecture/` (신규)
- `.claude/skills/architecture-diagrams/` (신규)
- `.claude/skills/cloud-infra-build/` (신규)
- `.claude/skills/fullstack-orchestrator/SKILL.md` (수정 — Phase 0-0 신설 외)
- `CLAUDE.md` (하네스 섹션 갱신)
- `README.md` / `README_KO.md` / `README_JA.md` (3 파일 동기 갱신)

→ 이 PR 만으로 머지되면 현재 프로젝트는 기존 로컬 워크플로우 그대로 동작하며, 향후 클라우드 키워드 요청 시만 새 에이전트가 활성화된다.

**PR 2 — 현재 프로젝트 reference 구현 (실산출물):**
- `docs/architecture/` (15 파일: 7 mermaid `.mmd` + 7 markdown wrapper + README)
- `docs/architecture/adr/` (11 ADR)
- `_workspace/architecture/decisions.json`
- `infra/aws-cdk/` (CDK TypeScript 프로젝트)
- `backend/Dockerfile` (migration 바이너리 번들 수정)
- `.github/workflows/deploy-aws.yml` (OIDC 기반 수동 배포 workflow)
- `.github/workflows/ci.yml` (diagrams-lint job 추가)
- `docs/conventions/secrets.md` / `12-factor.md` / `dependencies.md` / `principles.md` (갱신)

### 2.2 전달물이 아닌 것

- PR 3 이후: 실제 AWS 배포(`cdk deploy` 실행) — 사용자 수동
- PR 3 이후: Stage 2 HA 확장, Aurora 전환, Multi-region — 미래 작업

## 3. Constraints

### 3.1 기술적 제약

- **학습용 프로젝트**: 모든 코드에 한국어 학습용 상세 주석 (기존 CLAUDE.md 규칙)
- **Free Tier 비용 0 원 근사**: AWS 청구액 월 $0.50~$2 (12개월 Free Tier 적용 시), 이후 ~$25/월
- **단일 사용자/소규모 트래픽**: HA·auto-scaling 불필요. `availability_target = "best-effort"` 허용
- **기존 코드 불변 원칙**: `backend/` 와 `frontend/` 의 비즈니스 로직은 건드리지 않는다. 예외는 `backend/Dockerfile` 의 migration 바이너리 번들 (cloud-infra-dev 요구)
- **모든 에이전트는 `model: "opus"` 사용** (CLAUDE.md 규칙)

### 3.2 정책적 제약 (유지)

- 시스템 레벨 가드레일 (`.env`, `*.pem`, `~/.ssh/*` read/write 금지) 전부 유지
- `git log -p` 로 과거 secret 파일 복원 금지
- 사용자 수동 승인 없이 `git push -f`, `rm -rf`, prod DB 접근 금지
- Phase 4-5 PR 생성 직전 Codex 리뷰는 IaC 코드에도 적용 (OIDC trust policy, Security Group, SSM SecureString 여부 중점)

### 3.3 리전 화이트리스트

허용 리전: `us-east-1` / `ap-northeast-1` / `ap-northeast-3` — 그 외 리전은 CDK `guards.ts` 에서 throw
- `ap-northeast-1` (도쿄): Primary workload
- `us-east-1` (버지니아북부): Global services (CloudFront ACM 인증서 발급 시만 사용, Free Tier MVP 에서는 Let's Encrypt 로 대체하여 미사용)
- `ap-northeast-3` (오사카): Backup vault (Free Tier 단계에서는 미사용, Stage 2 이후 활성화)

## 4. Key Decisions (brainstorming Q&A 합의)

| # | 질문 | 결정 |
|---|------|------|
| Q1 | 적용 범위 (현재 프로젝트 / 재사용 패턴 / 둘 다) | **둘 다** — 현재 프로젝트에 배포 능력 + 템플릿 패턴 |
| Q2 | 산출물 범위 (구조만 / 구조+reference) | **구조 + 현재 프로젝트 reference 구현** |
| Q3 | 클라우드 + IaC 조합 | **AWS + CDK (TypeScript)** |
| Q4 | Compute 모델 | **EC2 + Docker Compose** (전 환경). ALB/NAT/Secrets Manager 제거 (Free Tier 0 원 목표). 이후 확장 시 옵션 C(하이브리드)로 진화 |
| — | DB engine (MySQL vs PostgreSQL) | **TBD** — 프로젝트 요구사항 확정 후 결정. 스키마는 engine 무관 구조로 작성 |
| — | Observability 범위 | Logs + Metrics (CloudWatch Agent) 만. X-Ray / Dashboards / Alarms 전 환경 off (MVP) |
| — | DB 배포 방식 | RDS 표준 PostgreSQL 또는 MySQL (engine TBD). 전 환경 single-instance, Multi-AZ 제거. 진화 경로 ADR 기록 |
| — | 리전 정책 | us-east-1 / ap-northeast-1 / ap-northeast-3 화이트리스트. MVP 는 ap-northeast-1 단일 사용 |
| — | Phase 0-0 → 0-5 순서 | **solution-architect 먼저, project-architect 가 1 회 실행**하여 일반+클라우드 특화 컨벤션을 동시에 작성 (두 번 실행 방식 폐기) |
| — | 배포 전략 | MVP: 단일 EC2 `restart` (`docker compose pull && up -d`). Stage 2 에서 ASG instance refresh, Stage 3 에서 Blue/Green으로 진화 |
| — | DB schema migration 실행 | one-off 형태 + backward-compatible 필수. MVP 에서는 SSM Run Command 로 EC2 에서 `docker compose exec backend ./migrate up` 실행 |
| — | Snapshot test 범위 | **prod 만** 분리. dev/stg 는 `cdk synth` 성공만 검증 |
| — | 다이어그램 범위 | **7 개** (C4 L1~L3 + deployment + sequence + ER) + `.mmd`/`.md` 이중 저장 + CI diagrams-lint 포함 |

## 5. Design Overview — New Components

### 5.1 디렉토리 변경

```
.claude/
├── agents/
│   ├── project-architect.md     # 기존 — 변경 없음
│   ├── backend-dev.md           # 기존 — 변경 없음
│   ├── frontend-dev.md          # 기존 — 변경 없음
│   ├── infra-dev.md             # 기존 — "로컬" 범위 축소 문구만 수정
│   ├── qa-engineer.md           # 기존 — 변경 없음
│   ├── code-reviewer.md         # 기존 — 변경 없음
│   ├── solution-architect.md    # ★ 신규
│   └── cloud-infra-dev.md       # ★ 신규
└── skills/
    ├── fullstack-orchestrator/  # 기존 — Phase 0-0 신설 등 수정
    ├── project-conventions/     # 기존 — 변경 없음
    ├── backend-build/           # 기존 — 변경 없음
    ├── frontend-build/          # 기존 — 변경 없음
    ├── infra-setup/             # 기존 — 변경 없음
    ├── qa-verify/               # 기존 — 변경 없음
    ├── codex-review/            # 기존 — 변경 없음
    ├── solution-architecture/   # ★ 신규
    │   ├── SKILL.md
    │   └── references/
    │       ├── discovery-questions.md
    │       ├── architecture-patterns.md
    │       ├── cloud-tradeoffs.md
    │       ├── iac-tradeoffs.md
    │       └── adr-template.md
    ├── architecture-diagrams/   # ★ 신규
    │   ├── SKILL.md
    │   └── references/
    │       ├── mermaid-c4-patterns.md
    │       ├── mermaid-sequence-patterns.md
    │       ├── mermaid-deployment-patterns.md
    │       ├── mermaid-er-patterns.md
    │       ├── naming-conventions.md
    │       └── drawio-integration.md
    └── cloud-infra-build/       # ★ 신규
        ├── SKILL.md
        └── references/
            ├── aws-cdk.md          # ★ 이번 PR 상세 작성 (~500 줄)
            ├── aws-terraform.md    # 스텁
            ├── gcp-cdk.md          # 스텁
            └── gcp-terraform.md    # 스텁

docs/
├── conventions/                 # 기존 — 일부 파일 갱신 (PR 2)
├── architecture/                # ★ 신규 디렉토리 (PR 2)
│   ├── README.md
│   ├── context.mmd + context.md
│   ├── container.mmd + container.md
│   ├── component-frontend.mmd + component-frontend.md
│   ├── component-backend.mmd + component-backend.md
│   ├── deployment-aws.mmd + deployment-aws.md
│   ├── sequence-auth.mmd + sequence-auth.md
│   ├── er-schema.mmd + er-schema.md
│   └── adr/
│       ├── 0001-cloud-aws.md
│       ├── 0002-iac-cdk.md
│       ├── 0003-compute-ec2-docker-compose.md
│       ├── 0004-data-rds-progressive.md
│       ├── 0005-secrets-ssm-parameter-store.md
│       ├── 0006-db-evolution-path.md
│       ├── 0007-region-strategy.md
│       ├── 0008-db-schema-migration-strategy.md
│       ├── 0009-deployment-strategy.md
│       ├── 0010-schema-migration-compatibility.md
│       └── 0011-single-ec2-availability.md
└── superpowers/specs/
    └── 2026-04-11-infra-architect-harness-extension-design.md  # ★ 이 파일

infra/                           # ★ 신규 루트 디렉토리 (PR 2)
└── aws-cdk/
    ├── README.md
    ├── package.json
    ├── tsconfig.json
    ├── cdk.json
    ├── .gitignore
    ├── bin/app.ts
    ├── lib/
    │   ├── network-stack.ts
    │   ├── database-stack.ts
    │   ├── ec2-app-stack.ts
    │   ├── frontend-stack.ts
    │   ├── observability-stack.ts
    │   └── shared/
    │       ├── env-config.ts
    │       ├── tags.ts
    │       ├── guards.ts
    │       └── naming.ts
    ├── test/
    │   ├── snapshot.test.ts       # prod 만
    │   └── guards.test.ts
    └── scripts/
        ├── build-and-push.sh
        └── synth-all-envs.sh

_workspace/architecture/         # ★ 신규 (PR 2)
└── decisions.json

.github/workflows/
├── ci.yml                        # 기존 — diagrams-lint job 추가
└── deploy-aws.yml                # ★ 신규
```

### 5.2 역할 경계 (최종)

| 에이전트 | 책임 | 실행 시점 |
|---------|------|---------|
| **solution-architect** (신규) | 요구사항 수집 → 아키텍처 결정 → 7 다이어그램 생성 → ADR 작성 → `decisions.json` 기록 → cloud-infra-dev 활성화 플래그 설정 | Phase 0-0 (클라우드 키워드 트리거 시) |
| **project-architect** (기존) | 일반 컨벤션(KISS/YAGNI/DRY/SOLID, 12-Factor, 의존성 위생) + `decisions.json` 을 읽어 클라우드 특화 섹션(secrets, 환경변수 주입, 리전 가드) 추가. **1 회 실행** | Phase 0-5 (solution-architect 직후) |
| **cloud-infra-dev** (신규) | `infra/{cloud}-{iac}/` 하위 IaC 코드 생성, `cdk synth` 검증, deploy workflow 작성 | Phase 2 (backend-dev 완료 후) |
| **infra-dev** (기존, 범위 축소) | **로컬 Docker Compose**, 로컬 CI(`ci.yml`), 로컬 환경변수, diagrams-lint job 추가 | Phase 2 |
| **backend-dev** (기존) | Go 백엔드 + Dockerfile (migration 바이너리 번들 추가) | Phase 2 |
| **frontend-dev** (기존) | React 프론트엔드 | Phase 2 |
| **qa-engineer** (기존) | 경계면 계약 검증 + `cdk synth` 성공 확인 | Phase 3~4 점진적 |
| **code-reviewer** (기존) | Codex 리뷰 (IaC 코드 포함) | Phase 4-5 (PR 단위) |

### 5.3 데이터 흐름 (high-level)

```
사용자 요청 ("현재 프로젝트에 AWS 배포 추가해줘")
   │
   ├─ Phase 0: 컨텍스트 확인 (기존 코드/컨벤션/architecture 유무)
   │
   ├─ Phase 0-0: solution-architect
   │     ├─ initial_constraints (리더 전달) 파싱
   │     ├─ 코드 스캔 (backend/, frontend/) 으로 자동 도출
   │     ├─ 미확정 항목만 사용자에게 discovery Q&A
   │     ├─ decisions.json 작성 → _workspace/architecture/decisions.json
   │     ├─ architecture-diagrams 스킬로 7 개 다이어그램 생성
   │     └─ 11 개 ADR 작성 → docs/architecture/adr/
   │
   ├─ Phase 0-5: project-architect (1 회 실행)
   │     └─ decisions.json 읽어 docs/conventions/ 파일들 갱신
   │
   ├─ Phase 1: 준비
   │
   ├─ Phase 2: 팀 구성
   │     ├─ backend-dev, frontend-dev, infra-dev, qa-engineer [기본 4명]
   │     └─ + cloud-infra-dev [decisions.cloud_infra_dev.activate === true]
   │
   ├─ Phase 3: 병렬 구현
   │     ├─ backend-dev: Dockerfile 에 migration 바이너리 번들 추가
   │     ├─ frontend-dev: (변경 없음)
   │     ├─ infra-dev: ci.yml 에 diagrams-lint job 추가
   │     ├─ cloud-infra-dev: infra/aws-cdk/ 전체 생성 (backend 완료 후)
   │     └─ qa-engineer: 점진적 검증
   │
   ├─ Phase 4: QA 검증 + 빌드 확인
   │     └─ cdk synth --context env=dev/stg/prod 모두 성공 확인
   │
   ├─ Phase 4-4: README 자동 갱신 (docs/architecture/, infra/aws-cdk/ 트리거)
   ├─ Phase 4-5: Codex 리뷰 (IaC 보안 중점)
   └─ Phase 5: PR 생성 (2 개 PR 로 분할)
```

## 6. Phase 0-0: Solution Architecture Workflow

### 6.1 트리거 매트릭스

`fullstack-orchestrator` Phase 0 에서 다음 분기로 Phase 0-0 실행 여부를 결정한다:

| 코드 | conventions | architecture | 사용자 요청 | 실행 |
|------|-------------|-------------|-----------|------|
| ✗ | ✗ | ✗ | 신규 프로젝트 + 클라우드 키워드 | Phase 0-0 → 0-5 → 1→5 |
| ✗ | ✗ | ✗ | 신규 프로젝트, 클라우드 키워드 없음 | Phase 0-5 → 1→5 (0-0 skip) |
| ✓ | ✓ | ✗ | "클라우드 추가", "AWS 배포", "CDK 세팅" | **Phase 0-0 + cloud-infra-dev 1 회 실행** |
| ✓ | ✓ | ✓ | "아키텍처 수정", "다이어그램 갱신" | Phase 0-0 audit 모드 |
| ✓ | ✓ | ✓ | 일반 기능/버그 수정 | Phase 0-0 skip |
| ✗ | ✓ | ✓ | "구현 다시" (코드만 재생성) | Phase 0-0 skip |

**클라우드 키워드 목록:** `aws`, `gcp`, `azure`, `cloud`, `배포`, `deploy`, `인프라 설계`, `아키텍처`, `architecture`, `cdk`, `terraform`, `iac`, `serverless`, `ecs`, `fargate`, `lambda`, `cloud run`, `kubernetes`, `k8s`, `ec2`, `rds`, `cloud sql`, `s3`, `cloudfront`, `vpc`

### 6.2 solution-architect 단계별 워크플로우

1. **선행 컨텍스트 수집 (자동):** 코드 스캔, 기존 conventions 스캔, 리더 전달 `initial_constraints` 파싱
2. **Gap 분석:** 미확정 항목 리스트 작성
3. **Discovery Q&A:** 최소 5 개 batch 질문 (트래픽, availability, region, compliance, DB HA)
4. **ADR 작성:** 11 개 ADR 초안 → `docs/architecture/adr/`
5. **다이어그램 생성:** `architecture-diagrams` 스킬 호출 → 7 개 `.mmd` + 7 개 `.md` wrapper
6. **decisions.json 작성:** `_workspace/architecture/decisions.json` (schema_version 1.0)
7. **project-architect 연계:** 리더에게 "Phase 0-5 실행 요청 + decisions.json 경로" SendMessage
8. **cloud-infra-dev 활성화 플래그 설정:** `decisions.cloud_infra_dev.activate`
9. **완료 보고 → idle**

### 6.3 discovery-questions.md 핵심 질문 목록

**무조건 물어보는 5 개:**
1. 배포 대상 (AWS / GCP / Azure / on-prem / 미정)
2. 트래픽 규모 (MVP / 소규모 / 중규모 / 대규모)
3. Availability 요구 (best-effort / 99% / 99.9% / 99.99%)
4. 지역 (single-region / multi-region)
5. Compliance (없음 / HIPAA / PCI-DSS / GDPR / 기타)

**조건부:**
6. 컴퓨팅 모델 (container / serverless / VM)
7. 오케스트레이터 (managed ECS / Kubernetes / EC2 + Docker Compose)
8. IaC 도구 (CDK TS / CDK Python / Terraform / Pulumi)
9. DB HA (Multi-AZ / Read replica / Single)
10. CI/CD 접근 (GitHub Actions OIDC / 기존 pipeline)

**자동 도출:** 백엔드 언어·프레임워크, 프론트엔드 프레임워크, DB 종류, 인증 방식

### 6.4 decisions.json 스키마 (Free Tier 반영)

전체 스키마는 섹션 9.3 참조. 주요 변경점:

- `non_functional.cost_target: "aws-free-tier"`
- `compute.backend.type: "ec2-docker-compose"`
- `networking.vpc.nat_gateway: {dev: "none", stg: "none", prod: "none"}`
- `networking.vpc.load_balancer: false`
- `secrets.store: "ssm-parameter-store"`
- `backup.service: "rds-automated-backup"` (AWS Backup 폐기)
- `data.primary.engine: "TBD"`, `engine_candidates: ["postgresql", "mysql"]`
- `tls.service: "lets-encrypt-on-ec2"`

### 6.5 에러 핸들링

| 상황 | 대응 |
|------|------|
| 사용자 discovery 질문 미답변 (3 회 reminder 후) | 기본값 auto-진행 + `auto_default: true` 플래그 + PR body 에 명시 |
| initial_constraints ↔ 코드 스캔 불일치 | 사용자 판단 위임, 자동 선택 금지 |
| 사용자 결정 번복 ("CDK 말고 Terraform") | 새 ADR 로 기록(기존은 `superseded` 마커), decisions.json 갱신, cloud-infra-dev 재실행 |
| mermaid 렌더 실패 | 텍스트 소스만 유지, GitHub 이 자동 렌더 |
| AWS 계정 ID 모름 | `"TBD"` placeholder, README 에 수동 치환 매뉴얼 |

### 6.6 종료 조건

- `docs/architecture/README.md` 생성됨
- 7 개 `.mmd` 파일 + 7 개 `.md` wrapper 존재
- 11 개 ADR 존재
- `_workspace/architecture/decisions.json` + schema validation 통과
- project-architect 재활성화 요청 메시지 전송됨

## 7. cloud-infra-dev Activation & Execution

### 7.1 에이전트 정의 (`.claude/agents/cloud-infra-dev.md`)

**핵심 역할:** `decisions.json` 을 입력으로 받아 `infra/{cloud}-{iac}/` 하위에 IaC 코드 생성·검증·deploy workflow 작성.

**담당 영역:**
- `infra/aws-cdk/` (CDK TypeScript 프로젝트)
- `.github/workflows/deploy-aws.yml`
- `infra/aws-cdk/README.md`
- `infra/aws-cdk/scripts/` (빌드·푸시 헬퍼)

**담당하지 않는 영역:**
- 로컬 `docker-compose.yml`, 로컬 CI → infra-dev
- 백엔드·프론트엔드 코드 → backend-dev / frontend-dev
- 아키텍처 ADR → solution-architect
- 컨벤션 문서 → project-architect
- 실제 `cdk deploy` 실행 → 사용자 수동

**작업 원칙:**
1. `decisions.json` 단일 진실원 — 하드코딩 금지
2. 환경별 stack 분리 금지, 파라미터화 우선 (DRY)
3. 한국어 학습용 상세 주석 의무
4. 리전 화이트리스트 가드 (`shared/guards.ts`)
5. Secret 주입은 SSM Parameter Store 참조 (평문 금지)
6. 모든 리소스에 공통 태그 (`Project`, `Environment`, `ManagedBy`, `Owner`)

### 7.2 활성화·스폰 플로우 (리더 수행)

```
Phase 2 팀 구성 단계:
  1. _workspace/architecture/decisions.json 읽기
  2. decisions.cloud_infra_dev.activate === true 확인
  3. skill_refs 목록 확인 → ["aws-cdk"]
  4. backend-dev 완료 대기 (Dockerfile + 환경변수 계약 필요)
  5. Agent 스폰:
     Agent(
       subagent_type: "general-purpose",
       model: "opus",
       name: "cloud-infra-dev",
       prompt: """
         역할: .claude/agents/cloud-infra-dev.md 읽고 동작
         스킬: .claude/skills/cloud-infra-build/SKILL.md + references/aws-cdk.md 로드
         입력:
           - _workspace/architecture/decisions.json
           - docs/architecture/deployment-aws.mmd
           - docs/conventions/ (secrets, 12-factor, ai-guardrails)
           - backend/Dockerfile
         출력:
           - infra/aws-cdk/
           - .github/workflows/deploy-aws.yml
         검증:
           - cdk synth --context env=dev/stg/prod 모두 성공
           - prod 만 snapshot test 통과
         완료 시: qa-engineer 에게 "cloud infra ready" SendMessage
       """
     )
  6. Task 등록: TaskCreate "클라우드 인프라 구성"
```

**조건부 skip:** `decisions.cloud_infra_dev.activate === false` 또는 `_workspace/architecture/` 미존재 → cloud-infra-dev 스폰 안 함

### 7.3 cloud-infra-build 스킬 구조

```
cloud-infra-build/
├── SKILL.md                    # 공통 원칙, reference 로딩 가이드
└── references/
    ├── aws-cdk.md              # ★ 이번 PR 상세 (~500 줄)
    │   ├─ CDK 프로젝트 scaffold
    │   ├─ Stack 분리 원칙 (5 stack)
    │   ├─ env-config 파라미터화
    │   ├─ SSM Parameter Store 주입
    │   ├─ 리전 가드
    │   ├─ 태그 전파
    │   ├─ EC2 User Data 패턴 (Docker + Compose + Caddy + Let's Encrypt)
    │   ├─ DB schema migration via SSM Run Command
    │   ├─ snapshot test 패턴 (prod 만)
    │   ├─ GitHub Actions OIDC 매뉴얼
    │   └─ engine-swap-checklist (DB engine TBD 대응)
    ├── aws-terraform.md        # 스텁
    ├── gcp-cdk.md              # 스텁
    └── gcp-terraform.md        # 스텁
```

**공통 원칙 (cloud/IaC 무관):**
- 1 환경 = 1 account 권장 (MVP 는 단일 account + resource prefix)
- state 분리: dev/stg/prod 를 tag/resource name 에 반드시 포함
- secret 은 IaC 코드 평문 금지 — 항상 parameter store/secrets manager 참조
- 태그 전파 필수
- `synth`/`plan` 자동, `deploy`/`apply` 수동 승인

### 7.4 협업 프로토콜

| 상대 | 방향 | 내용 |
|------|------|------|
| backend-dev | ← | Dockerfile 경로, 노출 port, 환경변수 목록, health check path |
| backend-dev | → | ECR image URI 형식, SSM Parameter 경로 매핑 |
| frontend-dev | ← | 정적 빌드 경로 |
| frontend-dev | → | CloudFront 배포 URL (TBD placeholder) |
| infra-dev | ↔ | ECR repo 는 cloud-infra-dev 생성, 로컬 docker-compose.yml 은 infra-dev 유지 |
| project-architect | ← | `docs/conventions/secrets.md` 의 SSM 주입 규칙 |
| solution-architect | ← | `decisions.json`, `deployment-aws.mmd` |
| qa-engineer | → | "cloud infra ready" 알림 + synth 로그 경로 |

### 7.5 종료 조건

- `infra/aws-cdk/` 디렉토리 전체 파일 생성 (package.json, tsconfig.json, cdk.json, bin/, lib/, shared/, test/, scripts/, README.md)
- `cdk synth --context env=dev` 성공
- `cdk synth --context env=stg` 성공 (placeholder account)
- `cdk synth --context env=prod` 성공 (placeholder account)
- `npm run test` (prod snapshot test 만) 성공
- `.github/workflows/deploy-aws.yml` 생성 + YAML lint 통과
- `infra/aws-cdk/README.md` 의 "사전 준비" / "bootstrap" / "수동 배포" 섹션 모두 작성
- qa-engineer 에게 완료 메시지 송신

## 8. architecture-diagrams Skill

### 8.1 철학: Mermaid-first

- 텍스트 기반 → git diff 로 변경 가시
- GitHub native 지원 → `.md` 내부 mermaid 블록 자동 렌더
- YAGNI: draw.io 는 MCP/CLI 가용 시에만 병행
- 이번 PR 에선 mermaid only (draw.io MCP 미가정)

### 8.2 스킬 디렉토리 구조

```
architecture-diagrams/
├── SKILL.md
└── references/
    ├── mermaid-c4-patterns.md
    ├── mermaid-sequence-patterns.md
    ├── mermaid-deployment-patterns.md
    ├── mermaid-er-patterns.md
    ├── naming-conventions.md
    └── drawio-integration.md   # 스텁 (fallback 매뉴얼만)
```

### 8.3 현재 프로젝트 다이어그램 목록 (7 개 필수)

| # | 파일명 | 종류 | 학습 포인트 |
|---|--------|------|-----------|
| 1 | `context.mmd` + `.md` | C4 Context (L1) | 시스템 바운더리 |
| 2 | `container.mmd` + `.md` | C4 Container (L2) | Frontend/Backend/DB 분리 |
| 3 | `component-frontend.mmd` + `.md` | C4 Component (L3) | React 내부 — Pages/AuthContext/Router/API Client |
| 4 | `component-backend.mmd` + `.md` | C4 Component (L3) | Go 백엔드 레이어 — Handler→Service→Repository, Middleware |
| 5 | `deployment-aws.mmd` + `.md` | Deployment | AWS 토폴로지 (Free Tier: 단일 EC2 + RDS + S3/CloudFront + Route 53) |
| 6 | `sequence-auth.mmd` + `.md` | Sequence | JWT 발급·검증 플로우 |
| 7 | `er-schema.mmd` + `.md` | ER | users 테이블 + 향후 확장 지점 |

### 8.4 `.md` wrapper 필수 구조 (학습용 병행 자료)

모든 `.md` wrapper 는 다음 4 섹션 포함:

```markdown
# {다이어그램 제목}

## 이 다이어그램이 설명하는 것
{1~2 문장}

## 코드 매핑
| 다이어그램 노드 | 실제 파일 경로 | 주요 함수/컴포넌트 |
|---------------|-------------|----------------|
| ... | ... | ... |

```mermaid
{다이어그램 코드}
```

## 왜 이 구조인가 (설계 의도)
- ...

## 관련 학습 포인트
- ...
```

**핵심**: "코드 매핑" 표를 모든 wrapper 에 의무화 → 다이어그램 노드 ↔ 실제 코드 경로 즉시 확인

### 8.5 네이밍·스타일 컨벤션

- 파일명: `{scope}-{subject}.mmd`
- 노드 ID: kebab-case
- 노드 Label: 한/영 병기 가능
- 색상: Mermaid 기본 테마 (`classDef` 로 환경/레이어 구분)
- 방향: flowchart 기본 `TB`
- 외부 서비스: 점선 화살표
- 민감 정보 흐름: 별도 색상 강조

### 8.6 CI diagrams-lint job

`.github/workflows/ci.yml` 에 신규 job 추가 (infra-dev 담당):

```yaml
diagrams-lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '20' }
    - name: Validate Mermaid diagrams
      run: |
        set -e
        for mmd in docs/architecture/*.mmd; do
          npx -y @mermaid-js/mermaid-cli -i "$mmd" -o /tmp/$(basename "$mmd" .mmd).svg
        done
    - name: Verify diagram count (≥7)
      run: |
        count=$(ls docs/architecture/*.mmd | wc -l)
        [ "$count" -ge 7 ] || { echo "Expected ≥7, found $count"; exit 1; }
    - name: Verify .mmd ↔ .md pairing
      run: |
        for mmd in docs/architecture/*.mmd; do
          [ -f "${mmd%.mmd}.md" ] || { echo "Missing wrapper for $mmd"; exit 1; }
        done
```

### 8.7 종료 조건

- 7 개 `.mmd` + 7 개 `.md` wrapper 생성
- 모든 `.md` wrapper 에 "코드 매핑" 표 포함
- `docs/architecture/README.md` 에서 7 개 모두 링크
- CI `diagrams-lint` job 추가 (infra-dev 담당)
- mermaid-cli 로 로컬 검증 통과

## 9. Current Project Reference Implementation (infra/aws-cdk/)

### 9.1 Stack 분리 (Free Tier: 5 Stack)

| # | Stack | 역할 |
|---|-------|------|
| 1 | **NetworkStack** | VPC (cdk-default CIDR), public subnet 1 개, isolated subnet 1 개 (RDS), SG 세트 (app/db). NAT Gateway 없음, ALB 없음 |
| 2 | **DatabaseStack** | RDS (engine TBD, db.t3.micro, single-instance, Multi-AZ 없음) + SSM Parameter 구조 |
| 3 | **Ec2AppStack** | ECR Repository + IAM Role + Launch Template (User Data: Docker + Compose + ECR login + SSM fetch compose + docker compose up) + EC2 instance + Elastic IP + Route 53 record (stg/prod) |
| 4 | **FrontendStack** | S3 bucket (private, OAC) + CloudFront (WAF 없음, ACM 없음, PriceClass_100) |
| 5 | **ObservabilityStack** | CloudWatch Log Groups only (Dashboards/Alarms/X-Ray 전부 없음) |

**폐기된 Stack:** BackupStack (RDS 자동 백업으로 대체), MigrationTaskStack (SSM Run Command 로 대체)

### 9.2 Stack 의존성 그래프

```
NetworkStack
   ├── DatabaseStack (VPC, dbSG)
   ├── Ec2AppStack (VPC, publicSubnet, appSG, dbSecret, dbEndpoint)
   └── FrontendStack (독립)
        └── ObservabilityStack (ec2Instance, dbInstance)
```

### 9.3 전체 decisions.json 스키마 (Free Tier 반영)

```jsonc
{
  "schema_version": "1.0",
  "created_at": "2026-04-11T00:00:00Z",
  "updated_at": "2026-04-11T00:00:00Z",

  "project": {
    "name": "harness-fullstack-test",
    "owner": "TBD",
    "stack": {
      "backend": "go/gin",
      "frontend": "react/vite/ts",
      "database": "TBD"
    }
  },

  "non_functional": {
    "allowed_regions": ["us-east-1", "ap-northeast-1", "ap-northeast-3"],
    "region_roles": {
      "primary_workload": "ap-northeast-1",
      "backup_vault": null,
      "global_services": "us-east-1"
    },
    "traffic_scale": "mvp",
    "cost_target": "aws-free-tier",
    "availability_target_current": "best-effort",
    "availability_target_future": "99.9",
    "compliance": []
  },

  "cloud": {
    "provider": "aws",
    "accounts": { "dev": "TBD", "stg": "TBD", "prod": "TBD" }
  },

  "iac": {
    "tool": "cdk",
    "language": "typescript",
    "directory": "infra/aws-cdk"
  },

  "compute": {
    "backend": {
      "type": "ec2-docker-compose",
      "image_registry": "ecr",
      "per_environment": {
        "dev":  {"instance_type": "t3.micro", "count": 1, "ami": "al2023", "user_data_version": 1},
        "stg":  {"instance_type": "t3.micro", "count": 1, "ami": "al2023", "user_data_version": 1},
        "prod": {"instance_type": "t3.micro", "count": 1, "ami": "al2023", "user_data_version": 1}
      },
      "runtime": {
        "docker_version": "24.x",
        "docker_compose_plugin": "v2",
        "reverse_proxy": "caddy",
        "ssm_agent": true
      }
    },
    "frontend": {
      "type": "s3-cloudfront"
    }
  },

  "data": {
    "primary": {
      "engine": "TBD",
      "engine_candidates": ["postgresql", "mysql"],
      "version": null,
      "per_environment": {
        "dev":  {"deploy_type": "single-instance", "instance_class": "db.t3.micro", "multi_az": false, "reader_replicas": 0, "storage_gb": 20, "backup_retention_days": 1},
        "stg":  {"deploy_type": "single-instance", "instance_class": "db.t3.micro", "multi_az": false, "reader_replicas": 0, "storage_gb": 20, "backup_retention_days": 7},
        "prod": {"deploy_type": "single-instance", "instance_class": "db.t3.micro", "multi_az": false, "reader_replicas": 0, "storage_gb": 20, "backup_retention_days": 7}
      },
      "endpoints": {
        "writer_env_var": "DATABASE_URL",
        "reader_env_var": null
      }
    }
  },

  "networking": {
    "vpc": {
      "cidr_strategy": "cdk-default",
      "public_subnets": 1,
      "private_subnets": 0,
      "isolated_subnets": 1,
      "nat_gateway": { "dev": "none", "stg": "none", "prod": "none" },
      "load_balancer": false
    }
  },

  "secrets": {
    "store": "ssm-parameter-store",
    "tier": "standard",
    "per_environment": {
      "dev":  { "rotation": false },
      "stg":  { "rotation": false },
      "prod": { "rotation": false }
    }
  },

  "observability": {
    "per_environment": {
      "dev":  { "logs": "cloudwatch-logs", "metrics": "cloudwatch-agent", "traces": null, "dashboards": false, "alarms": false },
      "stg":  { "logs": "cloudwatch-logs", "metrics": "cloudwatch-agent", "traces": null, "dashboards": false, "alarms": false },
      "prod": { "logs": "cloudwatch-logs", "metrics": "cloudwatch-agent", "traces": null, "dashboards": false, "alarms": false }
    }
  },

  "backup": {
    "service": "rds-automated-backup",
    "per_environment": {
      "dev":  { "enabled": false, "retention_days": 1 },
      "stg":  { "enabled": true,  "retention_days": 7 },
      "prod": { "enabled": true,  "retention_days": 7 }
    }
  },

  "cdn": {
    "service": "cloudfront",
    "per_environment": {
      "dev":  { "cache_policy": "no-cache", "waf": false, "price_class": "PriceClass_100" },
      "stg":  { "cache_policy": "default",  "waf": false, "price_class": "PriceClass_100" },
      "prod": { "cache_policy": "default",  "waf": false, "price_class": "PriceClass_100" }
    }
  },

  "tls": {
    "service": "lets-encrypt-on-ec2",
    "per_environment": {
      "dev":  { "cert": null },
      "stg":  { "cert": "lets-encrypt", "renewal": "auto-caddy" },
      "prod": { "cert": "lets-encrypt", "renewal": "auto-caddy" }
    }
  },

  "dns": {
    "managed_service": "route53",
    "hosted_zone_cost_usd_per_month": 0.50,
    "hosted_zone": { "dev": null, "stg": "TBD", "prod": "TBD" }
  },

  "ecr": {
    "lifecycle_policy": { "keep_last": 10, "untagged_expire_days": 7 }
  },

  "deployment": {
    "strategy": {
      "per_environment": {
        "dev":  { "type": "restart", "description": "EC2 에서 docker compose pull && up -d (in-place)" },
        "stg":  { "type": "restart", "description": "동일" },
        "prod": { "type": "restart", "description": "brief downtime 허용. Stage 2 에서 ASG instance refresh 로 전환" }
      }
    }
  },

  "cicd": {
    "ci": "github-actions",
    "cd": {
      "method": "github-actions-oidc",
      "apply_trigger": {
        "dev":  "manual-workflow-dispatch",
        "stg":  "manual-approval",
        "prod": "manual-approval-with-review"
      }
    }
  },

  "cloud_infra_dev": {
    "activate": true,
    "skill_refs": ["aws-cdk"],
    "output_directory": "infra/aws-cdk"
  },

  "architecture_docs": {
    "directory": "docs/architecture",
    "diagrams": [
      "context.mmd",
      "container.mmd",
      "component-frontend.mmd",
      "component-backend.mmd",
      "deployment-aws.mmd",
      "sequence-auth.mmd",
      "er-schema.mmd"
    ],
    "wrappers_format": {
      "required_sections": ["설명", "코드 매핑", "다이어그램", "설계 의도", "학습 포인트"]
    },
    "adrs": [
      "0001-cloud-aws.md",
      "0002-iac-cdk.md",
      "0003-compute-ec2-docker-compose.md",
      "0004-data-rds-progressive.md",
      "0005-secrets-ssm-parameter-store.md",
      "0006-db-evolution-path.md",
      "0007-region-strategy.md",
      "0008-db-schema-migration-strategy.md",
      "0009-deployment-strategy.md",
      "0010-schema-migration-compatibility.md",
      "0011-single-ec2-availability.md"
    ]
  },

  "conventions_updates_requested": [
    "docs/conventions/secrets.md: SSM Parameter Store 주입 방식 + SecureString 필수 전환 매뉴얼",
    "docs/conventions/12-factor.md: EC2 User Data → docker compose env_file 주입 흐름",
    "docs/conventions/dependencies.md: CDK 버전 핀 정책 (aws-cdk-lib ^2.150.0)",
    "docs/conventions/principles.md: 리전 화이트리스트 가드 패턴 + DB engine 무관 스키마"
  ],

  "cost_estimate": {
    "free_tier_monthly_usd": 0.50,
    "post_free_tier_monthly_usd": 25,
    "free_tier_duration_months": 12,
    "line_items": {
      "ec2_t3_micro": "free 12mo → ~8",
      "rds_t3_micro": "free 12mo → ~15",
      "route53_hosted_zone": "0.50",
      "s3_cloudfront": "within free tier",
      "ssm_parameter_store": "0 (standard tier)",
      "cloudwatch_logs": "within free tier (<5GB)",
      "ecr_private": "within free tier (<500MB)"
    }
  }
}
```

### 9.4 `bin/app.ts` 구조

CDK App 엔트리 — env context 파싱, 리전 가드, 5 Stack 조립. 전체 구현은 cloud-infra-build skill reference 에서 제공.

주요 책임:
1. `env` context 파싱 (`dev`/`stg`/`prod`)
2. `loadDecisions()` 로 `_workspace/architecture/decisions.json` 로드
3. `resolveEnvConfig(decisions, env)` 로 env 별 설정 추출
4. `assertAllowedRegion()` 로 허용 리전 검증
5. 5 개 Stack 순차 조립 + 의존성 주입
6. `applyCommonTags()` 로 태그 부여
7. `app.synth()`

### 9.5 `Ec2AppStack` 핵심 구성 요소

- **ECR Repository** (lifecycle: keep_last 10, untagged_expire 7d, imageScanOnPush)
- **IAM Role** (`AmazonSSMManagedInstanceCore` + ECR pull + SSM GetParameter on `/hft/{env}/*`)
- **Launch Template** (AL2023, t3.micro, User Data)
- **User Data 스크립트**:
  1. docker + git 설치
  2. docker compose plugin v2 설치 (curl from GitHub release)
  3. ECR login (`aws ecr get-login-password`)
  4. `/opt/hft/docker-compose.yml` 을 SSM Parameter 에서 fetch
  5. `.env` 파일 생성 (비-secret 만)
  6. `docker compose pull && up -d`
- **EC2 Instance** (public subnet)
- **Elastic IP** (instance 에 attach)
- **SSM StringParameter placeholder** (`/hft/{env}/JWT_SECRET` = "REPLACE_ME") — 사용자가 수동 SecureString 변환
- **Route 53 ARecord** (stg/prod, hosted zone 존재 시)
- **CfnOutput**: ElasticIp, EcrRepoUri, InstanceId

### 9.6 DB schema migration 실행

**전략:** SSM Run Command 로 EC2 에서 `docker compose exec -T backend ./migrate up` 실행

**backend Dockerfile 수정** (backend-dev 담당):
- multi-stage build 의 final stage 에 migration 바이너리 번들
- 예: `goose` 또는 golang-migrate CLI 를 COPY
- 또는 Go 코드 내부에 migration 로직 포함 후 `./migrate` subcommand 로 호출

**실행 순서 (backward-compatible 필수):**
```
1. build-and-push-image    (backend Docker → ECR)
2. migrate                  (SSM Run Command → docker compose exec migrate)
3. deploy-app               (cdk deploy → User Data 가 새 이미지로 docker compose pull/up)
```

→ schema 가 backward-compatible 이어야 구버전 코드가 신 스키마에서도 동작 가능 (drop column 금지, add column 허용)

### 9.7 배포 전략 (환경별)

Free Tier MVP 에서는 전 환경 `restart`:
- `docker compose pull && docker compose up -d`
- brief downtime 허용 (수 초)
- Stage 2 로 전환 시 ASG instance refresh (in-place rolling)
- Stage 3 로 전환 시 ALB + 2 개 ASG Blue/Green

### 9.8 `infra/aws-cdk/README.md` 섹션

- 사전 준비 (AWS 계정, IAM user, AWS CLI, OIDC role 수동 생성)
- CDK bootstrap (ap-northeast-1)
- 환경별 synth (`npm run synth:dev/stg/prod`)
- 수동 배포 (`npx cdk deploy --all --context env=dev`)
- GitHub Actions 자동 배포 설정
- SSM Parameter 수동 SecureString 변환 매뉴얼
- Route 53 hosted zone 수동 생성 매뉴얼 (stg/prod)
- 트러블슈팅 (User Data 실패, Let's Encrypt 실패 등)
- CDK 학습용 주석 인덱스

### 9.9 Snapshot test (prod 만)

```typescript
// test/snapshot.test.ts
describe('Ec2AppStack (prod)', () => {
  it('matches snapshot', () => {
    const app = new cdk.App();
    const stack = new Ec2AppStack(app, 'TestProd', { /* prod mock */ });
    expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
  });
});
```

→ dev/stg 는 `cdk synth` 성공만 검증, snapshot 파일 없음 (유지보수 부담 감소)

### 9.10 `package.json` 주요 의존성

```json
{
  "dependencies": {
    "aws-cdk-lib": "^2.150.0",
    "constructs": "^10.0.0",
    "source-map-support": "^0.5.21"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "aws-cdk": "^2.150.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.0",
    "typescript": "~5.3.0"
  },
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "test": "jest",
    "synth:dev": "cdk synth --context env=dev",
    "synth:stg": "cdk synth --context env=stg",
    "synth:prod": "cdk synth --context env=prod",
    "synth:all": "npm run synth:dev && npm run synth:stg && npm run synth:prod"
  }
}
```

## 10. Orchestrator / CLAUDE.md / README Updates

### 10.1 `.claude/skills/fullstack-orchestrator/SKILL.md` 수정

**A. 에이전트 구성 표** — 2 줄 추가 (solution-architect, cloud-infra-dev)

**B. Phase 순서** — Phase 0-0 신설 (섹션 6.1~6.2 참조)

**C. Phase 0-5** — 1 회 실행 (두 번 실행 폐기)

**D. Phase 2 팀 구성** — `decisions.cloud_infra_dev.activate === true` 일 때 5 명, 그 외 기본 4 명

**E. Phase 4-4 README 트리거 표** — `docs/architecture/*`, `infra/{cloud}-{iac}/*`, `_workspace/architecture/decisions.json` 추가

**F. Phase 4-5** — IaC 코드도 Codex 리뷰 범위 (IAM trust policy, SG 0.0.0.0/0, SSM SecureString 중점)

**G. 변경 이력** — 1 줄 추가

**H. 테스트 시나리오** — 섹션 11 참조

**I. description 업데이트** — 클라우드/배포/아키텍처/CDK/Terraform 키워드 추가 (후속 요청 트리거)

### 10.2 `.claude/agents/infra-dev.md` 수정

- 핵심 역할 문구에 "**로컬** Docker Compose + GitHub Actions CI + 설정 파일" 로 "로컬" 명시
- 담당 영역에 "`.github/workflows/ci.yml` 에 `diagrams-lint` job 추가" 1 줄 포함
- 담당하지 않는 영역에 "클라우드 IaC (cloud-infra-dev 담당)" 명시

### 10.3 CLAUDE.md 수정

- 하네스 섹션 에이전트 표 2 줄 추가
- 하네스 섹션 스킬 표 3 줄 추가
- 디렉토리 구조 갱신 (`.claude/agents/{solution-architect,cloud-infra-dev}.md`, `.claude/skills/{solution-architecture,architecture-diagrams,cloud-infra-build}/`, `docs/architecture/`, `infra/aws-cdk/`, `_workspace/architecture/`)
- 변경 이력 1 줄 추가
- 실행 규칙 1 줄 추가 — "클라우드 배포/AWS/GCP/CDK/Terraform 언급 시 fullstack-orchestrator 가 Phase 0-0 자동 트리거"

### 10.4 README 3 개 언어판 수정 (동기 갱신 필수)

- 에이전트 목록: solution-architect / cloud-infra-dev 2 개 추가
- 스킬 목록: solution-architecture / architecture-diagrams / cloud-infra-build 3 개 추가
- 프로젝트 구조 트리: `docs/architecture/`, `infra/aws-cdk/` 추가
- 기술 스택: "Infra (optional)" 에 AWS + CDK TypeScript + Let's Encrypt 추가
- Getting Started: "AWS 배포 (optional)" 섹션 신설 + Free Tier 비용 면책 ($0.50~$25/월)
- Harness Architecture 다이어그램: Phase 0-0 + solution-architect 반영

**언어 drift 방지**: 영/한/일 3 파일 동일 정보 단순 미러링

## 11. Testing Scenarios

### 11.1 정상 흐름 A — 로컬 전용 (기존 유지)

1. 사용자: "풀스택 구현해줘"
2. Phase 0: 초기 실행 모드
3. Phase 0-0: skip (클라우드 키워드 없음)
4. Phase 0-5: project-architect 일반 컨벤션 수립
5. Phase 1~5: 기존 흐름 그대로

### 11.2 정상 흐름 B — 클라우드 추가 (신규)

1. 사용자: "현재 프로젝트에 AWS 배포 추가해줘"
2. Phase 0: 기존 코드 + conventions + no architecture → Phase 0-0 실행 모드
3. Phase 0-0: solution-architect 스폰
   - initial_constraints: `{cloud: "aws", iac_tool: "cdk", iac_language: "typescript", compute_model: "ec2-docker-compose"}`
   - discovery Q&A: 5 개 질문 batch (사용자 "기본값" 응답 시 auto 진행)
   - decisions.json 작성 (engine TBD 포함)
   - 7 다이어그램 + 11 ADR 생성
4. Phase 0-5: project-architect 가 decisions.json 읽어 secrets.md/12-factor.md 갱신
5. Phase 2: backend-dev 재호출 (Dockerfile migration 바이너리 번들), infra-dev 재호출 (ci.yml diagrams-lint), cloud-infra-dev 신규 스폰
6. Phase 3: cloud-infra-dev 가 `infra/aws-cdk/` 전체 생성 (backend-dev 완료 후)
7. Phase 4: qa-engineer 가 `cdk synth dev/stg/prod` 성공 확인 + prod snapshot test 통과
8. Phase 4-4: README 자동 갱신 (3 파일)
9. Phase 4-5: Codex 리뷰 (IAM trust policy, SG, SSM SecureString 중점)
10. Phase 5: PR 생성 (2 개 분할)

### 11.3 에러 흐름 A — discovery 잠수

- solution-architect 가 discovery 중 사용자 3회 reminder → 기본값 auto-진행
- decisions.json 의 해당 필드에 `auto_default: true` 플래그
- PR body 에 기본값 명시

### 11.4 에러 흐름 B — cdk synth 실패

- cloud-infra-dev 의 `cdk synth --context env=stg` 실패
- 3 회 retry 후 실패 내용 `_workspace/cloud-infra-dev_error.md` 기록
- 리더가 사용자 보고

### 11.5 에러 흐름 C — AWS account ID 미결정

- `decisions.cloud.accounts` 에 `"TBD"` → CDK context 에서 `AWS_ACCOUNT_PLACEHOLDER` 사용
- `cdk synth` 성공 (placeholder 로)
- README 에 "실제 배포 시 account ID 치환" 매뉴얼

### 11.6 에러 흐름 D — Codex 미설치/쿼터 소진

- code-reviewer 가 `_workspace/review_report_*.md` 에 stub 보고서 생성
- 필수 필드: `status: "Codex unavailable"`, `reason`, `retry_count`, `manual_review_performed`, `merge_recommendation`
- PR body 에 "Codex 리뷰 누락" 명시 후 Phase 5 진행

## 12. Risks & Mitigations

| 리스크 | 영향 | 완화 |
|-------|------|------|
| Discovery Q&A 사용자 피로 | 높음 | 자동 도출 우선, 최소 5 개 필수, 기본값 세트 |
| decisions.json 스키마 미래 변경 | 중간 | `schema_version` 필드, project-architect dependencies.md 에 이력 |
| Free Tier 0 원 가정 vs 실제 비용 차이 | 낮음 | `cost_estimate` 에 월 $0.50 표기, README 에 "$0~$2 변동" 고지 |
| EC2 User Data 실패 디버깅 | 중간 | CloudWatch Agent 로 `/var/log/cloud-init-output.log` 수집, SSM Session Manager 접속 |
| Let's Encrypt 발급 실패 | 중간 | Caddy 자동 재시도, staging 환경 사용 가능, README 트러블슈팅 |
| SSM Parameter 평문 유출 | **높음** | 초기 placeholder 는 String, 사용자가 SecureString 수동 전환. `cloud-infra-build/references/aws-cdk.md` 강조 + codex-review 필수 검증 |
| 단일 EC2 장애 전면 다운 | 중간 | ADR `0011` 에 best-effort SLA 명시, Stage 2 로 ASG 전환 경로 |
| Q2 DB engine 미정으로 cloud-infra-dev 중단 | 높음 | `cloud-infra-build/references/aws-cdk.md` 를 engine 무관 구조로 작성, `engine-swap-checklist.md` 포함 |
| 리전 화이트리스트 가드가 us-east-1 사용 시 오해 | 낮음 | `guards.ts` 주석 + 테스트 (Free Tier MVP 에서는 us-east-1 미사용) |
| backend Dockerfile 수정으로 기존 로컬 compose 깨짐 | 중간 | multi-stage 에 migration 바이너리 추가만 수행, 기존 entrypoint 변경 금지. backend-dev 작업 후 로컬 `docker compose up` 재검증 |
| CDK L3 construct 버전 호환성 | 낮음 | `aws-cdk-lib ^2.150.0` 으로 caret range 고정, major 수동 업그레이드 |
| PR 1 과 PR 2 사이 시간차로 하네스-산출물 불일치 | 낮음 | PR 1 머지 후 PR 2 를 즉시 진행, 중간에 다른 작업 섞지 않음 |

## 13. PR Strategy

### 13.1 PR 1 — 하네스 확장 (구조만)

**파일 목록:**
- `.claude/agents/solution-architect.md`
- `.claude/agents/cloud-infra-dev.md`
- `.claude/agents/infra-dev.md` (범위 축소 수정)
- `.claude/skills/solution-architecture/SKILL.md` + `references/*`
- `.claude/skills/architecture-diagrams/SKILL.md` + `references/*`
- `.claude/skills/cloud-infra-build/SKILL.md` + `references/aws-cdk.md` + 3 개 스텁
- `.claude/skills/fullstack-orchestrator/SKILL.md` (수정)
- `CLAUDE.md` (수정)
- `README.md` / `README_KO.md` / `README_JA.md` (수정)

**머지 후 효과:** 현재 프로젝트는 로컬 워크플로우 그대로 유지. 향후 클라우드 키워드 요청 시 새 에이전트 자동 활성화.

### 13.2 PR 2 — 현재 프로젝트 reference 구현

**파일 목록:**
- `docs/architecture/README.md`
- `docs/architecture/{context,container,component-frontend,component-backend,deployment-aws,sequence-auth,er-schema}.mmd` (7 파일)
- `docs/architecture/{동일 7 개}.md` (7 파일)
- `docs/architecture/adr/0001~0011-*.md` (11 파일)
- `_workspace/architecture/decisions.json`
- `infra/aws-cdk/` 전체 (~25 파일)
- `backend/Dockerfile` (migration 바이너리 번들)
- `.github/workflows/deploy-aws.yml` (신규)
- `.github/workflows/ci.yml` (diagrams-lint job 추가)
- `docs/conventions/{secrets,12-factor,dependencies,principles}.md` (갱신)

**의존성:** PR 1 이 먼저 머지되어 있어야 함.

### 13.3 rollback 시나리오

- PR 1 rollback: PR 2 의존성 깨짐 → PR 2 도 revert. 하네스 기존 상태 복귀
- PR 2 만 rollback: PR 1 의 구조만 남음, 실제 reference 없음 → 추후 별도 PR 로 보완 가능
- PR 1 + PR 2 모두 머지 후 문제 발생: 한 번에 revert (git revert 2 개 커밋)

## 14. Pending Decisions (TBD)

1. **DB engine**: MySQL vs PostgreSQL — 프로젝트 요구사항 확정 후 결정. 현재는 `"TBD"` placeholder. `cloud-infra-build/references/aws-cdk.md` 의 DatabaseStack 섹션에 engine-swap-checklist 포함.
2. **AWS account ID**: dev/stg/prod 각각 — 사용자가 실제 배포 시 치환. `decisions.cloud.accounts` 에 `"TBD"` placeholder.
3. **Route 53 hosted zone (stg/prod)**: 사용자가 수동 생성 후 hosted zone ID 를 decisions.json 에 입력.
4. **GitHub Environment (stg/prod) reviewer 설정**: 사용자가 GitHub Repo Settings 에서 수동 구성. README 에 매뉴얼.
5. **OIDC IAM Role trust policy**: 초기 1 회 사용자가 수동 생성. `infra/aws-cdk/README.md` 에 bootstrap 매뉴얼.
6. **Aurora 전환 시점**: `0006-db-evolution-path.md` 의 전환 체크리스트 참조. 현재 MVP 에서는 보류.
7. **Multi-region / ASG 전환**: Stage 2 (HA 요구 발생 시)로 미룸.

## 15. Change Log (of this spec document)

| 날짜 | 변경 | 작성자 |
|------|------|-------|
| 2026-04-11 | 초안 작성 (Q1~Q4 합의 + Free Tier 제약 반영 + 7 다이어그램 + 11 ADR + 2 개 PR 분할) | 사용자 + Claude (brainstorming dialogue) |

---

**Next Step:** 이 spec 에 대한 사용자 검토 (수정 요청 반영 후) → `superpowers:writing-plans` 스킬로 전환하여 구현 계획 문서(`docs/superpowers/plans/YYYY-MM-DD-*.md`) 작성.
