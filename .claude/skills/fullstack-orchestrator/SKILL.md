---
name: fullstack-orchestrator
description: "풀스택 프로젝트(Go+React+PostgreSQL) 에이전트 팀을 조율하는 오케스트레이터. 풀스택 구현, 프로젝트 빌드, 전체 스택 구축, 백엔드+프론트엔드 개발 요청 시 이 스킬을 사용. PR 생성 직전의 Codex 리뷰 단계도 이 오케스트레이터가 관리한다. 후속 작업: 풀스택 수정, 부분 재실행, 업데이트, 보완, 다시 실행, 이전 결과 개선, 특정 에이전트만 재실행, PR 리뷰 요청 시에도 반드시 이 스킬을 사용."
---

# Fullstack Orchestrator

Go(Gin)+React+PostgreSQL 풀스택 프로젝트의 에이전트 팀을 조율하여 전체 스택을 구축하는 통합 스킬.

## 실행 모드: 에이전트 팀

## 에이전트 구성

| 팀원 | 에이전트 정의 | 역할 | 스킬 | 출력 |
|------|-------------|------|------|------|
| backend-dev | `.claude/agents/backend-dev.md` | Go 백엔드 전체 | backend-build | `backend/` |
| frontend-dev | `.claude/agents/frontend-dev.md` | React 프론트엔드 전체 | frontend-build | `frontend/` |
| infra-dev | `.claude/agents/infra-dev.md` | Docker, CI, 설정 | infra-setup | 루트 설정 파일들 |
| qa-engineer | `.claude/agents/qa-engineer.md` | 통합 정합성 검증 (경계면 계약) | qa-verify | `_workspace/qa_report.md` |
| code-reviewer | `.claude/agents/code-reviewer.md` | Codex 기반 PR 품질 리뷰 | codex-review | `_workspace/review_report_*.md` |

**역할 경계 (qa-engineer vs code-reviewer):**
- `qa-engineer`는 **경계면 계약 검증**(API shape ↔ 타입, 라우트 매핑, 빌드 성공, 인증 흐름 연속성)을 담당한다. 구현 모듈이 완성될 때마다 **점진적(incremental)**으로 실행된다.
- `code-reviewer`는 **코드 품질 second opinion**(로직 결함, 엣지 케이스, 설계 선택, 보안/성능 리스크)을 담당한다. **PR 생성 직전에 1회** 실행된다.
- 두 에이전트는 서로의 보고서를 먼저 읽어 중복 지적을 피한다.

## 워크플로우

### Phase 0: 컨텍스트 확인

기존 산출물 존재 여부를 확인하여 실행 모드를 결정한다:

1. `_workspace/` 디렉토리 존재 여부 확인
2. `backend/`, `frontend/` 디렉토리에 기존 코드 존재 여부 확인
3. 실행 모드 결정:
   - **코드 미존재** → 초기 실행. Phase 1로 진행
   - **코드 존재 + 사용자가 부분 수정 요청** → 부분 재실행. 해당 에이전트만 재호출
   - **코드 존재 + 새 입력/전체 재구축 요청** → 새 실행. 기존 `_workspace/`를 `_workspace_prev/`로 이동

### Phase 1: 준비

1. 설계 스펙 확인: `docs/superpowers/specs/2026-04-08-fullstack-harness-design.md`
2. 구현 계획 확인: `docs/superpowers/plans/2026-04-09-fullstack-harness-plan.md`
3. `_workspace/` 디렉토리 생성 (초기 실행 시)
4. 작업 범위 결정:
   - 전체 실행: Task 1~15 전체
   - 부분 재실행: 사용자 지정 Task만

### Phase 2: 팀 구성 및 작업 할당

1. 팀 생성:
   ```
   TeamCreate(team_name: "fullstack-team")
   ```

2. 팀원 스폰 — **모든 에이전트는 `model: "opus"` 사용**:
   - `backend-dev`: general-purpose 타입. 에이전트 정의 파일의 역할과 스킬을 읽고, 구현 계획 Task 1~7을 수행하도록 지시.
   - `frontend-dev`: general-purpose 타입. 에이전트 정의 파일의 역할과 스킬을 읽고, 구현 계획 Task 8~12를 수행하도록 지시.
   - `infra-dev`: general-purpose 타입. 에이전트 정의 파일의 역할과 스킬을 읽고, 구현 계획 Task 2(일부), 13~14를 수행하도록 지시.
   - `qa-engineer`: general-purpose 타입. 에이전트 정의 파일의 역할과 스킬을 읽고, 다른 에이전트의 작업 완료를 대기하다 점진적 검증을 수행하도록 지시.

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

### Phase 4-5: PR 생성 직전 Codex 리뷰

PR을 만들기 직전에 `code-reviewer`에게 리뷰를 요청하여 머지 전 second opinion을 확보한다. 이 Phase는 **PR 단위로 실행**되며, 각 PR 작업마다 1회씩 수행된다.

1. **선행 조건 확인:**
   - Phase 4의 QA가 완료되어 있는지 확인 (`_workspace/qa_report.md` 존재 + 빌드 통과)
   - 리뷰 대상 브랜치가 체크아웃되어 있는지 확인
   - `codex --version`으로 Codex CLI 가용성 확인
   - Codex 미설치/미인증 시 리더에게 보고하고 Phase 4-5 건너뜀 (단, 보고서에 "Codex 리뷰 누락" 명시)

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
4. Phase 2에서 5명 팀 구성 + Task 할당 (code-reviewer는 PR 단계에 활성화)
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
