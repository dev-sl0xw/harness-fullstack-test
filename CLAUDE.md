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
| backend-dev | Go(Gin) 백엔드 전체 (모델, 서비스, 핸들러, 미들웨어, DB) |
| frontend-dev | React 프론트엔드 전체 (라우팅, 인증, 페이지, 컴포넌트) |
| infra-dev | Docker Compose, GitHub Actions CI, 환경설정 |
| qa-engineer | 프론트↔백 경계면 계약 검증, 빌드 확인, 통합 정합성 (incremental) |
| code-reviewer | PR 생성 직전 Codex 기반 코드 품질 second opinion (per-PR) |

**스킬:**
| 스킬 | 용도 | 사용 에이전트 |
|------|------|-------------|
| fullstack-orchestrator | 에이전트 팀 조율, 워크플로우 관리 | 리더 (메인) |
| backend-build | Go 백엔드 구현 가이드 | backend-dev |
| frontend-build | React 프론트엔드 구현 가이드 | frontend-dev |
| infra-setup | Docker, CI, 설정 구성 가이드 | infra-dev |
| qa-verify | 경계면 계약 검증 방법론 (shape/타입/빌드) | qa-engineer |
| codex-review | Codex CLI 기반 PR 리뷰 + 보고서 작성 가이드 | code-reviewer |

**실행 규칙:**
- 풀스택 구현/빌드/전체 스택 구축 요청 시 `fullstack-orchestrator` 스킬을 통해 에이전트 팀으로 처리하라
- 백엔드만/프론트엔드만/인프라만 수정 요청 시에도 오케스트레이터를 통해 해당 에이전트만 재호출
- **PR 생성 직전**에는 `code-reviewer`를 통해 `codex-review` 스킬로 Codex second opinion 리뷰를 1회 수행한 후 PR 생성
- `qa-engineer`는 **경계면 계약 검증**(incremental), `code-reviewer`는 **코드 품질 리뷰**(per-PR)로 역할 분리
- 단순 질문/확인은 에이전트 팀 없이 직접 응답해도 무방
- 모든 에이전트는 `model: "opus"` 사용
- 중간 산출물: `_workspace/` 디렉토리 (QA 보고서: `qa_report.md`, 리뷰 보고서: `review_report_*.md`)

**아키텍처 다이어그램:** Claude Code CLI ↔ 에이전트 팀 ↔ Codex CLI ↔ ChatGPT Plus 의 전체 호출 구조/빌링 경계는 `README.md`의 "Harness Architecture — Claude + Codex Dual-Model Design" 섹션(또는 README_KO.md/README_JA.md) 참조. 사용자에게 아키텍처 질문을 받으면 해당 README 섹션을 먼저 읽고 답한다.

**디렉토리 구조** (주요 구조 발췌 — `.claude/settings.json`, `.claude/settings.local.json` 등 설정 파일 생략):
```
.claude/
├── agents/
│   ├── backend-dev.md
│   ├── frontend-dev.md
│   ├── infra-dev.md
│   ├── qa-engineer.md
│   └── code-reviewer.md
└── skills/
    ├── fullstack-orchestrator/
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
```

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-09 | 초기 구성 | 전체 | 풀스택 하네스 신규 구축 |
| 2026-04-10 | code-reviewer 에이전트 + codex-review 스킬 추가 | agents/code-reviewer.md, skills/codex-review/, fullstack-orchestrator | PR 생성 직전 Codex 기반 독립 second opinion 리뷰 도입. qa-engineer(경계면 계약 검증)와 역할 분리 — 전문성/병렬성/컨텍스트/재사용성 4축 모두 분리가 유리 |
| 2026-04-10 | README 3개 언어판 + 하네스 아키텍처 다이어그램 문서화 | README.md, README_KO.md, README_JA.md, CLAUDE.md | Claude + Codex 이중 모델 구조를 사람이 이해하도록 영/한/일 3개 언어판 README 구성. CLAUDE.md에는 포인터만 남겨 컨텍스트 lean 유지 |
