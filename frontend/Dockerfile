# =============================================================================
# Frontend Dockerfile - 멀티스테이지 빌드
# =============================================================================
# 1단계(builder): npm으로 React 앱을 빌드하여 정적 파일(HTML/CSS/JS) 생성
# 2단계(runtime): nginx로 정적 파일을 서빙
#
# 왜 nginx를 사용하는가?
#   - Vite 개발 서버는 프로덕션용이 아님 (HMR, 소스맵 등 개발 기능 포함)
#   - nginx는 정적 파일 서빙에 최적화된 웹 서버
#   - 이미지 크기도 훨씬 작음
# =============================================================================

# --- 1단계: 빌드 ---
# Node 22: CI(ci.yml)와 동일한 메이저 버전으로 통일한다.
# CI에서 통과한 코드가 Docker 빌드에서 실패하는 drift를 방지한다.
FROM node:22-alpine AS builder

WORKDIR /app

# package.json과 lock 파일을 먼저 복사하여 의존성 캐싱
COPY package.json package-lock.json ./
RUN npm ci

# 소스코드 복사 및 빌드
COPY . .
RUN npm run build

# --- 2단계: nginx로 서빙 ---
# nginxinc/nginx-unprivileged는 non-root(uid 101)로 실행되는 nginx 이미지이다.
# 기본 nginx 이미지와 달리 USER 전환이 불필요하며 컨테이너 보안 기본선에 맞다.
FROM nginxinc/nginx-unprivileged:alpine

# 빌드된 정적 파일을 nginx 서빙 디렉토리로 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA(Single Page Application) 지원을 위한 nginx 설정
# React Router가 클라이언트 사이드 라우팅을 처리하므로,
# 모든 경로를 index.html로 리다이렉트해야 한다.
# nginxinc/nginx-unprivileged는 non-root라 1024 이하 포트를 바인드할 수 없다.
# 5173은 1024 이상이므로 문제 없다.
RUN echo 'server { \
    listen 5173; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
