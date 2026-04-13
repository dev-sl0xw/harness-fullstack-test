/**
 * 파일: infra/aws-cdk/lib/frontend-stack.ts
 * 역할: React SPA를 S3 + CloudFront로 배포하는 인프라를 정의한다.
 * 시스템 내 위치: 프론트엔드 정적 파일 호스팅 레이어.
 * 관계:
 *   - NetworkStack과 독립적 (CloudFront/S3는 글로벌 서비스, VPC 불필요)
 *   - GitHub Actions(deploy-aws.yml)가 S3에 빌드 결과물을 업로드
 *   - CloudFront가 S3에서 파일을 가져와 CDN으로 배포
 * 설계 의도:
 *   - S3 bucket을 private으로 유지하고 OAC를 통해 CloudFront만 읽기 허용
 *     → public S3 bucket은 가장 흔한 AWS 보안 사고 원인 (ADR-0001 참조)
 *   - CloudFront PriceClass_100: 북미/유럽 edge location만 사용 → 비용 최소화
 *   - SPA 라우팅: 404/403 에러를 /index.html로 리다이렉트 → React Router가 처리
 *   - Free Tier: S3 5GB + CloudFront 1TB 전송이 무료 범위 내 (학습용 트래픽 기준)
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import { EnvConfig } from './shared/env-config';
import { resourceName } from './shared/naming';

/** FrontendStack 생성 파라미터 */
export interface FrontendStackProps extends cdk.StackProps {
  /** 환경 설정 (decisions.json에서 로드) */
  readonly envConfig: EnvConfig;
}

/**
 * Frontend Stack — S3 + CloudFront.
 *
 * 구성 요소:
 *   - S3 Bucket: private, 빌드 결과물 저장 (BLOCK_ALL public access)
 *   - CloudFront Distribution: OAC, PriceClass_100, SPA 라우팅 지원
 *
 * OAC(Origin Access Control)란?
 *   - S3 bucket에 직접 public access 없이 CloudFront를 통해서만 접근 허용
 *   - 구버전 OAI(Origin Access Identity)의 후속 — 더 나은 보안 모델
 *   - CloudFront가 S3에 접근할 때 서명된 요청을 사용
 *
 * SPA 라우팅 처리:
 *   - /users, /login 같은 경로로 직접 접근 시 S3에 파일이 없음 → 403/404 반환
 *   - CloudFront errorResponses로 이를 /index.html로 리다이렉트
 *   - React Router가 클라이언트 사이드에서 올바른 컴포넌트를 렌더링
 */
export class FrontendStack extends cdk.Stack {
  /** CloudFront 배포 도메인 (예: xxxx.cloudfront.net) */
  public readonly distributionDomainName: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { envConfig } = props;
    const env = envConfig.envName;

    // =========================================================================
    // S3 Bucket 생성
    // =========================================================================
    // blockPublicAccess: BLOCK_ALL
    //   - S3 버킷에 직접 public URL로 접근 불가
    //   - CloudFront OAC를 통해서만 접근 허용
    //   - 이것이 가장 안전한 정적 호스팅 방식
    //
    // versioning: 비활성화 (학습용이므로 버전 관리 불필요, 비용 절감)
    //
    // removalPolicy + autoDeleteObjects:
    //   - dev/stg: DESTROY + autoDeleteObjects=true → cdk destroy 시 버킷과 파일 모두 삭제
    //   - prod: RETAIN + autoDeleteObjects=false → 실수로 삭제 방지
    const bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: resourceName(env, 'frontend'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: env === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: env !== 'prod',
    });

    // =========================================================================
    // CloudFront Distribution 생성
    // =========================================================================
    // defaultBehavior: 모든 요청(/* )에 대한 기본 동작
    //   - origin: S3 bucket (OAC 사용)
    //   - viewerProtocolPolicy: HTTP 요청을 HTTPS로 리다이렉트
    //   - cachePolicy: dev는 캐싱 비활성화(개발 편의), stg/prod는 최적화된 캐싱
    //
    // priceClass: PRICE_CLASS_100
    //   - 북미 + 유럽 edge location만 사용
    //   - PriceClass_200, PriceClass_ALL 대비 저렴
    //   - 한국/일본 사용자는 ap-northeast-* edge를 사용 못하지만 학습용으로 허용
    //   - 실제 서비스 시 PriceClass_200 또는 ALL로 변경 검토
    //
    // defaultRootObject: 'index.html'
    //   - https://xxxx.cloudfront.net/ 요청 시 index.html 반환
    //
    // errorResponses: SPA 라우팅 처리
    //   - 403: S3에 파일 없으면 OAC가 403 반환 → /index.html로 리다이렉트
    //   - 404: 경로 없음 → /index.html로 리다이렉트
    //   - ttl: 0 → 에러 응답은 캐싱하지 않음 (배포 후 즉시 반영)
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${resourceName(env, 'frontend')} SPA distribution`,
      defaultBehavior: {
        // S3BucketOrigin.withOriginAccessControl(): OAC 자동 생성 + bucket policy 설정
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: envConfig.cfCachePolicy === 'no-cache'
          ? cloudfront.CachePolicy.CACHING_DISABLED    // dev: 캐싱 없음 (개발 편의)
          : cloudfront.CachePolicy.CACHING_OPTIMIZED,  // stg/prod: 최적화 캐싱
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          // OAC는 S3에 없는 파일 요청 시 403 반환 (public이 아니므로 404 대신 403)
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(0), // 에러 응답 캐싱 안 함
        },
        {
          // 일반적인 404 처리
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(0),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    this.distributionDomainName = distribution.distributionDomainName;

    // =========================================================================
    // CloudFormation Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket name (frontend SPA 빌드 결과물 업로드 대상)',
    });
    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront distribution URL (브라우저에서 SPA 접근)',
    });
    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID (캐시 무효화 시 사용: aws cloudfront create-invalidation)',
    });
  }
}
