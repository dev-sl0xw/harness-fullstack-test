# Harness Fullstack Test

**Go + React + PostgreSQL fullstack boilerplate** driven by a Claude Code agent-team harness with Codex-based PR review.

[English](README.md) | [한국어](README_KO.md) | [日本語](README_JA.md)

A fullstack boilerplate combining a React + Vite frontend, a Go (Gin) backend, and PostgreSQL. Built with an MVP-first approach implementing **User CRUD + JWT authentication**, Docker Compose, and GitHub Actions CI. Every file ships with detailed Korean learning comments so the entire system flow and logic is readable file by file.

## Tech Stack

| Area | Technology |
|------|------------|
| Backend | Go 1.22+ / Gin / lib/pq / golang-jwt / bcrypt |
| Frontend | React 18 / Vite / TypeScript / React Router v6 / CSS Modules |
| Database | PostgreSQL 16 |
| Infra | Docker Compose / GitHub Actions CI |
| AI Harness | Claude Code agent team + Codex CLI (PR review) |

## Project Structure

```
harness-fullstack-test/
├── frontend/                 ← React + Vite + TypeScript
│   ├── src/
│   │   ├── components/       ← Reusable UI (ProtectedRoute)
│   │   ├── pages/            ← Pages (Login, Register, UserList, UserDetail)
│   │   ├── hooks/            ← Custom hooks
│   │   ├── api/              ← API client (fetch wrapper)
│   │   ├── context/          ← React Context (AuthContext)
│   │   ├── App.tsx           ← Router setup
│   │   └── main.tsx          ← Entry point
│   ├── Dockerfile
│   └── package.json
│
├── backend/                  ← Go + Gin
│   ├── cmd/server/
│   │   └── main.go           ← Entry point
│   ├── internal/
│   │   ├── handler/          ← HTTP handlers (auth, user)
│   │   ├── model/            ← Data models (User struct)
│   │   ├── repository/       ← DB access layer (CRUD queries)
│   │   ├── service/          ← Business logic (auth, user management)
│   │   ├── middleware/       ← JWT auth middleware
│   │   └── config/           ← Environment variable loader
│   ├── migrations/           ← SQL migrations
│   ├── Dockerfile
│   └── go.mod
│
├── docs/
│   └── conventions/          ← Project rules (principles, secrets, 12-factor,
│                                dependencies, ai-guardrails) — by `project-architect`
├── docker-compose.yml
├── .github/workflows/ci.yml
├── .env.example              ← Env var template (copy to .env)
├── .claude/                  ← Claude Code harness (agents + skills)
│   ├── agents/               ← Agent definitions
│   └── skills/               ← Skill definitions
└── CLAUDE.md                 ← Harness context for Claude Code
```

## API Endpoints

### Authentication (Public)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register (email, password, name) |
| POST | `/api/auth/login` | Login → returns JWT token |

### User CRUD (Authenticated)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List users |
| GET | `/api/users/:id` | Get user detail |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

## Getting Started

### 1. Environment variables

Copy the template and fill in real values:

```bash
cp .env.example .env
# then edit .env with your DB credentials, JWT secret, etc.
```

The full key list and rationale live in [`docs/conventions/secrets.md`](docs/conventions/secrets.md). For Docker Compose the dev defaults baked into `docker-compose.yml` are sufficient — `.env` is mainly needed when running services individually outside Docker, or when you want to override the defaults.

### 2. Docker Compose (Recommended)

```bash
docker compose up -d
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8080
- PostgreSQL: localhost:5432

### 3. Run Individually

```bash
# Backend
cd backend
go mod tidy
go build ./cmd/server
./server

