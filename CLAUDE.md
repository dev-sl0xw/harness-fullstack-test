# Harness Fullstack Test

React + Vite 프론트엔드와 Go(Gin) 백엔드, PostgreSQL을 조합한 풀스택 보일러플레이트 프로젝트.
MVP 우선 접근으로 User CRUD + JWT 인증을 구현하고, Docker Compose와 GitHub Actions CI를 포함한다.

## 주석 규칙

모든 코드 파일에 한국어 학습용 상세 주석을 포함한다:
- 파일 상단: 역할, 시스템 내 위치, 다른 파일과의 관계
- 함수마다: 목적, 파라미터, 반환값, 호출 흐름
- 설계 의도: "왜 이렇게 하는지" 포함

## 기술 스택

- **Backend**: Go 1.22+ / Gin / lib/pq / golang-jwt / bcrypt
- **Frontend**: React 18 / Vite / TypeScript / React Router v6 / CSS Modules
- **DB**: PostgreSQL 16
- **Infra**: Docker Compose / GitHub Actions CI

## 개발 명령어

```bash
# 백엔드 빌드
cd backend && go build ./cmd/server

# 프론트엔드 빌드
cd frontend && npm run build

# Docker Compose 실행
docker compose up -d

# Docker Compose 설정 검증
docker compose config
```

## 설계 문서

- 설계 스펙: `docs/superpowers/specs/2026-04-08-fullstack-harness-design.md`
- 구현 계획: `docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md`

---

## 하네스: Fullstack Builder

**목표:** 풀스택 프로젝트를 에이전트 팀으로 병렬 구현하고 통합 검증한다.

**에이전트 팀:**
| 에이전트 | 역할 |
|---------|------|
| project-architect | 프로젝트 초기 규칙·컨벤션·가드레일 수립 (KISS/YAGNI/DRY/SOLID, 12-Factor, 환경 분리, 비밀 관리, 의존성 위생, AI 가드레일) |
| backend-dev | Go(Gin) 백엔드 전체 (모델, 서비스, 핸들러, 미들웨어, DB) |
| frontend-dev | React 프론트엔드 전체 (라우팅, 인증, 페이지, 컴포넌트) |
| infra-dev | Docker Compose, GitHub Actions CI, 환경설정 |
| qa-engineer | 프론트↔백 경계면 계약 검증, 빌드 확인, 통합 정합성 (incremental) |
| code-reviewer | PR 생성 직전 Codex 기반 코드 품질 second opinion (per-PR) |

**스킬:**
| 스킬 | 용도 | 사용 에이전트 |
|------|------|-------------|
| fullstack-orchestrator | 에이전트 팀 조율, 워크플로우 관리 | 리더 (메인) |
| project-conventions | 프로젝트 원칙·가드레일·환경 분리 reference | project-architect (작성 기준), backend/frontend/infra-dev (작업 reference), code-reviewer (리뷰 기준) |
| backend-build | Go 백엔드 구현 가이드 | backend-dev |
| frontend-build | React 프론트엔드 구현 가이드 | frontend-dev |
| infra-setup | Docker, CI, 설정 구성 가이드 | infra-dev |
| qa-verify | 경계면 계약 검증 방법론 (shape/타입/빌드) | qa-engineer |
| codex-review | Codex CLI 기반 PR 리뷰 + 보고서 작성 가이드 | code-reviewer |

**실행 규칙:**
- 풀스택 구현/빌드/전체 스택 구축 요청 시 `fullstack-orchestrator` 스킬을 통해 에이전트 팀으로 처리하라
- 신규 프로젝트 빌드 시에는 `fullstack-orchestrator`가 Phase 0-5에서 `project-architect`를 호출하여 `docs/conventions/`를 먼저 수립한 뒤 구현 단계로 진행
- 백엔드만/프론트엔드만/인프라만 수정 요청 시에도 오케스트레이터를 통해 해당 에이전트만 재호출
- **PR 생성 직전 README 자동 갱신**: 변경이 README에 반드시 반영되어야 하는 유형(에이전트/스킬 추가·삭제, 디렉토리 구조 변경, 컨벤션 추가, 환경변수/명령어 변경, 외부 서비스 추가, 인증 흐름 변경)이면 오케스트레이터 Phase 4-4가 자동으로 README.md/README_KO.md/README_JA.md 세 파일을 동기화한다. 사용자가 매번 "README도 업데이트해줘"라고 요청하지 않아도 동작. 상세 트리거 표는 `fullstack-orchestrator` SKILL.md의 Phase 4-4 참조
- **PR 생성 직전**에는 `code-reviewer`를 통해 `codex-review` 스킬로 Codex second opinion 리뷰를 1회 수행한 후 PR 생성
- `project-architect`는 **규칙 수립**(초기 1회/규칙 변경 시), `qa-engineer`는 **경계면 계약 검증**(incremental), `code-reviewer`는 **코드 품질 리뷰**(per-PR)로 역할 분리
- 단순 질문/확인은 에이전트 팀 없이 직접 응답해도 무방
- **에이전트 모델 정책 (역할별 분리, 시범 운영 중)**: 아래 "에이전트 모델 정책" 섹션 참조
- 중간 산출물: `_workspace/` 디렉토리 (QA 보고서: `qa_report.md`, 리뷰 보고서: `review_report_*.md`)
- 영구 산출물: `docs/conventions/` (프로젝트 규칙 문서)

