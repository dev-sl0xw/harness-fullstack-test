#!/usr/bin/env bash
# =============================================================================
# 파일: infra/aws-cdk/scripts/synth-all-envs.sh
# 역할: dev/stg/prod 전 환경의 cdk synth를 순차 실행하여 CloudFormation 템플릿을 검증한다.
# 시스템 내 위치: CDK 프로젝트의 빌드/검증 스크립트.
# 관계:
#   - bin/app.ts의 5개 Stack을 각 환경별로 synth
#   - package.json의 "synth:all" 스크립트와 동일한 역할 (더 상세한 출력 제공)
#   - CI 파이프라인에서 CDK 문법 오류를 조기에 감지하는 데 사용
# 설계 의도:
#   - 배포 전 "코드가 유효한가?" 검증 (배포 없이 CloudFormation 템플릿만 생성)
#   - 3개 환경 모두 순차 실행하여 환경별 설정 차이로 인한 오류를 조기 발견
#   - set -euo pipefail: 에러 발생 즉시 종료, 미정의 변수 사용 시 에러
#
# 사용법:
#   cd infra/aws-cdk
#   bash scripts/synth-all-envs.sh
# =============================================================================
set -euo pipefail

# 스크립트 위치를 기준으로 infra/aws-cdk 디렉토리로 이동
cd "$(dirname "$0")/.."

echo "=== Synthesizing dev environment ==="
npx cdk synth --context env=dev --quiet

echo "=== Synthesizing stg environment ==="
npx cdk synth --context env=stg --quiet

echo "=== Synthesizing prod environment ==="
npx cdk synth --context env=prod --quiet

echo ""
echo "All environments synthesized successfully."
echo "CloudFormation templates are in: cdk.out/"
