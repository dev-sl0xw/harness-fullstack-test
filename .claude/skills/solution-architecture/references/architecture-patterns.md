# Architecture Patterns — 아키텍처 패턴 카탈로그

solution-architect 에이전트가 Discovery Q&A 결과를 바탕으로 아키텍처 패턴을 선택할 때 참조하는 카탈로그다. 5개 패턴을 비교하고 이 프로젝트에 적합한 패턴을 선택한다.

---

## 패턴 1: 3-Tier (EC2 + Docker Compose)

**한 줄 설명:** EC2 단일 인스턴스에서 Docker Compose로 프론트엔드(Nginx) + 백엔드(Go) + DB(PostgreSQL)를 함께 운영하는 단순 구조.

**적합 프로젝트 유형:**
- MVP / 내부 도구 / 소규모 프로젝트
- 팀이 Docker Compose에 이미 익숙한 경우
- 빠른 프로토타이핑, 단기 검증 목적
- 월 활성 사용자 1천 명 이하

**AWS 서비스 매핑:**

| 역할 | 서비스 | 비고 |
|------|------|------|
| 컴퓨팅 | EC2 (t3.micro) | Free Tier 750h/월 |
| 정적 파일 서빙 | Nginx (EC2 내부) | S3+CloudFront로 이전 가능 |
| DB | PostgreSQL (Docker Compose) | EC2 내부 볼륨 |
| 시크릿 | SSM Parameter Store | 무료 Standard tier |
| DNS | Route53 | 도메인 $0.50/월 |
| TLS | ACM + Nginx | ACM 인증서 무료 |
| CI/CD | GitHub Actions + OIDC | OIDC role로 장기 자격증명 불필요 |

**비용 특성:**
- EC2 t3.micro: Free Tier 내 ($0)
- EBS 30GB: Free Tier 내 ($0)
- Route53: ~$0.50/월
- 예상 월 비용: $0~5 (Free Tier 기준)

**장점:**
- 구조 단순, 운영 부담 최소
- 로컬 `docker compose up`과 동일한 운영 경험
- CDK 스택이 단순해짐

**단점:**
- 단일 장애점 (SPOF)
- 수평 확장 불가
- DB와 앱이 같은 호스트에 있어 보안 격리 부족

**이 프로젝트 선택 여부: 선택 (MVP 기본 패턴)**

---

## 패턴 2: Serverless (Lambda + API Gateway + RDS Proxy)

**한 줄 설명:** Go 백엔드를 Lambda 함수로 실행하고 API Gateway가 라우팅하며, RDS Proxy로 DB 연결을 풀링하는 이벤트 기반 구조.

**적합 프로젝트 유형:**
- API 요청이 산발적이고 콜드스타트가 허용되는 경우
- 트래픽 급증/급감이 예측 불가한 경우
- 인프라 운영을 최소화하고 싶은 경우

**AWS 서비스 매핑:**

| 역할 | 서비스 | 비고 |
|------|------|------|
| 백엔드 | Lambda (Go runtime) | 1M 요청/월 Free Tier |
| API 라우팅 | API Gateway (HTTP API) | 1M 요청/월 Free Tier |
| DB 연결 풀링 | RDS Proxy | 비용 발생 (~$0.015/vCPU-hour) |
| DB | RDS PostgreSQL | Multi-AZ 선택적 |
| 정적 파일 | S3 + CloudFront | |
| 시크릿 | Secrets Manager | 요청당 과금 |

**비용 특성:**
- Lambda: 소규모 트래픽 시 거의 무료
- RDS Proxy: 비용 발생 (Free Tier 없음)
- 예상 월 비용: $10~30 (RDS Proxy 포함)

**장점:**
- 트래픽 0일 때 비용 0 (Lambda)
- 자동 확장
- 서버 패치 불필요

**단점:**
- Go 콜드스타트 지연 (~500ms)
- RDS Proxy 비용
- 로컬 개발 환경과 괴리 (SAM/LocalStack 필요)
- 장기 WebSocket/SSE 불가

**이 프로젝트 선택 여부: 미선택 (콜드스타트 + 비용 이유)**

---

## 패턴 3: Container-Orchestrated (ECS Fargate + RDS)

**한 줄 설명:** ECS Fargate로 컨테이너를 서버리스 방식으로 실행하고, ALB가 트래픽을 분산하며, RDS가 DB를 관리하는 구조.

