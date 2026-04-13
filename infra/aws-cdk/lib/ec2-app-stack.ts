/**
 * 파일: infra/aws-cdk/lib/ec2-app-stack.ts
 * 역할: 백엔드 API를 실행하는 EC2 인스턴스와 관련 리소스를 정의한다.
 * 시스템 내 위치: 백엔드 Docker 컨테이너를 호스팅하는 컴퓨팅 레이어.
 * 관계:
 *   - NetworkStack의 vpc와 appSecurityGroup을 Props로 받아 사용
 *   - DatabaseStack의 dbEndpoint를 User Data에서 DATABASE_URL 구성에 사용
 *   - ECR Repository에서 Docker 이미지를 pull (ECR은 이 Stack이 직접 생성)
 *   - SSM Parameter Store에서 JWT_SECRET 등 시크릿을 주입
 * 설계 의도:
 *   - EC2 + Docker Compose: 로컬 개발 환경과 동일한 구조 → 디버깅 용이 (ADR-0003)
 *   - Caddy: ALB($16/월) 대신 무료 TLS reverse proxy, Let's Encrypt 자동 갱신
 *   - Elastic IP: 인스턴스 재시작 시에도 동일 IP 유지 (인스턴스에 연결된 EIP는 무료)
 *   - User Data: 인스턴스 최초 부팅 시 자동 실행되는 초기화 스크립트
 *   - SSM Session Manager: SSH(22번) 없이 EC2 접속 가능 (ADR-0005)
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { EnvConfig } from './shared/env-config';
import { resourceName, ssmPath } from './shared/naming';

/** Ec2AppStack 생성 파라미터 */
export interface Ec2AppStackProps extends cdk.StackProps {
  /** 환경 설정 (decisions.json에서 로드) */
  readonly envConfig: EnvConfig;
  /** NetworkStack에서 전달받은 VPC */
  readonly vpc: ec2.IVpc;
  /** NetworkStack에서 전달받은 App 보안 그룹 */
  readonly appSecurityGroup: ec2.ISecurityGroup;
  /** DatabaseStack에서 전달받은 DB endpoint (host:port) */
  readonly dbEndpoint: string;
}

/**
 * EC2 App Stack — 백엔드 실행 인프라.
 *
 * 생성되는 리소스:
 *   - ECR Repository: Docker 이미지 저장소 (lifecycle: keep_last 10, untagged 7일 만료)
 *   - IAM Role: EC2 Instance Profile (SSM + ECR pull + SSM GetParameter)
 *   - SSM Parameter: JWT_SECRET placeholder (사용자가 SecureString으로 수동 전환)
 *   - EC2 Instance: t3.micro, Amazon Linux 2023
 *   - Elastic IP: 고정 IP (인스턴스 재시작 시에도 유지)
 *
 * User Data 실행 순서 (인스턴스 최초 부팅 시):
 *   1. Docker + Docker Compose plugin v2 설치
 *   2. ECR login (aws ecr get-login-password)
 *   3. SSM에서 환경변수 가져와 /opt/hft/.env 파일 생성
 *   4. /opt/hft/docker-compose.yml + Caddyfile 생성
 *   5. docker compose pull && docker compose up -d
 */
export class Ec2AppStack extends cdk.Stack {
  /** ECR Repository (GitHub Actions에서 이미지 push 시 사용) */
  public readonly ecrRepository: ecr.IRepository;
  /** EC2 인스턴스 참조 */
  public readonly instance: ec2.IInstance;

