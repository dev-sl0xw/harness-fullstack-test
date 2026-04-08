-- =============================================================================
-- 001_create_users.sql - users 테이블 생성
-- =============================================================================
-- 이 파일은 PostgreSQL 컨테이너가 최초 실행될 때 자동으로 실행된다.
-- docker-entrypoint-initdb.d 디렉토리에 마운트되어 있기 때문이다.
--
-- users 테이블은 애플리케이션의 핵심 테이블로,
-- 회원가입/로그인/유저 관리 기능에서 사용된다.
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    -- id: 자동 증가 정수 기본키. 각 유저를 고유하게 식별한다.
    id          SERIAL PRIMARY KEY,

    -- email: 로그인에 사용되는 이메일 주소. 중복 불가(UNIQUE).
    email       VARCHAR(255) UNIQUE NOT NULL,

    -- password: bcrypt로 해시된 비밀번호. 평문 비밀번호는 절대 저장하지 않는다.
    password    VARCHAR(255) NOT NULL,

    -- name: 사용자 표시 이름.
    name        VARCHAR(100) NOT NULL,

    -- created_at: 계정 생성 시각. 자동으로 현재 시각이 들어간다.
    created_at  TIMESTAMP DEFAULT NOW(),

    -- updated_at: 마지막 수정 시각. 업데이트할 때 애플리케이션에서 갱신한다.
    updated_at  TIMESTAMP DEFAULT NOW()
);
