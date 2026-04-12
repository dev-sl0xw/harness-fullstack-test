# IaC Tradeoffs — 인프라 코드 도구 비교

solution-architect 에이전트가 IaC 도구를 선택할 때 참조하는 비교 문서다. CDK(TypeScript), Terraform(HCL), Pulumi(TypeScript), CDKTF를 비교하며, 이 프로젝트의 선택 근거를 포함한다.

---

## IaC 도구 비교표

| 항목 | CDK (TS) | Terraform (HCL) | Pulumi (TS) | CDKTF |
|------|----------|----------------|------------|-------|
| **언어** | TypeScript, Python, Java, C#, Go | HCL (독자 DSL) | TypeScript, Python, Go, .NET | TypeScript (Terraform 백엔드) |
| **State 관리** | CloudFormation이 처리 (파일 없음) | `.tfstate` 파일 (S3 백엔드 권장) | Pulumi Cloud 또는 S3 백엔드 | `.tfstate` 파일 (Terraform 백엔드) |
| **학습 곡선** | 낮음 (TS 개발자 기준) | 중간 (HCL 문법 별도 학습) | 낮음 (TS 개발자 기준) | 낮음~중간 (TS + Terraform 개념) |
| **커뮤니티** | 크고 성장 중 | 매우 큼 (사실상 표준) | 중간 | 작음 |
| **멀티클라우드** | AWS 전용 | O (AWS/GCP/Azure/K8s 등) | O (AWS/GCP/Azure/K8s 등) | O (Terraform provider 활용) |
| **AWS 통합도** | 최상 (L1/L2/L3 constructs) | 높음 (AWS provider 성숙) | 높음 | 높음 (Terraform AWS provider) |
| **L3 Constructs** | O (ApplicationLoadBalancedFargateService 등 고수준 패턴) | X (모듈로 유사 구현) | X (ComponentResource로 유사 구현) | X |
| **타입 안전성** | O (TS 인터페이스) | 제한적 (HCL 자체 타입) | O (TS 인터페이스) | O (TS 인터페이스) |
| **IDE 지원** | 최상 (TS + AWS 자동완성) | 보통 (HashiCorp LSP) | 상 (TS + Pulumi 자동완성) | 상 |
| **Drift Detection** | CloudFormation이 처리 | `terraform plan` | `pulumi preview` | `terraform plan` |
| **가격 (기본 사용)** | 무료 (CloudFormation 비용만) | 무료 (Terraform OSS) | 무료 (10개 리소스/프로젝트 이상 유료) | 무료 |
| **CI/CD 연동** | CDK Pipelines, GitHub Actions | GitHub Actions, Atlantis, TFC | GitHub Actions, Pulumi Cloud | GitHub Actions |

---

## State 관리 상세 비교

### CDK (CloudFormation)
- State 파일이 없다. CloudFormation이 서버 측에서 스택 상태를 관리한다.
- 장점: state 파일 분실 위험 없음, 잠금(lock) 문제 없음
- 단점: CloudFormation 변경 세트(change set) 배포가 느림 (대형 스택 5~10분)
- drift 감지: CloudFormation 콘솔에서 "Detect drift" 기능 제공

### Terraform
- `.tfstate` 파일을 S3 버킷 + DynamoDB(잠금)에 저장해야 한다.
- 장점: 모든 클라우드에서 동일한 방식으로 state 관리
- 단점: state 파일 관리 오버헤드, 초기 백엔드 구성 필요, 팀 협업 시 잠금 설정 필수
- 초기 S3 버킷/DynamoDB 생성 닭-달걀 문제: S3 버킷을 Terraform으로 만들면 state를 어디에?

### Pulumi
- Pulumi Cloud(SaaS) 또는 S3 백엔드 선택 가능
- 무료 플랜: 1개 조직, 프로젝트 수 제한
- 팀 협업 시 Pulumi Cloud 유료 플랜 또는 S3 백엔드 직접 구성 필요

### CDKTF
- Terraform 백엔드를 그대로 사용 (S3 + DynamoDB)
- CDK 문법으로 작성하지만 내부적으로 Terraform JSON으로 컴파일
- Terraform 생태계(provider, module) 그대로 활용 가능

---

## AWS 서비스 매핑 예시

**같은 인프라를 각 도구로 표현하는 방식 비교 (EC2 + Security Group)**

### CDK (TypeScript)
```typescript
// L2 construct: 보안그룹 자동 생성, 기본값 적용
const instance = new ec2.Instance(this, 'AppServer', {
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
  machineImage: new ec2.AmazonLinuxImage(),
  vpc,
});
```

