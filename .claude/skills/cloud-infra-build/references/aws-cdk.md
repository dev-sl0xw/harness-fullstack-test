---
status: detailed
cloud: aws
iac: cdk
language: typescript
---

# AWS + CDK (TypeScript) Reference

> cloud-infra-dev 가 AWS + CDK 조합으로 EC2 Docker Compose 기반 Free Tier 인프라를
> 구현할 때 따르는 상세 가이드. decisions.json 의 `cloud_infra_dev.skill_refs` 에
> `references/aws-cdk.md` 가 포함된 경우 이 파일을 로드한다.

---

## 1. CDK 프로젝트 scaffold

`infra/aws-cdk/` 디렉토리에 다음 구조를 생성한다:

```
infra/aws-cdk/
├── bin/
│   └── app.ts          # CDK app 진입점
├── lib/
│   ├── network-stack.ts
│   ├── database-stack.ts
│   ├── ec2-app-stack.ts
│   ├── frontend-stack.ts
│   └── observability-stack.ts
├── shared/
│   ├── env-config.ts   # decisions.json 파싱 + EnvConfig 타입
│   ├── guards.ts       # 허용 리전 검증
│   ├── tags.ts         # 공통 태그 전파
│   └── naming.ts      # 리소스 이름 생성 규칙
├── test/
│   └── prod-snapshot.test.ts
├── .github/
│   └── workflows/
│       └── deploy-aws.yml
├── cdk.json
├── package.json
├── tsconfig.json
└── README.md
```

### `package.json` 템플릿

```json
{
  "name": "hft-infra-aws-cdk",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build":       "tsc",
    "test":        "jest",
    "synth:dev":   "cdk synth --context env=dev",
    "synth:stg":   "cdk synth --context env=stg",
    "synth:prod":  "cdk synth --context env=prod",
    "synth:all":   "npm run synth:dev && npm run synth:stg && npm run synth:prod"
  },
  "dependencies": {
    "aws-cdk-lib": "^2.150.0",
    "constructs":  "^10.0.0"
  },
  "devDependencies": {
    "aws-cdk":        "^2.150.0",
    "jest":           "^29.0.0",
    "ts-jest":        "^29.0.0",
    "typescript":     "^5.4.0",
    "@types/node":    "^20.0.0",
    "@types/jest":    "^29.0.0"
  }
}
```

### `cdk.json` 템플릿

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/app.ts",
  "context": {
    "env": "dev",
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "@aws-cdk/core:enablePartitionLiterals": true
  }
}
```

### `tsconfig.json` 템플릿

```json
{
  "compilerOptions": {
    "target":            "ES2020",
    "module":            "commonjs",
    "lib":               ["es2020"],
    "strict":            true,
    "esModuleInterop":   true,
    "skipLibCheck":      true,
    "outDir":            "dist",
    "declaration":       true,
    "resolveJsonModule": true
  },
  "include": ["bin", "lib", "shared", "test"],
  "exclude": ["node_modules", "dist", "cdk.out"]
}
```

---

## 2. Stack 분리 원칙 (5 Stack)

관심사 분리와 변경 격리를 위해 5개 Stack 으로 나눈다. 각 Stack 은 독립적으로
deploy/destroy 가능하며, 의존성 방향은 단방향이다.

| Stack | 책임 | 의존 |
|-------|------|------|
| NetworkStack | VPC, Subnet, SecurityGroup | 없음 |
| DatabaseStack | RDS, SSM Parameter | NetworkStack |
| Ec2AppStack | ECR, IAM, EC2, EIP, Route53 | NetworkStack |
| FrontendStack | S3, CloudFront | Ec2AppStack (EIP) |
| ObservabilityStack | CloudWatch Log Groups | 없음 |

**배포 순서**: Network → Database → Ec2App → Frontend → Observability

---

## 3. `bin/app.ts` 구조

```typescript
/**
 * bin/app.ts
 *
 * 역할: CDK app 의 진입점. 5개 Stack 을 조립하고 공통 태그를 전파한다.
 * 위치: infra/aws-cdk/bin/app.ts
 * 관계: shared/env-config.ts → decisions.json 파싱
 *       shared/guards.ts → 허용 리전 검증
 *       shared/tags.ts → 공통 태그 전파
 *       lib/*.ts → 각 Stack 구현
 *
 * 호출 흐름: cdk synth/deploy → bin/app.ts → Stack 조립 → app.synth()
 */
import * as cdk from 'aws-cdk-lib';
import { loadDecisions, resolveEnvConfig } from '../shared/env-config';
import { assertAllowedRegion } from '../shared/guards';
import { applyCommonTags } from '../shared/tags';
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';
import { Ec2AppStack } from '../lib/ec2-app-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { ObservabilityStack } from '../lib/observability-stack';

// CDK app 초기화
const app = new cdk.App();

// 1단계: context 에서 배포 환경 읽기 (--context env=dev|stg|prod)
const env = app.node.tryGetContext('env') ?? 'dev';

// 2단계: decisions.json 파싱 → 전체 설계 결정 로드
const decisions = loadDecisions();

