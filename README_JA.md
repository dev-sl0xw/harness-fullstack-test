# Harness Fullstack Test

**Go + React + PostgreSQL フルスタックボイラープレート** — Claude Code エージェントチーム + Codex ベース PR レビューのハーネスで駆動。

[English](README.md) | [한국어](README_KO.md) | [日本語](README_JA.md)

React + Vite フロントエンド、Go(Gin) バックエンド、PostgreSQL を組み合わせたフルスタックボイラープレート。MVP ファーストのアプローチで **User CRUD + JWT 認証** を実装し、Docker Compose と GitHub Actions CI を含む。すべてのコードには韓国語の学習用詳細コメントが含まれており、ファイルごとにシステム全体のフローとロジックを把握できる。

## 技術スタック

| 領域 | 技術 |
|------|------|
| Backend | Go 1.22+ / Gin / lib/pq / golang-jwt / bcrypt |
| Frontend | React 18 / Vite / TypeScript / React Router v6 / CSS Modules |
| Database | PostgreSQL 16 |
| Infra | Docker Compose / GitHub Actions CI |
| AI ハーネス | Claude Code エージェントチーム + Codex CLI (PR レビュー) |

## プロジェクト構造

```
harness-fullstack-test/
├── frontend/                 ← React + Vite + TypeScript
│   ├── src/
│   │   ├── components/       ← 再利用 UI コンポーネント (ProtectedRoute)
│   │   ├── pages/            ← ページ (Login, Register, UserList, UserDetail)
│   │   ├── hooks/            ← カスタムフック
│   │   ├── api/              ← API クライアント (fetch wrapper)
│   │   ├── context/          ← React Context (AuthContext)
│   │   ├── App.tsx           ← ルーティング設定
│   │   └── main.tsx          ← エントリーポイント
│   ├── Dockerfile
│   └── package.json
│
├── backend/                  ← Go + Gin
│   ├── cmd/server/
│   │   └── main.go           ← エントリーポイント
│   ├── internal/
│   │   ├── handler/          ← HTTP ハンドラー (auth, user)
│   │   ├── model/            ← データモデル (User 構造体)
│   │   ├── repository/       ← DB アクセスレイヤー (CRUD クエリ)
│   │   ├── service/          ← ビジネスロジック (認証、ユーザー管理)
│   │   ├── middleware/       ← JWT 認証ミドルウェア
│   │   └── config/           ← 環境変数ロード
│   ├── migrations/           ← SQL マイグレーションファイル
│   ├── Dockerfile
│   └── go.mod
│
├── docs/
│   └── conventions/          ← プロジェクトルール (principles, secrets, 12-factor,
│                                dependencies, ai-guardrails) — `project-architect` 生成
├── docker-compose.yml
├── .github/workflows/ci.yml
├── .env.example              ← 環境変数テンプレート (.env にコピー)
├── .claude/                  ← Claude Code ハーネス (エージェント + スキル)
│   ├── agents/               ← エージェント定義
│   └── skills/               ← スキル定義
└── CLAUDE.md                 ← Claude Code 用ハーネスコンテキスト
```

## API エンドポイント

### 認証 (公開)

| Method | Path | 説明 |
|--------|------|------|
| POST | `/api/auth/register` | ユーザー登録 (email, password, name) |
| POST | `/api/auth/login` | ログイン → JWT トークン返却 |

### User CRUD (認証必須)

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/users` | ユーザー一覧取得 |
| GET | `/api/users/:id` | ユーザー詳細取得 |
| PUT | `/api/users/:id` | ユーザー情報更新 |
| DELETE | `/api/users/:id` | ユーザー削除 |

## はじめに

### 1. 環境変数

テンプレートをコピーして実際の値を入れる:

```bash
cp .env.example .env
# その後 .env を開いて DB 認証情報、JWT シークレット等を入力
```

全キー一覧と作成根拠は [`docs/conventions/secrets.md`](docs/conventions/secrets.md) にある。Docker Compose で実行する場合は `docker-compose.yml` に含まれる dev デフォルトで十分なので `.env` なしでも動作する — `.env` は Docker 外で個別実行する場合、またはデフォルト値を上書きしたい場合に主に必要となる。

### 2. Docker Compose (推奨)

```bash
docker compose up -d
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8080
- PostgreSQL: localhost:5432

### 3. 個別実行

```bash
# バックエンド
cd backend
go mod tidy
go build ./cmd/server
./server

# フロントエンド
cd frontend
npm install
npm run dev
```

## アプリケーションアーキテクチャ

### バックエンドレイヤー

