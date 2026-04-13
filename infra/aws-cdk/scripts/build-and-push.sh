#!/usr/bin/env bash
# =============================================================================
# 파일: infra/aws-cdk/scripts/build-and-push.sh
# 역할: Backend Docker 이미지를 빌드하고 ECR에 push한다.
# 시스템 내 위치: CDK 프로젝트의 배포 보조 스크립트.
# 관계:
#   - backend/Dockerfile을 사용하여 이미지 빌드
#   - Ec2AppStack이 생성한 ECR Repository에 push
#   - deploy-aws.yml(.github/workflows/)이 이 스크립트 또는 동일 로직을 사용
# 설계 의도:
#   - ECR login → build → push를 하나의 스크립트로 자동화 (로컬 배포 편의)
#   - git commit hash를 이미지 태그로 사용 → 어느 코드가 배포되었는지 추적 가능
#   - :latest도 함께 push → EC2 User Data에서 "docker compose pull"이 최신 이미지 가져옴
#
# 사용법:
#   bash scripts/build-and-push.sh <env> <aws-region> <aws-account-id>
#   예: bash scripts/build-and-push.sh dev ap-northeast-1 123456789012
#
# 사전 준비:
#   - aws configure (또는 AWS_PROFILE 환경변수 설정)
#   - docker daemon 실행 중
#   - ECR Repository 생성 완료 (cdk deploy Ec2App-dev 먼저 실행)
# =============================================================================
set -euo pipefail

# 인수 검증 — 모두 필수
ENV="${1:?사용법: $0 <env> <region> <account-id>}"
REGION="${2:?사용법: $0 <env> <region> <account-id>}"
ACCOUNT_ID="${3:?사용법: $0 <env> <region> <account-id>}"

# ECR Repository 이름: hft-{env}-backend (resourceName()과 동일 패턴)
REPO_NAME="hft-${ENV}-backend"
REPO_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}"

# git commit hash로 이미지 태그 생성 (추적 가능성)
# --short: 7자리 단축 해시 (예: "a1b2c3d")
TAG=$(git rev-parse --short HEAD)

echo "=== ECR Login ==="
# ECR 인증 토큰을 docker login에 전달 (토큰 유효기간: 12시간)
aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "=== Building backend image ==="
# 스크립트 위치에서 backend 디렉토리로 이동
cd "$(dirname "$0")/../../../backend"
# 두 개의 태그로 빌드:
#   - :{TAG}: 이 배포를 고정 식별 (롤백 시 활용)
#   - :latest: EC2 User Data의 "docker compose pull"이 가져오는 태그
docker build -t "${REPO_URI}:${TAG}" -t "${REPO_URI}:latest" .

echo "=== Pushing to ECR ==="
docker push "${REPO_URI}:${TAG}"
docker push "${REPO_URI}:latest"

echo ""
echo "Pushed images:"
echo "  ${REPO_URI}:${TAG}"
echo "  ${REPO_URI}:latest"
echo ""
echo "EC2 배포 방법 (SSM Session Manager):"
echo "  aws ssm start-session --target <INSTANCE_ID>"
echo "  cd /opt/hft && docker compose pull && docker compose up -d"