// 3단계: 환경별 설정 추출 (region, account, instance type 등)
const envConfig = resolveEnvConfig(decisions, env);

// 4단계: 허용 리전 검증 (ap-northeast-1, ap-northeast-3, us-east-1)
assertAllowedRegion(envConfig.region, decisions.allowed_regions);

// 5단계: CDK env 객체 (account + region)
const cdkEnv: cdk.Environment = {
  account: envConfig.account,
  region: envConfig.region,
};

// 6단계: Stack 조립 (의존성 순서 엄수)
const networkStack = new NetworkStack(app, `hft-${env}-network`, {
  env: cdkEnv,
  envConfig,
});

const databaseStack = new DatabaseStack(app, `hft-${env}-database`, {
  env: cdkEnv,
  envConfig,
  vpc: networkStack.vpc,
  dbSg: networkStack.dbSg,
});

const ec2AppStack = new Ec2AppStack(app, `hft-${env}-ec2app`, {
  env: cdkEnv,
  envConfig,
  vpc: networkStack.vpc,
  appSg: networkStack.appSg,
});

new FrontendStack(app, `hft-${env}-frontend`, {
  env: cdkEnv,
  envConfig,
  ec2ElasticIp: ec2AppStack.elasticIp,
});

new ObservabilityStack(app, `hft-${env}-observability`, {
  env: cdkEnv,
  envConfig,
});

// 7단계: 공통 태그 전파 (app 레벨 → 모든 리소스에 적용)
applyCommonTags(app, env);

// 8단계: CloudFormation 템플릿 합성
app.synth();
```

---

## 4. `shared/env-config.ts` 패턴

```typescript
/**
 * shared/env-config.ts
 *
 * 역할: decisions.json 을 파싱하여 환경별 설정을 제공한다.
 * 위치: infra/aws-cdk/shared/env-config.ts
 * 관계: bin/app.ts 에서 호출, decisions.json 을 입력으로 사용
 *
 * 설계 의도: IaC 코드에 하드코딩 없이 단일 소스(decisions.json)에서
 *   모든 환경별 파라미터를 읽는다. 환경 추가 시 JSON 만 수정하면 된다.
 */
import * as fs from 'fs';
import * as path from 'path';

/** decisions.json 의 per_environment 항목 하나에 매핑되는 타입 */
export interface EnvConfig {
  /** 배포 환경 이름 (dev | stg | prod) */
  env:          string;
  /** AWS account ID */
  account:      string;
  /** 주 배포 리전 (ap-northeast-1 등) */
  region:       string;
  /** EC2 instance type (t2.micro 등 Free Tier 대상) */
  instanceType: string;
  /** EC2 키페어 이름 (optional — SSM Session Manager 를 선호하면 생략) */
  keyPairName?: string;
  /** Route53 호스팅 영역 ID (optional — 없으면 Route53 레코드 미생성) */
  hostedZoneId?: string;
  /** 서비스 도메인 (예: dev.hft.example.com) */
  domain?:      string;
  /** CloudWatch 로그 보존 기간 (일, dev=7 / stg=30 / prod=90) */
  logRetentionDays: number;
  /** RDS instance type (db.t3.micro 등) */
  dbInstanceType: string;
  /** RDS 할당 스토리지 (GiB) */
  dbAllocatedStorageGiB: number;
}

/** decisions.json 전체 구조의 최소 타입 */
interface Decisions {
  allowed_regions: string[];
  per_environment: Record<string, Partial<EnvConfig>>;
  [key: string]: unknown;
}

/**
 * decisions.json 을 로드하여 파싱한다.
 *
 * @returns Decisions 객체
 * @throws 파일이 없거나 JSON 파싱 실패 시 오류
 */
