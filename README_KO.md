# Harness Fullstack Test

**Go + React + PostgreSQL 풀스택 보일러플레이트** — Claude Code 에이전트 팀 + Codex 기반 PR 리뷰 하네스로 구동.

[English](README.md) | [한국어](README_KO.md) | [日本語](README_JA.md)

React + Vite 프론트엔드와 Go(Gin) 백엔드, PostgreSQL을 조합한 풀스택 보일러플레이트. MVP 우선 접근으로 **User CRUD + JWT 인증**을 구현하고, Docker Compose와 GitHub Actions CI를 포함한다. 모든 코드에는 한국어 학습용 상세 주석이 포함되어 있어, 파일별로 시스템 전체 흐름과 로직을 파악할 수 있다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | Go 1.22+ / Gin / lib/pq / golang-jwt / bcrypt |
| Frontend | React 18 / Vite / TypeScript / React Router v6 / CSS Modules |
| Database | PostgreSQL 16 |
| Infra | Docker Compose / GitHub Actions CI |
| AI 하네스 | Claude Code 에이전트 팀 + Codex CLI (PR 리뷰) |

## 프로젝트 구조

```
harness-fullstack-test/
├── frontend/                 ← React + Vite + TypeScript
│   ├── src/
│   │   ├── components/       ← 재사용 UI 컴포넌트 (ProtectedRoute)
│   │   ├── pages/            ← 페이지 (Login, Register, UserList, UserDetail)
│   │   ├── hooks/            ← 커스텀 훅
│   │   ├── api/              ← API 클라이언트 (fetch wrapper)
│   │   ├── context/          ← React Context (AuthContext)
│   │   ├── App.tsx           ← 라우팅 설정
│   │   └── main.tsx          ← 엔트리포인트
│   ├── Dockerfile
│   └── package.json
│
├── backend/                  ← Go + Gin
│   ├── cmd/server/
│   │   └── main.go           ← 엔트리포인트
│   ├── internal/
│   │   ├── handler/          ← HTTP 핸들러 (auth, user)
│   │   ├── model/            ← 데이터 모델 (User 구조체)
│   │   ├── repository/       ← DB 접근 레이어 (CRUD 쿼리)
│   │   ├── service/          ← 비즈니스 로직 (인증, 유저 관리)
│   │   ├── middleware/       ← JWT 인증 미들웨어
│   │   └── config/           ← 환경변수 로드
│   ├── migrations/           ← SQL 마이그레이션 파일
│   ├── Dockerfile
│   └── go.mod
│
├── docs/
│   └── conventions/          ← 프로젝트 규칙 (principles, secrets, 12-factor,
│                                dependencies, ai-guardrails) — `project-architect` 산출
├── docker-compose.yml
├── .github/workflows/ci.yml
├── .env.example              ← 환경변수 템플릿 (.env로 복사)
├── .claude/                  ← Claude Code 하네스 (에이전트 + 스킬)
│   ├── agents/               ← 에이전트 정의
│   └── skills/               ← 스킬 정의
└── CLAUDE.md                 ← Claude Code용 하네스 컨텍스트
```

## API 엔드포인트

### 인증 (공개)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/register` | 회원가입 (email, password, name) |
| POST | `/api/auth/login` | 로그인 → JWT 토큰 반환 |

### User CRUD (인증 필요)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/users` | 유저 목록 조회 |
| GET | `/api/users/:id` | 유저 상세 조회 |
| PUT | `/api/users/:id` | 유저 정보 수정 |
| DELETE | `/api/users/:id` | 유저 삭제 |

## 시작하기

### 1. 환경변수

템플릿을 복사한 뒤 실제 값을 채운다:

```bash
cp .env.example .env
# 그 다음 .env를 열어 DB 자격증명, JWT 비밀키 등을 입력
```

전체 키 목록과 작성 근거는 [`docs/conventions/secrets.md`](docs/conventions/secrets.md)에 있다. Docker Compose로 실행하는 경우 `docker-compose.yml`에 포함된 dev 기본값으로 충분하므로 `.env` 없이도 동작한다 — `.env`는 Docker 외부에서 개별 실행하거나 기본값을 오버라이드하고 싶을 때 주로 필요하다.

