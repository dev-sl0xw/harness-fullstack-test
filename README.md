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
├── docker-compose.yml
├── .github/workflows/ci.yml
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

### Docker Compose (Recommended)

```bash
docker compose up -d
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8080
- PostgreSQL: localhost:5432

### Run Individually

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
│  │  Team (fullstack-team) — all use Claude Opus via Anthropic API   │  │
│  │                                                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │  │
│  │  │ backend-dev  │  │ frontend-dev │  │ infra-dev    │            │  │
│  │  │  (opus)      │  │  (opus)      │  │  (opus)      │            │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘            │  │
│  │                                                                  │  │
│  │  ┌──────────────┐  ┌──────────────────────────────┐              │  │
│  │  │ qa-engineer  │  │ code-reviewer (new)          │              │  │
│  │  │  (opus)      │  │  (opus)                      │              │  │
│  │  │              │  │  · thinks in Claude          │              │  │
│  │  │ Incremental  │  │  · calls Bash("codex ...")   │              │  │
│  │  │ contract     │  │  ──────────┐                 │              │  │
│  │  │ verification │  │            │                 │              │  │
│  │  └──────────────┘  └────────────┼─────────────────┘              │  │
│  └───────────────────────────────┼─┼────────────────────────────────┘  │
└──────────────────────────────────┼─┼───────────────────────────────────┘
                                   │ │ process boundary (fork/exec)
                                   │ │ Bash tool runs external CLI
                                   ▼ ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Codex CLI  (separate process · /usr/local/bin/codex)                  │
│                                                                        │
│  · Version: codex-cli 0.118.0                                          │
│  · Credentials: ~/.codex/auth.json                                     │
│  · auth_mode: chatgpt    (OAuth, not API key)                          │
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
│  · Request is authenticated as a ChatGPT Plus user                     │
│  · Billed against the subscription quota (no separate API charges)     │
│  · Runs gpt-5-codex family → returns review text                       │
└────────────────────────────────────────────────────────────────────────┘
```

### Two Independent Model Paths

```
[1] Claude path (runs constantly)
    Leader + every agent (backend-dev, frontend-dev, infra-dev,
                          qa-engineer, code-reviewer's own reasoning)
         │
         ▼
    Anthropic API  ← your Anthropic account / subscription
         │
         ▼
    claude-opus-4-6

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
| `codex review` invocations | ChatGPT Plus quota |

If the ChatGPT Plus quota is exhausted, Codex CLI returns an error and the orchestrator's error handler (`Codex CLI unavailable` branch) skips Phase 4-5 and opens the PR with a "Codex review skipped" note. The rest of the workflow continues untouched.

**4) Credentials are fully isolated.**
```
~/.codex/auth.json    ← Codex CLI only (ChatGPT OAuth token)
                        (no link to Claude Code)

Claude Code auth      ← managed by Anthropic, entirely separate
                        (no link to `codex login`)
```
Logging out of one does not affect the other.

## Claude Code Harness

This project is wired up for [Claude Code](https://claude.com/claude-code) + the [Harness plugin](https://github.com/anthropics/harness-marketplace) so you can run parallel development with an agent team.

### Agent Team

| Agent | Role | Execution |
|-------|------|-----------|
| `backend-dev` | Go (Gin) backend (models, services, handlers, middleware, DB) | Parallel |
| `frontend-dev` | React frontend (routing, auth, pages, components) | Parallel |
| `infra-dev` | Docker Compose, GitHub Actions CI, configuration | Parallel |
| `qa-engineer` | Front ↔ back contract verification, builds, integration sanity | Incremental (per module) |
| `code-reviewer` | Codex-based second-opinion code review | Per-PR (just before `gh pr create`) |

### Skills

| Skill | Purpose | Used by |
|-------|---------|---------|
| `fullstack-orchestrator` | Team coordination, workflow management | Leader |
| `backend-build` | Go backend implementation guide | `backend-dev` |
| `frontend-build` | React frontend implementation guide | `frontend-dev` |
| `infra-setup` | Docker, CI, config guide | `infra-dev` |
| `qa-verify` | Contract verification methodology | `qa-engineer` |
| `codex-review` | Codex CLI invocation + review report format | `code-reviewer` |

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