export function loadDecisions(): Decisions {
  // decisions.json 경로: infra/aws-cdk/ 에서 두 단계 상위 (프로젝트 루트)
  const filePath = path.resolve(__dirname, '..', '..', '..', 'decisions.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`decisions.json 이 없습니다: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Decisions;
}

/**
 * decisions.json 에서 특정 환경의 설정을 추출하고 기본값을 채운다.
 *
 * @param decisions loadDecisions() 반환값
 * @param env       배포 환경 이름 (dev | stg | prod)
 * @returns EnvConfig 객체
 * @throws env 가 per_environment 에 없으면 오류
 */
export function resolveEnvConfig(decisions: Decisions, env: string): EnvConfig {
  const perEnv = decisions.per_environment?.[env];
  if (!perEnv) {
    throw new Error(
      `decisions.json 의 per_environment 에 '${env}' 가 없습니다. ` +
      `사용 가능한 환경: ${Object.keys(decisions.per_environment ?? {}).join(', ')}`
    );
  }

  // 기본값을 설정하고 per_environment 값으로 덮어쓴다
  return {
    env,
    account:               perEnv.account          ?? process.env.CDK_DEFAULT_ACCOUNT ?? '',
    region:                perEnv.region            ?? process.env.CDK_DEFAULT_REGION  ?? 'ap-northeast-1',
    instanceType:          perEnv.instanceType      ?? 't2.micro',
    keyPairName:           perEnv.keyPairName,
    hostedZoneId:          perEnv.hostedZoneId,
    domain:                perEnv.domain,
    logRetentionDays:      perEnv.logRetentionDays  ?? (env === 'prod' ? 90 : env === 'stg' ? 30 : 7),
    dbInstanceType:        perEnv.dbInstanceType    ?? 'db.t3.micro',
    dbAllocatedStorageGiB: perEnv.dbAllocatedStorageGiB ?? 20,
  };
}
```

---

## 5. `shared/guards.ts`

```typescript
/**
 * shared/guards.ts
 *
 * 역할: CDK synth 전에 잘못된 리전/설정을 조기에 탐지하는 가드 함수 모음.
 * 위치: infra/aws-cdk/shared/guards.ts
 * 관계: bin/app.ts 에서 호출
 *
 * 설계 의도: 비용이 큰 실수(잘못된 리전 배포)를 synth 시점에 차단한다.
 */

/**
 * 리전이 허용 목록에 있는지 검증한다.
 *
 * @param region  배포 리전 문자열 (예: "ap-northeast-1")
 * @param allowed decisions.json 의 allowed_regions 배열
 * @throws 허용되지 않은 리전이면 오류 발생 → synth 중단
 */
export function assertAllowedRegion(region: string, allowed: string[]): void {
  if (!allowed.includes(region)) {
    throw new Error(
      `Region '${region}' is not in allowed list: ${allowed.join(', ')}.`
    );
  }
}
```

---

## 6. `shared/tags.ts`

```typescript
/**
 * shared/tags.ts
 *
 * 역할: 모든 CDK 리소스에 공통 태그를 전파하는 헬퍼.
 * 위치: infra/aws-cdk/shared/tags.ts
 * 관계: bin/app.ts 에서 app 레벨에 한 번 호출하면 모든 Stack 에 적용된다.
 *
 * 설계 의도: 태그를 각 Stack 에 개별 설정하면 누락 위험이 있다.
 *   app 레벨 Tags.of(app) 으로 한 번만 설정하여 일관성을 보장한다.
 */
import { App, Tags } from 'aws-cdk-lib';

/**
 * CDK app 전체에 공통 태그를 적용한다.
 *
 * @param app CDK App 인스턴스
 * @param env 배포 환경 이름 (dev | stg | prod)
 */
export function applyCommonTags(app: App, env: string): void {
  // 프로젝트 식별자 (비용 분석, 리소스 그룹핑에 사용)
  Tags.of(app).add('Project',     'hft');
  // 환경 식별자 (dev/stg/prod 필터링에 사용)
  Tags.of(app).add('Environment', env);
  // 이 리소스가 CDK 로 관리됨을 명시 (수동 변경 경고 용)
  Tags.of(app).add('ManagedBy',   'cdk');
  // 이 리소스를 생성한 에이전트/팀 (운영 책임 명확화)
  Tags.of(app).add('Owner',       'cloud-infra-dev');
}
```

---

## 7. `shared/naming.ts`

```typescript
/**
 * shared/naming.ts
 *
 * 역할: 리소스 이름을 일관된 규칙으로 생성하는 헬퍼.
 * 위치: infra/aws-cdk/shared/naming.ts
 * 관계: 모든 Stack 에서 리소스 이름 생성 시 호출
 *
 * 설계 의도: 이름 규칙을 한 곳에서 관리하여 환경 간 충돌과 오해를 방지한다.
 *   규칙: hft-{env}-{role} (예: hft-prod-ec2, hft-dev-vpc)
 */

/**
 * 리소스 이름을 생성한다.
 *
 * @param env  배포 환경 (dev | stg | prod)
 * @param role 리소스 역할 (ec2, vpc, rds, s3 등)
 * @returns 리소스 이름 문자열 (예: "hft-prod-ec2")
 */
export function resourceName(env: string, role: string): string {
  return `hft-${env}-${role}`;
}
```

---

## 8. NetworkStack 패턴

```typescript
/**
 * lib/network-stack.ts
 *
 * 역할: VPC, Subnet, SecurityGroup 을 정의한다.
 * 위치: infra/aws-cdk/lib/network-stack.ts
 * 관계: DatabaseStack, Ec2AppStack 이 vpc/appSg/dbSg 를 import 하여 사용
 *
 * 설계 의도: NAT Gateway 와 ALB 를 의도적으로 제거하여 월 $48 절감.
 *   Free Tier 목표에서는 EC2 에 Elastic IP 를 직접 부착하여 public 접근을 처리한다.
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvConfig } from '../shared/env-config';
import { resourceName } from '../shared/naming';

interface NetworkStackProps extends cdk.StackProps {
  envConfig: EnvConfig;
}

export class NetworkStack extends cdk.Stack {
  /** 다른 Stack 에서 참조하는 VPC */
  public readonly vpc: ec2.IVpc;
  /** EC2 에 적용되는 SecurityGroup (80/443 인바운드 허용) */
  public readonly appSg: ec2.SecurityGroup;
  /** RDS 에 적용되는 SecurityGroup (appSg 에서만 5432 허용) */
  public readonly dbSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);
    const { envConfig } = props;
    const env = envConfig.env;

    // VPC 생성: public subnet 1개 + isolated subnet 1개, NAT 없음
    // NAT Gateway 를 사용하지 않아 월 ~$32 절감
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: resourceName(env, 'vpc'),
      maxAzs: 2,
      natGateways: 0, // Free Tier: NAT 없음
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // App SecurityGroup: 인터넷에서 80/443 인바운드 허용
    this.appSg = new ec2.SecurityGroup(this, 'AppSg', {
      vpc: this.vpc,
      securityGroupName: resourceName(env, 'app-sg'),
      description: 'EC2 app server: allow HTTP/HTTPS from internet',
      allowAllOutbound: true,
    });
    this.appSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80),  'HTTP');
    this.appSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');

    // DB SecurityGroup: appSg 에서만 5432 (PostgreSQL) 허용
    // 설계 의도: DB 를 인터넷에 직접 노출하지 않아 보안 강화
    this.dbSg = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: this.vpc,
      securityGroupName: resourceName(env, 'db-sg'),
      description: 'RDS: allow PostgreSQL only from app SG',
      allowAllOutbound: false,
    });
    this.dbSg.addIngressRule(
      ec2.Peer.securityGroupId(this.appSg.securityGroupId),
      ec2.Port.tcp(5432), // TODO: MySQL 선택 시 3306 으로 변경
      'PostgreSQL from app'
    );
  }
}
```

---

## 9. DatabaseStack 패턴

```typescript
/**
 * lib/database-stack.ts
 *
 * 역할: RDS 인스턴스와 SSM Parameter Store credential placeholder 를 생성한다.
 * 위치: infra/aws-cdk/lib/database-stack.ts
 * 관계: NetworkStack 의 vpc/dbSg 를 props 로 수신
 *
 * 설계 의도: DB engine 은 TBD 로 표시하고, 확정 시 engine prop 만 변경한다.
 *   SSM Parameter 는 placeholder 로 생성하고 실제 값은 배포 후 수동 또는
 *   Secrets Manager rotation 으로 채운다.
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { EnvConfig } from '../shared/env-config';
import { resourceName } from '../shared/naming';

interface DatabaseStackProps extends cdk.StackProps {
  envConfig: EnvConfig;
  vpc:   ec2.IVpc;
  dbSg:  ec2.SecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  /** 다른 Stack 에서 참조할 수 있는 RDS 주 인스턴스 */
  public readonly primaryInstance: rds.DatabaseInstance;
  /** DB 엔드포인트 주소 (SSM Parameter 참조) */
  public readonly dbEndpoint: string;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);
    const { envConfig } = props;
    const env = envConfig.env;

    // TODO: engine 확정 시 변경 — PostgreSQL 또는 MySQL 중 하나를 선택한다.
    // PostgreSQL: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 })
    // MySQL:      rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 })
    const engine = rds.DatabaseInstanceEngine.postgres({
      version: rds.PostgresEngineVersion.VER_16, // TODO: engine 확정 시 변경
    });

    // RDS 단일 인스턴스 (Free Tier: db.t3.micro, 단일 AZ)
    // 설계 의도: Multi-AZ 는 비용이 2배이므로 MVP 단계에서는 단일 인스턴스 사용
    this.primaryInstance = new rds.DatabaseInstance(this, 'DbInstance', {
      instanceIdentifier: resourceName(env, 'db'),
      engine,
      instanceType:    ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      vpc:             props.vpc,
      vpcSubnets:      { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups:  [props.dbSg],
      allocatedStorage: envConfig.dbAllocatedStorageGiB,
      // 멀티 AZ 없음 (Free Tier 유지)
      multiAz:         false,
      // 자동 백업 보존 (prod 7일 / dev-stg 1일)
      backupRetention: cdk.Duration.days(env === 'prod' ? 7 : 1),
      // 삭제 보호 (prod 만 활성화)
      deletionProtection: env === 'prod',
    });

    this.dbEndpoint = this.primaryInstance.instanceEndpoint.hostname;

    // SSM Parameter: DB endpoint placeholder (EC2 User Data 에서 참조)
    new ssm.StringParameter(this, 'DbEndpointParam', {
      parameterName: `/hft/${env}/db/endpoint`,
      stringValue:   this.dbEndpoint,
      description:   `RDS endpoint for ${env}`,
    });

    // SSM Parameter: DB password placeholder (초기값은 PLACEHOLDER — 배포 후 수동 교체)
    // 설계 의도: IaC 코드에 평문 비밀번호를 절대 포함하지 않는다.
    //   실제 비밀번호는 배포 후 AWS Console 또는 CLI 로 수동 설정한다.
    new ssm.StringParameter(this, 'DbPasswordParam', {
      parameterName: `/hft/${env}/db/password`,
      stringValue:   'PLACEHOLDER__CHANGE_AFTER_DEPLOY',
      description:   `RDS password for ${env} — MUST be changed after first deploy`,
    });
  }
}
```

---

## 10. Ec2AppStack 패턴

EC2 App Stack 은 ECR, IAM Role, Launch Template, EC2 인스턴스, Elastic IP, Route53
레코드를 포함한다.

```typescript
/**
 * lib/ec2-app-stack.ts
 *
 * 역할: 백엔드 애플리케이션을 실행하는 EC2 인프라를 정의한다.
 * 위치: infra/aws-cdk/lib/ec2-app-stack.ts
 * 관계: NetworkStack 의 vpc/appSg 를 props 로 수신
 *       FrontendStack 이 elasticIp 를 읽어 CloudFront origin 으로 사용
 *
 * 설계 의도: ECS Fargate 대신 EC2 + Docker Compose 를 사용하여
 *   Free Tier (t2.micro) 를 최대한 활용한다. ALB 없음 ($16/월 절감).
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { EnvConfig } from '../shared/env-config';
import { resourceName } from '../shared/naming';

interface Ec2AppStackProps extends cdk.StackProps {
  envConfig: EnvConfig;
  vpc:   ec2.IVpc;
  appSg: ec2.SecurityGroup;
}

export class Ec2AppStack extends cdk.Stack {
  /** FrontendStack 에서 CloudFront origin 으로 사용하는 Elastic IP 주소 */
  public readonly elasticIp: string;

  constructor(scope: Construct, id: string, props: Ec2AppStackProps) {
    super(scope, id, props);
    const { envConfig } = props;
    const env = envConfig.env;
    const region = envConfig.region;
    const account = this.account;

    // ECR Repository: Docker 이미지를 저장한다. lifecycle 로 이미지 10개만 유지.
    const ecrRepo = new ecr.Repository(this, 'EcrRepo', {
      repositoryName: resourceName(env, 'backend'),
      lifecycleRules: [{
        description: '최신 10개 이미지만 유지 (비용 절감)',
        maxImageCount: 10,
      }],
      // prod 외 환경은 삭제 허용 (실험/재구축 편의)
      removalPolicy: env === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // IAM Role: EC2 인스턴스에 부여하는 권한
    // 설계 의도: 최소 권한 원칙. SSM Session Manager 로 SSH 없이 접속하고,
    //   ECR pull 과 SSM Parameter 읽기만 허용한다.
    const instanceRole = new iam.Role(this, 'InstanceRole', {
      roleName: resourceName(env, 'ec2-role'),
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        // SSM Session Manager 접속 (SSH 키 불필요)
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        // CloudWatch 에이전트 (로그 전송)
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // ECR pull 권한 (최소 권한: ecr:GetAuthorizationToken + 이미지 pull 3개 작업)
    instanceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchGetImage',
        'ecr:GetDownloadUrlForLayer',
      ],
      resources: ['*'],
    }));

    // SSM Parameter 읽기 (이 환경의 /hft/{env}/* 경로만 허용)
    instanceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
      resources: [`arn:aws:ssm:${region}:${account}:parameter/hft/${env}/*`],
    }));

    // User Data 스크립트: EC2 초기 부팅 시 Docker 및 앱 설치
    // 전체 스크립트는 아래 "User Data 전체 스크립트" 섹션 참조
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'set -eux',

      // 시스템 업데이트
      'dnf update -y',
      'dnf install -y docker git',
      'systemctl enable --now docker',
      'usermod -aG docker ec2-user',

      // Docker Compose v2 plugin 설치
      'mkdir -p /usr/local/lib/docker/cli-plugins',
      `curl -SL https://github.com/docker/compose/releases/download/v2.29.0/docker-compose-linux-x86_64 \\`,
      `  -o /usr/local/lib/docker/cli-plugins/docker-compose`,
      'chmod +x /usr/local/lib/docker/cli-plugins/docker-compose',

      // ECR 로그인 (IAM Role 권한 사용)
      `aws ecr get-login-password --region ${region} | \\`,
      `  docker login --username AWS --password-stdin ${account}.dkr.ecr.${region}.amazonaws.com`,

      // 앱 디렉토리 생성
      'mkdir -p /opt/hft && cd /opt/hft',

      // docker-compose.yml 을 SSM Parameter 에서 가져오기
      // 설계 의도: compose 파일을 SSM 에 보관하여 IaC 재배포 없이 업데이트 가능
      `aws ssm get-parameter --region ${region} \\`,
      `  --name /hft/${env}/compose/main \\`,
      '  --query Parameter.Value --output text > docker-compose.yml',

      // 환경변수 파일 생성 (minimal — secret 은 SSM 에서 직접 읽음)
      'cat > .env <<ENVEOF',
      `APP_ENV=${env}`,
      `AWS_REGION=${region}`,
      'ENVEOF',

      // 앱 시작
      'docker compose pull && docker compose up -d',
    );

    // Launch Template: EC2 인스턴스 시작 구성
    const launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
      launchTemplateName: resourceName(env, 'lt'),
      instanceType: new ec2.InstanceType(envConfig.instanceType),
      // AL2023 AMI (x86_64) — dnf 패키지 매니저 사용
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      userData,
      role: instanceRole,
      securityGroup: props.appSg,
    });

    // EC2 인스턴스 (CfnInstance 사용 — L2 Instance 보다 세밀한 제어 가능)
    const instance = new ec2.CfnInstance(this, 'AppInstance', {
      launchTemplate: {
        launchTemplateId: launchTemplate.launchTemplateId,
        version: launchTemplate.latestVersionNumber,
      },
      subnetId: props.vpc.publicSubnets[0].subnetId,
      tags: [{ key: 'Name', value: resourceName(env, 'ec2') }],
    });

    // Elastic IP: 인스턴스에 고정 IP 부착
    // 설계 의도: 인스턴스를 재시작해도 IP 가 바뀌지 않아 DNS 변경 없이 운영 가능
    const eip = new ec2.CfnEIP(this, 'ElasticIp', {
      domain: 'vpc',
      instanceId: instance.ref,
      tags: [{ key: 'Name', value: resourceName(env, 'eip') }],
    });
    this.elasticIp = eip.attrPublicIp;

    // Route53 A 레코드 (hostedZoneId 가 있을 때만 생성)
    if (envConfig.hostedZoneId && envConfig.domain) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
        this, 'HostedZone',
        {
          hostedZoneId: envConfig.hostedZoneId,
          zoneName:     envConfig.domain,
        }
      );
      new route53.ARecord(this, 'AliasRecord', {
        zone:       hostedZone,
        recordName: envConfig.domain,
        target:     route53.RecordTarget.fromIpAddresses(eip.attrPublicIp),
      });
    }

    // CloudFormation Output: 배포 후 확인에 필요한 값
    new cdk.CfnOutput(this, 'ElasticIpOutput',  { value: eip.attrPublicIp, exportName: `hft-${env}-eip` });
    new cdk.CfnOutput(this, 'EcrRepoUriOutput', { value: ecrRepo.repositoryUri });
    new cdk.CfnOutput(this, 'InstanceIdOutput', { value: instance.ref });
  }
}
```

---

## 11. FrontendStack 패턴

```typescript
/**
 * lib/frontend-stack.ts
 *
 * 역할: S3 정적 호스팅 + CloudFront 배포를 정의한다.
 * 위치: infra/aws-cdk/lib/frontend-stack.ts
 * 관계: Ec2AppStack.elasticIp 를 CloudFront API origin 으로 사용
 *
 * 설계 의도: ALB 없이 CloudFront 에서 EC2 EIP 로 직접 프록시하여 비용 절감.
 *   PriceClass_100 (북미+유럽)으로 제한하여 CloudFront 비용 최소화.
 */
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import { EnvConfig } from '../shared/env-config';
import { resourceName } from '../shared/naming';

