---
name: codex-review
description: "`code-reviewer` 에이전트가 호출하는 **내부 전용** 스킬. Codex CLI(`codex review`)를 실행하여 변경셋 second opinion을 받고 구조화된 리뷰 보고서를 생성하는 방법을 정의한다. 사용자 발화("PR 리뷰해줘", "머지 전 리뷰", "second opinion")로부터 **직접 트리거되면 안 되며**, 사용자 진입점은 항상 `fullstack-orchestrator`이다. 오케스트레이터가 Phase 4-5에서 `code-reviewer`를 스폰할 때 해당 에이전트가 이 스킬을 내부적으로 로드한다."
---

# Codex Review Skill

Codex CLI(`codex review`)를 호출하여 변경셋에 대한 **독립적 second opinion** 리뷰를 수행하고, 그 결과를 프로젝트 맥락에 맞게 필터링한 구조화된 보고서로 정리한다.

## 핵심 원칙

1. **변경셋 중심**: 리뷰 범위는 항상 diff. 전체 리포지토리 리뷰 금지.
2. **심각도 분류 필수**: 모든 지적은 `must-fix` / `should-fix` / `nit` 중 하나로 분류.
3. **Codex 응답 ≠ 최종 보고서**: Codex 출력을 그대로 복사하지 말고, 프로젝트 맥락으로 필터링.
4. **중복 방지**: `_workspace/qa_report.md`가 있으면 먼저 읽고, QA가 잡은 계약 불일치는 재지적하지 않음.

## 워크플로우

### 1. 리뷰 범위 결정

다음 중 해당하는 입력을 확인한다:

