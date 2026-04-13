# ADR-0010: Schema Migration Compatibility

<!-- 
  역할: 스키마 마이그레이션의 backward-compatibility 규칙을 정의한 아키텍처 결정 기록
  시스템 내 위치: docs/architecture/adr/ — ADR-0008(마이그레이션 전략)의 안전 보장 규칙
  관련 파일: backend/migrations/ (SQL 마이그레이션 파일), ADR-0008 (실행 전략),
            ADR-0009 (배포 전략 — 마이그레이션 → 코드 배포 순서)
  설계 의도: "마이그레이션 먼저, 코드 배포 나중" 순서에서 구버전 코드가
            새 스키마에서도 깨지지 않도록 허용/금지 규칙을 명시한다.
-->

**Status:** Accepted
**Date:** 2026-04-12
**Deciders:** 프로젝트 팀

## Context

<!-- 결정이 필요했던 배경: 배포 중 구버전 코드와 새 스키마의 공존 문제. -->

배포 순서가 "마이그레이션 실행 → 새 코드 배포"이므로, 마이그레이션 후 기존(구버전) 코드가 잠시 동안 새 스키마에서 실행된다. 이때 구버전 코드가 깨지면 안 된다.

## Decision

<!-- 내린 결정: 모든 마이그레이션은 backward-compatible이어야 한다. -->

모든 마이그레이션은 **backward-compatible**이어야 한다.

## Rules

<!-- 허용/금지/보류 규칙을 명시한다. 학습자가 마이그레이션 작성 시 참고할 수 있다. -->

- **허용:** ADD COLUMN (nullable 또는 DEFAULT), CREATE TABLE, ADD INDEX
- **금지:** DROP COLUMN, RENAME COLUMN, ALTER COLUMN NOT NULL (기존 데이터 없을 때 제외)
- **보류:** 이전 마이그레이션의 역할이 끝난 후 별도 마이그레이션으로 DROP

## Consequences

### Positive

<!-- backward-compatibility 규칙의 이점. -->

- 배포 중 구버전 코드가 깨지지 않음
- 롤백 시에도 스키마 호환

### Negative

<!-- backward-compatibility 규칙의 단점. -->

- 스키마 정리(cleanup)를 위한 추가 마이그레이션이 필요할 수 있음

## Alternatives Considered

<!-- 검토했지만 기각한 대안들. -->

| 대안 | 장점 | 단점 | 기각 사유 |
|------|------|------|----------|
| 동시 배포 (코드+마이그레이션) | 호환성 고민 불필요 | 실패 시 롤백 복잡, 다운타임 길어짐 | 안정성 |
| Feature flag로 스키마 분기 | 유연한 전환 | 복잡도 증가, MVP에 과함 | YAGNI |
| 마이그레이션 없이 직접 ALTER | 빠른 적용 | 버전 관리 불가, 재현성 없음 | 운영 안전 |

## Evolution Path

<!-- 향후 변경이 필요할 때의 전환 경로. -->

- Stage 2: 마이그레이션 CI 체크 추가 (backward-incompatible 변경 자동 감지)
- Stage 3: Blue/Green 배포 시에도 동일 규칙 적용 (양쪽 버전이 동시에 같은 DB 사용)