### 2. Docker Compose (권장)

```bash
docker compose up -d
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8080
- PostgreSQL: localhost:5432

### 3. 개별 실행

```bash
# 백엔드
cd backend
go mod tidy
go build ./cmd/server
./server

# 프론트엔드
cd frontend
npm install
npm run dev
```

## 애플리케이션 아키텍처

### 백엔드 레이어

```
HTTP 요청 → Router → Middleware(JWT 검증) → Handler → Service → Repository → DB
```

| 레이어 | 역할 |
|--------|------|
| Handler | HTTP 요청 파싱, 응답 생성 |
| Service | 비즈니스 로직 (비밀번호 해싱, 토큰 생성, 유효성 검사) |
| Repository | SQL 쿼리 실행 (database/sql + lib/pq) |
| Middleware | JWT 토큰 검증, 인증 정보를 Context에 저장 |

### 프론트엔드 인증 흐름

```
로그인 성공 → JWT를 localStorage 저장 → AuthContext 업데이트
  → API 호출 시 Authorization 헤더 자동 첨부
  → 토큰 만료/부재 시 /login 리다이렉트
```

## 하네스 아키텍처 — Claude + Codex 이중 모델 설계

이 프로젝트는 개발 중에 **두 개의 독립된 AI 모델 제공자**를 사용하는 특이한 구조이다:
- **Claude (Anthropic)** — 오케스트레이터와 팀의 모든 에이전트가 사용한다.
- **Codex (OpenAI, ChatGPT Plus OAuth)** — `code-reviewer`가 PR 시점에만 **second opinion 감정인**으로 호출한다.

이 경계를 이해해야 빌링, 인증, "어떤 모델이 무엇을 사고하는가"에 대한 혼동을 피할 수 있다.

### 전체 시스템 다이어그램

> **참고:** 아래 Codex CLI 박스의 값(버전, 설치 경로, `auth_mode`, `chatgpt_plan_type`)은 **특정 로컬 설치의 한 스냅샷**이다. 실제 환경에서는 API key 모드(`OPENAI_API_KEY`), 다른 버전, 다른 설치 경로를 쓸 수 있다. 개념적 경계 — Codex가 별도 프로세스라는 것, 인증이 격리된다는 것, Claude 경로와 빌링이 분리된다는 것 — 은 모드와 무관하게 유지된다.

```
┌────────────────────────────────────────────────────────────────────────┐
│                            USER (터미널)                                 │
│                   "풀스택 구현하고 PR 올려줘" 같은 지시                     │
└────────────────────────┬───────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Claude Code CLI  (메인 프로세스 · 한 대의 claude 바이너리)                 │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              리더(메인) — 지금 여러분이 대화하는 Claude               │  │
│  │   · model: claude-opus-4-6 (1M context)                          │  │
│  │   · Anthropic API 호출  ←── Claude 구독/API 키                    │  │
│  │   · 하네스 스킬 로딩: fullstack-orchestrator                       │  │
│  │   · 팀 조율 (TeamCreate / TaskCreate / SendMessage)               │  │
│  └────────────────┬─────────────────────────────────────────────────┘  │
│                   │ 에이전트 팀 스폰 (같은 프로세스 · 각자 컨텍스트)       │
│                   ▼                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  팀 (fullstack-team) — Anthropic API, 역할별 모델 분리 정책        │  │
│  │                                                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │  │
│  │  │ backend-dev  │  │ frontend-dev │  │ infra-dev    │            │  │
│  │  │  (sonnet)    │  │  (sonnet)    │  │  (sonnet)    │            │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘            │  │
│  │       구현 에이전트 — 코드/패턴 작성                               │  │
│  │                                                                  │  │
│  │  ┌──────────────┐  ┌──────────────────────────────┐              │  │
│  │  │ qa-engineer  │  │ code-reviewer                │              │  │
│  │  │  (opus)      │  │  (opus)                      │              │  │
│  │  │              │  │  · 본인은 Claude로 사고        │              │  │
│  │  │ Incremental  │  │  · Bash(codex review ...) 호출│              │  │
│  │  │ 계약 검증     │  │  ──────────┐                 │              │  │
│  │  └──────────────┘  └────────────┼─────────────────┘              │  │
│  │       검증·판단 에이전트 — opus 유지                                │  │
│  └───────────────────────────────┼─┼────────────────────────────────┘  │
└──────────────────────────────────┼─┼───────────────────────────────────┘
                                   │ │ 프로세스 경계 (fork/exec)
                                   │ │ Bash 툴로 외부 CLI 실행
                                   ▼ ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Codex CLI  (별도 프로세스 · 예: /usr/local/bin/codex)                   │
