<!--
  파일: docs/conventions/dependencies.md
  역할: 의존성(dependencies) 관리의 위생 규칙과 이 프로젝트의 실제 사고 사례(PR #6 → PR #8)를 통한 교훈 정리.
  시스템 내 위치: docs/conventions/의 "외부 코드를 이 프로젝트에 들여올 때의 규율" 문서.
  관계:
    - 12-factor.md의 Factor II(Dependencies)의 상세 확장.
    - ai-guardrails.md의 "패키지 설치 관련 exec 제한"과 연계.
    - 사고 사례가 기록되어 있으므로, 재발 방지의 권위 원천으로 code-reviewer가 참조한다.
  설계 의도:
    - 추상 원칙(직접 vs transitive)만 나열하지 않고, 실제로 터졌던 사고를 중심에 둔다. 입문자는 "왜 이 규칙이 이렇게 구체적인가"를 사례에서 이해할 수 있다.
    - 재발 방지는 "금지"만으로는 부족하다. "무엇을 먼저 의심해야 하는가"의 트러블슈팅 순서도 함께 제시.
-->

# Dependencies — 의존성 위생과 PR #6 → #8 사고 사례

> 이 문서를 읽어야 할 때: `npm install`·`go get`·`pip install` 직전, `package.json` / `go.mod` 수정 직전, lock 파일이 예상치 못하게 변경되었을 때, CI가 "로컬에서는 되는데" 실패했을 때.

---

## 0. 왜 의존성 위생이 중요한가

외부 패키지는 우리 프로젝트의 코드가 **아니면서**, 우리 프로젝트의 동작을 **결정**한다. 이 비대칭성이 모든 사고의 출발점이다:

- **공급망 공격**: 악성 코드가 섞인 패키지가 설치되면 우리 코드는 안전해도 사고가 난다.
- **플랫폼 의존**: 패키지가 특정 OS/CPU에 묶이면 "내 머신에서는 되는데" 사고가 난다.
- **transitive 지옥**: 직접 쓰지 않는 패키지가 직접 쓰는 패키지를 통해 끌려 들어오면서, 버전 충돌로 "빌드는 되는데 런타임에 crash" 사고가 난다.

이 문서는 의존성을 **명확히·보수적으로·재현 가능하게** 관리하기 위한 규칙을 모은다.

---

## 1. 직접 의존성 vs transitive 의존성

### 원칙

- **직접 의존성 (direct)**: 우리 코드에서 **직접 `import`/`require`로 사용하는** 패키지. `package.json`의 `dependencies`, `go.mod`의 `require`에 명시된다.
- **transitive 의존성 (indirect)**: 직접 의존성이 내부적으로 사용하는 패키지. 우리 코드는 이것들을 **직접 import하지 않는다**. 오직 **lock 파일**에서만 관리된다.

### 규칙

1. **`dependencies`에는 코드에서 실제로 `import`하는 패키지만 넣는다.**
2. "lint/type checker가 transitive를 못 찾아서 에러를 내니 일단 dependencies로 끌어올리자" — **금지**. 근본 원인은 다른 곳에 있다(아래 사고 사례 참조).
3. transitive 의존성의 버전 문제는 `package-lock.json` / `go.sum`의 역할이다. 직접 dependencies로 끌어올리지 말고 lock 파일로 해결하라.
4. transitive를 직접 의존성으로 올리면 "우리가 그것을 API로 보장한다"는 잘못된 신호를 준다. 부모 패키지가 그 transitive를 바꾸면 우리 코드가 조용히 깨진다.

### 왜 이 구분이 중요한가

`dependencies`는 "우리가 능동적으로 선택한 API 계약"이다. 여기에 들어간 패키지는:
- 버전 업그레이드 시 마이그레이션 비용이 발생 가능
- 보안 감사의 대상
- 라이선스 검토의 대상

transitive는 "부모 패키지가 알아서 관리하는 세부사항"이다. 우리는 lock 파일로 **고정만** 한다.

---

## 2. 플랫폼 native binding — 이 프로젝트의 실제 사고 사례

### 사고 개요 (PR #6 → PR #8)

> **타임라인:**
> 1. 개발 머신은 macOS(arm64). 사용자 전역 `~/.npmrc`에 `os=linux`가 설정되어 있었다. 이는 "이 NPM 설치를 Linux 타겟으로 간주하라"는 의미.
> 2. 로컬 `npm install` 시, npm은 `os=linux` 힌트를 따라 **macOS에 Linux용 바이너리**를 설치했다.
> 3. Vite/Rollup이 macOS에서 실행될 때 "맞는 바이너리가 없다" 에러를 뱉었다.
> 4. 에러 메시지를 본 개발자(또는 이전 AI 에이전트)가 **해결책**이라 믿고 `@rollup/rollup-darwin-arm64`를 `frontend/package.json`의 `dependencies`에 **직접 추가**했다.
> 5. 이 커밋(PR #6)이 머지됨. 로컬에서는 정상 동작.
> 6. **Linux CI가 실패**했다. Linux에서 `@rollup/rollup-darwin-arm64`는 맞지 않는 바이너리이므로 `EBADPLATFORM` 에러가 발생한 것.
> 7. 복구에 PR #8(의존성 원상 복구)과 약 25분의 Codex 리뷰 시간이 소요됨.

### 교훈

**1. 플랫폼 종속 native binding은 절대 직접 dependencies에 추가하지 않는다.**

구체적 금지 대상:
- `@rollup/rollup-{platform}-{arch}` (예: `-darwin-arm64`, `-linux-x64`)
- `@esbuild/{platform}-{arch}`
- `@swc/core-{platform}-{arch}`
- `@next/swc-{platform}-{arch}`
- `fsevents` (macOS 전용, 직접 넣으면 Linux에서 깨짐)

**이유:** 이런 패키지들은 부모 패키지(rollup, esbuild, swc, next)의 `optionalDependencies`로 이미 선언되어 있다. npm/yarn/pnpm은 **현재 설치 플랫폼에 맞는 것만 자동으로 설치**한다. 우리가 직접 dependencies에 박으면, 그 패키지가 **모든 플랫폼에 설치 시도**되면서 맞지 않는 플랫폼에서 실패한다.

**2. "바이너리 없음" 에러의 근본 원인은 거의 항상 환경 설정이다.**

`Cannot find module '@rollup/rollup-darwin-arm64'` 같은 에러를 봤을 때, **해결책은 그 패키지를 추가하는 것이 아니다**. 다음 순서로 의심하라:

1. **`~/.npmrc` 확인**: `os=`, `cpu=`, `platform=` 같은 강제 설정이 있는가? 있다면 제거하거나 프로젝트 단위로 오버라이드.
2. **`package-lock.json`을 삭제하고 재설치**: `rm -rf node_modules package-lock.json && npm install`. lock 파일이 오염된 경우 자주 해결됨.
3. **Node.js 버전 확인**: native binding은 Node.js major 버전에 묶일 수 있다. `.nvmrc` 또는 `engines` 필드 확인.
4. **부모 패키지 재설치**: `npm install rollup --force` 등으로 optional deps가 재해결되게 유도.
5. **이것으로도 안 되면**: 환경 문제가 맞고, 그때도 dependencies에 박지 말고 CI 설정 또는 Docker 환경에서 해결한다.

**3. "로컬에서 된다"는 안전 신호가 아니다.**

특히 플랫폼 종속 이슈에서는 **Linux CI에서 확인되기 전까지는 배포 준비 완료가 아니다**. macOS와 Linux는 충분히 다르다. 커밋 전 `docker compose build` 같은 Linux 환경에서 한 번 검증하는 것이 좋다.

### 재발 방지 체크리스트

`package.json`의 `dependencies` 변경을 리뷰할 때:

- [ ] 추가된 패키지 이름에 `-{platform}-{arch}` 접미사가 있는가? → **거부**. 원인 조사로 돌려보낸다.
- [ ] 추가된 패키지 이름에 `fsevents`, `@next/swc-*`, `@rollup/rollup-*`, `@esbuild/*`가 있는가? → **거부**.
- [ ] 코드에서 실제로 `import`하고 있는가? 아니라면 왜 추가하는가?
- [ ] 같은 PR에서 lint/type checker 관련 변경이 있는가? 그 체커가 "없다고 한" 경고가 native binding을 추가하게 만든 것은 아닌가?

---

## 3. Lock 파일 디시플린

### 원칙

1. **lock 파일(`package-lock.json`, `go.sum`, `yarn.lock`, `pnpm-lock.yaml`)은 항상 커밋한다.**
2. lock 파일을 **관계없는 PR에 끼워 넣지 않는다**. 기능 PR이 우연히 `package-lock.json`을 1000줄 수정하면 리뷰가 불가능해진다.
3. **lock 파일만 변경하는 PR**은 의도를 명확히: "의존성 업그레이드", "보안 패치 반영" 등.

### 왜 커밋해야 하는가

- lock 파일이 없으면 **개발자 A와 개발자 B가 서로 다른 버전의 transitive 의존성을 설치**할 수 있다.
- CI와 로컬이 다른 버전을 쓰면 "로컬에서는 되는데 CI에서는 안 되는" 사고가 재현된다.
- 공급망 공격 대응을 위한 정확한 버전 고정을 위해서도 필수.

### 충돌 해결 시

`package-lock.json`이나 `go.sum`이 머지 충돌을 일으켰을 때, 손으로 수정하지 말라:

```bash
# Node
git checkout --theirs package-lock.json  # 또는 --ours
npm install  # lock 파일 재생성

# Go
git checkout --theirs go.sum
go mod tidy
```

손으로 수정하면 거의 항상 깨진 lock이 나온다.

---

## 4. 의존성 추가 시 체크리스트

새 패키지를 `dependencies`에 추가하기 전에 다음을 확인하라:

### 기본 검토

- [ ] **우리 코드에서 실제로 `import`할 계획인가?** (아니면 추가 금지)
- [ ] **표준 라이브러리로 대체 가능한가?** 예: 작은 날짜 계산은 `date-fns` 없이도 가능. Go는 `time` 패키지만으로 대부분 해결.
- [ ] **같은 일을 하는 패키지가 이미 dependencies에 있는가?** (중복 방지)

### 패키지 건강성

- [ ] **마지막 릴리스가 1년 이내인가?** 1년 넘게 업데이트 없는 패키지는 supply chain 위험과 호환성 위험.
- [ ] **다운로드 수/stars/issue 응답 속도**가 합리적인가?
- [ ] **maintainer가 1명뿐인가?** 버스 팩터 = 1은 위험. 중요 패키지일수록 더 조심.

### 라이선스

- [ ] **GPL / AGPL 계열인가?** 이 프로젝트는 MVP 보일러플레이트이므로 특정 라이선스 제약은 명시되지 않았지만, GPL/AGPL은 downstream 저작권 이슈를 만들 수 있다. 도입 전 사용자 확인 필수.
- [ ] **Commercial license가 필요한가?** 일부 패키지는 상업적 사용 시 유료. package.json을 커밋하기 전에 확인.

### 보안

- [ ] `npm audit` / `govulncheck` / `pip-audit` 등을 실행했는가?
- [ ] 알려진 CVE가 없는가?

### 플랫폼

- [ ] 패키지 이름에 `-{platform}-{arch}` 접미사가 없는가? (있다면 → **금지**, 위 사고 사례 참조)
- [ ] 네이티브 빌드가 필요한 패키지인가? 그렇다면 CI와 Docker 환경에서 빌드 가능한지 확인.

---

## 5. Go / Node 특화 규칙

### Go (`go.mod`, `go.sum`)

- `go mod tidy`를 커밋 전에 실행하여 사용하지 않는 의존성을 제거하라.
- `go.sum`은 항상 커밋. 이것이 lock 파일 역할.
- `replace` 지시자는 **임시 포크**나 **로컬 개발** 용도 외에는 쓰지 말 것. 머지 전에 제거.
- transitive는 `go.mod`의 `// indirect` 코멘트로 자동 표시된다. 이를 수동 편집하지 말 것.

### Node.js (`package.json`, `package-lock.json`)

- `devDependencies`와 `dependencies`를 명확히 구분한다. 타입 정의(`@types/*`), 빌드 도구(`vite`, `typescript`, `eslint`)는 `devDependencies`.
- 프로덕션 번들에 들어가는 것만 `dependencies`.
- Vite는 `@rollup/rollup-*`, `@esbuild/*` 등을 `optionalDependencies`로 관리한다. 절대 직접 dependencies에 넣지 말 것 (사고 사례 참조).
- `^` 캐럿과 `~` 틸드 중 선택: SemVer 준수 라이브러리는 `^`, 그렇지 않은 것은 `~` 또는 정확한 버전.
- `package-lock.json`이 항상 커밋. `npm ci`가 CI에서 이 파일을 정확히 재현한다.

---

## 6. 의존성 업그레이드 전략

### 주기

- **보안 패치**: 즉시 반영 (CVE 공개 직후, 심각도에 따라 hours ~ days).
- **minor 업그레이드**: 월 1회 배치로 검토.
- **major 업그레이드**: 릴리스 노트와 마이그레이션 가이드를 먼저 읽고, 테스트 커버리지 충분할 때만.

### PR 분리 원칙

- 기능 개발 PR과 의존성 업그레이드 PR은 **분리**한다.
- 이유: 문제 발생 시 bisect가 쉬워지고, 리뷰어가 무엇을 봐야 하는지 명확해진다.

### 이 프로젝트(MVP)의 현실

- MVP 단계에서는 의존성 업그레이드를 **적극적으로** 하지 않는다. 초기 구성을 안정화하는 것이 우선.
- stg/prod로 넘어가는 시점에 의존성 감사(audit)를 한 번 돌리고, 이후 주기적으로 반복.

---

## 7. AI 에이전트 관련 규칙

의존성은 AI 에이전트가 특히 조심해야 할 영역이다:

- **`npm install <patch-like-package>`을 제안할 때**: 반드시 "왜 이 패키지를 추가하는가"를 설명하고, 위 사고 사례와 같은 패턴(`-platform-arch` 접미사)이 아닌지 검증한다.
- **의존성 에러를 만났을 때**: 해결책으로 "패키지를 추가하자"를 제안하기 전에, "환경 설정 문제가 아닌가"를 먼저 의심한다 (섹션 2의 트러블슈팅 순서).
- **lock 파일을 수정하게 되었을 때**: 해당 변경이 지금 PR의 범위에 속하는지 사용자에게 확인. 아니라면 별도 PR로 분리 제안.
- **`curl ... | sh`로 의존성 설치하는 패턴**: 금지 (→ [ai-guardrails.md](./ai-guardrails.md)). 반드시 공식 패키지 매니저 사용.

---

## 8. 체크리스트 요약

### PR 리뷰어용 (dependencies 변경이 포함된 PR)

- [ ] `package.json` / `go.mod` diff에 네이티브 바인딩(`-{os}-{arch}`) 추가가 있는가? → **거부**
- [ ] 새 직접 의존성이 코드에서 실제로 `import`되는가?
- [ ] lock 파일 변경이 해당 PR의 의도와 일치하는가 (관계없는 대량 변경 아닌가)?
- [ ] 라이선스 / 마지막 업데이트 / CVE 체크를 했는가?
- [ ] PR 설명에 "왜 이 의존성이 필요한가"가 적혀 있는가?

### 개발자용 (의존성 추가 전)

- [ ] 표준 라이브러리 또는 기존 의존성으로 해결할 수 없는가?
- [ ] 이 의존성을 6개월 후 제거해야 한다면 얼마나 어려운가?
- [ ] 이 의존성이 이 프로젝트의 모든 타겟 플랫폼에서 동작하는가? (특히 Linux CI)

### AI 에이전트용 (의존성 에러 만났을 때)

- [ ] 환경 설정(`.npmrc`, `.nvmrc`, Node 버전)을 먼저 확인했는가?
- [ ] lock 파일 삭제 + 재설치를 시도했는가?
- [ ] "패키지 추가"를 제안하기 전에 "왜 이게 필요한가"를 설명할 수 있는가?

---

## 9. 같이 보면 좋은 문서

- [12-factor.md](./12-factor.md) — Factor II(Dependencies)의 상위 원칙.
- [ai-guardrails.md](./ai-guardrails.md) — 패키지 설치 관련 exec 제한.
- [secrets.md](./secrets.md) — 의존성 설치 중 `.npmrc`의 auth 토큰이 노출될 수 있는 경로.
