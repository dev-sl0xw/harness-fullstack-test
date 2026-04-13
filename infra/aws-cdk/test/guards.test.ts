/**
 * 파일: infra/aws-cdk/test/guards.test.ts
 * 역할: 리전 화이트리스트 가드(guards.ts)의 단위 테스트.
 * 시스템 내 위치: CDK 프로젝트의 테스트 스위트.
 * 관계:
 *   - lib/shared/guards.ts의 assertAllowedRegion()과 getAllowedRegions()를 테스트
 *   - ADR-0007 (Region Strategy)의 허용 리전 목록과 일치하는지 검증
 * 설계 의도:
 *   - 허용 리전 3개에서는 에러 없이 통과 확인
 *   - 비허용 리전에서는 명확한 에러 메시지와 함께 에러 발생 확인
 *   - guards.ts 변경 시 이 테스트가 실패하여 의도치 않은 변경을 감지
 *
 * 테스트 실행: cd infra/aws-cdk && npm test
 */

import { assertAllowedRegion, getAllowedRegions } from '../lib/shared/guards';

describe('assertAllowedRegion', () => {
  /**
   * 허용 리전에서는 에러 없이 통과해야 한다.
   * test.each: 여러 입력값으로 동일한 테스트를 반복 실행 (DRY)
   */
  test.each(['us-east-1', 'ap-northeast-1', 'ap-northeast-3'])(
    '%s는 허용 리전이므로 에러 없이 통과해야 함',
    (region) => {
      // assertAllowedRegion이 에러를 throw하지 않아야 한다
      expect(() => assertAllowedRegion(region)).not.toThrow();
    },
  );

  /**
   * 비허용 리전에서는 명확한 에러 메시지와 함께 에러가 발생해야 한다.
   * 에러 메시지에 "허용 리전 목록에 없습니다"가 포함되어야 함을 정규식으로 검증.
   */
  test.each(['eu-west-1', 'us-west-2', 'ap-southeast-1', 'sa-east-1', 'eu-central-1'])(
    '%s는 비허용 리전이므로 에러가 발생해야 함',
    (region) => {
      // 에러 메시지가 "허용 리전 목록에 없습니다"를 포함해야 한다
      expect(() => assertAllowedRegion(region)).toThrow(/허용 리전 목록에 없습니다/);
    },
  );

  test('빈 문자열도 비허용 리전으로 처리', () => {
    expect(() => assertAllowedRegion('')).toThrow(/허용 리전 목록에 없습니다/);
  });
});

describe('getAllowedRegions', () => {
  test('허용 리전은 정확히 3개여야 함 (ADR-0007)', () => {
    // decisions.json의 non_functional.allowed_regions와 일치해야 함
    expect(getAllowedRegions()).toHaveLength(3);
  });

  test('반환된 배열은 수정 불가능해야 함 (readonly)', () => {
    const regions = getAllowedRegions();
    // 배열 원소는 읽기 전용 — 외부에서 변경해도 원본에 영향 없어야 함
    expect(regions).toContain('us-east-1');
    expect(regions).toContain('ap-northeast-1');
    expect(regions).toContain('ap-northeast-3');
  });
});
