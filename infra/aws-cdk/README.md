# AWS CDK Infrastructure — harness-fullstack-test

이 디렉토리는 harness-fullstack-test 프로젝트의 AWS 인프라를 CDK (TypeScript)로 정의한다.
아키텍처 결정의 단일 진실원: [`_workspace/architecture/decisions.json`](../../_workspace/architecture/decisions.json)

## 아키텍처 개요

5개 Stack으로 구성 (의존성 순서):

| Stack | 역할 | 주요 리소스 | 환경 의존성 |
|-------|------|-----------|-----------|
| `NetworkStack` | 네트워크 기반 | VPC, Public/Isolated Subnet, App SG, DB SG | 공통 |
| `DatabaseStack` | 관계형 DB | RDS PostgreSQL 16 (db.t3.micro) | NetworkStack |
| `Ec2AppStack` | 백엔드 실행 | ECR, EC2 (t3.micro), Elastic IP, IAM Role, SSM | NetworkStack, DatabaseStack |
| `FrontendStack` | 프론트엔드 배포 | S3 (private), CloudFront (OAC) | 독립 |
| `ObservabilityStack` | 로그 수집 | CloudWatch Log Groups (backend, caddy) | 독립 |

### 의존성 그래프

```
NetworkStack
  ├── DatabaseStack  (vpc, dbSecurityGroup)
  └── Ec2AppStack    (vpc, appSecurityGroup, dbEndpoint)
FrontendStack        (독립 — VPC 불필요)
ObservabilityStack   (독립 — VPC 불필요)
```

## 사전 준비

1. **Node.js 20+** 설치 확인:
   ```bash
   node --version
   ```

2. **AWS CLI** 설치 및 자격증명 설정:
   ```bash
   aws configure
   # 또는 AWS_PROFILE 환경변수 사용
   ```

3. **CDK Bootstrap** (최초 1회, 계정/리전별):
   ```bash
   npx cdk bootstrap aws://<ACCOUNT_ID>/ap-northeast-1
   ```

## 로컬 개발

```bash
# 1. 의존성 설치
npm install

# 2. TypeScript 컴파일 확인
npx tsc --noEmit

# 3. 테스트 실행
npm test

# 4. 전 환경 synth (배포 없이 CloudFormation 템플릿 검증)
npm run synth:all
```

## 환경별 Synth

```bash
npm run synth:dev    # dev 환경 CloudFormation 템플릿 생성
npm run synth:stg    # stg 환경 CloudFormation 템플릿 생성
npm run synth:prod   # prod 환경 CloudFormation 템플릿 생성
```

생성된 템플릿은 `cdk.out/` 디렉토리에 저장된다.

## 수동 배포

```bash
# 전체 Stack 배포 (dev 환경)
npx cdk deploy --all --context env=dev

# 특정 Stack만 배포
npx cdk deploy Network-dev --context env=dev
npx cdk deploy Database-dev --context env=dev

# 변경사항 미리 보기 (배포 전)
npx cdk diff --context env=stg
```

## ECR에 이미지 Push

```bash
# 사용법: <env> <aws-region> <aws-account-id>
bash scripts/build-and-push.sh dev ap-northeast-1 123456789012
```

이미지 태그:
- `:git-hash` — 특정 커밋 버전 (롤백 시 활용)
- `:latest` — EC2 User Data에서 `docker compose pull`이 가져오는 태그

## SSM Parameter SecureString 전환

CDK는 보안 제약으로 SecureString을 직접 생성할 수 없다.
배포 후 수동으로 실제 값으로 교체:

```bash
# JWT_SECRET 교체 예시 (prod 환경)
aws ssm put-parameter \
  --name "/hft/prod/JWT_SECRET" \
  --value "$(openssl rand -base64 48)" \
  --type SecureString \
  --overwrite

# DB_PASSWORD 교체 예시
aws ssm put-parameter \
  --name "/hft/prod/DB_PASSWORD" \
  --value "실제_비밀번호" \
  --type SecureString \
  --overwrite
```

ADR 참조: [0005-secrets-ssm-parameter-store](../../docs/architecture/adr/0005-secrets-ssm-parameter-store.md)

## 비용 추정

| 항목 | Free Tier (12개월) | Free Tier 이후 |
|------|-------------------|---------------|
| EC2 t3.micro | 무료 | ~$8/월 |
| RDS db.t3.micro | 무료 | ~$15/월 |
| Route 53 Hosted Zone | $0.50/월 | $0.50/월 |
| S3 + CloudFront | 무료 (5GB + 1TB) | 무료 수준 |
| SSM Parameter Store | 무료 (Standard Tier) | 무료 |
| CloudWatch Logs | 무료 (<5GB/월) | 무료 수준 |
| ECR | 무료 (<500MB/월) | 무료 수준 |
| **합계** | **~$0.50/월** | **~$25/월** |

## 트러블슈팅

### User Data 실행 실패

```bash
# SSM Session Manager로 EC2 접속 (SSH 불필요)
aws ssm start-session --target <INSTANCE_ID>

# cloud-init 로그 확인 (User Data 실행 로그)
sudo cat /var/log/cloud-init-output.log

# Docker Compose 상태 확인
cd /opt/hft && docker compose ps
docker compose logs backend
docker compose logs caddy
```

### SSM Parameter 확인

```bash
# 특정 환경의 모든 파라미터 목록
aws ssm get-parameters-by-path \
  --path "/hft/dev/" \
  --region ap-northeast-1 \
  --query "Parameters[*].[Name,Type]" \
  --output table

# 특정 파라미터 값 확인 (SecureString은 --with-decryption 필요)
aws ssm get-parameter \
  --name "/hft/dev/JWT_SECRET" \
  --with-decryption \
  --query "Parameter.Value"
```

### Let's Encrypt 발급 실패

```bash
# Caddy 로그 확인
docker compose logs caddy

# staging CA로 테스트 (rate limit 없음)
# Caddyfile에 추가:
# acme_ca https://acme-staging-v02.api.letsencrypt.org/directory

# 도메인이 EIP를 가리키는지 확인
nslookup api.example.com
```

### snapshot 테스트 갱신

인프라 구조가 의도적으로 변경된 경우:

```bash
# snapshot 갱신
npm test -- -u

# 변경된 snapshot 검토 후 커밋
git diff test/__snapshots__/
```

## 학습용 주석

모든 `.ts` 파일에 한국어 학습용 상세 주석이 포함되어 있다:
- **파일 상단**: 역할, 시스템 내 위치, 다른 파일과의 관계
- **각 리소스**: 왜 이 설정인지, Free Tier 관련 의사결정, ADR 참조
- **설계 의도**: KISS/DRY/YAGNI 원칙 적용 이유

관련 ADR:
- [ADR-0001](../../docs/architecture/adr/0001-cloud-aws.md): Cloud Provider — AWS
- [ADR-0002](../../docs/architecture/adr/0002-iac-cdk.md): IaC Tool — CDK (TypeScript)
- [ADR-0003](../../docs/architecture/adr/0003-compute-ec2-docker-compose.md): Compute — EC2 + Docker Compose
- [ADR-0007](../../docs/architecture/adr/0007-region-strategy.md): Region Strategy
