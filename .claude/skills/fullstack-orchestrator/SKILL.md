---
name: fullstack-orchestrator
description: "풀스택 프로젝트(Go+React+PostgreSQL) 에이전트 팀을 조율하는 오케스트레이터. 풀스택 구현, 프로젝트 빌드, 전체 스택 구축, 백엔드+프론트엔드 개발 요청 시 이 스킬을 사용. 신규 프로젝트 초기화 시 규칙·컨벤션·가드레일 수립, PR 생성 직전의 Codex 리뷰 단계 모두 이 오케스트레이터가 관리한다. 후속 작업: 풀스택 수정, 부분 재실행, 업데이트, 보완, 다시 실행, 이전 결과 개선, 특정 에이전트만 재실행, PR 리뷰 요청, 컨벤션 수립/수정, KISS/YAGNI/DRY/SOLID 적용, 12-Factor/환경 분리 도입, 시크릿 관리, AI 가드레일 추가 요청 시에도 반드시 이 스킬을 사용."
---

# Fullstack Orchestrator

Go(Gin)+React+PostgreSQL 풀스택 프로젝트의 에이전트 팀을 조율하여 전체 스택을 구축하는 통합 스킬.

## 실행 모드: 에이전트 팀

## 에이전트 구성

| 팀원 | 에이전트 정의 | 역할 | 스킬 | 출력 |
|------|-------------|------|------|------|
| project-architect | `.claude/agents/project-architect.md` | 프로젝트 규칙·컨벤션·가드레일 수립 | project-conventions | `docs/conventions/`, `.env.example`, CLAUDE.md 가드레일 섹션 |
| backend-dev | `.claude/agents/backend-dev.md` | Go 백엔드 전체 | backend-build | `backend/` |
| frontend-dev | `.claude/agents/frontend-dev.md` | React 프론트엔드 전체 | frontend-build | `frontend/` |
| infra-dev | `.claude/agents/infra-dev.md` | Docker, CI, 설정 | infra-setup | 루트 설정 파일들 |
| qa-engineer | `.claude/agents/qa-engineer.md` | 통합 정합성 검증 (경계면 계약) | qa-verify | `_workspace/qa_report.md` |
| code-reviewer | `.claude/agents/code-reviewer.md` | Codex 기반 PR 품질 리뷰 | codex-review | `_workspace/review_report_*.md` |

**역할 경계 (project-architect vs qa-engineer vs code-reviewer):**
- `project-architect`는 **규칙 수립**(원칙·가드레일·환경 분리 골격) 담당. 프로젝트 초기 1회 또는 규칙 변경 시점에만 실행된다. 코드를 작성하지 않고 `docs/conventions/`와 가드레일 문서를 만든다.
- `qa-engineer`는 **경계면 계약 검증**(API shape ↔ 타입, 라우트 매핑, 빌드 성공, 인증 흐름 연속성) 담당. 구현 모듈이 완성될 때마다 **점진적(incremental)**으로 실행된다.
- `code-reviewer`는 **코드 품질 second opinion**(로직 결함, 엣지 케이스, 설계 선택, 보안/성능 리스크) 담당. **PR 생성 직전에 1회** 실행된다. 리뷰 시 `docs/conventions/`를 reference로 로드하여 평가 기준으로 사용.
- 세 에이전트는 서로의 산출물을 먼저 읽어 중복 지적을 피한다.

## 워크플로우

### Phase 0: 컨텍스트 확인

기존 산출물 존재 여부를 확인하여 실행 모드를 결정한다:

1. `_workspace/` 디렉토리 존재 여부 확인
2. `backend/`, `frontend/` 디렉토리에 기존 코드 존재 여부 확인
3. `docs/conventions/` 디렉토리 존재 여부 확인 (규칙 수립 여부 판단)
4. 실행 모드 결정:
   - **코드 미존재 + conventions 미존재** → 초기 실행. Phase 0-5(규칙 수립)부터 진행
   - **코드 미존재 + conventions 존재** → 초기 구현 실행. Phase 1로 진행
   - **코드 존재 + 사용자가 부분 수정 요청** → 부분 재실행. 해당 에이전트만 재호출
   - **코드 존재 + 새 입력/전체 재구축 요청** → 새 실행. 기존 `_workspace/`를 `_workspace_prev/`로 이동
   - **사용자가 규칙·컨벤션·가드레일 수립/수정 요청** → Phase 0-5만 실행