# Frontend
cd frontend
npm install
npm run dev
```

## Application Architecture

### Backend Layers

```
HTTP request → Router → Middleware (JWT) → Handler → Service → Repository → DB
```

| Layer | Responsibility |
|-------|----------------|
| Handler | Parse HTTP requests, build responses |
| Service | Business logic (password hashing, token generation, validation) |
| Repository | SQL query execution (database/sql + lib/pq) |
| Middleware | JWT verification, store auth info in Context |

### Frontend Auth Flow

```
Login success → Store JWT in localStorage → Update AuthContext
  → Attach Authorization header on API calls
  → Redirect to /login on token expiry/absence
```

## Harness Architecture — Claude + Codex Dual-Model Design

This project is unusual in that it runs **two independent AI model providers** during development:
- **Claude (Anthropic)** powers the orchestrator and every agent in the team.
- **Codex (OpenAI, via ChatGPT Plus OAuth)** is invoked by `code-reviewer` purely as a second-opinion witness at PR time.

Understanding the boundary prevents confusion about billing, auth, and which model "thinks" about what.

### Full System Diagram

> **Note:** The values shown in the Codex CLI box below (version, install path, `auth_mode`, `chatgpt_plan_type`) reflect **one local installation snapshot**. Your setup may use API key mode (`OPENAI_API_KEY` instead of ChatGPT OAuth), a different version, or a different install path. The conceptual boundaries — Codex as a separate process, isolated authentication, and a separate billing path from Claude — hold regardless of mode.

```
┌────────────────────────────────────────────────────────────────────────┐
│                            USER (terminal)                             │
│           e.g. "implement the fullstack app and open PRs"              │
└────────────────────────┬───────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Claude Code CLI  (single claude binary · main process)                │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │        Leader (main) — the Claude you are talking to             │  │
│  │   · model: claude-opus-4-6 (1M context)                          │  │
│  │   · Calls Anthropic API  ←── your Claude subscription / API key  │  │
│  │   · Loads harness skill: fullstack-orchestrator                  │  │
│  │   · Team coordination (TeamCreate / TaskCreate / SendMessage)    │  │
│  └────────────────┬─────────────────────────────────────────────────┘  │
│                   │ spawns agent team (same process, isolated context) │
│                   ▼                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Team (fullstack-team) — Anthropic API, model split by role      │  │
│  │                                                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │  │
│  │  │ backend-dev  │  │ frontend-dev │  │ infra-dev    │            │  │
│  │  │  (sonnet)    │  │  (sonnet)    │  │  (sonnet)    │            │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘            │  │
│  │       implementation agents — code/pattern work                  │  │
│  │                                                                  │  │
│  │  ┌──────────────┐  ┌──────────────────────────────┐              │  │
│  │  │ qa-engineer  │  │ code-reviewer                │              │  │
│  │  │  (opus)      │  │  (opus)                      │              │  │
│  │  │              │  │  · thinks in Claude          │              │  │
│  │  │ Incremental  │  │  · calls Bash("codex ...")   │              │  │
│  │  │ contract     │  │  ──────────┐                 │              │  │
│  │  │ verification │  │            │                 │              │  │
│  │  └──────────────┘  └────────────┼─────────────────┘              │  │
│  │       verification/judgment agents — opus retained               │  │
│  └───────────────────────────────┼─┼────────────────────────────────┘  │
└──────────────────────────────────┼─┼───────────────────────────────────┘
                                   │ │ process boundary (fork/exec)
                                   │ │ Bash tool runs external CLI
                                   ▼ ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Codex CLI  (separate process · e.g. /usr/local/bin/codex)             │