interface FrontendStackProps extends cdk.StackProps {
  envConfig:    EnvConfig;
  ec2ElasticIp: string;
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);
    const { envConfig, ec2ElasticIp } = props;
    const env = envConfig.env;

    // S3 버킷: React 빌드 산출물 저장 (public access 완전 차단)
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName:         resourceName(env, 'frontend'),
      blockPublicAccess:  s3.BlockPublicAccess.BLOCK_ALL,
      // OAC 로만 접근 — 직접 S3 URL 접근 불가
      removalPolicy:      env === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects:  env !== 'prod',
    });

    // OAC: CloudFront 가 S3 에 안전하게 접근하기 위한 인증 방식
    const oac = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      signing: cloudfront.Signing.SIGV4_NO_OVERRIDE,
    });

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment:      `hft-${env} frontend`,
      priceClass:   cloudfront.PriceClass.PRICE_CLASS_100, // 북미+유럽 (저비용)
      defaultRootObject: 'index.html',

      // 기본 동작: /* → S3 (React SPA 정적 파일)
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket, { originAccessControl: oac }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy:          cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },

      // /api/* 경로: EC2 Elastic IP 로 프록시 (HTTP — 내부 통신)
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(ec2ElasticIp, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy:          cloudfront.CachePolicy.CACHING_DISABLED, // API 캐시 비활성화
          allowedMethods:       cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods:        cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        },
      },

      // SPA fallback: 404 → index.html (React Router 처리)
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: `https://${distribution.distributionDomainName}`,
    });
  }
}
```

---

## 12. ObservabilityStack 패턴

```typescript
/**
 * lib/observability-stack.ts
 *
 * 역할: CloudWatch Log Group 을 생성한다.
 * 위치: infra/aws-cdk/lib/observability-stack.ts
 * 관계: 독립 Stack — 다른 Stack 에 의존하지 않음
 *
 * 설계 의도: MVP 단계에서는 Log Group 만 생성한다.
 *   decisions.json 에 dashboard/alarm/xray 가 false 인 경우 해당 리소스를 생성하지 않는다.
 *   Stage 2 진화: CloudWatch Dashboard, Alarm, X-Ray 추가.
 */
