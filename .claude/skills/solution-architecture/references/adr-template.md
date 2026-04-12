# ADR Template — 아키텍처 결정 기록 템플릿

solution-architect 에이전트가 `docs/architecture/adr/` 디렉토리에 ADR(Architecture Decision Record)을 작성할 때 사용하는 템플릿이다.

---

## 파일명 규칙

```
ADR-{NNNN}-{kebab-case-title}.md
```

예시:
- `ADR-0001-cloud-provider-aws.md`
- `ADR-0002-iac-cdk-typescript.md`
- `ADR-0003-compute-ec2-docker-compose.md`
- `ADR-0004-database-rds-postgresql.md`
- `ADR-0005-secrets-ssm-parameter-store.md`
- `ADR-0006-region-strategy-single-region.md`
- `ADR-0007-deployment-strategy-rolling.md`

---

## ADR 파일 포맷

```markdown
# ADR-NNNN: {Title}

## Status
{Proposed | Accepted | Superseded by ADR-NNNN}

## Context
{왜 이 결정이 필요한가. 배경, 문제 상황, 제약 조건을 기술한다.
이 결정을 내리지 않으면 어떤 문제가 발생하는가.}

## Decision
{무엇을 결정했는가. 결정 내용과 그 근거를 기술한다.
"우리는 X를 선택한다. 왜냐하면 Y이기 때문이다."}

## Consequences
{이 결정의 결과를 기술한다.}

### 긍정적 결과
- {이점 1}
- {이점 2}

### 부정적 결과 / 트레이드오프
- {단점 1}
- {단점 2}

## Alternatives Considered
| 대안 | 장점 | 단점 | 기각 사유 |
|------|------|------|---------|
| {대안 A} | {장점} | {단점} | {기각 사유} |
| {대안 B} | {장점} | {단점} | {기각 사유} |
```

---

## 작성 예시: ADR-0001 (클라우드 공급자)

```markdown
# ADR-0001: 클라우드 공급자 — AWS 선택

## Status
Accepted

## Context
이 프로젝트(Go+React+PostgreSQL 풀스택)를 클라우드에 배포하기 위해 공급자를 선택해야 한다.
주요 제약 조건:
- MVP 단계: 비용 최소화(가능하면 Free Tier)
- IaC 도구를 TypeScript로 작성하고 싶다 (프론트엔드와 언어 공유)
- 한국/일본 사용자 대상 서비스 (리전 근접성 중요)
- 팀의 AWS 경험이 GCP보다 풍부하다

## Decision
AWS를 선택한다. 주 리전은 ap-northeast-1(도쿄)이다.

이유:
1. CDK TypeScript가 AWS에서만 네이티브 지원된다.
2. EC2 t3.micro + RDS t3.micro + S3 + CloudFront 모두 12개월 Free Tier에 포함된다.
3. ap-northeast-1이 한국 서비스에 충분히 가까운 리전이다.
4. SSM Parameter Store Standard tier가 완전 무료다.

## Consequences

### 긍정적 결과
- CDK TypeScript로 IaC 작성 가능 (TS 공유)
- MVP 단계 비용 $0~5/월
- AWS 레퍼런스 및 커뮤니티 자료 풍부

### 부정적 결과 / 트레이드오프
- AWS 벤더 종속 (멀티클라우드 전략 시 Terraform 재작성 필요)
- 12개월 후 Free Tier 만료 시 과금 시작 주의
- GCP의 상시 무료 e2-micro(지역 제한 없음)는 활용 불가

## Alternatives Considered
| 대안 | 장점 | 단점 | 기각 사유 |
|------|------|------|---------|
| GCP | e2-micro 상시 무료, Cloud Run 콜드스타트 빠름 | CDK 미지원, RDS 상당 Free Tier DB 없음 | CDK TS 사용 불가 |
| Azure | 글로벌 리전 커버리지 | CDK 미지원, 한국 리전 비용 높음 | CDK TS 사용 불가 |
| on-prem | 장기 비용 저렴 가능 | 초기 하드웨어 비용, 운영 부담 | MVP 단계에 부적합 |
```

---

## 작성 원칙

### 1. "왜"를 반드시 포함한다

**나쁜 예:**
```
## Decision
AWS를 선택한다.
```

**좋은 예:**
```
## Decision
AWS를 선택한다. 왜냐하면 CDK TypeScript가 AWS에서만 네이티브 지원되고,
팀의 AWS 경험이 풍부하며, Free Tier 범위가 이 프로젝트 MVP 요건을 충분히 커버하기 때문이다.
```

### 2. 대안 비교를 반드시 포함한다

대안을 검토하지 않은 결정은 신뢰하기 어렵다. 검토한 모든 대안과 기각 사유를 표로 기록한다.

### 3. 결정 번복 시 기존 ADR을 삭제하지 않는다

```markdown
# ADR-0001: 클라우드 공급자 — AWS 선택

## Status
Superseded by ADR-0012
```

기존 ADR은 보존하고 `Status` 필드만 `Superseded by ADR-NNNN`으로 변경한다. 새 ADR에는 번복 이유를 `Context`에 기술한다.

### 4. 컨텍스트에 제약 조건을 명시한다

결정 당시의 제약 조건(팀 규모, 예산, 기술 부채, 외부 요건)을 기록해야 나중에 결정의 타당성을 재평가할 수 있다.

### 5. ADR 번호는 순서대로 부여한다

번호를 건너뛰지 않는다. 기각된 아이디어는 ADR을 만들지 않는다 — ADR은 실제로 내린 결정만 기록한다.

---

## ADR 상태 종류

| 상태 | 의미 |
|------|------|
| `Proposed` | 제안된 상태, 아직 확정되지 않음 |
| `Accepted` | 확정된 결정 |
| `Superseded by ADR-NNNN` | 번호 NNNN의 ADR로 대체됨 |
| `Deprecated` | 더 이상 유효하지 않음 (대체 ADR 없음) |

---

## `docs/architecture/adr/` 구조 예시

```
docs/architecture/adr/
├── README.md                          # ADR 인덱스 (모든 ADR 링크)
├── ADR-0001-cloud-provider-aws.md
├── ADR-0002-iac-cdk-typescript.md
├── ADR-0003-compute-ec2-docker-compose.md
├── ADR-0004-database-deployment-ec2.md
├── ADR-0005-secrets-ssm-parameter-store.md
├── ADR-0006-region-strategy-single-region.md
└── ADR-0007-deployment-strategy-rolling.md
```

`adr/README.md`는 모든 ADR 목록을 상태(Accepted/Superseded/Deprecated)와 함께 표로 정리한다.