### Phase 0-5: 프로젝트 규칙 수립 (project-architect)

**언제 실행되는가:**
- 초기 신규 프로젝트 빌드 시 (Phase 1보다 먼저)
- 사용자가 명시적으로 규칙·컨벤션·가드레일 추가/수정을 요청할 때
- 새 원칙 도입 시 (예: "12-Factor 적용해줘", "AI 가드레일 추가해줘")

**워크플로우:**

1. **선행 조건 확인:** `docs/conventions/` 존재 여부 확인 → 없으면 신규 수립, 있으면 감사(audit) 모드
2. **project-architect 스폰:**
   - `general-purpose` 타입, `model: "opus"`
   - 에이전트 정의 파일(`.claude/agents/project-architect.md`)과 `project-conventions` 스킬을 읽도록 지시
3. **수립 요청:**
   - 리더 → project-architect에게 SendMessage: 적용할 원칙 항목 (기본은 Phase A 8개 항목 전체), 기존 컨텍스트 참고 사항(예: 의존성 사고 사례)
4. **산출 확인:**
   - `docs/conventions/{README,principles,secrets,12-factor,dependencies,ai-guardrails}.md` 생성 확인
   - `.env.example` 생성/갱신 확인
   - `.gitignore` 보강 확인
   - CLAUDE.md 가드레일 섹션 갱신 확인
5. **후속 에이전트에 컨벤션 전파:** 이후 Phase 2에서 backend-dev/frontend-dev/infra-dev/code-reviewer를 스폰할 때, 각 에이전트에게 *작업 시작 전 `docs/conventions/`를 reference로 읽도록* 명시 지시

**감사(audit) 모드 동작:**
- 기존 conventions 문서가 있을 때는 새로 만들지 않고, 누락 항목과 위반 사항만 `docs/conventions/audit.md`에 기록
- 사용자에게 보고하고 보강 여부 확인

### Phase 1: 준비

1. 설계 스펙 확인: `docs/superpowers/specs/2026-04-08-fullstack-harness-design.md`
2. 구현 계획 확인: `docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md`
3. `_workspace/` 디렉토리 생성 (초기 실행 시)
4. **`docs/conventions/` 존재 확인** (Phase 0-5에서 수립되어 있어야 함)
5. 작업 범위 결정:
   - 전체 실행: Task 1~15 전체
   - 부분 재실행: 사용자 지정 Task만

### Phase 2: 팀 구성 및 작업 할당

1. 팀 생성:
   ```
   TeamCreate(team_name: "fullstack-team")
   ```

2. **초기 팀원 스폰 — 4명** (모든 에이전트는 `model: "opus"` 사용). 각 에이전트는 작업 시작 전 **`docs/conventions/` 전체를 reference로 읽도록** 지시한다:
   - `backend-dev`: general-purpose 타입. 에이전트 정의 파일의 역할과 스킬을 읽고, `docs/conventions/`(특히 principles, secrets, 12-factor, dependencies, ai-guardrails)를 reference로 로드한 뒤, 구현 계획 Task 1~7을 수행하도록 지시.
   - `frontend-dev`: general-purpose 타입. 에이전트 정의 파일의 역할과 스킬을 읽고, `docs/conventions/`(같은 항목)를 reference로 로드한 뒤, 구현 계획 Task 8~12를 수행하도록 지시.
   - `infra-dev`: general-purpose 타입. 에이전트 정의 파일의 역할과 스킬을 읽고, `docs/conventions/`(특히 12-factor, secrets, ai-guardrails)를 reference로 로드한 뒤, 구현 계획 Task 2(일부), 13~14를 수행하도록 지시.
   - `qa-engineer`: general-purpose 타입. 에이전트 정의 파일의 역할과 스킬을 읽고, 다른 에이전트의 작업 완료를 대기하다 점진적 검증을 수행하도록 지시.

   **`project-architect`는 Phase 0-5에서만 동작**하며, Phase 2의 팀에는 포함되지 않는다.
   **`code-reviewer`는 Phase 4-5에서 필요 시점에 동적으로 스폰**된다 (Phase 2에서는 스폰하지 않음). 이는 팀 수명주기를 짧게 유지하고, 구현/QA 단계에서 idle 에이전트가 유휴 상태로 대기하는 비용을 피하기 위함이다.

