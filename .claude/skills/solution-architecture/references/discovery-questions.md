# Discovery Questions — 요구사항 수집 질문 목록

solution-architect 에이전트가 Step 3 Discovery Q&A에서 사용하는 질문 목록이다. 코드 스캔으로 자동 도출 가능한 항목은 묻지 않는다. 미결정 항목만 batch로 3~5개씩 사용자에게 전달한다.

---

## 1. 무조건 물어보는 질문 (Q1~Q5)

이 5개는 코드 스캔으로 알 수 없으므로 항상 사용자에게 묻는다. `initial_constraints`에 이미 있는 항목은 건너뛴다.

### Q1: 배포 대상 클라우드

```
어떤 클라우드 환경에 배포할 계획인가요?

선택지:
  A) AWS (Amazon Web Services)  ← MVP 기본값
  B) GCP (Google Cloud Platform)
  C) Azure (Microsoft Azure)
  D) on-prem (자체 서버)
  E) 미정 (나중에 결정)

[기본값: A — AWS]
```

**선택에 따른 후속 결정:**
- AWS → CDK/Terraform 선택(Q8), ap-northeast-1 리전 기본 제안
- GCP → Cloud Run/GKE 선택, Cloud CDK 불가 → Terraform/Pulumi 권고
- on-prem → IaC 불필요, Docker Compose 유지
- 미정 → 클라우드 독립 구조 유지, 결정 시점에 재호출

---

### Q2: 예상 트래픽 규모

```
예상 트래픽 규모는 어느 정도인가요?

선택지:
  A) MVP / 내부 테스트 — 일 100 요청 미만  ← MVP 기본값
  B) 소규모 — 일 1만 요청 미만 (월 활성 사용자 ~1천 명)
  C) 중규모 — 일 10만 요청 미만 (월 활성 사용자 ~1만 명)
  D) 대규모 — 일 10만 요청 이상 (Auto Scaling, CDN 필수)

[기본값: A — MVP]
```

**선택에 따른 영향:**
- A/B → t3.micro EC2 1대, Single-region, best-effort 가용성으로 충분
- C → t3.small 이상, RDS Multi-AZ 고려
- D → Auto Scaling Group, ALB, Multi-region, CDN 필수

---

### Q3: 가용성 요건 (Availability)

```
서비스의 가용성(uptime) 요건은 어느 수준인가요?

선택지:
  A) Best-effort — 월 다운타임 허용, SLA 없음  ← MVP 기본값
  B) 99% — 월 ~7시간 다운타임 허용
  C) 99.9% — 월 ~44분 다운타임 허용 (Multi-AZ 필요)
  D) 99.99% — 월 ~4분 다운타임 허용 (Multi-region 필요)

[기본값: A — best-effort]
```

**선택에 따른 영향:**
- A/B → Single-AZ, EC2 단일 인스턴스 가능
- C → RDS Multi-AZ, ALB + 최소 2 인스턴스
- D → Multi-region Active-Active, Route53 Failover

---

### Q4: 리전 전략

```
몇 개 리전에 배포할 계획인가요?

선택지:
  A) Single-region — 1개 리전에만 배포  ← MVP 기본값
  B) Multi-region (Active-Passive) — 주 리전 + DR 리전
  C) Multi-region (Active-Active) — 여러 리전에서 동시 서비스

[기본값: A — single-region]

단일 리전의 경우 권장 리전:
  - ap-northeast-1 (도쿄) — 한국 서비스, AWS Free Tier 적용
  - us-east-1 (버지니아) — 글로벌 서비스, 가장 많은 서비스 지원
  - ap-northeast-3 (오사카) — ap-northeast-1 DR 용도
```

---

### Q5: 컴플라이언스 요건

```
특별한 보안·규정 준수 요건이 있나요?

선택지:
  A) 없음 — 일반 보안 모범 사례만 적용  ← MVP 기본값
  B) HIPAA — 의료 정보 보호 (미국)
  C) PCI-DSS — 결제 카드 정보 처리
  D) GDPR — 유럽 개인정보 보호

[기본값: A — 없음]
```

**선택에 따른 영향:**
- B → HIPAA-eligible 서비스 사용 필수, 감사 로그, BAA 필요
- C → PCI 범위 최소화, WAF 필수, 카드 데이터 분리 저장
- D → 데이터 거주지(data residency) 요건, 사용자 삭제 권리 구현 필요

---

## 2. 조건부 질문 (Q6~Q10)

Q1~Q5 답변 후, 필요한 경우에만 추가로 묻는다. Q1에서 AWS 선택 시 Q6~Q10이 관련된다.

