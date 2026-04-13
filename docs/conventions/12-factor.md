<!--
  파일: docs/conventions/12-factor.md
  역할: 12-Factor App 원칙 중 이 프로젝트에 가장 직접적인 5개 factor와, 실제 환경 분리(dev/stg/prod) 설계 골격을 정리.
  시스템 내 위치: docs/conventions/의 "어떻게 배포 가능하게 만드는가"를 다루는 문서.
  관계:
    - secrets.md의 "시크릿은 환경변수로"와 같은 관점에서 출발 (12-Factor의 Config in environment).
    - .env.example / docker-compose.yml / backend/internal/config/config.go가 이 문서가 기술하는 원칙의 실제 구현.
    - stg/prod 환경을 나중에 붙일 때의 골격 문서로도 기능.
  설계 의도:
    - 12-Factor 전체(12개)를 다 설명하지 않는다. MVP 학습용 보일러플레이트에는 핵심 5개만으로 충분하고, 나머지는 해당 시점에 확장하는 것이 옳다.
    - "원리 → 이 프로젝트의 현재 상태 → 확장 시 어떻게 해야 하는가"의 3단 구성.
    - dev/stg/prod 테이블은 실제 의사결정 근거로 쓸 수 있도록 구체적으로.
-->

# 12-Factor App & 환경 분리 — dev / stg / prod 설계

> 이 문서를 읽어야 할 때: 새 환경변수를 추가할 때, 설정 파일 구조를 바꿀 때, stg/prod 환경을 처음 붙일 때, "이게 prod에서도 동작할까?" 싶을 때.

---

## 0. 12-Factor App이란

