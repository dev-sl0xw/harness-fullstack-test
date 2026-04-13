/**
 * 파일: infra/aws-cdk/lib/shared/naming.ts
 * 역할: AWS 리소스 이름을 일관된 패턴으로 생성한다.
 * 시스템 내 위치: 각 Stack에서 리소스 이름 생성 시 호출.
 * 관계:
 *   - NetworkStack, DatabaseStack, Ec2AppStack, FrontendStack, ObservabilityStack이
 *     모두 이 모듈의 함수를 사용하여 리소스명 생성
 *   - tags.ts의 태그와 함께 리소스 식별에 사용
 * 설계 의도:
 *   - DRY: 네이밍 규칙을 한 곳에서 관리 — 규칙 변경 시 이 파일만 수정
 *   - 환경별 리소스를 이름만으로 구분 가능 (같은 계정 내 dev/stg/prod 공존 시)
 *   - 패턴: hft-{env}-{resource} (예: hft-dev-vpc, hft-prod-db)
 *   - SSM 경로: /hft/{env}/{KEY} (예: /hft/prod/JWT_SECRET)
 *   - CloudWatch Log Group: /hft/{env}/{service} (예: /hft/dev/backend)
 */

import { EnvName } from './env-config';

/** 프로젝트 접두사 — 모든 리소스 이름과 경로에 사용 */
const PROJECT_PREFIX = 'hft';

/**
 * 환경과 리소스 이름을 조합하여 AWS 리소스 이름을 생성한다.
 *
 * @param envName - 환경 이름 (dev/stg/prod)
 * @param resource - 리소스 식별자 (예: 'vpc', 'db', 'ec2', 'app-sg')
 * @returns 조합된 이름 (예: 'hft-dev-vpc', 'hft-prod-db')
 *
 * 사용 예:
 *   resourceName('dev', 'vpc')   → 'hft-dev-vpc'
 *   resourceName('prod', 'db')   → 'hft-prod-db'
 *   resourceName('stg', 'ec2')   → 'hft-stg-ec2'
 */
export function resourceName(envName: EnvName, resource: string): string {
  return `${PROJECT_PREFIX}-${envName}-${resource}`;
}

/**
 * SSM Parameter Store 경로를 생성한다.
 *
 * @param envName - 환경 이름 (dev/stg/prod)
 * @param key - 파라미터 키 (예: 'JWT_SECRET', 'DB_PASSWORD')
 * @returns SSM 경로 (예: '/hft/dev/JWT_SECRET', '/hft/prod/DB_PASSWORD')
 *
 * 왜 경로에 환경을 포함하는가?
 *   - 환경별 격리: dev EC2가 prod 시크릿에 접근하지 못하도록 IAM 정책과 함께 제어
 *   - 계층 구조: GetParametersByPath('/hft/dev/')로 환경의 모든 파라미터를 한번에 가져올 수 있음
 */
export function ssmPath(envName: EnvName, key: string): string {
  return `/${PROJECT_PREFIX}/${envName}/${key}`;
}

/**
 * CloudWatch Log Group 이름을 생성한다.
 *
 * @param envName - 환경 이름 (dev/stg/prod)
 * @param service - 서비스 이름 (예: 'backend', 'caddy')
 * @returns Log Group 이름 (예: '/hft/dev/backend', '/hft/prod/caddy')
 *
 * 왜 슬래시 경로 형태인가?
 *   - CloudWatch Log Groups는 계층적 경로를 지원 (AWS 콘솔에서 트리 구조로 표시)
 *   - /hft/ 접두사로 다른 프로젝트의 로그와 구분
 */
export function logGroupName(envName: EnvName, service: string): string {
  return `/${PROJECT_PREFIX}/${envName}/${service}`;
}
