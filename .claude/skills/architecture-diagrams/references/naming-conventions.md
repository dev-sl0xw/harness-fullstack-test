# 다이어그램 네이밍 컨벤션

이 파일은 `docs/architecture/` 하위의 모든 다이어그램 파일에 적용되는
파일명, 노드 ID, 노드 레이블, 방향, 색상 규칙을 정의한다.

---

## 파일명 규칙

**패턴**: `{scope}-{subject}.mmd` / `{scope}-{subject}.md`

| scope | 사용 상황 | 예시 |
|-------|---------|------|
| `context` | C4 L1 — 시스템 맥락 | `context-system.mmd` |
| `container` | C4 L2 — 컨테이너 수준 | `container-overview.mmd` |
| `component` | C4 L3 — 컴포넌트 수준 | `component-frontend.mmd`, `component-backend.mmd` |
| `deployment` | 인프라 배포 토폴로지 | `deployment-aws.mmd` |
| `sequence` | 시퀀스 다이어그램 | `sequence-auth-flow.mmd` |
| `er` | ER 다이어그램 (스키마) | `er-schema.mmd` |

**규칙**:
- 소문자 kebab-case만 사용한다.
- `subject`는 구체적인 내용을 나타낸다 (`overview`, `aws`, `auth-flow`, `schema` 등).
- `.mmd`: raw Mermaid 소스만 포함.
- `.md`: `.mmd`와 동일한 이름, 래퍼(설명 + 코드 매핑 + 다이어그램) 포함.

---

## 노드 ID 규칙

**패턴**: kebab-case

```
좋은 예:
  alb, ecs-backend, rds-primary, s3-frontend, ssm-params

나쁜 예:
  ALB, ecsBackend, RDS_Primary, s3Frontend
```

**규칙**:
- 모두 소문자.
- 단어 구분은 하이픈(`-`).
- 약어는 그대로 사용 가능 (`alb`, `rds`, `ec2`, `ssm`, `iam`).
- 역할이 중복될 때는 `-primary`, `-backup`, `-frontend`, `-backend` 접미사 추가.

---

## 노드 레이블 규칙

**한/영 병기 가능** (학습용 목적):

```
"Application Load Balancer<br/>ALB"
"EC2 t2.micro<br/>Go Backend API"
"RDS PostgreSQL 16<br/>:5432"
```

**규칙**:
- `<br/>` 로 줄바꿈 (Mermaid HTML 레이블).
- 영문 서비스명 + 한국어 설명 순서.
- 포트/버전 정보는 레이블 하단에 추가.
- 민감 정보(비밀번호, 토큰 값)는 레이블에 절대 포함하지 않는다.

---

## 다이어그램 방향

| 방향 | 키워드 | 사용 상황 |
|------|--------|---------|
| Top → Bottom | `flowchart TB` | 기본값. 인터넷→서버→DB 흐름 |
| Left → Right | `flowchart LR` | 복잡한 네트워크, 수평 서비스 체인 |
| Bottom → Top | `flowchart BT` | 거의 사용하지 않음 |
| Right → Left | `flowchart RL` | 거의 사용하지 않음 |

**원칙**:
- Deployment 다이어그램: `TB` (수직 계층 구조 강조).
- 복잡한 MSA 서비스 간 연결: `LR` (수평 나열이 읽기 쉬움).
- C4 다이어그램: `C4Context` 등 C4 키워드가 방향 내장.

---

## 화살표 규칙

| 관계 유형 | 화살표 | 예시 |
|---------|--------|------|
| 내부 서비스 간 트래픽 | `-->` (실선) | `ec2 --> rds` |
| 외부 서비스 참조 | `-.->` (점선) | `github -.-> ec2` |
| 양방향 통신 | `<-->` | `fe <--> be` (드물게 사용) |
| 비동기/이벤트 | `-.->`(점선) | `sqs -.-> lambda` |

**원칙**:
- 외부 서비스(GitHub, Docker Hub, 외부 API)는 항상 점선 화살표.
- 화살표 방향은 데이터/요청 흐름의 방향 (발신 → 수신).
- 양방향 화살표는 명확성을 위해 두 개의 단방향으로 분리하는 것을 우선한다.

---

## classDef 색상 규칙

### 범용 레이어 색상 (Deployment/Container 다이어그램)

```mermaid
%%{init: {'theme': 'default'}}%%
flowchart TB

  %% 색상 정의 — CLAUDE.md 주석 규칙 적용
  classDef page     fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
  classDef state    fill:#fff3e0,stroke:#e65100,color:#bf360c
  classDef http     fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c
  classDef storage  fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
  classDef infra    fill:#eceff1,stroke:#546e7a,color:#263238
```

| classDef 이름 | fill | 용도 |
|--------------|------|------|
| `page` | `#e3f2fd` (연한 파랑) | 페이지 컴포넌트, EC2 컴퓨팅 |
| `state` | `#fff3e0` (연한 주황) | 보안/시크릿/상태 (SSM, IAM, JWT) |
| `http` | `#f3e5f5` (연한 보라) | HTTP 엔드포인트, API Gateway |
| `storage` | `#e8f5e9` (연한 초록) | DB, S3, 파일 스토리지 |
| `infra` | `#eceff1` (연한 회색) | 네트워크, CDN, DNS |

### 민감 정보 흐름 강조 (주황 강조색)

민감 정보(JWT, 비밀번호 해시, 환경변수 시크릿)가 흐르는 경로는
별도 classDef로 시각적으로 구분한다.

```mermaid
classDef sensitive fill:#fff3e0,stroke:#f57c00,color:#e65100,stroke-width:2px
```

- `stroke-width:2px` 으로 테두리를 두껍게 강조.
- `state` classDef와 색상 계열 동일 (주황 계열).
- 민감 정보를 다루는 노드와 화살표에 적용.

### C4 다이어그램 전용 색상 (Blue Palette)

C4 전용 Mermaid 키워드(`C4Context`, `C4Container`, `C4Component`)를 사용할 때는
`mermaid-c4-patterns.md`의 C4 Blue Palette를 따른다.

---

## 주석 규칙 (다이어그램 내부)

Mermaid 코드 내부에 `%%` 로 주석을 추가한다.

```mermaid
flowchart TB
  %% ============================
  %% 섹션 구분 주석
  %% ============================
  %% 비용 주석: EC2 t2.micro — Free Tier 750h/월
  %% 보안 주석: SSM → JWT_SECRET 조회 (평문 로깅 금지)
```

**원칙**:
- `%% ===...===` 로 논리 섹션을 구분한다.
- 비용 관련 정보는 `%% [비용]` 주석으로 명시.
- 보안 제약(민감 정보 흐름, 로깅 금지)은 `%% [보안]` 주석으로 명시.
- 미구현/계획 예정 노드는 `%% [미구현]` 주석 추가.