│                                                                        │
│  Example local install snapshot — yours may differ:                    │
│  · Version: codex-cli 0.118.0                                          │
│  · Credentials: ~/.codex/auth.json                                     │
│  · auth_mode: chatgpt    (OAuth login; API key mode also supported)    │
│  · chatgpt_plan_type: plus                                             │
│  · Default model: gpt-5-codex family                                   │
│                                                                        │
│  `codex review --base main`  → HTTPS request to OpenAI backend         │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTPS (OAuth bearer token)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│  OpenAI / ChatGPT backend                                              │
│                                                                        │
│  · In ChatGPT OAuth mode: authenticated as a ChatGPT user; billed      │
│    against the subscription quota (no separate API charges)            │
│  · In API key mode: authenticated via OPENAI_API_KEY; billed to the    │
│    API account per token usage                                         │
│  · Runs gpt-5-codex family → returns review text                       │
└────────────────────────────────────────────────────────────────────────┘
```

### Two Independent Model Paths

```
[1] Claude path (runs constantly)
    Leader (main session) ─────────────────────► claude-opus-4-6
    backend-dev / frontend-dev / infra-dev ────► claude-sonnet-4-6
    qa-engineer / code-reviewer / project-architect ► claude-opus-4-6
         │
         ▼
    Anthropic API  ← your Anthropic account / subscription

    Note: model split is a deliberate role-based policy (currently
    in trial). Implementation agents use sonnet because code/pattern
    work is its strength, with qa + Codex review acting as the safety
    net. Verification/judgment agents stay on opus because reasoning
    depth converts directly into value there.

[2] OpenAI / Codex path (only when code-reviewer runs at PR time)
    code-reviewer invokes Bash → `codex review --base main ...`
         │
         ▼
    Codex CLI (separate process)
         │
         ▼  (OAuth bearer token, chatgpt mode)
    OpenAI backend
         │
         ▼
    gpt-5-codex   ← billed against ChatGPT Plus quota
```

The two paths are **completely isolated**. Same word ("agent") but entirely separate accounts, models, and billing systems.

### Key Points (Common Misconceptions)

**1) "code-reviewer agent = Codex model" — wrong.**
`code-reviewer` is still a Claude-Opus agent. Its job is:
1. Use Claude Opus to figure out the change scope
2. Shell out to `codex review` via the Bash tool
3. Take the Codex response and filter it through project context (again with Claude Opus)
4. Produce a structured review report (Claude Opus)

In other words, `code-reviewer` is a **Claude agent that hires Codex as an expert witness**.

**2) Why bother with a second opinion?**
If every reviewer is the same model, they share the same blind spots. Using a model from **a different vendor trained on different data with different techniques** (GPT-5-codex) catches bias the in-team Claude reviewers miss.

**3) Billing is never mixed.**
| Path | Billed to |
|------|-----------|
| Leader + all agent reasoning | Anthropic (your Claude subscription) |
| `codex review` invocations (ChatGPT OAuth mode) | ChatGPT subscription quota |
| `codex review` invocations (API key mode) | OpenAI API account (per-token) |

The Claude path and the Codex path are always billed separately — the specific Codex billing destination depends on which auth mode Codex CLI is configured in. If the Codex call fails for any reason (quota exhausted, unauthenticated, offline), the orchestrator's error handler skips Phase 4-5, writes a minimal stub review report, and opens the PR with a "Codex review skipped" note. The rest of the workflow continues untouched.

**4) Credentials are fully isolated.**
```
~/.codex/auth.json    ← Codex CLI only
                        (holds either ChatGPT OAuth token
                         or OPENAI_API_KEY — both modes store here)
                        No link to Claude Code.

Claude Code auth      ← managed by Anthropic, entirely separate.
                        No link to `codex login`.
