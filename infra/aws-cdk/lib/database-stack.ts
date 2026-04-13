/**
 * 파일: infra/aws-cdk/lib/database-stack.ts
 * 역할: RDS PostgreSQL 인스턴스를 정의한다.
 * 시스템 내 위치: 백엔드 API가 데이터를 저장하는 관리형 데이터베이스 레이어.
 * 관계:
 *   - NetworkStack의 vpc와 dbSecurityGroup을 Props로 받아 사용
 *   - Ec2AppStack이 dbEndpoint를 환경변수(DATABASE_URL)로 사용하여 RDS에 연결
 *   - ADR-0004 (RDS PostgreSQL Progressive): 4단계 진화 경로의 Stage 1
 *   - ADR-0006 (DB Evolution Path): 향후 Multi-AZ, Read Replica, Aurora 전환 경로 참조
 * 설계 의도:
 *   - Free Tier 최적화: db.t3.micro, 20GB, single-instance (12개월 무료)
 *   - Isolated Subnet 배치: 인터넷에서 직접 DB 접근 차단 → 보안 강화
 *   - 자동 백업: prod 7일, dev 1일 (decisions.json에서 환경별 설정 로드)
 *   - deleteProtection: prod는 삭제 방지, dev는 편의상 해제
 *   - removalPolicy: prod는 RETAIN (데이터 보존), dev는 DESTROY (개발 편의)
 */

import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvConfig } from './shared/env-config';
import { resourceName } from './shared/naming';

/** DatabaseStack 생성 파라미터 */
export interface DatabaseStackProps extends cdk.StackProps {
  /** 환경 설정 (decisions.json에서 로드) */
  readonly envConfig: EnvConfig;
  /** NetworkStack에서 전달받은 VPC */
  readonly vpc: ec2.IVpc;
  /** NetworkStack에서 전달받은 DB 보안 그룹 */
  readonly dbSecurityGroup: ec2.ISecurityGroup;
}

/**
 * RDS PostgreSQL Stack.
 *
 * 구성 요소:
 *   - PostgreSQL 16 엔진 (로컬 docker-compose.yml과 동일 버전)
 *   - db.t3.micro 인스턴스 (Free Tier 12개월 무료)
 *   - 20GB gp2 스토리지 (Free Tier 포함)
 *   - Isolated Subnet 배치 (인터넷 차단)
 *   - master 자격증명 → Secrets Manager 자동 저장 (CDK 기본 동작)
 *   - 자동 백업 retention: decisions.json에서 환경별 결정
 *
 * 왜 RDS를 사용하는가 (ADR-0004):
 *   - EC2에 PostgreSQL 직접 설치 시 패치/백업/고가용성을 수동 관리해야 함
 *   - RDS는 자동 패치, 자동 백업, Multi-AZ 전환이 가능한 managed service
 *   - 로컬과 동일 엔진(PostgreSQL 16)으로 호환성 보장
 */
export class DatabaseStack extends cdk.Stack {
  /** RDS 인스턴스 참조 (다른 Stack이 필요 시 사용) */
  public readonly dbInstance: rds.IDatabaseInstance;
  /**
   * DB 접속 endpoint (host:port 형태).
   * Ec2AppStack의 User Data에서 DATABASE_URL 생성에 사용.
   */
  public readonly dbEndpoint: string;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { envConfig, vpc, dbSecurityGroup } = props;
    const env = envConfig.envName;

    // =========================================================================
    // RDS DatabaseInstance 생성
    // =========================================================================
    // credentials.fromGeneratedSecret():
    //   - master password를 AWS Secrets Manager에 자동 생성/저장
    //   - CDK가 SecureString을 직접 생성하는 유일한 방법 (SSM SecureString은 CDK 불가)
    //   - Secrets Manager는 $0.40/secret/월이지만, RDS 기본 자격증명은 CDK 관례
    //   - 향후 SSM Parameter로 전환 시 ADR-0005 참조
    //
    // instanceType: db.t3.micro
    //   - Free Tier 12개월 무료 (750시간/월)
    //   - 2 vCPU, 1GB RAM — 학습용으로 충분
    //
    // multiAz: false (dev/stg/prod 모두)
    //   - Multi-AZ는 비용 2배 ($15 → $30/월)
    //   - ADR-0011: best-effort SLA 수용, Stage 2에서 Multi-AZ 전환
    //
    // vpcSubnets.subnetType: PRIVATE_ISOLATED
    //   - 인터넷에서 직접 DB 접근 차단 (NetworkStack의 isolated subnet)
    //   - EC2(App SG)에서만 5432 포트 접근 가능 (DB SG 규칙)
    const instance = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: resourceName(env, 'db'),
      engine: rds.DatabaseInstanceEngine.postgres({
        // PostgreSQL 16: 로컬 docker-compose.yml과 동일 메이저 버전
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      // 'harness': master username (EC2 User Data의 DATABASE_URL에 사용)
      credentials: rds.Credentials.fromGeneratedSecret('harness', {
        secretName: resourceName(env, 'db-secret'),
      }),
      databaseName: 'harness',
      allocatedStorage: envConfig.dbStorageGb,
      // maxAllocatedStorage를 allocatedStorage와 동일하게 설정 → auto-scaling 비활성화
      // 왜? 학습용이므로 예상치 못한 비용 발생 방지
      maxAllocatedStorage: envConfig.dbStorageGb,
      multiAz: envConfig.dbMultiAz,
      // backupRetention: dev=1일, stg/prod=7일 (decisions.json에서 로드)
      backupRetention: cdk.Duration.days(envConfig.dbBackupRetentionDays),
      // deletionProtection: prod 인스턴스는 실수로 삭제되지 않도록 보호
      deletionProtection: env === 'prod',
      // removalPolicy:
      //   - prod: RETAIN — CDK stack 삭제 시에도 RDS 인스턴스와 데이터 보존
      //   - dev/stg: DESTROY — `cdk destroy`시 RDS도 함께 삭제 (개발 편의)
      removalPolicy: env === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    this.dbInstance = instance;
    // socketAddress: "host:port" 형태 (예: "hft-dev-db.xxxx.ap-northeast-1.rds.amazonaws.com:5432")
    this.dbEndpoint = instance.instanceEndpoint.socketAddress;

    // =========================================================================
    // CloudFormation Outputs
    // =========================================================================
    // 배포 후 AWS 콘솔/CLI에서 endpoint를 확인할 수 있도록 Output 생성
    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: this.dbEndpoint,
      description: 'RDS PostgreSQL endpoint (host:port). Use in DATABASE_URL.',
    });
  }
}