import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvConfig } from '../shared/env-config';
import { resourceName } from '../shared/naming';

interface ObservabilityStackProps extends cdk.StackProps {
  envConfig: EnvConfig;
}

export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);
    const { envConfig } = props;
    const env = envConfig.env;

    // 로그 보존 기간: dev=7일 / stg=30일 / prod=90일
    // 설계 의도: 환경별로 보존 기간을 다르게 하여 CloudWatch 비용을 최소화한다.
    const retentionDays = envConfig.logRetentionDays;
    const retention = retentionDays <= 7
      ? logs.RetentionDays.ONE_WEEK
      : retentionDays <= 30
        ? logs.RetentionDays.ONE_MONTH
        : logs.RetentionDays.THREE_MONTHS;

    // 백엔드 애플리케이션 로그 그룹
    new logs.LogGroup(this, 'BackendLogGroup', {
      logGroupName:  `/hft/${env}/backend`,
      retention,
      removalPolicy: env === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // DB migration 로그 그룹
    new logs.LogGroup(this, 'MigrationLogGroup', {
      logGroupName:  `/hft/${env}/migration`,
      retention,
      removalPolicy: env === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });
  }
}
```

---

## 13. Snapshot test 패턴 (prod only)

```typescript
/**
 * test/prod-snapshot.test.ts
 *
 * 역할: prod Stack 의 CloudFormation 템플릿이 의도치 않게 변경되지 않았는지 검증.
 * 위치: infra/aws-cdk/test/prod-snapshot.test.ts
 * 관계: Jest + ts-jest 로 실행. CI 에서 npm test 로 호출.
 *
 * 설계 의도: prod 환경에만 snapshot test 를 적용한다. dev/stg 는 빠른 반복이
 *   필요하므로 snapshot 을 강제하지 않는다. prod 변경 시 개발자가 의식적으로
 *   snapshot 을 업데이트해야 한다 (jest -u).
 */
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../lib/network-stack';
import { loadDecisions, resolveEnvConfig } from '../shared/env-config';

