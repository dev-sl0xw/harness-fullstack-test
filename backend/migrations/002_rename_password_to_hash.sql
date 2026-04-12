-- =============================================================================
-- 002_rename_password_to_hash.sql - password 컬럼을 password_hash로 변경
-- =============================================================================
-- 왜 이름을 바꾸는가?
--   001에서 컬럼명이 "password"였지만, 실제로 bcrypt 해시를 저장한다.
--   "password"라는 이름은 평문을 저장하는 것처럼 보여 코드/쿼리에서 혼동을 유발한다.
--   컬럼명을 "password_hash"로 바꿔 저장하는 값의 의미를 명확히 한다.
--
-- 적용 방법:
--   psql -U harness -d harness -f backend/migrations/002_rename_password_to_hash.sql
--
-- 롤백:
--   ALTER TABLE users RENAME COLUMN password_hash TO password;
-- =============================================================================

ALTER TABLE users RENAME COLUMN password TO password_hash;
