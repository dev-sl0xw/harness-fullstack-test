/**
 * 파일: infra/aws-cdk/lib/shared/guards.ts
 * 역할: 허용되지 않은 리전에서의 배포를 차단한다.
 * 시스템 내 위치: bin/app.ts에서 Stack 생성 전 호출.
 * 관계:
 *   - ADR-0007 (Region Strategy)의 구현체
 *   - docs/conventions/principles.md의 "리전 가드" 패턴 참조
 *   - bin/app.ts가 loadEnvConfig() 직후 이 함수를 호출
 * 설계 의도:
 *   - KISS: 단순한 화이트리스트 체크로 실수 방지
 *   - 허용 리전: us-east-1, ap-northeast-1, ap-northeast-3
 *   - 그 외 리전에서 cdk deploy 시 즉시 에러 → 잘못된 리전에 리소스 생성 방지
 *   - ALLOWED_REGIONS는 decisions.json의 non_functional.allowed_regions와 동기화되어야 함
 */

/** 허용 리전 화이트리스트 (ADR-0007 — Region Strategy 참조) */
const ALLOWED_REGIONS = ['us-east-1', 'ap-northeast-1', 'ap-northeast-3'] as const;

/**
 * 지정 리전이 화이트리스트에 있는지 검증한다.
 * 없으면 Error를 throw하여 CDK synth/deploy를 중단한다.
 *
 * @param region - 검증할 AWS 리전 코드 (예: 'ap-northeast-1')
 * @throws Error 허용되지 않은 리전인 경우
 *
 * 호출 흐름: bin/app.ts → loadEnvConfig() → assertAllowedRegion(region) → 통과 또는 에러
 *
 * 왜 as const + includes cast를 사용하는가?
 *   - as const: 배열 요소를 string literal type으로 좁혀 타입 안전성 확보
 *   - includes(region as any): TypeScript가 ALLOWED_REGIONS 타입을 좁게 추론하므로
 *     일반 string을 includes에 전달하려면 캐스트 필요
 */
export function assertAllowedRegion(region: string): void {
  if (!ALLOWED_REGIONS.includes(region as typeof ALLOWED_REGIONS[number])) {
    throw new Error(
      `리전 '${region}'은(는) 허용 리전 목록에 없습니다.\n` +
      `허용 리전: ${ALLOWED_REGIONS.join(', ')}\n` +
      `ADR-0007 참조: docs/architecture/adr/0007-region-strategy.md`
    );
  }
}

/**
 * 허용 리전 목록을 반환한다.
 * 주로 테스트에서 화이트리스트를 동적으로 확인할 때 사용한다.
 *
 * @returns 허용 리전 배열 (readonly)
 */
export function getAllowedRegions(): readonly string[] {
  return ALLOWED_REGIONS;
}