test('prod NetworkStack snapshot', () => {
  const app = new cdk.App({ context: { env: 'prod' } });
  const decisions = loadDecisions();
  const envConfig  = resolveEnvConfig(decisions, 'prod');

  const stack = new NetworkStack(app, 'hft-prod-network', {
    env: { account: envConfig.account, region: envConfig.region },
    envConfig,
  });

  // CloudFormation 템플릿을 snapshot 으로 저장하여 의도치 않은 변경을 감지
  expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
});
```

snapshot 업데이트 방법:
```bash
# prod 인프라 변경이 의도된 경우에만 실행
cd infra/aws-cdk && npx jest -u
```

---

## 14. GitHub Actions OIDC deploy workflow

`.github/workflows/deploy-aws.yml` 에 생성한다:

```yaml
# .github/workflows/deploy-aws.yml
#
# 역할: ECR 이미지 빌드/푸시 + DB migration + CDK deploy 를 자동화한다.
# 트리거: main 브랜치 push 또는 workflow_dispatch (수동 실행 + 환경 선택)
# 보안: OIDC 로 AWS 인증 — 장기 자격증명(Access Key) 사용 금지
#
# 설계 의도: main push 시 자동으로 dev 배포, stg/prod 는 수동 승인 게이트.
#   환경 게이트(environment protection rules)로 prod 실수 배포를 방지한다.