```
HTTP リクエスト → Router → Middleware(JWT 検証) → Handler → Service → Repository → DB
```

| レイヤー | 役割 |
|--------|------|
| Handler | HTTP リクエスト解析、レスポンス生成 |
| Service | ビジネスロジック (パスワードハッシュ化、トークン生成、バリデーション) |
| Repository | SQL クエリ実行 (database/sql + lib/pq) |
| Middleware | JWT トークン検証、認証情報を Context に保存 |

### フロントエンド認証フロー

```
ログイン成功 → JWT を localStorage に保存 → AuthContext 更新
  → API 呼び出し時に Authorization ヘッダー自動付与
  → トークン失効/不在時に /login へリダイレクト
```

## ハーネスアーキテクチャ — Claude + Codex デュアルモデル設計

このプロジェクトは開発中に **2 つの独立した AI モデルプロバイダー** を使用する珍しい構造である:
- **Claude (Anthropic)** — オーケストレーターとチームのすべてのエージェントが使用する。
- **Codex (OpenAI, ChatGPT Plus OAuth)** — `code-reviewer` が PR 時点のみ **セカンドオピニオンの鑑定人** として呼び出す。

この境界を理解することで、課金、認証、「どのモデルが何を考えるか」についての混乱を避けられる。

### システム全体図

> **注意:** 下記の Codex CLI ボックスに表示される値 (バージョン、インストールパス、`auth_mode`、`chatgpt_plan_type`) は **特定のローカルインストールのスナップショット** である。実際の環境では API キーモード (`OPENAI_API_KEY`)、異なるバージョン、異なるインストールパスが使われる場合がある。概念的な境界 — Codex が別プロセスであること、認証が分離されていること、Claude 経路と課金が分離されていること — はモードに関わらず維持される。

```
┌────────────────────────────────────────────────────────────────────────┐
│                            USER (ターミナル)                             │
│              例: "フルスタックを実装して PR を出して"                        │
└────────────────────────┬───────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Claude Code CLI  (単一の claude バイナリ · メインプロセス)                │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │        リーダー(メイン) — 今あなたが話している Claude                │  │
│  │   · model: claude-opus-4-6 (1M context)                          │  │
│  │   · Anthropic API 呼び出し  ←── Claude サブスク/API キー           │  │
│  │   · ハーネススキル読み込み: fullstack-orchestrator                   │  │
│  │   · チーム調整 (TeamCreate / TaskCreate / SendMessage)             │  │
│  └────────────────┬─────────────────────────────────────────────────┘  │
│                   │ エージェントチームをスポーン (同一プロセス · 独立コンテキスト) │
│                   ▼                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  チーム (fullstack-team) — 全員 Anthropic API で Claude Opus 呼び出し │  │
│  │                                                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │  │
│  │  │ backend-dev  │  │ frontend-dev │  │ infra-dev    │            │  │
│  │  │  (opus)      │  │  (opus)      │  │  (opus)      │            │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘            │  │
│  │                                                                  │  │
│  │  ┌──────────────┐  ┌──────────────────────────────┐              │  │
│  │  │ qa-engineer  │  │ code-reviewer (新規)          │              │  │
│  │  │  (opus)      │  │  (opus)                      │              │  │
│  │  │              │  │  · 本人は Claude で思考        │              │  │
│  │  │ Incremental  │  │  · Bash(codex review ...) 呼出│              │  │
│  │  │ 契約検証      │  │  ──────────┐                 │              │  │
│  │  └──────────────┘  └────────────┼─────────────────┘              │  │
│  └───────────────────────────────┼─┼────────────────────────────────┘  │
└──────────────────────────────────┼─┼───────────────────────────────────┘
                                   │ │ プロセス境界 (fork/exec)
                                   │ │ Bash ツールで外部 CLI 実行
                                   ▼ ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Codex CLI  (別プロセス · 例: /usr/local/bin/codex)                      │
│                                                                        │
│  ローカルインストール例のスナップショット — 環境により異なる:                │
│  · バージョン: codex-cli 0.118.0                                         │
│  · 認証ファイル: ~/.codex/auth.json                                      │
│  · auth_mode: chatgpt    (OAuth ログイン; API キーモードもサポート)       │
│  · chatgpt_plan_type: plus                                             │
│  · デフォルトモデル: gpt-5-codex 系                                       │
│                                                                        │
│  codex review --base main → 内部で OpenAI バックエンドへ HTTPS リクエスト │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTPS (OAuth bearer トークン)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│  OpenAI / ChatGPT バックエンド                                           │
│                                                                        │
│  · ChatGPT OAuth モード: ChatGPT ユーザーとして認証、サブスクリプション   │
│    クォータから消費 (別途 API 課金なし)                                   │
│  · API キーモード: OPENAI_API_KEY で認証、API アカウントにトークン使用量課金 │
│  · gpt-5-codex 系を実行 → レビュー応答を返す                              │
└────────────────────────────────────────────────────────────────────────┘
```

