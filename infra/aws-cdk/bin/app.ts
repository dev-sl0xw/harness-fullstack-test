#!/usr/bin/env node
/**
 * 파일: infra/aws-cdk/bin/app.ts
 * 역할: CDK App의 진입점. env context를 파싱하고 5개 Stack을 조립한다.
 * 시스템 내 위치: CDK 명령어(synth, deploy)가 최초로 실행하는 파일.
 * 관계:
 *   - cdk.json의 "app" 필드가 이 파일을 가리킴: "npx ts-node --prefer-ts-exts bin/app.ts"
 *   - shared/env-config.ts: decisions.json에서 환경 설정 로드
 *   - shared/guards.ts: 허용 리전 검증 (배포 차단)
 *   - shared/tags.ts: 모든 Stack 리소스에 공통 태그 부여
 *   - 5개 Stack을 의존성 순서대로 조립
 * 설계 의도:
 *   - DRY: 환경별 Stack 복사 없이 envConfig 파라미터화 → "dev와 prod의 차이는 값이지 구조가 아니다"
 *   - 리전 가드: 허용되지 않은 리전에서 cdk deploy 실행 시 즉시 에러 (ADR-0007)
 *   - 태그 전파: Tags.of(stack)으로 Stack 하위 모든 리소스에 4개 태그 일괄 적용 (DRY)
 *   - 의존성 그래프를 명시적으로 관리하여 Stack 간 출력(output) 전달을 명확하게 함
 *
 * 사용법:
 *   npx cdk synth --context env=dev          # dev 환경 CloudFormation 템플릿 생성
 *   npx cdk deploy --all --context env=prod  # prod 전체 Stack 배포
 *   npx cdk diff --context env=stg           # stg 변경사항 미리 보기
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { loadEnvConfig, EnvName } from '../lib/shared/env-config';
import { assertAllowedRegion } from '../lib/shared/guards';
import { applyCommonTags } from '../lib/shared/tags';
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';
import { Ec2AppStack } from '../lib/ec2-app-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { ObservabilityStack } from '../lib/observability-stack';

// =============================================================================
// env context 파싱
// =============================================================================
// CDK context는 --context key=value 형태로 전달된다.
// 예: npx cdk synth --context env=dev
//
// tryGetContext: 없으면 undefined 반환 (getContext는 없으면 에러)
const app = new cdk.App();
const envNameRaw = app.node.tryGetContext('env');

// env context가 없거나 유효하지 않은 경우 명확한 에러 메시지와 함께 종료
if (!envNameRaw || !['dev', 'stg', 'prod'].includes(envNameRaw)) {
  throw new Error(
    `--context env=<dev|stg|prod> 필수입니다.\n` +
    `사용법:\n` +
    `  npx cdk synth --context env=dev\n` +
    `  npx cdk deploy --all --context env=prod`
  );
}

const envName = envNameRaw as EnvName;

// =============================================================================
// decisions.json에서 환경 설정 로드
// =============================================================================
// decisions.json이 없으면 loadEnvConfig()가 명확한 에러 메시지와 함께 throw
const envConfig = loadEnvConfig(envName);

// =============================================================================
// 리전 가드 (ADR-0007)
// =============================================================================
// 허용 리전: us-east-1, ap-northeast-1, ap-northeast-3
// 그 외 리전에서 실행 시 에러 throw → 잘못된 리전 배포 사고 방지
assertAllowedRegion(envConfig.region);

// =============================================================================
// CDK 환경 설정
// =============================================================================
// account: TBD인 경우 undefined로 처리 (환경 무관 Stack으로 배포 가능)
// 실제 배포 시에는 decisions.json의 cloud.accounts.{env}를 실제 계정 ID로 교체
const cdkEnv: cdk.Environment = {
  account: envConfig.account !== 'TBD' ? envConfig.account : undefined,
  region: envConfig.region,
};

// =============================================================================
// Stack 조립
// =============================================================================
// 의존성 그래프:
//   NetworkStack                  ← 모든 Stack의 기반 (VPC, SG)
//     ├── DatabaseStack (vpc, dbSG)
//     └── Ec2AppStack (vpc, appSG, dbEndpoint)
//   FrontendStack                 ← 독립 (S3 + CloudFront, VPC 불필요)
//   ObservabilityStack            ← 독립 (CloudWatch Log Groups)
//
// Stack 이름 패턴: {StackType}-{env} (예: Network-dev, Database-prod)
// cdk deploy Network-dev: 특정 Stack만 배포 가능

const network = new NetworkStack(app, `Network-${envName}`, {
  env: cdkEnv,
  envConfig,
  description: `harness-fullstack-test NetworkStack — ${envName} 환경 VPC/SG`,
});

const database = new DatabaseStack(app, `Database-${envName}`, {
  env: cdkEnv,
  envConfig,
  vpc: network.vpc,
  dbSecurityGroup: network.dbSecurityGroup,
  description: `harness-fullstack-test DatabaseStack — ${envName} 환경 RDS PostgreSQL`,
});

const ec2App = new Ec2AppStack(app, `Ec2App-${envName}`, {
  env: cdkEnv,
  envConfig,
  vpc: network.vpc,
  appSecurityGroup: network.appSecurityGroup,
  dbEndpoint: database.dbEndpoint,
  description: `harness-fullstack-test Ec2AppStack — ${envName} 환경 EC2 + ECR + SSM`,
});

const frontend = new FrontendStack(app, `Frontend-${envName}`, {
  env: cdkEnv,
  envConfig,
  description: `harness-fullstack-test FrontendStack — ${envName} 환경 S3 + CloudFront`,
});

const observability = new ObservabilityStack(app, `Observability-${envName}`, {
  env: cdkEnv,
  envConfig,
  description: `harness-fullstack-test ObservabilityStack — ${envName} 환경 CloudWatch Log Groups`,
});

// =============================================================================
// 공통 태그 부여
// =============================================================================
// Tags.of(stack)으로 Stack 하위 모든 리소스에 4개 태그 일괄 적용
// 개별 리소스마다 태그를 설정하면 누락 위험 → DRY 패턴으로 한 번에 처리
[network, database, ec2App, frontend, observability].forEach((stack) => {
  applyCommonTags(stack, envName);
});