name: deploy-aws

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'frontend/**'
      - 'infra/aws-cdk/**'
  workflow_dispatch:
    inputs:
      environment:
        description: '배포 환경 (dev | stg | prod)'
        required: true
        default: dev
        type: choice
        options: [dev, stg, prod]

permissions:
  id-token: write   # OIDC JWT 발급에 필요
  contents: read

env:
  AWS_REGION: ap-northeast-1
  CDK_DIR: infra/aws-cdk

jobs:
  # 1단계: 백엔드 Docker 이미지 빌드 + ECR push
  build-push-image:
    name: Build & Push Docker image
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}

    steps:
      - uses: actions/checkout@v4

      - name: AWS OIDC 인증 (장기 자격증명 없음)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: ECR 로그인
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: 이미지 메타데이터 생성 (태그 = git SHA)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ steps.ecr-login.outputs.registry }}/hft-dev-backend
          tags: type=sha,prefix=,format=short

      - name: Docker 이미지 빌드 + push
        uses: docker/build-push-action@v5
        with:
          context: backend
          push: true
          tags: ${{ steps.meta.outputs.tags }}

  # 2단계: DB migration (SSM Run Command 로 EC2 에서 실행)
  migrate:
    name: DB Migration
    needs: build-push-image
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment || 'dev' }}

    steps:
      - name: AWS OIDC 인증
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: SSM Run Command — migration 실행
        run: |
          INSTANCE_ID=$(aws cloudformation describe-stacks \
            --stack-name hft-${{ inputs.environment || 'dev' }}-ec2app \
            --query "Stacks[0].Outputs[?OutputKey=='InstanceIdOutput'].OutputValue" \
            --output text)

          aws ssm send-command \
            --instance-ids "$INSTANCE_ID" \
            --document-name "AWS-RunShellScript" \
            --parameters 'commands=["cd /opt/hft && docker compose exec -T backend ./migrate up"]' \
            --output text

  # 3단계: CDK deploy
  deploy-cdk:
    name: CDK Deploy
    needs: migrate
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment || 'dev' }}

    steps:
      - uses: actions/checkout@v4

      - name: Node.js 설정
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          cache-dependency-path: ${{ env.CDK_DIR }}/package-lock.json

      - name: AWS OIDC 인증
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: CDK 의존성 설치
        run: npm ci
        working-directory: ${{ env.CDK_DIR }}

      - name: CDK deploy (환경별)
        run: |
          ENV=${{ inputs.environment || 'dev' }}
          npx cdk deploy --all --context env=$ENV --require-approval never
        working-directory: ${{ env.CDK_DIR }}