### 2 つの独立したモデル呼び出し経路

```
[1] Claude 系呼び出し (常時)
    リーダー + すべてのエージェント (backend-dev, frontend-dev, infra-dev,
                                   qa-engineer, code-reviewer 本人の思考)
         │
         ▼
    Anthropic API  ← Anthropic アカウント/サブスク
         │
         ▼
    claude-opus-4-6

[2] OpenAI/Codex 系呼び出し (code-reviewer が PR 直前のみ)
    code-reviewer が Bash ツールで `codex review ...` を実行
         │
         ▼
    Codex CLI (別プロセス)
         │
         ▼ (OAuth bearer トークン, chatgpt モード)
    OpenAI バックエンド
         │
         ▼
    gpt-5-codex  ← ChatGPT Plus サブスクリプションクォータから消費
```

この 2 つの経路は **完全に独立** している。同じ「エージェント」という言葉を使うが、内部的には全く別のアカウント・モデル・課金システムである。

### 要点 (誤解しやすい部分)

**1) 「code-reviewer エージェント = Codex モデル」ではない。**
`code-reviewer` は依然として Claude Opus で思考するエージェントである。このエージェントの役割は:
1. Claude Opus で変更範囲を把握する
2. Bash ツールで `codex review` を呼び出す
3. Codex のオリジナル応答をプロジェクトコンテキストでフィルタリングする (再び Claude Opus で)
4. 構造化されたレビュー報告書を Claude Opus で作成する

つまり、`code-reviewer` は **Codex を外部鑑定人 (expert witness) として雇う Claude エージェント** である。

**2) なぜセカンドオピニオンに意味があるのか?**
同じ Claude Opus で別のエージェントがレビューすると「同じモデルが同じバイアスを繰り返す」可能性がある。**別会社・別の学習データ・別の訓練技法のモデル**(GPT-5-codex)をレビュアーとして使うことが、チーム内の Claude レビュアーが見逃すバイアスを捕らえる価値につながる。

**3) 課金は混ざらない。**
| 経路 | 課金対象 |
|------|---------|
| リーダー + すべてのエージェントの思考 | Anthropic (Claude サブスク) |
| `codex review` 呼び出し (ChatGPT OAuth モード) | ChatGPT サブスクリプションクォータ |
| `codex review` 呼び出し (API キーモード) | OpenAI API アカウント (トークン使用量課金) |

Claude 経路と Codex 経路は **常に分離して課金** される。Codex 側の具体的な課金先は Codex CLI がどの auth モードで設定されているかによって変わる。Codex 呼び出しが何らかの理由で失敗した場合(クォータ枯渇、未認証、オフラインなど)、オーケストレーターのエラーハンドラーが Phase 4-5 をスキップし、最小限の stub レビュー報告書を書いてから「Codex レビュー欠落」と注釈して PR を作成する。残りのワークフローはそのまま進行する。

**4) 認証は完全に分離されている。**
```
~/.codex/auth.json    ← Codex CLI 専用
                        (ChatGPT OAuth トークンまたは OPENAI_API_KEY を
                         保存 — 両モードともこのファイルを使う)
                        Claude Code とは無関係。

Claude Code 認証      ← Anthropic 側で別途管理
                        codex login とは無関係。
```
一方をログアウトしてももう一方には影響しない。

## Claude Code ハーネス

