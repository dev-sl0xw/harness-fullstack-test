/**
 * 파일: infra/aws-cdk/lib/observability-stack.ts
 * 역할: CloudWatch Log Groups를 정의한다.
 * 시스템 내 위치: 로그 수집 인프라 레이어.
 * 관계:
 *   - EC2의 CloudWatch Agent가 이 Stack에서 생성한 Log Group에 로그를 전송
 *   - EC2AppStack의 IAM Role에 CloudWatchAgentServerPolicy를 부여하여 연동
 *   - ADR-0003 (EC2 + Docker Compose)의 관측 가능성 결정 반영
 * 설계 의도:
 *   - MVP에서는 로그 수집만으로 충분 (Free Tier 5GB/월 → 학습용으로 여유 있음)
 *   - 비용 발생 항목 모두 비활성화: Dashboards, Alarms, X-Ray, Container Insights
 *   - Log Group을 CDK로 관리 → retention 정책 일관성 확보 (삭제 방지)
 *   - dev: 3일 보존 (디스크 절감), stg/prod: 30일 보존 (문제 추적)
 *
 * 비활성화 이유 (MVP):
 *   - CloudWatch Dashboards: 월 $3/dashboard
 *   - CloudWatch Alarms: 월 $0.10/알람
 *   - X-Ray: 100,000 trace/월 이후 과금
 *   - CloudWatch Container Insights: 기본 지표보다 비쌈
 */

import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvConfig } from './shared/env-config';
import { logGroupName } from './shared/naming';

/** ObservabilityStack 생성 파라미터 */
export interface ObservabilityStackProps extends cdk.StackProps {
  /** 환경 설정 (decisions.json에서 로드) */
  readonly envConfig: EnvConfig;
}

/**
 * Observability Stack — CloudWatch Log Groups.
 *
 * 생성되는 Log Groups:
 *   - /hft/{env}/backend: Go API 서버 로그 (gin 액세스 로그, 애플리케이션 로그)
 *   - /hft/{env}/caddy: Caddy reverse proxy 접근 로그 (HTTP 요청/응답)
 *
 * CloudWatch Agent 연동:
 *   EC2 인스턴스의 CloudWatch Agent 설정에서 이 Log Group 이름을 참조한다.
 *   User Data에서 CloudWatch Agent 설정 파일을 생성하여 자동으로 로그를 전송.
 *
 * retention 정책:
 *   - dev: THREE_DAYS (3일) — 개발 중 디버깅에 충분, 비용 최소화
 *   - stg/prod: ONE_MONTH (30일) — 문제 추적에 충분한 기간
 *
 * removalPolicy:
 *   - prod: RETAIN — cdk destroy 시에도 로그 보존 (감사 목적)
 *   - dev/stg: DESTROY — cdk destroy 시 Log Group 삭제
 */
export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const { envConfig } = props;
    const env = envConfig.envName;

    // =========================================================================
    // Backend Log Group
    // =========================================================================
    // Go/Gin API 서버의 로그를 수집한다.
    // CloudWatch Agent가 docker logs backend → CloudWatch Log Group으로 전송
    new logs.LogGroup(this, 'BackendLogGroup', {
      // logGroupName: '/hft/dev/backend', '/hft/prod/backend' 등
      logGroupName: logGroupName(env, 'backend'),
      // retention: dev 3일, stg/prod 30일
      retention: env === 'dev'
        ? logs.RetentionDays.THREE_DAYS
        : logs.RetentionDays.ONE_MONTH,
      removalPolicy: env === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // =========================================================================
    // Caddy Log Group
    // =========================================================================
    // Caddy reverse proxy의 접근 로그를 수집한다.
    // 형식: {"ts": ..., "msg": "handled request", "request": {...}, "status": 200, "duration": ...}
    new logs.LogGroup(this, 'CaddyLogGroup', {
      // logGroupName: '/hft/dev/caddy', '/hft/prod/caddy' 등
      logGroupName: logGroupName(env, 'caddy'),
      retention: env === 'dev'
        ? logs.RetentionDays.THREE_DAYS
        : logs.RetentionDays.ONE_MONTH,
      removalPolicy: env === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });
  }
}