3. 작업 등록 (TaskCreate):
   - backend-dev: "Go 백엔드 전체 구현 (Task 1-7)"
   - frontend-dev: "React 프론트엔드 전체 구현 (Task 8-12)"
   - infra-dev: "인프라 구성 (Docker, CI, CLAUDE.md)"
   - qa-engineer: "통합 정합성 검증" (depends_on: backend + frontend)

### Phase 3: 병렬 구현

**실행 방식:** 감독자 패턴 — 팀원들이 자체 조율하며, 리더가 모니터링.

**병렬 작업 구조:**
```
[backend-dev]  ──Task 1~7──→  Go 백엔드 완성
[frontend-dev] ──Task 8~12──→ React 프론트엔드 완성  
[infra-dev]    ──Task 2,13,14→ 인프라 완성
    ↓ (완료 알림)
[qa-engineer]  ──점진적 검증──→ QA 보고서
```

**의존성 관리:**
- backend-dev와 frontend-dev는 독립적으로 시작 가능 (설계 스펙에서 API 형식 도출)
- backend-dev가 API 완성 시 frontend-dev에게 정확한 응답 shape 전달
- infra-dev는 DB 마이그레이션/config부터 시작, Dockerfile은 빌드 코드 완성 후
- qa-engineer는 백엔드/프론트엔드 코드가 나오는 대로 점진적 검증

**팀원 간 통신:**
- backend-dev → frontend-dev: API 엔드포인트 완성 알림 (응답 shape 포함)
- backend-dev → infra-dev: 환경변수 추가/변경 알림
- 각 에이전트 → qa-engineer: 모듈 완성 알림

**리더 역할:**
- 팀원 유휴 알림을 수신하며 진행 상황 파악
- 팀원이 막힌 경우 SendMessage로 지시
- 팀원 간 충돌 발생 시 중재

### Phase 4: QA 검증 및 수정

1. qa-engineer의 검증 보고서 수신 대기
2. 불일치 발견 시:
   - qa-engineer가 담당 에이전트에게 직접 수정 요청 (SendMessage)
   - 수정 후 재검증 (최대 2회 반복)
3. 전체 빌드 확인:
   - `go build ./cmd/server` (백엔드)
   - `npm run build` (프론트엔드)
4. 최종 QA 보고서를 `_workspace/qa_report.md`에 저장

### Phase 4-4: README 갱신 영향도 평가

PR을 만들기 직전(Codex 리뷰 직전)에, 이번 변경이 **README.md / README_KO.md / README_JA.md**에 반드시 반영되어야 하는지 자동 평가하고, 필요한 경우 README를 갱신한다. 사용자가 매번 "README도 업데이트해줘"라고 요청하지 않아도 자동 동작한다.

**README 갱신이 필요한 변경 유형 (자동 트리거 조건):**

| 변경 영역 | 갱신 필요 여부 | 갱신할 README 섹션 |
|---------|--------------|------------------|
| 새 에이전트 추가/삭제 (`.claude/agents/*.md`) | **필수** | 하네스 구조 / 에이전트 목록 |
| 새 스킬 추가/삭제 (`.claude/skills/*/SKILL.md`) | **필수** | 하네스 구조 / 스킬 목록 |
| 디렉토리 구조 변경 (`backend/`, `frontend/`, `docs/`, `_workspace/` 등 최상위 레벨) | **필수** | 프로젝트 구조 / 디렉토리 트리 |
| 새 컨벤션/규칙 (`docs/conventions/`) 추가 | **필수** | 프로젝트 규칙 / 컨벤션 |
| 신규 환경변수 추가 (`.env.example` 변경) | **필수** | 환경 설정 / 시작하기 |
| 빌드/실행 명령어 변경 (`package.json` scripts, Makefile, Dockerfile entrypoint) | **필수** | 개발 명령어 / 시작하기 |
| 새 외부 서비스/포트 추가 (Redis, Elasticsearch 등) | **필수** | 기술 스택 / 아키텍처 |
| 인증/권한 흐름 변경 | 필수 | 보안 / 인증 |
| 일반 비즈니스 로직 변경 (핸들러 내부, 컴포넌트 내부 등) | 불필요 | — |
| 버그 수정, refactoring, 주석 보강 | 불필요 | — |
| lock 파일만 변경 | 불필요 | — |