**적합 프로젝트 유형:**
- 중규모 이상, 수평 확장이 필요한 경우
- 컨테이너 운영 경험이 있지만 K8s 운영 부담을 피하고 싶은 경우
- Docker 이미지를 그대로 활용하면서 관리형 스케일링 원하는 경우

**AWS 서비스 매핑:**

| 역할 | 서비스 | 비고 |
|------|------|------|
| 컴퓨팅 | ECS Fargate | vCPU/메모리 과금 |
| 로드밸런싱 | ALB | $16~/월 |
| DB | RDS PostgreSQL (Multi-AZ) | $25~/월 |
| 컨테이너 레지스트리 | ECR | 500MB Free Tier |
| 정적 파일 | S3 + CloudFront | |
| 시크릿 | Secrets Manager | |

**비용 특성:**
- Fargate (0.25 vCPU, 0.5GB): ~$9/월
- ALB: ~$16/월
- RDS (db.t3.micro, Single-AZ): ~$13/월
- 예상 월 비용: $40~80

**장점:**
- 서버 관리 불필요
- 자동 수평 확장 (Auto Scaling)
- Blue-Green 배포 기본 지원

**단점:**
- 비용이 EC2+Docker Compose보다 높음
- CDK 스택이 복잡해짐

**이 프로젝트 선택 여부: 미선택 (비용, MVP 단계)**

---

## 패턴 4: Hybrid (EC2 + S3/CloudFront 분리)

**한 줄 설명:** 프론트엔드는 S3+CloudFront로 CDN 서빙하고, 백엔드+DB는 EC2에서 Docker Compose로 운영하는 분리 구조.

**적합 프로젝트 유형:**
- 프론트엔드 트래픽이 높고 글로벌 배포가 필요한 경우
- 백엔드는 단순하게 유지하면서 프론트엔드 성능을 개선하고 싶은 경우
- 패턴 1 → 패턴 3으로 이전하는 중간 단계

**AWS 서비스 매핑:**

| 역할 | 서비스 | 비고 |
|------|------|------|
| 프론트엔드 | S3 + CloudFront | Free Tier: S3 5GB, CF 1TB/월 |
| 백엔드 | EC2 + Docker Compose | t3.micro Free Tier |
| DB | PostgreSQL (Docker Compose) | EC2 내부 |
| DNS | Route53 | |
| TLS | ACM | |

**비용 특성:**
- EC2 t3.micro: Free Tier 내
- CloudFront: 소규모 트래픽 Free Tier 내
- 예상 월 비용: $0~10

**장점:**
- 프론트엔드 글로벌 CDN 서빙
- 백엔드는 단순 유지
- 점진적 확장 경로 명확

**이 프로젝트 선택 여부: 선택 가능 (성장 단계에서 고려)**

---

## 패턴 5: Static Site + API Gateway (JAMstack)

**한 줄 설명:** 프론트엔드는 완전 정적으로 S3+CloudFront에서 서빙하고, 백엔드는 API Gateway + Lambda로만 구성하는 JAMstack 구조.

**적합 프로젝트 유형:**
- 콘텐츠 중심, 동적 서버 렌더링 불필요한 경우
- 블로그, 마케팅 사이트, 문서 사이트
- 글로벌 CDN 배포가 핵심인 경우

**AWS 서비스 매핑:**

| 역할 | 서비스 |
|------|------|
| 프론트엔드 | S3 + CloudFront |
| API | API Gateway (HTTP API) |
| 백엔드 로직 | Lambda |
| DB | DynamoDB 또는 RDS |

**비용 특성:**
- 소규모: 거의 무료 (Free Tier)
- 중규모: $5~20/월

**이 프로젝트 선택 여부: 미선택 (Go+PostgreSQL 구조와 맞지 않음)**

---

## 패턴 선택 매트릭스

| 조건 | 권장 패턴 |
|------|---------|
| MVP + Free Tier + 단순 운영 | 패턴 1 (3-Tier EC2) |
| 이벤트 기반 + 트래픽 불규칙 | 패턴 2 (Serverless) |
| 중규모 + 자동 확장 필요 | 패턴 3 (ECS Fargate) |
| 프론트 글로벌 CDN + 백엔드 단순 | 패턴 4 (Hybrid) |
| 정적 콘텐츠 중심 | 패턴 5 (JAMstack) |

**이 프로젝트 선택:** 패턴 1 (3-Tier EC2 + Docker Compose) — MVP 단계, Free Tier 목표, 로컬 환경과 동일한 Docker Compose 경험 유지.
