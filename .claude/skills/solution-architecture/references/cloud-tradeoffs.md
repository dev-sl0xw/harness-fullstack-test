# Cloud Tradeoffs — 클라우드 공급자 비교

solution-architect 에이전트가 클라우드 공급자를 선택할 때 참조하는 비교 문서다. AWS와 GCP를 주요 비교 대상으로 하며, 이 프로젝트의 선택 근거를 포함한다.

---

## AWS vs GCP 서비스 비교

| 영역 | AWS | GCP | 비고 |
|------|-----|-----|------|
| **컴퓨팅 (VM)** | EC2 (t3.micro) | Compute Engine (e2-micro) | 둘 다 Free Tier 존재 |
| **컨테이너 관리형** | ECS (Fargate) | Cloud Run | Cloud Run이 콜드스타트 더 빠름 |
| **Kubernetes** | EKS | GKE (Autopilot) | GKE Autopilot이 운영 부담 적음 |
| **관계형 DB** | RDS (PostgreSQL) | Cloud SQL (PostgreSQL) | API 호환, 가격 유사 |
| **오브젝트 스토리지** | S3 | GCS (Cloud Storage) | API 다름, 기능 유사 |
| **CDN** | CloudFront | Cloud CDN | CloudFront PoP 더 많음 |
| **시크릿 관리** | SSM Parameter Store / Secrets Manager | Secret Manager | SSM Standard 무료, GCP 6개 이하 무료 |
| **DNS** | Route53 | Cloud DNS | Route53 $0.50/호스팅존/월, Cloud DNS $0.20 |
| **IaC 네이티브 도구** | CDK (TypeScript/Python 등) | Deployment Manager / Config Connector | CDK가 L3 constructs 강점 |
| **이벤트 버스** | EventBridge | Eventarc | |
| **로그/메트릭** | CloudWatch | Cloud Monitoring + Cloud Logging | CloudWatch가 AWS 서비스 통합 더 깊음 |
| **CI/CD OIDC** | GitHub Actions + IAM OIDC | GitHub Actions + Workload Identity | 둘 다 지원, 설정 복잡도 유사 |

---

## Free Tier 비교

| 항목 | AWS Free Tier | GCP Free Tier |
|------|-------------|---------------|
| **VM** | EC2 t3.micro 750h/월 (12개월) | e2-micro 1대 상시 무료 (미국 리전) |
| **스토리지** | S3 5GB (12개월) | GCS 5GB 상시 무료 |
| **DB** | RDS t3.micro 750h/월 (12개월) | Cloud SQL 없음 |
| **CDN** | CloudFront 1TB 전송/월 (12개월) | Cloud CDN 없음 |
| **시크릿** | SSM Standard 파라미터 무료 | Secret Manager 6개 버전/월 무료 |
| **Lambda/Functions** | 1M 요청/월 상시 | Cloud Functions 2M 요청/월 상시 |

**핵심 차이:**
- GCP e2-micro는 12개월 제한 없는 상시 무료 (미국 리전만)
- AWS RDS t3.micro Free Tier 12개월 → 이후 유료 전환 주의
- AWS Free Tier 전반적으로 12개월 제한이 많음

---

## Pricing Model 비교

| 항목 | AWS | GCP |
|------|-----|-----|
| **EC2/GCE 과금 단위** | 초 단위 (최소 1분) | 초 단위 (최소 1분) |
| **지속 사용 할인** | Reserved Instance (1/3년 약정) | Sustained Use Discount (자동 적용) |
| **선점형 인스턴스** | Spot Instance (최대 90% 할인) | Spot VM (최대 91% 할인) |
| **네트워크 Egress** | $0.09/GB (ap-northeast-1) | $0.12/GB (asia-northeast1) |
| **지원 플랜** | 기본 무료 / 개발자 $29+/월 | 기본 무료 / 개발자 $150/월 |

---

## 리전 비교 (한국/일본 근접 리전)

| 리전명 | AWS | GCP |
|--------|-----|-----|
| **도쿄** | ap-northeast-1 | asia-northeast1 |
| **오사카** | ap-northeast-3 | asia-northeast2 |
| **서울** | ap-northeast-2 | asia-northeast3 |
| **가장 가까운 리전** | ap-northeast-2 (서울) | asia-northeast3 (서울) |

**이 프로젝트 리전 선택:**
- Primary: `ap-northeast-1` (도쿄) — Free Tier t3.micro 포함
- DR/보조: `ap-northeast-3` (오사카)
- 글로벌 CI/CD 기준: `us-east-1`

---

## 이 프로젝트의 결정: AWS 선택

**선택: AWS**

**선택 근거:**

| 근거 | 설명 |
|------|------|
| **CDK TypeScript** | AWS CDK는 TypeScript 네이티브 지원, 프론트엔드(TS) 코드와 언어 공유. GCP는 CDK 사용 불가 (Deployment Manager/Terraform 필요) |
| **Free Tier 범위** | EC2 t3.micro + RDS t3.micro + S3 + CloudFront 모두 12개월 Free Tier. MVP 단계 비용 최소화 |
| **ap-northeast-1 리전** | 한국 서비스 기준 도쿄 리전이 가장 가까운 AWS 리전. 오사카(ap-northeast-3) DR 구성 용이 |
| **SSM Parameter Store** | Standard tier 완전 무료. Secrets Manager($0.40/비밀/월)보다 MVP 단계에 적합 |
| **GitHub Actions OIDC** | AWS IAM OIDC 연동 성숙도 높음, 사례 풍부 |
| **커뮤니티/사례** | Go + EC2 + Docker Compose 조합의 한국어 레퍼런스 풍부 |

**기각된 대안:**

| 대안 | 기각 사유 |
|------|---------|
| GCP | CDK 미지원, RDS 상당의 Free Tier DB 없음 |
| Azure | CDK 미지원, 한국 리전 가격 상대적으로 높음 |
| on-prem | 초기 인프라 비용, 운영 부담 |

---

## 마이그레이션 경로 (GCP로 이전 시)

AWS → GCP 이전 시 주요 변경 항목:

| AWS 서비스 | GCP 대체 | 변경 난이도 |
|-----------|---------|-----------|
| EC2 + Docker Compose | GCE + Docker Compose | 낮음 (Docker 이미지 재사용) |
| RDS PostgreSQL | Cloud SQL PostgreSQL | 낮음 (PostgreSQL 호환) |
| S3 | GCS | 중간 (SDK 변경 필요) |
| CloudFront | Cloud CDN | 중간 |
| SSM Parameter Store | Secret Manager | 중간 (API 다름) |
| CDK | Terraform 또는 Pulumi | 높음 (코드 재작성) |
| IAM + OIDC | Workload Identity | 중간 |

**이전 권고:** IaC를 CDK로 작성하면 GCP 이전 시 Terraform으로 재작성 필요. 멀티클라우드 전략이 처음부터 요건이라면 Terraform 선택 권장.
