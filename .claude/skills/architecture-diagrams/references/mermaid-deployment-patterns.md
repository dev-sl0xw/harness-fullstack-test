# Mermaid Deployment Diagram 패턴 참조

이 파일은 AWS Free Tier 배포 토폴로지를 Mermaid `flowchart` 문법으로
표현하는 패턴과 이 프로젝트 기준 예시를 제공한다.

---

## 기본 원칙

- **flowchart TB** (Top-Bottom): 인터넷 → CDN → 서버 → DB 순서로 시각화
- **subgraph**: VPC, Subnet, AZ(Availability Zone), 서비스 그룹을 표현
- **점선 `-.->` **: 외부 서비스(GitHub, Docker Hub) 참조
- **실선 `-->` **: 내부 트래픽 흐름
- **classDef**: compute/storage/network/security 레이어별 색상 구분

---

## 노드 모양 패턴

```mermaid
flowchart TB
  %% 네트워크/엔트리포인트
  internet["🌐 Internet"]
  r53["Route 53\nDNS"]
  cf["CloudFront\nCDN + HTTPS"]

  %% 정적 자산 저장소
  s3[("S3 Bucket\nFrontend 정적 파일")]

  %% 컴퓨팅
  ec2["EC2 t2.micro\nGo Backend API\n:8080"]

  %% 데이터베이스 (원통형)
  rds[("RDS PostgreSQL\nt3.micro Free Tier\n:5432")]

  %% 보안/설정
  ssm["SSM Parameter Store\n(환경변수 / 시크릿)"]
  sg["Security Group\nInbound: 80,443,22"]
  iam["IAM Role\nEC2 → SSM Read Only"]
```

### Mermaid 노드 모양 대응

| 모양 | 문법 | 사용 상황 |
|------|------|---------|
| 직사각형 | `id["Label"]` | 서버, 서비스 |
| 원통형 (DB) | `id[("Label")]` | 데이터베이스, S3 |
| 마름모 | `id{"Label"}` | 의사결정, Load Balancer 조건 |
| 육각형 | `id{{"Label"}}` | 준비/대기 상태 |
| 스타디움 | `id(["Label"])` | 시작/종료 노드 |

---

## 이 프로젝트 기준: AWS Free Tier 배포 토폴로지