│                                                                        │
│  로컬 설치 예시 스냅샷 — 환경마다 다를 수 있음:                             │
│  · 버전: codex-cli 0.118.0                                              │
│  · 인증 파일: ~/.codex/auth.json                                         │
│  · auth_mode: chatgpt    (OAuth 로그인; API key 모드도 지원)              │
│  · chatgpt_plan_type: plus                                             │
│  · 기본 모델: gpt-5-codex 계열                                           │
│                                                                        │
│  codex review --base main → 내부에서 OpenAI 백엔드로 HTTPS 요청          │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTPS (OAuth bearer 토큰)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│  OpenAI / ChatGPT 백엔드                                                │
│                                                                        │
│  · ChatGPT OAuth 모드: ChatGPT 사용자 자격으로 인증, 구독 쿼터에서 차감   │
│    (별도 API 과금 없음)                                                  │
│  · API key 모드: OPENAI_API_KEY로 인증, API 계정에 토큰 사용량 과금        │
│  · gpt-5-codex 계열 실행 → 리뷰 응답 반환                                 │
└────────────────────────────────────────────────────────────────────────┘
```

### 두 개의 독립된 모델 호출 경로

```
[1] Claude 계열 호출 (항상 일어남)
    리더 (메인 세션) ─────────────────────────────► claude-opus-4-6
    backend-dev / frontend-dev / infra-dev ────► claude-sonnet-4-6
    qa-engineer / code-reviewer / project-architect ► claude-opus-4-6
         │
         ▼
    Anthropic API  ← Anthropic 계정/구독

    참고: 이 모델 분리는 의도적인 역할 기반 정책 (시범 운영 중).
    구현 에이전트는 코드/패턴 작성이 sonnet 4.6의 강점이라 sonnet을
    사용하고, qa + Codex 리뷰가 안전망 역할을 한다. 검증·판단
    에이전트는 추론 깊이가 직접 가치로 변환되는 영역이라 opus 유지.

[2] OpenAI/Codex 계열 호출 (code-reviewer가 PR 직전에만)
    code-reviewer가 Bash 툴로 `codex review ...` 실행
         │
         ▼
    Codex CLI (별도 프로세스)
         │
         ▼ (OAuth bearer 토큰, chatgpt 모드)
    OpenAI 백엔드
         │
         ▼
    gpt-5-codex  ← ChatGPT Plus 구독 쿼터에서 차감