**워크플로우:**

1. **변경 영향도 분석:**
   - `git diff main...HEAD --stat`으로 변경 파일 목록 확보
   - 위 표의 "필수" 패턴 중 하나라도 매칭되면 다음 단계로, 그렇지 않으면 Phase 4-5로 점프
2. **README 갱신 대상 결정:**
   - 매칭된 변경 유형별로 README의 어느 섹션을 갱신해야 하는지 매핑
   - 다국어 README가 모두 존재하는 경우 (`README.md`, `README_KO.md`, `README_JA.md`) **세 파일 모두** 동일하게 갱신 — 한 언어만 업데이트하는 drift 금지
3. **자동 갱신 수행:**
   - 리더(메인 에이전트)가 직접 Edit 도구로 README를 갱신. 에이전트 팀에 별도 README 전담 에이전트는 만들지 않는다 (단순 동기화 작업이며 새 에이전트 도입은 YAGNI 위반)
   - 갱신 내용은 *변경된 사실의 반영*으로 한정. 마케팅 카피·재구성·번역 개선 등 범위 외 작업 금지
   - 다국어 일관성: 한국어 표현·영어 표현·일본어 표현이 같은 정보를 담도록 단순 미러링
4. **갱신 후 검증:**
   - 세 README 파일에서 변경된 섹션의 정보가 일치하는지 grep으로 교차 확인
   - 깨진 내부 링크/앵커가 없는지 확인 (`.md` 내부 헤딩 참조)
5. **PR body 메모:**
   - PR 본문에 "README 자동 갱신 — {변경 유형}, 대상 파일: README.md/README_KO.md/README_JA.md" 한 줄 기록
6. Phase 4-5(Codex 리뷰)로 진행. **README 변경분도 Codex 리뷰 범위에 포함**된다.

**자동 갱신 건너뛰기 조건:**

- README 파일 자체가 존재하지 않는 프로젝트 단계 (초기 빌드 중)
- 사용자가 이번 PR에 대해 명시적으로 "README는 다음 PR에서 같이"라고 지시한 경우
- 변경이 모두 "불필요" 카테고리

### Phase 4-5: PR 생성 직전 Codex 리뷰

PR을 만들기 직전에 `code-reviewer`에게 리뷰를 요청하여 머지 전 second opinion을 확보한다. 이 Phase는 **PR 단위로 실행**되며, 각 PR 작업마다 1회씩 수행된다.

1. **선행 조건 확인:**
   - Phase 4의 QA가 완료되어 있는지 확인 (`_workspace/qa_report.md` 존재 + 빌드 통과)
   - 리뷰 대상 브랜치가 체크아웃되어 있는지 확인
   - `codex --version`으로 Codex CLI 가용성 확인
   - **Codex 미설치/미인증/쿼터 소진 시 fallback:** `code-reviewer`(미스폰이면 리더가 직접) 가 `_workspace/review_report_{식별자}.md`에 **stub 보고서**를 반드시 생성한다. stub 보고서 필수 필드: `status: "Codex unavailable"`, `reason`(에러 메시지), `retry_count`, `manual_review_performed`(true/false), `merge_recommendation`(GO/NO-GO/HUMAN-REVIEW-REQUIRED). 이 stub 파일이 있어야 Phase 5의 PR body 요약 단계가 정상 동작한다.

2. **code-reviewer 팀원 활성화 (아직 미스폰이면 스폰):**
   - `general-purpose` 타입, `model: "opus"`
   - 에이전트 정의 파일(`.claude/agents/code-reviewer.md`)과 `codex-review` 스킬을 읽도록 지시

3. **리뷰 요청:**
   - 리더 → code-reviewer에게 SendMessage: PR 번호 또는 브랜치명, 리뷰 범위 힌트
   - code-reviewer는 `codex-review` 스킬의 워크플로우에 따라 `codex review --base main` 실행
   - 결과를 `_workspace/review_report_{식별자}.md`에 저장

