/**
 * 파일: infra/aws-cdk/lib/shared/tags.ts
 * 역할: 모든 AWS 리소스에 공통 태그를 부여한다.
 * 시스템 내 위치: bin/app.ts에서 Stack 생성 후 호출.
 * 관계:
 *   - bin/app.ts가 applyCommonTags()를 호출
 *   - 모든 리소스에 4개 태그가 자동 부여됨
 * 설계 의도:
 *   - 태그로 비용 추적, 리소스 식별, 관리 주체 파악이 가능
 *   - CDK의 Tags.of() API로 Stack 하위 모든 리소스에 일괄 적용 (DRY)
 *   - 4개 태그 기준:
 *       Project: 어느 프로젝트의 리소스인가
 *       Environment: dev/stg/prod 중 어느 환경인가
 *       ManagedBy: 누가(무엇이) 이 리소스를 관리하는가
 *       Owner: 누가 이 프로젝트를 소유하는가 (비용 청구 추적용)
 */

import * as cdk from 'aws-cdk-lib';
import { EnvName } from './env-config';

/**
 * Stack 하위 모든 리소스에 공통 태그를 부여한다.
 *
 * @param scope - 태그를 적용할 CDK construct (보통 Stack)
 * @param envName - 환경 이름
 *
 * 부여되는 태그:
 *   - Project: "harness-fullstack-test"
 *   - Environment: "dev" | "stg" | "prod"
 *   - ManagedBy: "cdk"
 *   - Owner: "dev-sl0xw"
 *
 * 왜 Tags.of(scope)를 사용하는가?
 *   - CDK가 Stack 내 모든 리소스에 태그를 자동으로 전파
 *   - 리소스별로 태그를 개별 지정하면 누락 위험 (DRY 위반)
 */
export function applyCommonTags(scope: cdk.Stack, envName: EnvName): void {
  cdk.Tags.of(scope).add('Project', 'harness-fullstack-test');
  cdk.Tags.of(scope).add('Environment', envName);
  cdk.Tags.of(scope).add('ManagedBy', 'cdk');
  cdk.Tags.of(scope).add('Owner', 'dev-sl0xw');
}
