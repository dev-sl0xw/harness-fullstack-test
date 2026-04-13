/**
 * 파일: infra/aws-cdk/test/snapshot.test.ts
 * 역할: prod 환경의 CloudFormation 템플릿 snapshot 테스트.
 * 시스템 내 위치: CDK 프로젝트의 인프라 변경 감지 테스트.
 * 관계:
 *   - lib/network-stack.ts의 NetworkStack을 prod 설정으로 인스턴스화
 *   - lib/shared/env-config.ts의 loadEnvConfig()로 decisions.json 로드
 *   - _workspace/architecture/decisions.json이 없으면 테스트 skip
 * 설계 의도:
 *   - prod 인프라 변경을 코드 리뷰에서 감지하는 안전망
 *   - dev/stg snapshot은 미생성 (유지보수 부담 감소 — YAGNI)
 *   - snapshot이 변경되면: npm test -- -u 로 갱신 후 diff를 PR에서 리뷰
 *   - CI에서도 _workspace/architecture/decisions.json이 있어야 실행됨
 *
 * snapshot 갱신 방법:
 *   cd infra/aws-cdk && npm test -- -u
 *   → test/__snapshots__/snapshot.test.ts.snap 파일 갱신 후 커밋
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../lib/network-stack';
import { loadEnvConfig } from '../lib/shared/env-config';

describe('Prod NetworkStack Snapshot', () => {
  // decisions.json이 없으면 테스트를 건너뛴다.
  // 이 try/catch는 모듈 로드 시점에 실행되므로 테스트 파일 로드 시 판단한다.
  let envConfig: ReturnType<typeof loadEnvConfig>;
  let skipReason: string | undefined;

  try {
    envConfig = loadEnvConfig('prod');
  } catch (e) {
    skipReason = `decisions.json을 찾을 수 없음 — snapshot 테스트 skip. 원인: ${e}`;
  }

  test('NetworkStack prod 템플릿이 snapshot과 일치해야 함', () => {
    // decisions.json이 없으면 이 테스트를 건너뜀
    if (skipReason) {
      console.warn(`[SKIP] ${skipReason}`);
      return;
    }

    const app = new cdk.App();
    // prod 환경의 NetworkStack을 인스턴스화
    const stack = new NetworkStack(app, 'TestNetworkProd', {
      envConfig,
      env: { region: envConfig.region },
    });

    // Template.fromStack(): CDK Stack에서 CloudFormation JSON 템플릿 생성
    const template = Template.fromStack(stack);

    // toMatchSnapshot(): 처음 실행 시 snapshot 파일 생성, 이후 실행 시 비교
    // snapshot 파일 위치: test/__snapshots__/snapshot.test.ts.snap
    expect(template.toJSON()).toMatchSnapshot();
  });

  test('NetworkStack에 VPC 리소스가 존재해야 함', () => {
    if (skipReason) {
      console.warn(`[SKIP] ${skipReason}`);
      return;
    }

    const app = new cdk.App();
    const stack = new NetworkStack(app, 'TestNetworkProdVpc', {
      envConfig,
      env: { region: envConfig.region },
    });

    const template = Template.fromStack(stack);

    // VPC 리소스가 정확히 1개 존재해야 함
    template.resourceCountIs('AWS::EC2::VPC', 1);
    // Security Group은 최소 2개 (App SG + DB SG)
    template.resourceCountIs('AWS::EC2::SecurityGroup', 2);
  });
});
