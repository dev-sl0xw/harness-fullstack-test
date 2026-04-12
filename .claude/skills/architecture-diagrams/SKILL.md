---
name: architecture-diagrams
description: |
  Mermaid-first C4/시퀀스/배포/ER 다이어그램 생성 가이드.
  아래 키워드/상황에서 이 스킬을 즉시 로드하여 사용한다:
  - 다이어그램, 아키텍처 시각화, 아키텍처 다이어그램
  - mermaid, C4, sequence diagram, ER diagram, ERD
  - 시퀀스 다이어그램, 배포 다이어그램
  - deployment diagram, context diagram, container diagram, component diagram
  - draw.io, architecture visualization
  - "어떻게 연결되어 있어?", "구조 보여줘", "흐름 그려줘"
  7개 다이어그램(C4 L1~L3 × 2, Deployment, Sequence, ER)을 .mmd + .md 이중 저장으로 생성한다.
  코드 매핑 표(노드 ↔ 실제 파일 경로 ↔ 주요 함수)가 반드시 포함되어야 한다.
---

# Architecture Diagrams Skill

## 개요

이 스킬은 이 프로젝트의 아키텍처를 시각화하는 다이어그램을 생성하는 가이드다.
Mermaid를 기본 도구로 사용하며, 다음 7개 다이어그램을 대상으로 한다:

| 번호 | 종류 | 파일명 (예정) | 설명 |
|------|------|-------------|------|
| 1 | C4 L1 Context | `context-system.mmd` / `.md` | 시스템 전체 맥락 (외부 사용자·의존 서비스) |
| 2 | C4 L2 Container | `container-overview.mmd` / `.md` | 컨테이너 수준 (Frontend, Backend, DB) |
| 3 | C4 L3 Component (Frontend) | `component-frontend.mmd` / `.md` | React 컴포넌트·라우트·Context |
| 4 | C4 L3 Component (Backend) | `component-backend.mmd` / `.md` | Go 핸들러·서비스·미들웨어·DB 레이어 |
| 5 | Deployment | `deployment-aws.mmd` / `.md` | AWS Free Tier 배포 토폴로지 |
| 6 | Sequence | `sequence-auth-flow.mmd` / `.md` | JWT 로그인 시퀀스 |
| 7 | ER | `er-schema.mmd` / `.md` | PostgreSQL 스키마 |

패턴 참조 파일은 `references/` 디렉토리 하위에 위치한다.


## 핵심 철학 — Mermaid-first

**왜 Mermaid인가?**

| 기준 | Mermaid | draw.io |
|------|---------|---------|
| git diff 가시성 | 텍스트 → diff 가능 | XML 이진형 → diff 불가 |
| GitHub 렌더 | 코드블록 자동 렌더 | 별도 뷰어 필요 |
| 편집 도구 | 없어도 됨 | 프로그램 설치 필요 |
| YAGNI 적합 | 학습용 MVP에 충분 | 과도한 도구 의존 |

draw.io는 조건부 보조 역할만 수행한다. 자세한 내용은 `references/drawio-integration.md` 참조.

**이중 저장 의무**: 모든 다이어그램은 `.mmd` (raw 소스) + `.md` (래퍼 + 설명) 두 파일로 저장한다.


## C4 모델 레벨 매핑

C4 모델은 소프트웨어 아키텍처를 4개 레벨로 단계적으로 확대(zoom in)하며 설명한다.
이 프로젝트에서는 L1~L3 + Deployment + Sequence + ER 총 7개 다이어그램을 생성한다.

```
L1 Context    → 시스템이 누구와 연결되는가 (사용자, 외부 서비스)
L2 Container  → 시스템 내부의 실행 단위 (Frontend, Backend, DB)
L3 Component  → 각 Container 내부의 코드 모듈 (핸들러, 서비스, 컴포넌트)
Deployment    → 인프라 위에 어떻게 배포되는가 (AWS, Docker)
Sequence      → 특정 기능의 시간 순서 흐름 (JWT 로그인)
ER            → 데이터베이스 스키마 구조
```

각 레벨의 Mermaid 문법 패턴은 `references/mermaid-c4-patterns.md` 참조.


## 이중 저장 규칙

### 디렉토리 구조