### Q6: 컴퓨팅 모델

```
애플리케이션 실행 방식은 어떻게 할까요?

선택지:
  A) EC2 + Docker Compose — 단순, 저비용, 이 프로젝트 기본  ← 기본값
  B) ECS (Fargate) — 컨테이너 관리형, Serverless 컨테이너
  C) Lambda — 이벤트 기반 Serverless
  D) EKS — Kubernetes 오케스트레이션 (중/대규모)

[기본값: A — EC2 + Docker Compose]
```

**적합 상황:**
- A → MVP, 소규모, 팀이 Docker Compose에 익숙한 경우
- B → 컨테이너 자동 스케일링이 필요하지만 K8s 운영 부담을 피하고 싶은 경우
- C → API 요청이 산발적이고 콜드스타트가 허용되는 경우
- D → 대규모 마이크로서비스, 팀에 K8s 운영 역량이 있는 경우

---

### Q7: 오케스트레이터

```
컨테이너 오케스트레이션은 어떻게 할까요?

(Q6에서 EC2 + Docker Compose 선택 시에는 이 질문을 건너뛴다)

선택지:
  A) Docker Compose (단일 호스트)  ← EC2 선택 시 기본값
  B) ECS (AWS Managed)
  C) Kubernetes (EKS)

[기본값: A — Docker Compose]
```

---

### Q8: IaC 도구

```
인프라 코드(IaC)는 어떤 도구로 작성할까요?

선택지:
  A) CDK (TypeScript) — AWS 전용, state 파일 없음, TS 공유  ← AWS 선택 시 기본값
  B) Terraform (HCL) — 멀티클라우드, 대규모 커뮤니티
  C) Pulumi (TypeScript) — 멀티클라우드, TS 공유 가능
  D) CDKTF — Terraform 백엔드 + CDK 문법
  E) IaC 없음 — 수동 콘솔 배포

[기본값: A — CDK TypeScript (AWS 선택 시)]
```

---

### Q9: DB 고가용성 (HA)

```
데이터베이스 고가용성은 어떻게 구성할까요?

선택지:
  A) Single-AZ — 단일 인스턴스, 다운타임 허용  ← MVP 기본값
  B) Multi-AZ — 자동 Failover, ~35초 전환 시간
  C) Read Replica — 읽기 분산, HA 아님

[기본값: A — Single-AZ]
```

---

### Q10: CI/CD 구성

```
CI/CD 파이프라인은 어떻게 구성할까요?

선택지:
  A) GitHub Actions + OIDC — 장기 자격증명 없음, 이 프로젝트 기본  ← 기본값
  B) 기존 CI/CD 사용 — Jenkins/GitLab CI 등 유지
  C) 수동 배포 — CI/CD 없음

[기본값: A — GitHub Actions + OIDC]
```

---

## 3. 자동 도출 항목 (묻지 않음)

코드 스캔으로 확인하므로 사용자에게 질문하지 않는다.

| 항목 | 확인 위치 | 도출 방법 |
|------|---------|---------|
| 백엔드 언어 | `backend/go.mod` | `module` 선언 + `go` 버전 |
| 백엔드 프레임워크 | `backend/go.mod` | `github.com/gin-gonic/gin` 의존성 |
| 프론트엔드 프레임워크 | `frontend/package.json` | `"react"`, `"vite"` 의존성 |
| DB 종류 | `docker-compose.yml` | `image: postgres:*` |
| DB 버전 | `docker-compose.yml` | `postgres:16` 등 |
| 인증 방식 | `backend/internal/` 코드 스캔 | JWT 미들웨어 존재 여부 |
| 현재 포트 구성 | `docker-compose.yml` | `ports:` 섹션 |

---

## 4. batch 구성 전략

Q1~Q5를 한 번에 묻는다. 사용자 답변 수신 후 Q6~Q10 필요 여부를 판단한다.

**2차 batch 필요 조건:**
- Q1 = AWS → Q8(IaC) 필요
- Q2 = 중규모 이상 → Q6(컴퓨팅), Q7(오케스트레이터) 필요
- Q3 = 99% 이상 → Q9(DB HA) 필요
- `initial_constraints`에 `compute` 미포함 → Q6 필요

**잠수 처리 (3회 reminder 후 기본값 자동 적용):**

모든 질문의 기본값을 모아 놓으면 다음과 같다:
- Q1: AWS / Q2: MVP / Q3: best-effort / Q4: single-region / Q5: 없음
- Q6: EC2+Docker Compose / Q7: Docker Compose / Q8: CDK TS / Q9: Single-AZ / Q10: GitHub Actions + OIDC