```

**OIDC 사전 설정 (1회)**:
1. AWS Console → IAM → Identity providers → GitHub OIDC 추가
2. IAM Role 생성: `hft-github-deploy-role` (신뢰 정책에 repo 한정)
3. GitHub → Settings → Secrets → `AWS_DEPLOY_ROLE_ARN` 추가
4. GitHub → Settings → Environments → `stg`, `prod` 생성 + Required reviewers 설정

---

## 15. DB schema migration 패턴

EC2 에서 직접 migration 을 실행한다. SSM Run Command 를 사용하여 SSH 없이 접근한다.

```bash
# SSM Run Command 예시 (GitHub Actions 의 migrate job 에서 실행)
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=[
    "cd /opt/hft",
    "docker compose exec -T backend ./migrate up"
  ]'
```

**backward-compatible schema 필수 규칙**:

| 작업 | 허용 여부 | 이유 |
|------|---------|------|
| 컬럼 추가 | 허용 | 기존 코드에 영향 없음 |
| 컬럼 삭제 | 금지 | 롤백 시 구 코드가 참조 |
| 컬럼 rename | 2-step 필수 | 1) 새 컬럼 추가 → 배포 → 2) 구 컬럼 삭제 |
| 테이블 추가 | 허용 | 기존 코드에 영향 없음 |
| 인덱스 추가 | 허용 (CONCURRENTLY) | 잠금 없이 추가 |

---

## 16. 배포 전략

**현재 (Stage 1): docker compose restart**

```bash
# EC2 에서 실행 (SSM Run Command 또는 직접 접속)
cd /opt/hft
docker compose pull
docker compose up -d --force-recreate
```

- Brief downtime 허용 (보통 10~30초)
- Free Tier 단일 인스턴스 환경에서 적합

**Stage 2 진화: ASG + Instance Refresh**
- Auto Scaling Group + Launch Template 전환
- Instance Refresh 로 zero-downtime rolling 업데이트
- 트래픽 증가 시점에 전환 (현재 불필요)

---

## 17. Free Tier 비용 최적화

| 항목 | 제거 이유 | 월 절감 |
|------|---------|--------|
| ALB 없음 | EC2 EIP 직접 사용 | ~$16 |
| NAT Gateway 없음 | Public subnet 에 EC2 배치 | ~$32 |
| Fargate 없음 | EC2 t2.micro (Free Tier) | ~$30+ |

| 항목 | 비용 |
|------|------|
| EC2 t2.micro (Free Tier 12개월) | $0 |
| RDS db.t3.micro (Free Tier 12개월) | $0 |
| S3 (소규모) | ~$0.02 |
| CloudFront (소규모) | ~$0.01 |
| SSM Parameter Store | $0 (무료 tier) |
| Elastic IP (실행 중) | $0 |
| Route53 Hosted Zone | ~$0.50 |
| **합계 (12개월 내)** | **~$0.50/월** |
| **합계 (12개월 후)** | **~$25/월** |

---

## 18. engine-swap-checklist

DB engine 이 TBD → 확정 시 변경할 항목:

| 항목 | PostgreSQL | MySQL |
|------|-----------|-------|
| DatabaseStack engine prop | `rds.DatabaseInstanceEngine.postgres(...)` | `rds.DatabaseInstanceEngine.mysql(...)` |
| DB 포트 | 5432 | 3306 |
| NetworkStack dbSg ingressRule | `ec2.Port.tcp(5432)` | `ec2.Port.tcp(3306)` |
| Connection string | `postgres://user:pass@host:5432/db` | `mysql://user:pass@host:3306/db` |
| Migration tool | `golang-migrate` (postgres driver) | `golang-migrate` (mysql driver) |
| RDS parameter group | 기본값 또는 `postgres16` | 기본값 또는 `mysql8.0` |

**변경 절차**:
1. `DatabaseStack` 의 `engine` 및 `// TODO` 주석 업데이트
2. `NetworkStack` 의 dbSg ingressRule 포트 변경
3. backend 의 DB driver + connection string 변경
4. migration 파일이 새 dialect 와 호환되는지 확인
5. `cdk synth:all` + prod snapshot test 재실행
