# 에이전트 모델 정책 시범 운영 평가 — 첫 sonnet 빌드

**Date:** 2026-04-13
**Build:** PR #19 (Plan B — architecture docs + CDK reference implementation)
**평가 주체:** 리더 (메인 세션, opus)

## sonnet 에이전트 실적

| 에이전트 | 모델 | 산출물 | 자체 버그 수정 | 주석 규칙 준수 |
|---------|------|--------|-------------|-------------|
| backend-dev | sonnet | Dockerfile 수정 (1파일) | go 버전 1.22→1.26 자동 보정 | PASS |
| cloud-infra-dev | sonnet | CDK 프로젝트 (22파일) | ECR lifecycle priority 수정 1건 | PASS (10/10 파일) |
| infra-dev | sonnet | CI diagrams-lint (1파일) | 없음 | PASS |

## 정량 기준 측정

| # | 기준 | 측정값 | 임계치 | 판정 |
|---|------|--------|--------|------|
| 1 | qa miss → reviewer 후속 검출 | **0건** (inline QA 전항목 PASS) | 1건 이상 → rollback | **PASS** |
| 2 | 한국어 학습용 주석 결락 | **0파일** (CDK 10/10, Dockerfile 1/1, ADR 11/11) | 1파일 이상 → rollback | **PASS** |
| 3 | must-fix 건수 직전 대비 | **N/A** (직전 opus 빌드(PR#18)에 Codex 리뷰 없음, 비교 기준 부재) | +2건 이상 → rollback | **비교 불가** |
| 4 | qa mismatch 건수 직전 대비 | **N/A** (직전 빌드에 qa-engineer 미스폰, 비교 기준 부재) | +50% 이상 → rollback | **비교 불가** |

## cloud-infra-dev(sonnet) 자체 버그 수정 분석

- `fix(infra): fix ECR lifecycle rule priority` — CDK validation이 잡은 런타임 에러를 sonnet이 자체 수정. opus였어도 동일 실수 가능성 있음 (CDK API 명세 이슈). **rollback 사유에 해당하지 않음.**

## 판정: **연장 1회차**

### 사유
- 기준 1, 2는 명확히 PASS — sonnet 품질에 문제 없음
- 기준 3, 4는 비교 기준 부재로 측정 불가 — 직전 빌드(PR#18)가 하네스 구조만 변경하여 Codex 리뷰/qa-engineer 보고서가 없음
- **다음 빌드에서 qa-engineer + code-reviewer를 모두 스폰**하여 정량 비교 기준을 확보한 후 최종 GO/rollback 결정

### 다음 단계
- 연장 1회차 (최대 2회 가능)
- 다음 풀스택 빌드에서 4개 기준 모두 측정 후 GO/rollback 확정