このプロジェクトは [Claude Code](https://claude.com/claude-code) + [Harness プラグイン](https://github.com/anthropics/harness-marketplace) でエージェントチームを構成し、並列開発できるように設計されている。

### エージェントチーム

| エージェント | 役割 | 実行タイミング |
|------------|------|--------------|
| `project-architect` | プロジェクトのルール・規約・ガードレール策定 (KISS/YAGNI/DRY/SOLID, 12-Factor, 環境分離, シークレット管理, 依存衛生, AI ガードレール) | 初期 1 回 + ルール変更時 |
| `backend-dev` | Go (Gin) バックエンド (モデル、サービス、ハンドラー、ミドルウェア、DB) | 並列 |
| `frontend-dev` | React フロントエンド (ルーティング、認証、ページ、コンポーネント) | 並列 |
| `infra-dev` | Docker Compose, GitHub Actions CI, 環境設定 | 並列 |
| `qa-engineer` | フロント↔バック 契約検証、ビルド、統合整合性 | モジュール単位 incremental |
| `code-reviewer` | Codex ベースのセカンドオピニオンコードレビュー | PR 直前 1 回 |

### スキル

| スキル | 用途 | 使用エージェント |
|-------|------|---------------|
| `fullstack-orchestrator` | エージェントチーム調整、ワークフロー管理 (Phase 0-5 ルール策定、Phase 4-4 README 自動同期、Phase 4-5 Codex レビューを含む) | リーダー |
| `project-conventions` | 原則・ガードレール・環境分離の reference | `project-architect`(策定基準)、すべての実装エージェント(作業 reference)、`code-reviewer`(レビュー基準) |
| `backend-build` | Go バックエンド実装ガイド | `backend-dev` |
| `frontend-build` | React フロントエンド実装ガイド | `frontend-dev` |
| `infra-setup` | Docker, CI, 設定構成ガイド | `infra-dev` |
| `qa-verify` | 契約検証方法論 | `qa-engineer` |
| `codex-review` | Codex CLI 呼び出し + レビュー報告書作成ガイド | `code-reviewer` |

### ワークフローフェーズ (`fullstack-orchestrator` が管理)

- **Phase 0-5 — ルール策定:** 新規プロジェクトでは `project-architect` が最初に実行され、`docs/conventions/`(principles, secrets, 12-factor, dependencies, ai-guardrails) を作成する。実装エージェントはコードを書き始める前にこれらを reference として読み込む。
- **Phase 2-4 — 並列ビルド:** `backend-dev`/`frontend-dev`/`infra-dev` が並列で構築し、`qa-engineer` がモジュール完成ごとに incremental に検証する。
- **Phase 4-4 — README 自動同期:** PR 作成直前にオーケストレーターが diff を検査し、トリガー条件 — **追加/削除だけでなく既存項目の*意味変更***(エージェント/スキル追加・役割変更、ワークフローフェーズ変更、規約内容変更、ガードレール変更、トップレベルディレクトリ変更、環境変数、ビルドコマンド、外部サービス、認証フロー変更) — にマッチした場合、`README.md`/`README_KO.md`/`README_JA.md` の 3 ファイルを同時に更新する (1 言語のみ更新する drift を防止)。純粋なコード変更はこのフェーズをスキップする。
- **Phase 4-5 — Codex レビュー:** PR 作成直前に `code-reviewer` が `codex review --base main` を実行し、独立したセカンドオピニオンを取得する。

### システムレベルのガードレール (すべてのエージェントに適用)

- **読み取り禁止:** `.env`, `.env.*` (ただし `.env.example` は許可), `*.pem`, `*.key`, `id_rsa*`, `credentials.json`, `*credentials*.json`, `service-account*.json`, `~/.aws/*`, `~/.ssh/*`, `*.kdbx`, **ユーザーホームのシェル初期化ファイル** (`~/.zshrc`, `~/.bashrc`, `~/.profile`, `~/.zprofile` — secret/トークンが環境変数として export されている可能性がある)、**git 履歴経由で露出した secret** (過去に commit されて削除された secret ファイルを `git log -p`/`git show` で復元しないこと)。このポリシーはユーザー承認でも解除されない — 値が本当に必要なら、AI エージェントの read を経由せずユーザーが直接 cat/エディタで開くこと。
- **書き込み禁止:** 上記すべて + ユーザーシステム設定 (`~/.gitconfig`, `~/.npmrc`, `~/.ssh/config`) + 本番設定 (`config/prod.yaml`)
- **実行禁止 (ユーザーの明示的な承認なし):** ワイルドカード `rm -rf`, `git push -f`, `git reset --hard`, 本番 DB への直接アクセス, `curl ... | sh`, `sudo`
- **ロギング禁止:** 環境変数のダンプ、`Authorization` ヘッダー、平文の DB 接続文字列

詳細なガードレールとその根拠は `docs/conventions/ai-guardrails.md` (`project-architect` が作成) に記録される。

### 実行方法

Claude Code でオーケストレーターにチームを指揮するよう依頼する:

```
フルスタックを実装して
```

部分修正も可能:

```
バックエンド API だけ修正して
フロントエンドのログインページを補完して
この PR を codex でレビューして
```

## 設計ドキュメント

- **設計仕様**: [`docs/superpowers/specs/2026-04-08-fullstack-harness-design.md`](docs/superpowers/specs/2026-04-08-fullstack-harness-design.md)
- **実装計画**: [`docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md`](docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md)

## ライセンス

MIT