```mermaid
flowchart TB
  %% ============================
  %% 외부 (인터넷)
  %% ============================
  internet(["🌐 Internet"])

  %% ============================
  %% AWS ap-northeast-1 — 메인 리전
  %% ============================
  subgraph region1["AWS ap-northeast-1 (Tokyo) — Primary"]
    direction TB

    %% DNS
    r53["Route 53\nharness.example.com\nDNS 라우팅"]

    %% CDN + HTTPS 종단
    cf["CloudFront\nCDN + HTTPS 종단\nOrigin: S3 + EC2 ALB"]

    %% 정적 자산
    subgraph static["정적 자산"]
      s3[("S3 Bucket\nfrontend 빌드 결과물\n(npm run build → dist/)")]
    end

    %% VPC
    subgraph vpc["VPC 10.0.0.0/16"]
      direction TB

      subgraph pub["Public Subnet 10.0.1.0/24"]
        ec2["EC2 t2.micro\nGo Backend API\n:8080\n(Free Tier: 750h/월)"]
        sg["Security Group\nInbound: 80(HTTP), 443(HTTPS), 22(SSH)\nOutbound: All"]
      end

      subgraph priv["Private Subnet 10.0.2.0/24"]
        rds[("RDS PostgreSQL 16\nt3.micro\n:5432\n(Free Tier: 750h/월, 20GB)")]
      end
    end

    %% 보안/설정 서비스
    ssm["SSM Parameter Store\nJWT_SECRET, DB_PASSWORD\n(환경변수 · 시크릿 저장)"]
    iam["IAM Role\nec2-harness-role\nSSM:GetParameter Read Only"]
    cw["CloudWatch\n로그 수집 (애플리케이션 로그)\n(비용 주의: 무료 5GB/월)"]
  end

  %% ============================
  %% AWS ap-northeast-3 — 백업 볼트
  %% ============================
  subgraph region3["AWS ap-northeast-3 (Osaka) — Backup Vault"]
    s3backup[("S3 Backup\nRDS 스냅샷 보관\n(교차 리전 복제)")]
  end

  %% ============================
  %% 외부 서비스 (점선)
  %% ============================
  github["GitHub\n소스 코드 / Actions CI"]
  dockerhub["Docker Hub\n베이스 이미지"]

  %% ============================
  %% 흐름 연결
  %% ============================
  internet --> r53
  r53 --> cf
  cf --> s3
  cf --> ec2
  ec2 --> sg
  ec2 --> rds
  ec2 --> ssm
  ec2 --> cw
  iam --> ec2
  iam --> ssm
  rds --> s3backup

  %% 외부 → 내부 (점선)
  github -.->|"Actions: build + deploy"| ec2
  github -.->|"Actions: docker pull"| dockerhub
  dockerhub -.->|"베이스 이미지"| ec2

  %% ============================
  %% classDef — 레이어별 색상
  %% ============================
  classDef compute fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
  classDef storage fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
  classDef network fill:#eceff1,stroke:#546e7a,color:#263238
  classDef security fill:#fff3e0,stroke:#e65100,color:#bf360c
  classDef external fill:#f5f5f5,stroke:#9e9e9e,color:#424242,stroke-dasharray: 5 5
  classDef region fill:#fafafa,stroke:#bdbdbd

  class ec2,rds compute
  class s3,s3backup storage
  class r53,cf,sg,vpc,pub,priv network
  class ssm,iam,cw security
  class github,dockerhub external
```

---

## subgraph로 VPC/Subnet/AZ 표현

```mermaid
flowchart TB
  subgraph vpc["VPC 10.0.0.0/16"]
    subgraph az1["AZ: ap-northeast-1a"]
      subgraph pub1["Public Subnet 10.0.1.0/24"]
        ec2a["EC2 인스턴스 A"]
      end
      subgraph priv1["Private Subnet 10.0.2.0/24"]
        rds1[("RDS Primary")]
      end
    end

    subgraph az2["AZ: ap-northeast-1c"]
      subgraph priv2["Private Subnet 10.0.3.0/24"]
        rds2[("RDS Standby\n(Multi-AZ 구성 시)")]
      end
    end
  end

  ec2a --> rds1
  rds1 -.->|"동기 복제"| rds2
```

---

## Free Tier 비용 주석

```
%% [비용 주석]
%% EC2 t2.micro: Free Tier 750h/월 (Linux)
%% RDS t3.micro: Free Tier 750h/월 + 20GB gp2
%% S3: Free Tier 5GB 저장 + GET 20,000건/월
%% CloudFront: Free Tier 1TB 전송/월 (12개월)
%% Route 53: 호스팅 존 $0.50/월 (Free Tier 없음 — 가장 저렴한 유료 서비스)
%% SSM Parameter Store: 표준 파라미터는 무료
%% CloudWatch: 무료 5GB 로그 수집/월 (초과 시 $0.50/GB)
%%
%% 주의: 모든 Free Tier는 계정 생성 후 12개월 한정
%% EC2/RDS는 인스턴스 운영 중 750h 이상이면 비용 발생
```

---

## classDef 색상 표준 (Deployment)

| 레이어 | fill | stroke | 용도 |
|--------|------|--------|------|
| compute | `#e3f2fd` | `#1565c0` | EC2, RDS, 컨테이너 |
| storage | `#e8f5e9` | `#2e7d32` | S3, EFS, 블록 스토리지 |
| network | `#eceff1` | `#546e7a` | Route53, CloudFront, SG, VPC |
| security | `#fff3e0` | `#e65100` | IAM, SSM, KMS, WAF |
| external | `#f5f5f5` | `#9e9e9e` | GitHub, Docker Hub (점선 테두리) |
