<!--
  파일: docs/conventions/README.md
  역할: 프로젝트 규칙 인덱스 — 이 디렉토리의 모든 컨벤션 문서를 한 눈에 보게 한다.
  시스템 내 위치: docs/conventions/ 아래 6개 규칙 문서(principles/secrets/12-factor/dependencies/ai-guardrails)의 진입점.
  관계:
    - 이 파일을 읽는 독자: 신규 기여자(사람), 그리고 후속 에이전트(backend-dev / frontend-dev / infra-dev / code-reviewer).
    - 이 파일을 생성한 주체: project-architect 에이전트 (1회성 초기 구성).
    - 이 파일의 권위 원천: .claude/skills/project-conventions/SKILL.md (8개 원칙 압축 reference).
  설계 의도:
    - 인덱스는 "링크 나열"이 아니라 "언제 어느 문서를 봐야 하는가"의 지도 역할을 해야 한다.
    - 각 링크 옆에는 "이런 일을 할 때 먼저 읽어라"를 한 줄로 붙인다.
    - 컨벤션 문서도 프로젝트의 다른 코드와 동일하게 한국어 학습용 상세 주석 원칙을 따른다.
-->

# Project Conventions — 프로젝트 규칙 인덱스

이 디렉토리는 **Harness Fullstack Test** 프로젝트의 모든 기여자(사람 + AI 에이전트)가 따라야 할 공통 규칙을 모아둔다. 하나의 "원천(source of truth)"으로서, 코드 리뷰·구현·가드레일 판단의 근거가 된다.

## 이 문서를 왜 두는가

이 프로젝트는 Go + React + PostgreSQL 풀스택 **MVP 보일러플레이트**이자 **학습용 프로젝트**이다. 그래서 단순히 "규칙이니 지켜라"가 아니라, **왜 그 규칙이 필요한지**, **지키지 않으면 어떤 사고가 나는지**, **어떻게 적용하는지**의 3박자를 모두 기록한다. 입문자가 이 문서들을 처음부터 끝까지 읽으면, 왜 풀스택 프로젝트가 이렇게 구조를 잡는지 큰 그림이 그려지는 것이 목표이다.

## 규칙 문서 목록

| 문서 | 핵심 질문 | 언제 먼저 읽어야 하는가 |
|------|-----------|-------------------------|
| [principles.md](./principles.md) | "이 코드, 너무 복잡한 거 아닌가?" | 새 기능·리팩터링·코드 리뷰 전 항상 |
| [secrets.md](./secrets.md) | "이 값이 리포에 들어가도 되는가?" | `.env` 관련 작업, 로그 추가, 에러 메시지 설계 전 |
| [12-factor.md](./12-factor.md) | "이거 prod에서도 똑같이 동작하는가?" | 환경변수 추가, 설정 분기 작성, 배포 파이프라인 설계 전 |
| [dependencies.md](./dependencies.md) | "이 패키지, 정말 필요한가?" | `npm install`, `go get`, lock 파일 변경 전 |
| [ai-guardrails.md](./ai-guardrails.md) | "AI 에이전트가 이 동작을 해도 되는가?" | 자동화 스크립트·Agent 작업 트리거 설계 전 |

> **참고**: 위 5개 문서의 이론적 뼈대는 `.claude/skills/project-conventions/SKILL.md`에 있다. SKILL.md는 AI 에이전트가 내부 reference로 로드하는 *압축된* 버전이고, 이 `docs/conventions/` 문서는 *사람이 읽기 위해 풀어 쓴* 버전이다. 같은 지식의 두 표현이므로, 한쪽을 수정하면 다른 쪽도 함께 업데이트해야 한다.

## 사용 방식

### 사람(기여자)이 읽을 때

1. 처음 프로젝트에 참여한다면: `principles.md → secrets.md → 12-factor.md → dependencies.md → ai-guardrails.md` 순서로 끝까지 읽는다(1시간).
2. 특정 작업을 시작할 때: 위 표에서 "언제 먼저 읽어야 하는가"를 보고 해당 문서만 재열람한다.
3. 코드 리뷰 시: 지적의 근거가 이 디렉토리의 어느 문서 어느 섹션인지 명시하면 "취향 vs 규칙"의 논쟁이 줄어든다.

### AI 에이전트(이 프로젝트의 backend-dev / frontend-dev / infra-dev / code-reviewer)가 읽을 때

- **구현 에이전트**는 작업 시작 전에 해당 영역 문서를 reference로 로드한다.
  - 백엔드 작업 → `principles.md`, `12-factor.md`, `secrets.md`
  - 프론트엔드 작업 → `principles.md`, `secrets.md`(VITE_ prefix 규칙)
  - 인프라 작업 → `12-factor.md`, `secrets.md`, `dependencies.md`
- **code-reviewer**는 PR 리뷰 시 이 전체 디렉토리를 로드하여 평가 기준으로 사용한다. `must-fix` / `should-fix` / `nice-to-have` 등급 판단의 근거가 여기에 있다.
- **어떤 에이전트도** 사용자 코드에 규칙 위반이 발견되었다고 해서 자동 수정하지는 않는다. `docs/conventions/audit.md`(존재 시)에 기록만 하고, 수정은 사람 또는 담당 구현 에이전트에게 위임한다.

## 이 디렉토리의 변경 규칙

- 규칙 문서를 수정할 때는 변경 의도를 commit message에 명시한다("왜 이 규칙을 추가/완화했는가").
- 규칙이 프로젝트 현실과 맞지 않으면 **규칙을 고쳐라**. 문서와 코드가 따로 노는 것보다, 현실에 맞게 규칙을 업데이트하는 것이 낫다.
- 단, `secrets.md`와 `ai-guardrails.md`의 "절대 금지" 항목은 보안 관련이므로 **완화는 신중히**. 완화가 필요하다면 CLAUDE.md의 변경 이력 테이블에도 기록한다.

## 같이 보면 좋은 파일

- `/CLAUDE.md` — 프로젝트 상위 지침, 하네스 아키텍처, 변경 이력
- `/.env.example` — 환경변수 키 목록과 placeholder (실제 값 없음)
- `/.gitignore` — 민감 파일 차단 패턴
- `/.claude/skills/project-conventions/SKILL.md` — 이 문서들의 내부 reference 원천