```

두 경로는 **완전히 독립적**이다. 같은 "에이전트"라는 단어를 쓰지만, 내부적으로는 전혀 다른 계정·모델·빌링 시스템이다.

### 핵심 포인트 (오해하기 쉬운 부분)

**1) "code-reviewer 에이전트 = Codex 모델"이 아니다.**
`code-reviewer`는 여전히 Claude Opus로 사고하는 에이전트이다. 이 에이전트의 역할은:
1. Claude Opus로 변경 범위를 파악하고
2. Bash 툴로 `codex review`를 호출하고
3. Codex 원본 응답을 프로젝트 맥락으로 필터링하고 (다시 Claude Opus로)
4. 구조화된 리뷰 보고서를 Claude Opus로 작성한다

즉, `code-reviewer`는 **Codex를 외부 감정인(expert witness)으로 고용하는 Claude 에이전트**이다.

**2) 왜 second opinion이 의미 있나?**
같은 Claude Opus로 다른 에이전트가 검토하면 "같은 모델이 같은 편향을 반복"할 가능성이 있다. **다른 회사·다른 학습 데이터·다른 훈련 기법의 모델**(GPT-5-codex)을 리뷰어로 쓰는 것이 팀 내 Claude 리뷰어가 놓치는 편향을 잡는 데 가치가 있다.

**3) 빌링이 섞이지 않는다.**
| 경로 | 과금 대상 |
|------|----------|
| 리더 + 모든 에이전트 사고 | Anthropic (Claude 구독) |
| `codex review` 호출 (ChatGPT OAuth 모드) | ChatGPT 구독 쿼터 |
| `codex review` 호출 (API key 모드) | OpenAI API 계정 (토큰 사용량 과금) |

Claude 경로와 Codex 경로는 **항상 분리 과금**된다. Codex 쪽의 구체적 과금 대상은 Codex CLI가 어떤 auth 모드로 설정되어 있느냐에 따라 달라진다. Codex 호출이 어떤 이유로든 실패하면(쿼터 소진, 미인증, 오프라인 등) 오케스트레이터의 에러 핸들러가 Phase 4-5를 건너뛰고, 최소 stub 리뷰 보고서를 작성한 뒤 "Codex 리뷰 누락" 메모와 함께 PR을 생성한다. 나머지 워크플로우는 그대로 진행된다.

**4) 인증이 완전히 격리된다.**
```
~/.codex/auth.json    ← Codex CLI 전용
                        (ChatGPT OAuth 토큰 또는 OPENAI_API_KEY 저장
                         — 두 모드 모두 이 파일을 사용)
                        Claude Code와 전혀 무관.

Claude Code 인증      ← Anthropic 측에서 별도 관리
                        codex login과 전혀 무관.