[12factor.net](https://12factor.net)이 정리한, **SaaS 스타일 애플리케이션의 배포 안정성을 담보하는 12개 원칙**의 모음이다. 2011년에 나온 문서이지만 컨테이너·클라우드 시대에도 그대로 유효하다. 이 원칙들의 공통 관심사는 단 하나이다:

**"개발·테스트·배포·운영 사이의 마찰을 최소화한다."**

이 프로젝트는 전부 12개를 적용할 필요는 없다. 아래 **핵심 5개**만으로 MVP 단계에서의 환경 분리와 운영 안정성의 대부분이 해결된다. 나머지 7개는 프로젝트가 실제로 "프로덕션 운영" 단계에 들어갈 때 다시 열어보라.

---

## 1. 핵심 5개 Factor

### Factor III — Config in the environment

**원리:** 환경별로 달라지는 모든 값은 **환경변수**로 주입한다. 코드에 환경별 분기를 하드코딩하지 않는다.

**왜 중요한가:**
- dev → stg → prod를 옮길 때 **코드 수정 없이** 환경변수만 바꾸면 되어야 한다.
- 코드에 `if env == "prod" { ... }` 분기가 여기저기 흩어지면, 새 환경(예: demo, canary)이 추가될 때마다 코드를 고쳐야 한다.

**이 프로젝트의 현재 상태:**
- `backend/internal/config/config.go`의 `Load()`가 환경변수 7개를 읽어 `Config` 구조체를 만든다:
  - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  - `JWT_SECRET`
  - `SERVER_PORT`
- 기본값(fallback)은 로컬 개발 편의를 위한 것이며, 실제 환경에서는 모두 환경변수로 덮어쓰도록 설계되어 있다.

**안티패턴:**
```go
// 나쁨 - 환경별 하드코딩 분기
if os.Getenv("APP_ENV") == "prod" {
    dbHost = "prod-rds.amazonaws.com"
} else {
    dbHost = "localhost"
}

// 좋음 - 환경변수 하나로 충분
dbHost := os.Getenv("DB_HOST")
```

**확장 시 어떻게:**
- stg/prod 환경에서는 `.env` 파일 대신 AWS Secrets Manager / SSM / Vault 등 시크릿 스토어에서 값을 주입한다.
- CI/CD 파이프라인에서 환경별 시크릿을 환경변수로 컨테이너에 넘긴다.
- 코드 변경은 **없다**. 오직 주입 방식만 달라진다.

---

### Factor IV — Backing services as attached resources

**원리:** DB, 캐시, 이메일 서비스, 외부 API 등 "백엔드에 붙는 서비스"는 모두 **연결 정보로 교체 가능**해야 한다. 코드가 특정 인스턴스에 묶이면 안 된다.

**왜 중요한가:**
- dev 환경에서는 로컬 Postgres, stg에서는 RDS dev 인스턴스, prod에서는 RDS prod 인스턴스를 쓴다. 이 전환이 **연결 문자열 변경만으로** 끝나야 한다.
- 외부 서비스 장애 시 fallback (예: 임시로 다른 SMTP 서버 사용)을 환경변수 변경만으로 적용 가능해야 한다.

**이 프로젝트의 현재 상태:**
- Postgres 접속 정보는 모두 환경변수 (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
- `config.DSN()`이 이 값들을 조합해 DSN 문자열을 만든다 → 어느 Postgres에든 교체 가능.
- Docker Compose 환경에서는 `DB_HOST=db` (서비스명), 로컬 실행 시에는 `DB_HOST=localhost`로 변경하는 것만으로 접속 대상이 바뀐다.

**안티패턴:**
```go
// 나쁨 - 하드코딩된 연결
db, _ := sql.Open("postgres", "host=localhost port=5432 ...")

// 나쁨 - 환경변수를 쓰긴 하지만 코드가 "dev/prod"를 구분
if prod {
    url = "postgresql://prod-rds..."
} else {
    url = "postgresql://localhost..."
}
```

**확장 시 어떻게:**
- Redis, S3, SES 등 외부 서비스를 붙일 때도 같은 원칙: `REDIS_URL`, `AWS_S3_BUCKET`, `SMTP_HOST` 등을 환경변수로 받는다.
- 외부 API 키(OpenAI, Stripe 등)도 동일 — 하드코딩 금지.

---

### Factor V — Build, release, run 분리

**원리:** 애플리케이션의 배포 생명주기를 3단계로 나눈다:

1. **Build**: 코드 + 의존성을 "실행 가능한 번들"로 변환 (Docker 이미지 빌드, `go build`, `npm run build`).
2. **Release**: Build 산출물 + 환경별 config의 **결합**. 실행할 수 있는 최종 형태.
3. **Run**: 실제로 컨테이너/프로세스를 기동.

**왜 중요한가:**
- Build는 **불변**이어야 한다. 같은 코드로 빌드한 이미지는 dev, stg, prod에서 모두 동일한 바이너리여야 한다. 환경 차이는 오직 Release 단계에서 config로 주입한다.
- 이 원칙이 지켜지면 "dev에서는 되는데 prod에서는 안 되는" 사고의 80%가 사라진다.

**절대 하지 말 것:**
```bash
# 나쁨 - 운영 중인 서버에서 코드를 바로 갱신
ssh prod-server
cd /app && git pull && systemctl restart myapp
```

이런 패턴은 Build/Release/Run을 모두 섞어버린다. prod 서버의 상태가 "어떤 커밋이 빌드되었는지"가 불명확해진다.

**대신:**
1. CI에서 Docker 이미지 빌드 → 레지스트리에 태그 푸시.
2. prod 환경변수와 함께 이미지를 pull하여 컨테이너 기동.
3. 새 코드가 필요하면 새 이미지를 빌드하고 rolling update.

**이 프로젝트의 현재 상태:**
- `backend/Dockerfile`이 "Build 단계"를 정의한다.
- `docker-compose.yml`이 로컬 환경에서 "Release + Run"을 담당한다.
- stg/prod에서는 이 compose 파일 대신 k8s manifest 또는 ECS task definition이 같은 역할을 하게 된다.

---

### Factor X — Dev/prod parity

**원리:** 로컬 개발 환경과 프로덕션 환경의 차이를 **최소화**한다. "내 노트북에서는 되는데 prod에서는 안 된다" 사고를 예방한다.

**원칙의 3가지 간극:**
1. **시간 간극**: 개발부터 배포까지 걸리는 시간을 짧게 (CI/CD로).
2. **인력 간극**: 개발자가 배포도 한다 (DevOps 문화).
3. **도구 간극**: dev와 prod에서 같은 도구를 사용 (SQLite dev + Postgres prod 같은 패턴 금지).

**이 프로젝트의 적용:**
- **Docker Compose가 이 원칙의 실용적 구현이다**. 로컬에서도 Postgres 16을 컨테이너로 띄우므로, prod에서 RDS Postgres를 쓸 때 SQL 방언·확장 함수·성능 특성이 거의 일치한다.
- 로컬에서 SQLite를 쓰고 prod에서 Postgres를 쓰는 구성은 **명시적으로 금지**한다. 로컬 편의를 위해 parity를 희생하지 않는다.

**현실적 트레이드오프:**
- 로컬에서 Redis, S3까지 모두 완벽하게 재현하는 건 비용이 크다. Redis는 LocalStack/MinIO로 근사할 수 있지만, 때로는 "로컬에서 mock + CI에서 실물"로 타협한다.
- **타협이 필요한 경우**, 그 차이를 **명시적으로 문서화**하라. 사고 시 첫 의심 대상이 된다.

---

### Factor XI — Logs as event streams

**원리:** 애플리케이션은 로그를 **stdout / stderr로 스트리밍**하기만 한다. 파일 회전, 압축, 적재는 모두 **인프라의 일**이다. 앱은 로그 파일 경로를 알 필요가 없고, 알아서도 안 된다.

**왜 중요한가:**
- 컨테이너 환경에서는 파일 시스템이 임시적이다. 앱이 `/var/log/myapp.log`에 쓰면 컨테이너 재시작 시 로그가 사라진다.
- Docker/k8s는 stdout/stderr를 자동으로 캡처하여 중앙 로그 시스템(CloudWatch, Loki, Datadog 등)으로 보낸다. 앱은 그 존재를 몰라도 된다.
- 개발자가 `docker logs` 한 줄로 로그를 볼 수 있어야 한다.

**이 프로젝트의 현재 상태:**
- Go 표준 `log` 패키지는 기본적으로 stderr로 출력한다. `log.Println`/`log.Printf`는 그대로 12-Factor XI를 만족한다.
- Gin도 기본으로 stdout에 access log를 찍는다.
- **파일 로깅을 추가하지 말 것**. 필요하다면 인프라 레벨(Docker logging driver)에서 처리한다.

**로그 포맷:**
| 환경 | 포맷 |
|------|------|
| dev | text (사람이 읽기 좋게) |
| stg/prod | JSON (기계 파싱 가능하게, CloudWatch/Loki가 구조 인덱싱) |

로그 포맷도 환경변수로 제어한다: `LOG_FORMAT=json` 같은 식. (현재 MVP에서는 text 고정, 필요 시 추가)

---

## 2. 나머지 7개 Factor의 요약 위치

이 문서에서 상세히 다루지는 않지만, 참고로:

| Factor | 요지 | 이 프로젝트에서의 상태 |
|--------|------|-------------------------|
| I. Codebase | 한 앱 = 한 리포 | 단일 리포, OK |
| II. Dependencies | 의존성을 명시적으로 선언·격리 | go.mod / package.json 사용, OK (→ [dependencies.md](./dependencies.md) 참조) |
| VI. Processes | 앱은 stateless 프로세스로 실행 | 세션 상태는 DB/쿠키에, OK |
| VII. Port binding | 앱이 자체 포트를 바인드 | Gin이 :8080 직접 바인딩, OK |
| VIII. Concurrency | 프로세스 모델로 스케일 | MVP 단계에서는 해당 사항 적음 |
| IX. Disposability | 빠른 기동·우아한 종료 | MVP에서는 후순위 |
| XII. Admin processes | 관리 작업을 일회성 프로세스로 | 마이그레이션 등을 별도 실행 (→ 확장 시 적용) |

MVP 단계에서는 위 항목들을 "알고는 있되 적극 적용하지는 않는" 상태로 둔다. stg/prod 배포 시점에 다시 검토한다.

---

## 3. 환경 분리 설계 (dev / stg / prod)

### 왜 환경을 분리하는가

- **dev**: 개발자가 자유롭게 실험하는 공간. 데이터 손실·재초기화 허용.
- **stg** (staging): prod과 **동일한 구조**로 테스트하는 공간. 배포 전 검증. 실서비스 트래픽 없음.
- **prod**: 실사용자가 있는 공간. 데이터 손실·장애 최소화가 절대 목표.

이 3개 환경은 **같은 코드·같은 이미지**로 동작하되, 오직 **환경변수(config)만 다르다**. Factor III + V의 실천이다.

### 환경별 차이 — 테이블로 한눈에

다음은 stg/prod 환경을 붙일 때의 참고 테이블이다. 현재 이 프로젝트는 dev만 동작하지만, 확장 시 다음과 같이 구성한다:

| 항목 | dev | stg | prod |
|------|-----|-----|------|
| **DB 접속** | 로컬 Postgres (Docker Compose) | RDS dev 인스턴스 | RDS prod 인스턴스 |
| **DB 비밀번호 소스** | `docker-compose.yml`의 환경변수 (dummy) | AWS Secrets Manager | AWS Secrets Manager |
| **JWT_SECRET** | 고정 dummy 값 | 랜덤 생성·Secrets Manager | 랜덤 생성·Secrets Manager |
| **로그 레벨** | debug | info | warn |
| **로그 포맷** | text (사람 친화) | json | json |
| **디버그 엔드포인트** (`/debug/pprof`) | on | off | **off** |
| **Swagger UI** | on | on | **off** |
| **CORS origin** | `*` 허용 | 명시적 도메인 | 명시적 도메인 |
| **Cookie Secure 플래그** | false | true | true |
| **DB 자동 마이그레이션** | on (편의) | 수동 (PR 분리) | 수동 (ops runbook) |
| **인증 만료 시간** | 24h | 24h | 1~4h |
| **에러 메시지 상세도** | stacktrace 포함 | 코드만 | 코드만 (내부 로그에만 상세) |

### prod에서 절대 켜면 안 되는 것

다음은 prod에서 "실수로 on이 되면 사고"가 되는 항목이다. 환경별 config 분기에서 prod은 **기본값 off**, 그리고 실수 방지를 위해 **토글 불가능**으로 설정하는 것이 안전하다:

- 디버그 모드 / verbose 로깅 (logs as event streams가 범람)
- 프로파일링 엔드포인트 (`/debug/pprof` — DoS 벡터가 될 수 있음)
- 임시 admin 백도어 (`?admin=1` 같은 류 — 반드시 삭제)
- 와일드카드 CORS (`Access-Control-Allow-Origin: *`)
- 자동 DB 마이그레이션 실행 (prod 마이그레이션은 반드시 별도 단계)

### 환경 검출은 한 곳에서만

환경을 **단 한 곳**에서만 판단한다. 코드 곳곳에 `if env == "prod"` 분기가 흩뿌려지면 12-Factor III 위반이다.

```go
// 개념 예시 — backend-dev가 실제 구현 시 참고
// internal/config/env.go
type Env string
const (
    EnvDev  Env = "dev"
    EnvStg  Env = "stg"
    EnvProd Env = "prod"
)

func DetectEnv() Env {
    // APP_ENV 환경변수 1개로 결정. 기본값은 dev.
    switch os.Getenv("APP_ENV") {
    case "stg":  return EnvStg
    case "prod": return EnvProd
    default:     return EnvDev
    }
}
```

그리고 **환경별 분기는 Config 객체가 이미 머지한 값으로만** 본다. 코드는 "현재 prod인가?"를 묻지 말고, `cfg.LogLevel` 같은 이미 결정된 값을 쓴다.

### 디렉토리 구조 (확장 시 권장)

현재 MVP에서는 `config.Load()` 하나로 충분하지만, stg/prod가 추가되면 다음과 같이 확장하는 것을 권장한다:

```
config/
├── default.yaml       # 모든 환경 공통
├── dev.yaml           # dev 오버라이드
├── stg.yaml           # stg 오버라이드
├── prod.yaml          # prod 오버라이드 (리포에 올리되 시크릿은 플레이스홀더)
└── local.yaml.example # 개인 로컬 오버라이드 템플릿 (실제 local.yaml은 .gitignore)
```

로딩 순서: `default → {env} → local` — 뒤에 오는 것이 앞을 덮어쓴다. 단, **YAGNI**: 지금 당장 만들 필요는 없다. stg 환경을 실제로 붙일 때 도입하라.

### Terraform/IaC 도입 시 고려

인프라 코드를 도입할 때:

```
terraform/
├── modules/           # 재사용 가능한 모듈 (vpc, rds, ecs ...)
└── envs/
    ├── dev/
    │   └── terraform.tfvars
    ├── stg/
    │   └── terraform.tfvars
    └── prod/
        └── terraform.tfvars
```

- State는 **환경별로 분리**한다 (S3 backend의 `key`를 환경별로).
- 동일한 모듈을 세 환경이 참조하되, 변수만 다르게 한다 — 코드의 Factor X를 인프라에도 적용.
- prod state에 접근할 수 있는 권한은 소수에게만.

---

## 4. 이 프로젝트에 맞춘 체크리스트

### 새 환경변수를 추가할 때

- [ ] `backend/internal/config/config.go`의 `Config` 구조체와 `Load()`에 추가했는가?
- [ ] `.env.example`에 키와 placeholder + 한글 주석을 추가했는가?
- [ ] `docker-compose.yml`의 `environment` 섹션에 dev용 dummy 값을 추가했는가?
- [ ] 기본값(fallback)이 prod에서 위험하지 않은가? (예: `JWT_SECRET` 기본값은 prod에서 절대 쓰면 안 됨)
- [ ] 시크릿이라면 로그에 노출될 경로를 검토했는가? (→ [secrets.md](./secrets.md))

### 새 백엔드 서비스(Redis, S3 등)를 붙일 때

- [ ] 연결 정보를 환경변수로 받는가? (Factor IV)
- [ ] 로컬에서 재현 가능한가 (docker-compose에 추가)? (Factor X)
- [ ] 접속 실패 시 에러 메시지에 시크릿이 섞이지 않는가? (→ [secrets.md](./secrets.md))

### stg/prod 환경을 처음 붙일 때

- [ ] 모든 시크릿이 Secrets Manager / SSM 등에서 주입되는가?
- [ ] 환경별 차이가 "config만"으로 구현되어 있는가 (코드 수정 없이)?
- [ ] prod에서 디버그/프로파일링 엔드포인트가 off인가?
- [ ] 로그가 JSON 포맷으로 stdout/stderr에 나가는가?
- [ ] DB 마이그레이션이 자동 실행되지 않는가?

---

## 5. 같이 보면 좋은 문서

- [secrets.md](./secrets.md) — Factor III와 직결. 시크릿이 환경변수에 들어갈 때의 취급 규칙.
- [principles.md](./principles.md) — YAGNI: 환경 분리 구조를 **지금 필요한 만큼만** 만들어라.
- [dependencies.md](./dependencies.md) — Factor II(Dependencies)의 상세 규칙.
- `/backend/internal/config/config.go` — Factor III의 실제 구현.
- `/docker-compose.yml` — Factor X(dev/prod parity) 실천.

---

## 6. AWS 배포 시 환경변수 주입 — EC2 User Data 흐름

> ADR: [0003-compute-ec2-docker-compose](../architecture/adr/0003-compute-ec2-docker-compose.md)

### 6.1 로컬 vs AWS 환경변수 주입 경로

| 항목 | 로컬 (Docker Compose) | AWS (EC2 + Docker Compose) |
|------|---------------------|---------------------------|
| 비밀 저장소 | `.env` 파일 | SSM Parameter Store |
| 주입 시점 | `docker compose up` 시 자동 | EC2 User Data 스크립트 |
| 주입 방법 | `env_file: .env` | SSM → `.env` 파일 생성 → `env_file` |
| 비밀 노출 위험 | `.env` 파일이 git에 올라갈 위험 | SSM에 암호화 저장, EC2 내에서만 복호화 |

### 6.2 User Data 환경변수 주입 흐름

```
EC2 부팅
  → User Data 스크립트 실행
    → aws ssm get-parameters-by-path --path "/hft/${ENV}/"
    → 결과를 /opt/hft/.env 로 변환
    → docker compose --env-file /opt/hft/.env up -d
```

### 6.3 12-Factor Factor III 준수

Factor III(Config)는 "설정을 환경변수에 저장하라"고 한다. AWS 배포에서도 이 원칙을 유지한다:

1. **코드에 설정을 하드코딩하지 않는다** → `config.go`가 `os.Getenv()`로 읽음 (기존 그대로)
2. **환경별로 다른 설정** → SSM 경로에 환경이 포함됨 (`/hft/dev/*` vs `/hft/prod/*`)
3. **비밀과 비-비밀 분리** → 비-비밀(PORT, LOG_LEVEL)은 CDK에서 직접 `.env`에 기록, 비밀(JWT_SECRET, DB_PASSWORD)은 SSM SecureString에서 가져옴