4. **리뷰 결과 처리:**
   - **must-fix ≥ 1건:** code-reviewer가 해당 구현 에이전트에게 직접 수정 요청 (SendMessage). 수정 후 `review_report_{식별자}_rev2.md`로 재리뷰
   - **must-fix = 0건, should-fix/nit만 있음:** PR 생성 진행. should-fix/nit 항목은 PR body에 "리뷰 참고사항" 섹션으로 기록
   - **머지 권고 NO-GO:** 리더가 사용자에게 보고하고 결정 대기

5. **PR 생성:**
   - 리뷰 보고서 요약(심각도별 건수 + 머지 권고)을 PR body에 포함
   - `gh pr create`로 PR 생성

### Phase 5: 정리

1. 모든 팀원에게 종료 요청 (SendMessage)
2. TeamDelete로 팀 정리
3. `_workspace/` 보존
4. 사용자에게 결과 요약 보고:
   - 생성된 파일 목록
   - 빌드 결과
   - QA 검증 결과
   - 남은 작업 (있을 경우)

## 데이터 흐름

```
[리더] → TeamCreate → [backend-dev] ←SendMessage→ [frontend-dev]
                          │                           │
                     API 코드 생성              페이지 코드 생성
                          │                           │
                    [infra-dev]                        │
                     Docker/CI 구성                    │
                          │                           │
                          └──── [qa-engineer] ────────┘
                                    │
                            _workspace/qa_report.md
                                    │
                          [code-reviewer] ← PR 단위 호출
                                    │
                        _workspace/review_report_*.md
                                    │
                              [리더: 결과 보고 + PR 생성]
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| 팀원 1명 실패/중지 | SendMessage로 상태 확인 → 재작업 지시 |
| Go/npm 빌드 실패 | 에러 메시지를 담당 에이전트에게 전달, 수정 요청 |
| API shape 불일치 | qa-engineer가 감지 → 담당 에이전트에게 수정 요청 |
| Codex CLI 미설치/미인증 | Phase 4-5 건너뛰고 리더에게 보고, PR body에 "Codex 리뷰 누락" 명시 |
| Codex 응답 타임아웃 | 1회 재시도 → 재실패 시 code-reviewer가 수동 리뷰 수행, 보고서에 표기 |
| Codex 리뷰 must-fix 발견 | 해당 구현 에이전트에게 수정 요청, 수정 후 rev2 재리뷰 |
| 팀원 과반 실패 | 사용자에게 알리고 진행 여부 확인 |
| 타임아웃 | 현재까지 생성된 코드 보존, 미완료 Task 보고 |

## 테스트 시나리오

### 정상 흐름
1. 사용자가 "풀스택 구현해줘" 요청
2. Phase 0에서 초기 실행 판정
3. Phase 1에서 설계 스펙/계획 확인
4. Phase 2에서 **초기 4명 팀 구성** (backend/frontend/infra/qa) + Task 할당. `code-reviewer`는 Phase 4-5에서 동적 스폰.
5. Phase 3에서 병렬 구현 (backend/frontend/infra 동시, qa 점진적)
6. Phase 4에서 QA 검증, 불일치 수정
7. Phase 4-5에서 PR 직전 Codex 리뷰 → must-fix 없음 확인 → PR 생성
8. Phase 5에서 팀 정리, 결과 보고
9. 예상 결과: `backend/`, `frontend/`, `docker-compose.yml`, `.github/workflows/ci.yml` 생성 + 모든 PR에 리뷰 보고서 첨부

### 에러 흐름
1. Phase 3에서 backend-dev가 Go 빌드 에러 발생
2. 리더가 에러 감지, backend-dev에게 수정 요청
3. backend-dev가 수정 후 빌드 성공
4. qa-engineer가 재검증 수행
5. Phase 4-5에서 code-reviewer가 must-fix 1건 발견(예: SQL injection 가능성)
6. code-reviewer가 backend-dev에게 직접 수정 요청
7. 수정 후 rev2 재리뷰 → must-fix 0건 확인
8. PR 생성 → 머지