### Terraform (HCL)
```hcl
resource "aws_instance" "app_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  subnet_id     = aws_subnet.public.id
}
```

### Pulumi (TypeScript)
```typescript
const server = new aws.ec2.Instance("appServer", {
  instanceType: "t3.micro",
  ami: "ami-0c55b159cbfafe1f0",
  vpcSecurityGroupIds: [sg.id],
  subnetId: publicSubnet.id,
});
```

CDK L3 construct를 사용하면 Terraform 대비 코드량이 70~80% 줄어드는 경우가 많다.

---

## 이 프로젝트의 결정: CDK TypeScript 선택

**선택: CDK TypeScript**

**선택 근거:**

| 근거 | 설명 |
|------|------|
| **State-free 운영** | CloudFormation이 state를 서버에서 관리하므로 S3 백엔드, DynamoDB 잠금 테이블, 닭-달걀 문제가 없다. MVP 초기 설정 부담 최소화 |
| **TypeScript 공유** | 프론트엔드(React+TS)와 같은 언어를 사용하므로 팀이 언어 전환 없이 IaC 코드를 읽고 수정할 수 있다 |
| **L3 Constructs** | `ApplicationLoadBalancedFargateService` 등 고수준 패턴으로 보일러플레이트를 줄인다. 성장 시 ECS로 이전이 쉽다 |
| **AWS 네이티브** | AWS 공식 지원, 새 서비스 출시 시 CDK construct가 가장 먼저 나온다 |
| **무료** | CloudFormation은 리소스 수 제한 없이 무료 (API 호출 비용만) |

**기각된 대안:**

| 대안 | 기각 사유 |
|------|---------|
| Terraform | HCL 학습곡선, state 파일 관리 오버헤드, 멀티클라우드 불필요 (AWS only) |
| Pulumi | 무료 플랜 제한, 커뮤니티 Terraform 대비 작음, CDK와 장점 유사 |
| CDKTF | CDK 문법이지만 Terraform state 문제 그대로 보유, 장점이 불명확 |

**향후 마이그레이션 경로:**

```
현재: CDK TypeScript (EC2 + Docker Compose 스택)
  ↓ 트래픽 증가 시
패턴 4: CDK TypeScript (EC2 → ECS Fargate 전환, L3 construct 재활용)
  ↓ 멀티클라우드 필요 시
Terraform 마이그레이션 (CDK 스택을 Terraform으로 재작성 — 1~2주 작업)
```

---

## CDK 디렉토리 구조 (이 프로젝트 기준)

```
infra/                          # CDK 프로젝트 루트
├── bin/
│   └── app.ts                  # CDK App 진입점
├── lib/
│   ├── network-stack.ts        # VPC, 서브넷, 보안그룹
│   ├── compute-stack.ts        # EC2, IAM Role, 키페어
│   ├── storage-stack.ts        # S3, EBS
│   └── config-stack.ts         # SSM Parameter Store 파라미터
├── cdk.json                    # CDK 설정
├── package.json                # CDK 의존성
└── tsconfig.json               # TypeScript 설정
```

**스택 분리 원칙:**
- 네트워크 스택을 가장 먼저 배포 (다른 스택이 참조)
- 스택 간 출력값(Output)은 CloudFormation Export로 전달
- 환경별 분리: `cdk deploy --context env=prod`

---

## CDK 핵심 개념 요약 (한국어 학습용)

| 개념 | 설명 |
|------|------|
| **App** | CDK 애플리케이션의 최상위 컨테이너. `new cdk.App()` |
| **Stack** | CloudFormation 스택에 1:1 매핑. 배포 단위 |
| **Construct** | 리소스 추상화 단위. L1(CloudFormation raw) / L2(기본 설정 포함) / L3(패턴) |
| **L1 Construct** | `CfnInstance` 등 CloudFormation 리소스와 1:1 대응 |
| **L2 Construct** | `ec2.Instance` 등 기본값과 편의 메서드를 제공하는 추상화 |
| **L3 Construct** | `ecs_patterns.ApplicationLoadBalancedFargateService` 등 완전한 아키텍처 패턴 |
| **cdk synth** | TypeScript 코드를 CloudFormation JSON/YAML로 컴파일 |
| **cdk deploy** | CloudFormation 스택 생성/업데이트 |
| **cdk diff** | 현재 배포된 스택과 코드 간 차이 확인 |