```
한쪽 로그아웃이 다른 쪽에 영향을 주지 않는다.

## Claude Code 하네스

이 프로젝트는 [Claude Code](https://claude.com/claude-code) + [Harness 플러그인](https://github.com/anthropics/harness-marketplace)으로 에이전트 팀을 구성하여 병렬 개발할 수 있도록 설계되어 있다.

### 에이전트 팀

| 에이전트 | 역할 | 실행 시점 |
|---------|------|----------|
| `project-architect` | 프로젝트 규칙·컨벤션·가드레일 수립 (KISS/YAGNI/DRY/SOLID, 12-Factor, 환경 분리, 비밀 관리, 의존성 위생, AI 가드레일) | 초기 1회 + 규칙 변경 시 |
| `backend-dev` | Go(Gin) 백엔드 (모델, 서비스, 핸들러, 미들웨어, DB) | 병렬 |
| `frontend-dev` | React 프론트엔드 (라우팅, 인증, 페이지, 컴포넌트) | 병렬 |
| `infra-dev` | Docker Compose, GitHub Actions CI, 환경설정 | 병렬 |
| `qa-engineer` | 프론트↔백 경계면 계약 검증, 빌드, 통합 정합성 | 모듈별 incremental |
| `code-reviewer` | Codex 기반 second opinion 코드 리뷰 | PR 직전 1회 |

### 스킬

| 스킬 | 용도 | 사용 에이전트 |
|------|------|-------------|
| `fullstack-orchestrator` | 에이전트 팀 조율, 워크플로우 관리 (Phase 0-5 규칙 수립, Phase 4-4 README 자동 동기화, Phase 4-5 Codex 리뷰 포함) | 리더 |
| `project-conventions` | 원칙·가드레일·환경 분리 reference | `project-architect`(작성 기준), 모든 구현 에이전트(작업 reference), `code-reviewer`(리뷰 기준) |
| `backend-build` | Go 백엔드 구현 가이드 | `backend-dev` |
| `frontend-build` | React 프론트엔드 구현 가이드 | `frontend-dev` |
| `infra-setup` | Docker, CI, 설정 구성 가이드 | `infra-dev` |
| `qa-verify` | 경계면 계약 검증 방법론 | `qa-engineer` |
| `codex-review` | Codex CLI 호출 + 리뷰 보고서 작성 가이드 | `code-reviewer` |

### 워크플로우 단계 (`fullstack-orchestrator`가 관리)

- **Phase 0-5 — 규칙 수립:** 신규 프로젝트일 경우 `project-architect`가 가장 먼저 실행되어 `docs/conventions/`(principles, secrets, 12-factor, dependencies, ai-guardrails)를 작성한다. 이후 구현 에이전트는 작업 시작 전 이 문서를 reference로 로드한다.
- **Phase 2-4 — 병렬 구현:** `backend-dev`/`frontend-dev`/`infra-dev`가 병렬로 작업하고, `qa-engineer`가 모듈 완성마다 incremental하게 검증한다.
- **Phase 4-4 — README 자동 동기화:** PR 생성 직전, 오케스트레이터가 diff를 검사하여 트리거 조건 — **추가/삭제뿐 아니라 기존 항목의 *의미 변경***(에이전트/스킬 추가·역할 변경, 워크플로우 단계 변경, 컨벤션 내용 변경, 가드레일 변경, 최상위 디렉토리 변경, 환경변수, 빌드 명령어, 외부 서비스, 인증 흐름 변경) — 에 매칭되면 `README.md`/`README_KO.md`/`README_JA.md` 세 파일을 함께 갱신한다 (한 언어만 갱신하는 drift 방지). 일반 코드 변경은 이 단계를 건너뛴다.
- **Phase 4-5 — Codex 리뷰:** PR 생성 직전 `code-reviewer`가 `codex review --base main`을 실행하여 독립적인 second opinion을 받는다.

### 시스템 레벨 가드레일 (모든 에이전트에 적용)

- **read 금지:** `.env`, `.env.*` (단 `.env.example`은 허용), `*.pem`, `*.key`, `id_rsa*`, `credentials.json`, `*credentials*.json`, `service-account*.json`, `~/.aws/*`, `~/.ssh/*`, `*.kdbx`, **사용자 홈 쉘 초기화 파일**(`~/.zshrc`, `~/.bashrc`, `~/.profile`, `~/.zprofile` — secret/토큰이 환경변수 형태로 export되어 있을 수 있음), **git 이력 기반 노출 secret**(과거에 commit되었다 삭제된 secret 파일을 `git log -p`/`git show`로 복원하지 말 것). 이 정책은 사용자 승인으로도 해제되지 않는다 — 정말 값이 필요하면 사용자가 직접 cat/편집기로 보는 것이 옳다 (AI 에이전트의 read를 우회).
- **write 금지:** 위 파일 모두 + 사용자 시스템 설정 (`~/.gitconfig`, `~/.npmrc`, `~/.ssh/config`) + production config (`config/prod.yaml`)
- **exec 금지 (사용자 명시 승인 없이):** 와일드카드 `rm -rf`, `git push -f`, `git reset --hard`, prod DB 직접 접근, `curl ... | sh`, `sudo`
- **로깅 금지:** 환경변수 dump, `Authorization` 헤더, DB 평문 connection string

상세 가드레일과 그 근거는 `docs/conventions/ai-guardrails.md`(`project-architect`가 생성)에 기록된다.

### 실행 방법

Claude Code에서 오케스트레이터에게 팀을 지휘하도록 요청한다:

```
풀스택 구현해줘
```

부분 수정도 가능:

```
백엔드 API만 수정해줘
프론트엔드 로그인 페이지 보완해줘
이 PR 코덱스로 리뷰해줘
```

## 설계 문서

- **설계 스펙**: [`docs/superpowers/specs/2026-04-08-fullstack-harness-design.md`](docs/superpowers/specs/2026-04-08-fullstack-harness-design.md)
- **구현 계획**: [`docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md`](docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md)

## 라이선스

MIT