```
docs/architecture/
├── README.md                      # 다이어그램 인덱스 (링크 목록)
├── context-system.mmd             # raw Mermaid 소스
├── context-system.md              # 래퍼 (설명 + 코드 매핑 + 다이어그램)
├── container-overview.mmd
├── container-overview.md
├── component-frontend.mmd
├── component-frontend.md
├── component-backend.mmd
├── component-backend.md
├── deployment-aws.mmd
├── deployment-aws.md
├── sequence-auth-flow.mmd
├── sequence-auth-flow.md
├── er-schema.mmd
└── er-schema.md
```

### `.mmd` 파일 규칙

- Mermaid 문법만 포함 (설명 없음)
- 파일 첫 줄에 다이어그램 종류 선언 (`graph TB`, `C4Context`, `sequenceDiagram`, `erDiagram` 등)
- CI에서 `mermaid-js/mermaid-cli`로 lint 가능한 형태

### `.md` 래퍼 4 섹션 (필수)

모든 `.md` 래퍼 파일은 반드시 아래 4개 섹션을 순서대로 포함해야 한다.
**코드 매핑 표는 가장 중요한 학습 자료이므로 생략 금지.**

```markdown
# {다이어그램 제목}

## 1. 이 다이어그램이 설명하는 것

{이 다이어그램이 보여주는 범위, 관점, 목적을 2~4문장으로 설명}

## 2. 코드 매핑

| 다이어그램 노드 | 실제 파일 경로 | 주요 함수/컴포넌트 |
|---------------|-------------|-----------------|
| {node_id} | {파일 경로} | {함수명, 역할} |

## 3. 다이어그램

```mermaid
{다이어그램 내용 — .mmd 파일과 동일}
```

## 4. 설계 의도 및 학습 포인트

### 왜 이 구조인가?
{설계 선택의 이유, 트레이드오프}

### 학습 포인트
- {이 다이어그램에서 배울 수 있는 개념 목록}
```


## draw.io 조건부 보조

draw.io는 MCP 서버 또는 CLI가 가용할 때만 병행 생성한다.

**가용성 체크 절차:**
1. 현재 세션의 MCP 서버 목록에서 `drawio` 키워드를 탐색한다.
2. `which drawio` 명령으로 CLI 바이너리 존재를 확인한다.
3. 둘 다 없으면 → **mermaid only**로 진행, draw.io 파일은 생성하지 않는다.

현재 MVP 단계에서는 draw.io MCP가 설치되어 있지 않다고 가정한다.
상세 지침은 `references/drawio-integration.md` 참조.


## 종료 조건

이 스킬을 사용하는 작업이 완료되었다고 판단하는 기준:

- [ ] 7개 `.mmd` 파일 생성 완료 (`docs/architecture/` 하위)
- [ ] 7개 `.md` 래퍼 파일 생성 완료 (4섹션 모두 포함, 코드 매핑 표 필수)
- [ ] `docs/architecture/README.md` 생성 완료 (7개 다이어그램 링크 목록)
- [ ] CI `diagrams-lint` job 추가 요청 완료 (infra-dev 에이전트 담당)
- [ ] 각 `.md` 파일의 코드 매핑 표에서 실제 파일 경로가 존재하는지 확인

**CI lint job**: `mermaid-js/mermaid-cli`를 사용하여 `.mmd` 파일의 문법 오류를 검출한다.
infra-dev 에이전트에게 `.github/workflows/diagrams-lint.yml` 추가를 요청하여 처리한다.


## 참조 파일 목록

| 파일 | 내용 |
|------|------|
| `references/mermaid-c4-patterns.md` | C4Context/Container/Component Mermaid 문법 패턴 |
| `references/mermaid-sequence-patterns.md` | Sequence Diagram 문법 + JWT 플로우 예시 |
| `references/mermaid-deployment-patterns.md` | AWS 배포 토폴로지 Flowchart 패턴 |
| `references/mermaid-er-patterns.md` | erDiagram 문법 + users 테이블 예시 |
| `references/naming-conventions.md` | 파일명/노드ID/색상/방향 네이밍 규칙 |
| `references/drawio-integration.md` | draw.io 조건부 보조 통합 가이드 (STUB) |