```
Logging out of one does not affect the other.

## Claude Code Harness

This project is wired up for [Claude Code](https://claude.com/claude-code) + the [Harness plugin](https://github.com/anthropics/harness-marketplace) so you can run parallel development with an agent team.

### Agent Team

| Agent | Role | Execution |
|-------|------|-----------|
| `project-architect` | Project rules, conventions, guardrails (KISS/YAGNI/DRY/SOLID, 12-Factor, env separation, secrets, dependency hygiene, AI guardrails) | Initial setup + on-rule-change |
| `backend-dev` | Go (Gin) backend (models, services, handlers, middleware, DB) | Parallel |
| `frontend-dev` | React frontend (routing, auth, pages, components) | Parallel |
| `infra-dev` | Docker Compose, GitHub Actions CI, configuration | Parallel |
| `qa-engineer` | Front ↔ back contract verification, builds, integration sanity | Incremental (per module) |
| `code-reviewer` | Codex-based second-opinion code review | Per-PR (just before `gh pr create`) |

### Skills

| Skill | Purpose | Used by |
|-------|---------|---------|
| `fullstack-orchestrator` | Team coordination, workflow management (incl. Phase 0-5 rule setup, Phase 4-4 README auto-sync, Phase 4-5 Codex review) | Leader |
| `project-conventions` | Reference for principles, guardrails, env separation | `project-architect` (authoring), all impl agents (work reference), `code-reviewer` (review criteria) |
| `backend-build` | Go backend implementation guide | `backend-dev` |
| `frontend-build` | React frontend implementation guide | `frontend-dev` |
| `infra-setup` | Docker, CI, config guide | `infra-dev` |
| `qa-verify` | Contract verification methodology | `qa-engineer` |
| `codex-review` | Codex CLI invocation + review report format | `code-reviewer` |

### Workflow Phases (managed by `fullstack-orchestrator`)

- **Phase 0-5 — Rule setup:** On a fresh project, `project-architect` runs first and writes `docs/conventions/` (principles, secrets, 12-factor, dependencies, ai-guardrails). Implementation agents load these as a reference before writing code.
- **Phase 2-4 — Parallel build:** `backend-dev`, `frontend-dev`, `infra-dev` build in parallel. `qa-engineer` runs incrementally as modules land.
- **Phase 4-4 — README auto-sync:** Just before PR creation, the orchestrator inspects the diff. If the change matches a tracked trigger — **including additions, deletions, and *semantic changes* to existing items** (new agent/skill, role/purpose change, workflow phase change, conventions content change, guardrail change, top-level directory change, env var, build command, external service, auth flow) — it auto-updates `README.md`, `README_KO.md`, and `README_JA.md` together (no language-only drift). Pure code changes skip this phase.
- **Phase 4-5 — Codex review:** `code-reviewer` runs `codex review --base main` for an independent second opinion before opening the PR.

### System-level guardrails (apply to every agent)

- **Read-blocked:** `.env`, `.env.*` (except `.env.example`), `*.pem`, `*.key`, `id_rsa*`, `credentials.json`, `*credentials*.json`, `service-account*.json`, `~/.aws/*`, `~/.ssh/*`, `*.kdbx`, **shell init files** (`~/.zshrc`, `~/.bashrc`, `~/.profile`, `~/.zprofile` — secrets/tokens often live there as exported env vars), and **VCS-history-exposed secrets** (do not resurrect previously-deleted secret files via `git log -p` / `git show`). This policy is not lifted by user approval — if you really need the value, open the file yourself (cat/editor) instead of routing through the AI agent.
- **Write-blocked:** all of the above, plus user system files (`~/.gitconfig`, `~/.npmrc`, `~/.ssh/config`) and production config (`config/prod.yaml`)
- **Exec-blocked (without explicit user approval):** wildcard `rm -rf`, `git push -f`, `git reset --hard`, direct prod DB access, `curl ... | sh`, `sudo`
- **Log-blocked:** environment-variable dumps, `Authorization` headers, plain-text DB connection strings

Full guardrail details and rationale live in `docs/conventions/ai-guardrails.md` (created by `project-architect`).

### How to Run

In Claude Code, ask the orchestrator to drive the team:

```
implement the fullstack app
```

Partial updates work too:

```
update only the backend API
patch the frontend login page
review this PR with codex
```

## Design Documents

- **Design spec:** [`docs/superpowers/specs/2026-04-08-fullstack-harness-design.md`](docs/superpowers/specs/2026-04-08-fullstack-harness-design.md)
- **Implementation plan:** [`docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md`](docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md)

## License

MIT