  constructor(scope: Construct, id: string, props: Ec2AppStackProps) {
    super(scope, id, props);

    const { envConfig, vpc, appSecurityGroup, dbEndpoint } = props;
    const env = envConfig.envName;

    // =========================================================================
    // ECR Repository 생성
    // =========================================================================
    // ECR(Elastic Container Registry): AWS 관리형 Docker 이미지 저장소
    // Free Tier: 500MB/월 무료 (백엔드 이미지 약 50MB → 여유 있음)
    //
    // lifecycle 정책:
    //   - keep_last 10: 최근 10개 이미지만 유지 → 스토리지 절감
    //   - untagged 7일: untagged 이미지(docker build 중간 레이어)는 7일 후 자동 삭제
    //
    // imageScanOnPush: 이미지 push 시 ECR이 자동으로 보안 취약점 스캔
    this.ecrRepository = new ecr.Repository(this, 'EcrRepo', {
      repositoryName: resourceName(env, 'backend'),
      lifecycleRules: [
        {
          // TagStatus.UNTAGGED: 먼저 낮은 우선순위 번호(1)로 설정
          // ECR 규칙: TagStatus.ANY는 가장 높은 우선순위 번호를 가져야 함
          description: 'untagged 이미지 7일 후 삭제',
          maxImageAge: cdk.Duration.days(7),
          rulePriority: 1,
          tagStatus: ecr.TagStatus.UNTAGGED,
        },
        {
          // TagStatus.ANY: 가장 높은 우선순위 번호(2)를 가져야 함
          description: '최근 10개 이미지만 유지 (스토리지 절감)',
          maxImageCount: 10,
          rulePriority: 2,
          tagStatus: ecr.TagStatus.ANY,
        },
      ],
      imageScanOnPush: true,
      removalPolicy: env === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // =========================================================================
    // IAM Role 생성 (EC2 Instance Profile)
    // =========================================================================
    // EC2 인스턴스가 AWS 서비스에 접근하기 위한 역할.
    // 자격증명(Access Key)을 EC2에 직접 저장하지 않고 IAM Role로 권한 부여 (보안 모범 사례)
    //
    // AmazonSSMManagedInstanceCore: SSM Session Manager 접속 허용 (SSH 대체)
    // ECR pull: 이미지 다운로드 (ecrRepository.grantPull()으로 부여)
    // SSM GetParameter: /hft/{env}/* 경로 시크릿 읽기 (환경별 격리)
    const role = new iam.Role(this, 'Ec2Role', {
      roleName: resourceName(env, 'ec2-role'),
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        // SSM Session Manager: 22번 포트(SSH) 없이 EC2에 접속 가능
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        // CloudWatch Agent: EC2에서 CloudWatch로 로그/메트릭 전송
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // ECR에서 이미지 pull 권한 (ecr:GetAuthorizationToken + ecr:BatchGetImage 등)
    this.ecrRepository.grantPull(role);

    // SSM Parameter 읽기 권한 (환경별 격리 — dev 인스턴스가 prod 시크릿 접근 방지)
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParametersByPath'],
      resources: [
        `arn:aws:ssm:${envConfig.region}:${this.account}:parameter/hft/${env}/*`,
      ],
    }));

    // =========================================================================
    // SSM Parameter Placeholder 생성
    // =========================================================================
    // CDK의 제약: StringParameter만 생성 가능, SecureString은 생성 불가 (AWS API 제한)
    // 워크플로우 (ADR-0005):
    //   1. CDK가 String placeholder 생성 (값: 'REPLACE_ME_WITH_SECURE_STRING')
    //   2. 배포 후 사용자가 수동으로 SecureString으로 교체:
    //      aws ssm put-parameter --name "/hft/prod/JWT_SECRET" --value "실제값" --type SecureString --overwrite
    new ssm.StringParameter(this, 'JwtSecretPlaceholder', {
      parameterName: ssmPath(env, 'JWT_SECRET'),
      stringValue: 'REPLACE_ME_WITH_SECURE_STRING',
      description: '⚠️ CDK placeholder. 배포 후 SecureString으로 수동 전환 필수 (ADR-0005 참조)',
    });

    // =========================================================================
    // EC2 User Data 스크립트
    // =========================================================================
    // User Data: EC2 인스턴스 최초 부팅 시 root 권한으로 자동 실행되는 스크립트.
    // 한 번만 실행됨 (재부팅 시 재실행 안 됨 — 재실행하려면 별도 설정 필요)
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'set -euxo pipefail',
      '# set -e: 에러 발생 시 즉시 종료, -u: 미정의 변수 사용 시 에러, -x: 명령 출력, -o pipefail: 파이프 에러 감지',
      '',
      '# === 1. Docker + Docker Compose v2 설치 ===',
      '# AL2023(Amazon Linux 2023): dnf 패키지 매니저 사용 (yum 대체)',
      'dnf install -y docker git',
      'systemctl enable --now docker',
      '# ec2-user를 docker 그룹에 추가 → sudo 없이 docker 명령 사용',
      'usermod -aG docker ec2-user',
      '',
      '# Docker Compose plugin v2 설치',
      '# v2는 "docker compose" 명령 (하이픈 없음), v1의 "docker-compose" 대체',
      'DOCKER_COMPOSE_VERSION="v2.27.0"',
      'mkdir -p /usr/local/lib/docker/cli-plugins',
      'curl -SL "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" \\',
      '  -o /usr/local/lib/docker/cli-plugins/docker-compose',
      'chmod +x /usr/local/lib/docker/cli-plugins/docker-compose',
      '',
      '# === 2. ECR Login ===',
      `REGION="${envConfig.region}"`,
      `ECR_REPO="${this.ecrRepository.repositoryUri}"`,
      '# ECR_REGISTRY: "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com" 형태',
      'ECR_REGISTRY=$(echo $ECR_REPO | cut -d/ -f1)',
      'aws ecr get-login-password --region $REGION | \\',
      '  docker login --username AWS --password-stdin $ECR_REGISTRY',
      '',
      '# === 3. SSM에서 환경변수 가져와 .env 파일 생성 ===',
      '# ADR-0005: SSM Parameter Store에서 시크릿 주입',
      '# 12-factor Factor III(Config): 환경변수로 설정 관리',
      'mkdir -p /opt/hft',
      `ENV_NAME="${env}"`,
      `DB_ENDPOINT="${dbEndpoint}"`,
      '',
      '# SSM GetParametersByPath로 /hft/{env}/ 하위 모든 파라미터 가져오기',
      '# --with-decryption: SecureString도 복호화하여 가져옴',
      '# --output text: "이름\t값" 탭 구분 형태로 출력',
      `aws ssm get-parameters-by-path --path "/hft/${env}/" --region $REGION --with-decryption \\`,
      '  --query "Parameters[*].[Name,Value]" --output text | \\',
      "  while IFS=$'\\t' read -r name value; do",
      '    key=$(basename "$name")',
      '    echo "${key}=${value}"',
      '  done > /opt/hft/.env',
      '',
      '# 비-시크릿 환경변수 추가 (SSM에 저장할 필요 없는 값)',
      'echo "PORT=8080" >> /opt/hft/.env',
      'echo "GIN_MODE=release" >> /opt/hft/.env',
      '# DB_PASSWORD는 SSM에서 가져온 .env에서 참조됨',
      `echo "DATABASE_URL=postgres://harness:\${DB_PASSWORD}@${dbEndpoint}/harness?sslmode=require" >> /opt/hft/.env`,
      '',
      '# === 4. docker-compose.yml 배치 ===',
      "cat > /opt/hft/docker-compose.yml << 'COMPOSE_EOF'",
      'services:',
      '  backend:',
      `    image: ${this.ecrRepository.repositoryUri}:latest`,
      '    env_file: .env',
      '    ports:',
      '      - "8080:8080"',
      '    restart: unless-stopped',
      '    healthcheck:',
      '      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/api/health"]',
      '      interval: 30s',
      '      timeout: 5s',
      '      retries: 3',
      '',
      '  caddy:',
      '    image: caddy:2-alpine',
      '    ports:',
      '      - "80:80"',
      '      - "443:443"',
      '    volumes:',
      '      - ./Caddyfile:/etc/caddy/Caddyfile',
      '      - caddy_data:/data',
      '      - caddy_config:/config',
      '    restart: unless-stopped',
      '    depends_on:',
      '      - backend',
      '',
      'volumes:',
      '  caddy_data:',
      '  caddy_config:',
      'COMPOSE_EOF',
      '',
      '# === 5. Caddyfile 생성 ===',
      '# dev 환경: IP 직접 접근 (TLS 없음) → :80에서 HTTP로 서빙',
      '# stg/prod 환경: Let\'s Encrypt 자동 TLS → 도메인 필요',
      "cat > /opt/hft/Caddyfile << 'CADDY_EOF'",
      envConfig.tlsCert === 'lets-encrypt'
        ? `:443 {\n  reverse_proxy backend:8080\n}`
        : `:80 {\n  reverse_proxy backend:8080\n}`,
      'CADDY_EOF',
      '',
      '# === 6. Docker Compose 실행 ===',
      'cd /opt/hft',
      '# ECR에서 최신 이미지 pull',
      'docker compose pull',
      '# 백그라운드로 컨테이너 시작 (-d: detach)',
      'docker compose up -d',
      '',
      'echo "=== User Data 완료 ==="',
    );

    // =========================================================================
    // EC2 Instance 생성
    // =========================================================================
    // Amazon Linux 2023: AWS 권장 최신 LTS AMI
    //   - AL2의 후속, RHEL9 기반, 기본 containerd 지원
    //   - 5년 지원 주기 (2028년까지)
    const machineImage = ec2.MachineImage.latestAmazonLinux2023({
      cpuType: ec2.AmazonLinuxCpuType.X86_64,
    });

    // t3.micro: 2 vCPU, 1GB RAM, Free Tier 750시간/월 (12개월)
    const instance = new ec2.Instance(this, 'AppInstance', {
      instanceName: resourceName(env, 'app'),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage,
      vpc,
      // PUBLIC subnet: Caddy가 인터넷에서 직접 80/443 수신
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: appSecurityGroup,
      role,
      userData,
      // userDataCausesReplacement: false → User Data 변경 시 인스턴스 교체 안 함
      // true로 설정 시 User Data가 바뀌면 새 인스턴스 생성 → 기존 데이터 손실 위험
      userDataCausesReplacement: false,
    });

    this.instance = instance;

    // =========================================================================
    // Elastic IP 연결
    // =========================================================================
    // 인스턴스에 연결된 EIP는 무료 (연결 안 된 EIP만 $0.005/시간 과금)
    // 인스턴스 재시작 시에도 동일 IP 유지 → Route 53 A 레코드 변경 불필요
    const eip = new ec2.CfnEIP(this, 'Eip', {
      instanceId: instance.instanceId,
      tags: [{ key: 'Name', value: resourceName(env, 'eip') }],
    });

    // =========================================================================
    // CloudFormation Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'ElasticIp', {
      value: eip.attrPublicIp,
      description: 'EC2 Elastic IP (고정 IP — Route 53 A Record에 사용)',
    });
    new cdk.CfnOutput(this, 'EcrRepoUri', {
      value: this.ecrRepository.repositoryUri,
      description: 'ECR repo URI (docker push 시 사용)',
    });
    new cdk.CfnOutput(this, 'InstanceId', {
      value: instance.instanceId,
      description: 'EC2 instance ID (SSM Session Manager로 접속 시 사용)',
    });
  }
}