| 입력 | Codex 명령 | 용도 |
|------|-----------|------|
| PR 번호(예: #7) | `gh pr checkout 7` 후 `codex review --base main` | PR 브랜치 체크아웃 후 main 기준 리뷰 |
| 브랜치명 | `git switch <branch>` 후 `codex review --base main` | 브랜치 vs 베이스 |
| 커밋 해시 | `codex review --commit <sha>` | 단일 커밋 |
| 커밋 전 작업물 | `codex review --uncommitted` | staged + unstaged + untracked |

**PR 생성 직전 리뷰(가장 일반적):**
```bash
# 현재 체크아웃된 브랜치가 PR의 소스 브랜치라고 가정
codex review --base main --title "$(git log -1 --format=%s)"
```

### 2. diff 크기 사전 점검

```bash
git diff --stat main...HEAD
```

- diff가 **2000줄 초과**이면 파일 그룹으로 분할 리뷰:
  - `backend/` 전용: `codex review --base main ... backend/`는 지원되지 않으므로, 임시 브랜치로 체리픽하거나, 보고서를 파일 그룹별 섹션으로 나눠 작성
  - 또는 Codex 프롬프트에 "특히 X 디렉토리에 집중해서 리뷰" 지시
- diff가 **비어있으면** 리뷰 대상 없음으로 보고서 생성하고 종료

### 3. Codex 호출

**기본 호출 (PR 리뷰):**
```bash
codex review --base main --title "PR #{N}: {제목}" <<'EOF'
이 프로젝트는 Go(Gin) 백엔드 + React(TypeScript) 프론트엔드 + PostgreSQL 풀스택 보일러플레이트이며, MVP 우선 접근으로 User CRUD + JWT 인증을 구현하는 단계이다.

다음 관점으로 변경셋을 리뷰해주세요:
1. 로직 결함, 엣지 케이스 누락, 에러 처리 부족
2. 설계 선택의 타당성 (레이어 분리, 의존 방향, 명명, 응집도)
3. 보안 리스크 (SQL injection, XSS, 인증 우회, 시크릿 노출 등)
4. 성능 리스크 (N+1, 불필요한 재렌더, 과도한 allocation)
5. 한국어 학습용 주석 품질 (파일 상단, 함수, 설계 의도)

각 지적은 파일:줄 위치와 함께 심각도(must-fix / should-fix / nit)를 붙여주세요.
이미 qa-engineer가 경계면 계약(API shape ↔ 타입 교차 비교, 빌드 성공, URL 매핑)을 검증했으므로, 그 영역은 재검토하지 말고 코드 품질/로직/설계에 집중해주세요.
EOF
```

**재시도 전략:**
- Codex가 타임아웃/에러 반환 → 1회 재시도
- 재실패 → 리뷰 보고서에 "Codex 응답 불가" 섹션 명시 + 가능한 범위에서 수동 리뷰 수행

### 4. 결과 필터링 (프로젝트 맥락 적용)

Codex 출력을 그대로 쓰지 말고 다음 필터를 적용한다:

| Codex가 지적할 가능성 | 프로젝트 맥락 | 처리 |
|--------------------|-------------|------|
| "테스트 코드가 없다" | MVP 단계, 테스트는 별도 작업 | **out-of-scope**로 분리 |
| "프로덕션 JWT 시크릿 하드코딩" | `dev-secret-change-in-production`은 의도적 플레이스홀더 | **nit** 또는 제외 |
| "한국어 주석이 과하다" | 학습용 상세 주석은 필수 규칙 | **제외** |
| "타입 추상화 더 필요" | MVP 보일러플레이트, 오버엔지니어링 금지 | **nit** 또는 out-of-scope |
| "SQL injection 가능성" | 실제 문자열 concat이 있다면 | **must-fix** |
| "패닉 핸들링 없음" | 핵심 경로라면 | **should-fix** |
| "에러 메시지 사용자 노출" | 보안 리스크 | **must-fix** |

판단 기준: **이 프로젝트 단계(MVP)**에서 **머지를 막아야 할 정도**인가?
- 머지 막아야 함 → `must-fix`
- 머지 후 곧 고쳐야 함 → `should-fix`
- 있으면 좋지만 지금 안 해도 됨 → `nit`
- 이 PR 범위 밖 → out-of-scope

### 5. 보고서 생성

보고서를 `_workspace/review_report_{식별자}.md`에 저장한다. 식별자는:
- PR 리뷰: `pr_{번호}` (예: `review_report_pr_7.md`)
- 브랜치 리뷰: `branch_{브랜치명을_안전하게_변환}`
- 재리뷰: `_rev2`, `_rev3` 접미사 (기존 파일 덮어쓰지 말 것)

### 6. 리더 보고

리더에게 SendMessage로 다음을 보고:
- 보고서 파일 경로
- 심각도별 건수 (must: N, should: M, nit: K)
- 머지 권고 (go / no-go with reason)

`must-fix`가 1건 이상이면 해당 구현 에이전트에게도 직접 SendMessage로 수정 요청.

## 리뷰 보고서 형식

```markdown
# 코드 리뷰 보고서 — {PR/브랜치/커밋 식별자}

**리뷰 대상:** {브랜치 또는 PR 번호}
**베이스:** main
**diff 크기:** {파일 수} files changed, {+추가} / {-삭제}
**Codex 실행:** {성공/실패/재시도 횟수}
**QA 보고서 참조:** {yes/no, 경로}

## 요약

- **must-fix:** N건
- **should-fix:** M건
- **nit:** K건
- **머지 권고:** GO / NO-GO
- **권고 사유:** {한 줄 요약}

## Must-fix (머지 전 수정 필수)

### 1. {한 줄 제목}

- **위치:** `backend/internal/service/auth_service.go:42`
- **현재 코드의 리스크:** {무엇이 문제인가}
- **근거:** {왜 문제인가 — 보안/데이터 손실/크래시 등}
- **수정 제안:** {어떻게 고쳐야 하나}

(지적 없으면 "없음"으로 기록)

## Should-fix (머지 후 빠른 수정 권장)

### 1. {한 줄 제목}

- **위치:** `frontend/src/pages/LoginPage.tsx:25`
- **현재 코드의 리스크:** ...
- **근거:** ...
- **수정 제안:** ...

## Nit (선택적 개선)

- `path/file.ts:10` — {한 줄 지적}
- `path/file.go:55` — {한 줄 지적}

## Out-of-scope (이 PR 범위 밖, 별도 이슈 권장)

- {항목 1}
- {항목 2}

## Codex 원본 응답 (참고용 접힘)

<details>
<summary>클릭하여 펼치기</summary>

```
{codex review 명령의 stdout 전체}
```

</details>

## 주석 품질 검증 (프로젝트 고유 규칙)

변경된 파일에 한국어 학습용 주석이 포함되어 있는지 확인:

| 파일 | 파일 상단 | 함수별 | 설계 의도 |
|------|----------|--------|----------|
| backend/.../x.go | O/X | O/X | O/X |
| frontend/.../y.tsx | O/X | O/X | O/X |

주석 누락은 `should-fix`로 분류한다.
```

## 트리거 정리

**사용해야 하는 상황:**
- "PR #N 리뷰해줘" / "이 PR 머지하기 전에 봐줘"
- "방금 만든 브랜치 코드 검토해줘"
- "Codex로 리뷰 돌려봐"
- "second opinion 받아봐"
- "리뷰 재실행" / "리뷰 업데이트"

**사용하면 안 되는 상황 (qa-verify가 담당):**
- "빌드 되는지 확인해줘"
- "API shape이랑 프론트 타입 맞는지 체크해줘"
- "라우트 매핑 확인해줘"
- "정합성 검증"

**직접 수행이 적절한 상황:**
- 명백히 작은 오타 수정 PR → 리뷰 스킵 가능 (리더 판단)
- 문서 전용 변경 → 선택적 리뷰
