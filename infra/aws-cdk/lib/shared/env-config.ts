/**
 * 파일: infra/aws-cdk/lib/shared/env-config.ts
 * 역할: 환경별(dev/stg/prod) 설정값을 정의하고, decisions.json에서 로드한다.
 * 시스템 내 위치: 모든 Stack이 참조하는 환경 설정의 단일 진실원.
 * 관계:
 *   - bin/app.ts가 이 모듈을 호출하여 환경 설정을 로드
 *   - 각 Stack이 EnvConfig을 Props로 받아 환경별 리소스를 생성
 *   - _workspace/architecture/decisions.json이 데이터 원천
 * 설계 의도:
 *   - DRY: 환경별 Stack을 복사하지 않고 파라미터화
 *   - 타입 안전성: EnvConfig 인터페이스로 필수 필드 누락 방지
 *   - decisions.json이 단일 진실원(Single Source of Truth) — 하드코딩 금지
 */

import * as fs from 'fs';
import * as path from 'path';

/** 환경 이름 타입 — dev/stg/prod만 허용 */
export type EnvName = 'dev' | 'stg' | 'prod';

/** 환경별 설정 — 각 Stack에 전달되는 파라미터 */
export interface EnvConfig {
  /** 환경 이름 */
  readonly envName: EnvName;
  /** AWS 리전 */
  readonly region: string;
  /** AWS 계정 ID (TBD placeholder 허용) */
  readonly account: string;
  /** EC2 인스턴스 타입 */
  readonly instanceType: string;
  /** RDS 인스턴스 클래스 */
  readonly dbInstanceClass: string;
  /** RDS 스토리지 (GB) */
  readonly dbStorageGb: number;
  /** RDS 백업 보존 기간 (일) */
  readonly dbBackupRetentionDays: number;
  /** RDS Multi-AZ 활성화 여부 */
  readonly dbMultiAz: boolean;
  /** Route 53 Hosted Zone ID (null이면 DNS 레코드 생성 안 함) */
  readonly hostedZoneId: string | null;
  /** 도메인 이름 (null이면 Elastic IP로 직접 접근) */
  readonly domainName: string | null;
  /** CloudFront 캐시 정책 */
  readonly cfCachePolicy: 'no-cache' | 'default';
  /** TLS 인증서 방식 */
  readonly tlsCert: 'lets-encrypt' | null;
  /** SSM Parameter Store 경로 접두사 */
  readonly ssmPrefix: string;
}

/**
 * decisions.json을 로드하여 지정 환경의 설정을 반환한다.
 *
 * @param envName - 환경 이름 (dev/stg/prod)
 * @returns EnvConfig 객체
 *
 * 호출 흐름: bin/app.ts → loadEnvConfig() → decisions.json 파싱
 *
 * 왜 decisions.json에서 로드하는가?
 *   - solution-architect가 설계 결정을 decisions.json에 기록
 *   - CDK 코드가 이를 읽어 인프라에 반영 → 문서와 코드가 항상 일치
 *   - 하드코딩 시 "왜 t3.micro인가?"를 코드에서 알 수 없음
 */
export function loadEnvConfig(envName: EnvName): EnvConfig {
  // decisions.json 경로: 프로젝트 루트의 _workspace/architecture/decisions.json
  // __dirname은 이 파일(env-config.ts)의 위치: infra/aws-cdk/lib/shared/
  // 4단계 상위로 올라가면 프로젝트 루트
  const decisionsPath = path.resolve(__dirname, '../../../../_workspace/architecture/decisions.json');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let decisions: any;
  try {
    decisions = JSON.parse(fs.readFileSync(decisionsPath, 'utf-8'));
  } catch (e) {
    throw new Error(
      `decisions.json을 로드할 수 없습니다: ${decisionsPath}\n` +
      `solution-architect가 먼저 실행되어야 합니다.\n` +
      `파일이 존재하는지 확인하세요: _workspace/architecture/decisions.json`
    );
  }

  // decisions.json에서 환경별 값을 추출
  const computeEnv = decisions.compute.backend.per_environment[envName];
  const dataEnv = decisions.data.primary.per_environment[envName];
  const cdnEnv = decisions.cdn.per_environment[envName];
  const tlsEnv = decisions.tls.per_environment[envName];
  // primary_workload 리전: 실제 워크로드가 실행되는 리전 (ap-northeast-1 = 도쿄)
  const region = decisions.non_functional.region_roles.primary_workload;
  const account = decisions.cloud.accounts[envName];

  return {
    envName,
    region,
    account,
    instanceType: computeEnv.instance_type,
    dbInstanceClass: dataEnv.instance_class,
    dbStorageGb: dataEnv.storage_gb,
    dbBackupRetentionDays: dataEnv.backup_retention_days,
    dbMultiAz: dataEnv.multi_az,
    // hostedZoneId, domainName: 사용자가 Route 53 설정 후 수동으로 입력
    // decisions.json의 hosted_zone이 "TBD"인 경우 null로 처리
    hostedZoneId: null,
    domainName: null,
    cfCachePolicy: cdnEnv.cache_policy,
    tlsCert: tlsEnv.cert,
    ssmPrefix: `/hft/${envName}`,
  };
}