**에이전트 모델 정책** (시범 운영 중, 첫 빌드 후 재평가):

| 역할군 | 에이전트 | model | 사유 |
|-------|---------|-------|------|
| 종합 판단 | 리더 (메인 세션) | `opus` | 종합 판단·충돌 중재 |
| 구현 | `backend-dev`, `frontend-dev`, `infra-dev` | **`sonnet`** | 코드 작성·패턴 기반 작업은 sonnet 4.6의 강점. qa+Codex 다중 검증 레이어가 안전망 |
| 검증·판단 | `qa-engineer`, `code-reviewer`, `project-architect` | `opus` | 누락 탐지·추론 깊이·우선순위 판단 정확도가 직접 가치로 변환 |

**시범 운영 평가 — 정량 기준 (rollback/유지/확장 결정에 사용):**

평가는 **첫 sonnet 빌드 1회 + 후속 PR 리뷰 1회 완료 후**에 리더가 수행한다 ("첫 sonnet 빌드"란 PR #11 머지 이후 backend/frontend/infra 중 1개 이상에 변경이 있는 첫 풀스택 작업을 말한다). 다음 기준 중 하나라도 위반되면 **즉시 rollback**:

| 기준 | 측정 | rollback 임계치 |
|------|------|---------------|
| **즉시 rollback (한 건이라도 발견 시)** | qa-engineer가 놓친 mismatch를 code-reviewer/Codex가 후속 검출 | 1건 이상 |
| 즉시 rollback | 구현 코드의 한국어 학습용 상세 주석 규칙(파일 상단 역할/함수별 목적/설계 의도)이 결락 | 1개 파일 이상 |
| 직전 빌드 대비 비교 | code-reviewer/Codex 리뷰의 must-fix 건수 | 직전(opus 빌드) 대비 +2건 이상 증가 |
| 직전 빌드 대비 비교 | qa-engineer가 잡은 경계면 계약 mismatch 건수 | 직전 대비 +50% 이상 증가 |

**기준 미위반 + 평가 완료 → 시범 운영 종료, 정책 확정.**

**평가·종료 절차 (오케스트레이터 Phase 5 정리 단계에서 리더가 수행):**
1. 첫 sonnet 빌드 완료 후 리더는 위 4개 기준을 측정한다 — 측정값을 `_workspace/model_policy_eval_{날짜}.md`에 기록.
2. **GO (정책 확정):** CLAUDE.md "에이전트 모델 정책" 섹션의 "시범 운영 중" 표현을 제거하고 "확정" 상태로 갱신. 변경 이력에 평가 결과 기록. README 3개 언어판도 같은 표현으로 동기화 (Phase 4-4 자동 트리거).
3. **rollback (구현 에이전트도 opus 회복):** 오케스트레이터 Phase 2 spawn 지시를 모두 opus로 되돌리고, 각 에이전트 정의 파일의 권장 model 메타도 opus로 변경. CLAUDE.md / README 3개 언어판도 일괄 opus로 동기화. 변경 이력에 rollback 사유와 평가 측정값을 기록.
4. **연장 (추가 빌드 후 재평가):** 평가 측정값이 경계 영역에 있어 판단이 어려운 경우, "1회 추가 빌드 후 재평가"를 변경 이력에 기록하고 동일 절차를 1회 더 반복. 단 연장은 최대 2회까지 (총 3회 빌드 후에는 GO/rollback 둘 중 하나로 강제 결정).

**주의:** 평가 보고가 한 번도 이루어지지 않은 상태로 빌드가 계속되면 trial 상태가 무한정 지속되어 문서와 실제 운영이 어긋난다. 첫 sonnet 빌드 후 Phase 5에서 *반드시* 평가를 수행하고, 평가 결과를 CLAUDE.md 변경 이력에 기록한다 — 이것이 trial 종료의 필수 조건.

**시스템 레벨 가드레일** (모든 에이전트에 적용):
- **read 금지 파일 패턴**: `.env`, `.env.*`(단 `.env.example`은 허용), `*.pem`, `*.key`, `id_rsa*`, `credentials.json`, `*credentials*.json`, `service-account*.json`, `~/.aws/*`, `~/.ssh/*`, `*.kdbx`, **사용자 홈 디렉토리 쉘 초기화 파일**(`~/.zshrc`, `~/.bashrc`, `~/.profile`, `~/.zprofile` 등 — 환경변수 형태로 secret/토큰이 노출될 수 있음), **git 이력 기반 노출 secret**(과거에 commit되었다 삭제된 secret 파일을 `git log -p`/`git show`로 복원하지 말 것). 위 정책은 사용자 승인으로도 해제되지 않는다 — 필요 시 사용자가 직접 cat/편집기로 확인 (상세: `docs/conventions/ai-guardrails.md` "왜 승인 카테고리를 두지 않는가")
- **write 금지**: 위 파일 모두 + 사용자 시스템 설정 (`~/.gitconfig`, `~/.npmrc`, `~/.ssh/config`) + production config (`config/prod.yaml`)
- **exec 금지** (사용자 명시 승인 없이): `rm -rf` 와일드카드, `git push -f`, `git reset --hard`, prod DB 직접 접근, `curl ... | sh`, `sudo`
- **로깅 금지**: 환경변수 dump, Authorization 헤더, DB 평문 connection string
- 상세 가드레일 및 위반 시 처리: `docs/conventions/ai-guardrails.md` 참조 (`project-architect`가 생성)

**아키텍처 다이어그램:** Claude Code CLI ↔ 에이전트 팀 ↔ Codex CLI ↔ ChatGPT Plus 의 전체 호출 구조/빌링 경계는 `README.md`의 "Harness Architecture — Claude + Codex Dual-Model Design" 섹션(또는 README_KO.md/README_JA.md) 참조. 사용자에게 아키텍처 질문을 받으면 해당 README 섹션을 먼저 읽고 답한다.

**디렉토리 구조** (주요 구조 발췌 — `.claude/settings.json`, `.claude/settings.local.json` 등 설정 파일 생략):
```
.claude/
├── agents/
│   ├── project-architect.md
│   ├── backend-dev.md
│   ├── frontend-dev.md
│   ├── infra-dev.md
│   ├── qa-engineer.md
│   └── code-reviewer.md
└── skills/
    ├── fullstack-orchestrator/
    │   └── SKILL.md
    ├── project-conventions/
    │   └── SKILL.md
    ├── backend-build/
    │   └── SKILL.md
    ├── frontend-build/
    │   └── SKILL.md
    ├── infra-setup/
    │   └── SKILL.md
    ├── qa-verify/
    │   └── SKILL.md
    └── codex-review/
        └── SKILL.md

docs/conventions/        # project-architect 산출물
├── README.md            # 컨벤션 인덱스
├── principles.md        # KISS/YAGNI/DRY + SOLID
├── secrets.md           # 민감 파일 + 비밀 관리
├── 12-factor.md         # 환경 분리 + 12-Factor
├── dependencies.md      # 의존성 위생 (사고 사례 포함)
└── ai-guardrails.md     # AI agent 작업 가드레일
```

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-09 | 초기 구성 | 전체 | 풀스택 하네스 신규 구축 |
| 2026-04-10 | code-reviewer 에이전트 + codex-review 스킬 추가 | agents/code-reviewer.md, skills/codex-review/, fullstack-orchestrator | PR 생성 직전 Codex 기반 독립 second opinion 리뷰 도입. qa-engineer(경계면 계약 검증)와 역할 분리 — 전문성/병렬성/컨텍스트/재사용성 4축 모두 분리가 유리 |
| 2026-04-10 | README 3개 언어판 + 하네스 아키텍처 다이어그램 문서화 | README.md, README_KO.md, README_JA.md, CLAUDE.md | Claude + Codex 이중 모델 구조를 사람이 이해하도록 영/한/일 3개 언어판 README 구성. CLAUDE.md에는 포인터만 남겨 컨텍스트 lean 유지 |
| 2026-04-11 | project-architect 에이전트 + project-conventions 스킬 추가 | agents/project-architect.md, skills/project-conventions/, fullstack-orchestrator, code-reviewer | 프로젝트 초기 규칙·가드레일·환경 분리 골격을 별도 에이전트로 분리(전문성/타이밍/컨텍스트/재사용성 4축 모두 분리 유리). Phase A 8개 항목(KISS/YAGNI/DRY, SOLID, 민감 파일 가드레일, 비밀 관리, 환경 분리, 12-Factor, 의존성 위생, AI 가드레일) 도입. PR #6→#8 의존성 사고 재발 방지 사례 포함 |
| 2026-04-11 | README 자동 갱신 Phase 4-4 추가 | fullstack-orchestrator, CLAUDE.md | 에이전트/스킬/디렉토리 구조/컨벤션/환경변수/명령어/외부서비스/인증흐름 변경 시 PR 생성 직전 README.md+README_KO.md+README_JA.md 세 파일을 자동 동기화. 사용자가 매번 명시 요청하지 않아도 트리거 표 매칭 시 자동 동작. 다국어 drift 방지를 위해 세 파일 동시 갱신 강제 |
| 2026-04-11 | 에이전트 모델 정책: 역할별 분리 (시범 운영) | fullstack-orchestrator, CLAUDE.md, agents/*.md, README × 3 | 일괄 opus → 구현(backend/frontend/infra)=sonnet, 검증·판단(qa/reviewer/architect)+리더=opus 로 분리. 코드 작성은 sonnet 4.6의 강점이고 qa+Codex 다중 검증이 안전망 역할. 시범 운영이며 첫 빌드 후 qa/reviewer 산출물 품질을 사후 검증하여 sonnet 확장 또는 opus 회복 결정. 하네스 스킬의 일괄 opus 권고에서 의식적으로 벗어나는 결정 |
