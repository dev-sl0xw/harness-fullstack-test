/**
 * 파일: infra/aws-cdk/lib/network-stack.ts
 * 역할: VPC, 서브넷, 보안 그룹을 정의한다.
 * 시스템 내 위치: 모든 Stack의 기반이 되는 네트워크 인프라.
 * 관계:
 *   - DatabaseStack이 이 Stack의 vpc와 dbSecurityGroup을 사용하여 RDS를 isolated subnet에 배치
 *   - Ec2AppStack이 이 Stack의 vpc와 appSecurityGroup을 사용하여 EC2를 public subnet에 배치
 *   - ADR-0003 (EC2 + Docker Compose)의 네트워크 토대를 제공
 * 설계 의도:
 *   - Free Tier 최적화: NAT Gateway($32/월) 없음, ALB($16/월) 없음 → 네트워크 비용 $0
 *   - Public Subnet 1개 (EC2 배치 — Caddy가 TLS 처리하므로 ALB 불필요)
 *   - Isolated Subnet 1개 (RDS 배치 — 인터넷 차단으로 DB 보안 강화)
 *   - App SG와 DB SG를 분리하여 최소 권한 원칙 적용
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvConfig } from './shared/env-config';
import { resourceName } from './shared/naming';

/**
 * NetworkStack이 다른 Stack에 내보내는 리소스.
 * 이 인터페이스를 통해 다른 Stack이 참조할 수 있는 값만 명시적으로 노출한다.
 */
export interface NetworkStackOutputs {
  /** VPC 참조 — EC2, RDS 배치에 사용 */
  readonly vpc: ec2.IVpc;
  /** EC2용 보안 그룹 — HTTP(80)/HTTPS(443) 인바운드 허용 */
  readonly appSecurityGroup: ec2.ISecurityGroup;
  /** RDS용 보안 그룹 — App SG에서만 PostgreSQL(5432) 인바운드 허용 */
  readonly dbSecurityGroup: ec2.ISecurityGroup;
}

/** NetworkStack 생성 파라미터 */
export interface NetworkStackProps extends cdk.StackProps {
  /** 환경 설정 (decisions.json에서 로드) */
  readonly envConfig: EnvConfig;
}

/**
 * VPC + 서브넷 + 보안 그룹 Stack.
 *
 * 구성 요소:
 *   - VPC (CDK 기본 CIDR: 10.0.0.0/16, maxAzs=1)
 *   - Public Subnet 1개 (EC2 배치, 인터넷 게이트웨이 연결)
 *   - Isolated Subnet 1개 (RDS 배치, 인터넷 연결 없음)
 *   - App SG: 80/443 인바운드 (전체), 아웃바운드 허용
 *   - DB SG: 5432 인바운드 (App SG에서만), 아웃바운드 차단
 *
 * 서브넷 타입 설명:
 *   - PUBLIC: 인터넷 게이트웨이 경로 있음, public IP 할당 가능
 *   - PRIVATE_WITH_EGRESS: 인터넷 아웃바운드 (NAT GW 필요) — 사용 안 함 (비용)
 *   - PRIVATE_ISOLATED: 인터넷 차단 (NAT GW 없음) — RDS에 사용
 */
export class NetworkStack extends cdk.Stack implements NetworkStackOutputs {
  public readonly vpc: ec2.IVpc;
  public readonly appSecurityGroup: ec2.ISecurityGroup;
  public readonly dbSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { envConfig } = props;
    const env = envConfig.envName;

    // =========================================================================
    // VPC 생성
    // =========================================================================
    // maxAzs=1: Free Tier에서는 단일 AZ로 충분
    //   - 다중 AZ는 고가용성에 필요하지만 각 AZ당 NAT GW 또는 서브넷 비용 발생
    //   - ADR-0011: single EC2 best-effort SLA 수용
    // natGateways=0: NAT Gateway 없음
    //   - Isolated Subnet의 RDS는 아웃바운드 인터넷 연결 자체가 불필요
    //   - Public Subnet의 EC2는 인터넷 게이트웨이로 직접 아웃바운드 가능
    // subnetConfiguration: 필요한 서브넷 타입만 명시
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: resourceName(env, 'vpc'),
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        {
          // EC2 배치용 — 인터넷 게이트웨이 연결, Caddy가 80/443 수신
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          // RDS 배치용 — 인터넷 완전 차단, EC2에서만 접근
          cidrMask: 24,
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // =========================================================================
    // App Security Group (EC2용)
    // =========================================================================
    // allowAllOutbound: true — EC2가 ECR, SSM, CloudWatch 등에 접근해야 함
    // 인바운드 규칙:
    //   - 80: HTTP → Caddy가 301 리다이렉트로 HTTPS로 보냄
    //   - 443: HTTPS → Caddy가 TLS 종료 후 backend:8080으로 reverse proxy
    // SSH(22)는 허용하지 않음 — SSM Session Manager로 대체 (ADR-0005 참조)
    this.appSecurityGroup = new ec2.SecurityGroup(this, 'AppSg', {
      securityGroupName: resourceName(env, 'app-sg'),
      vpc: this.vpc,
      description: 'EC2 app instance — HTTP/HTTPS inbound',
      allowAllOutbound: true,
    });

    // HTTP(80): Caddy가 HTTPS로 리다이렉트
    this.appSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'HTTP from anywhere (Caddy redirects to HTTPS)',
    );

    // HTTPS(443): Caddy + Let\'s Encrypt TLS 종료
    this.appSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "HTTPS from anywhere (Caddy + Let's Encrypt)",
    );

    // =========================================================================
    // DB Security Group (RDS용)
    // =========================================================================
    // allowAllOutbound: false — RDS는 아웃바운드 연결 불필요
    // 인바운드 규칙:
    //   - 5432 (PostgreSQL): App SG에서만 허용
    //   → EC2(App SG)에서만 DB에 접근 가능, 인터넷에서 직접 접근 차단
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSg', {
      securityGroupName: resourceName(env, 'db-sg'),
      vpc: this.vpc,
      description: 'RDS instance — PostgreSQL from app SG only',
      allowAllOutbound: false,
    });

    // PostgreSQL(5432): App SG(EC2)에서만 접근 허용
    // Peer.securityGroupId가 아닌 SG 참조를 사용 → CDK가 자동으로 SG ID를 연결
    this.dbSecurityGroup.addIngressRule(
      this.appSecurityGroup,
      ec2.Port.tcp(5432),
      'PostgreSQL from App SG only',
    );
  }
}
