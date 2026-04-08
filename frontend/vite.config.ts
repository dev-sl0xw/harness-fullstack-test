// =============================================================================
// vite.config.ts - Vite 빌드 도구 설정
// =============================================================================
// Vite는 프론트엔드 개발 서버 + 빌드 도구이다.
//
// proxy 설정이 중요한 이유:
//   - 프론트엔드 (localhost:5173)에서 백엔드 (localhost:8080)로 API 호출 시
//     브라우저의 CORS(Cross-Origin Resource Sharing) 정책에 의해 차단될 수 있다.
//   - proxy를 설정하면 프론트엔드 서버가 API 요청을 백엔드로 대신 전달해준다.
//   - 브라우저 입장에서는 같은 출처(localhost:5173)로 요청하는 것이므로 CORS 문제 없음.
//
// 요청 흐름:
//   브라우저 → localhost:5173/api/users → Vite 프록시 → localhost:8080/api/users
// =============================================================================
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Docker 컨테이너에서 접근 가능하도록 모든 인터페이스에 바인딩
    port: 5173,
    proxy: {
      // /api로 시작하는 요청을 백엔드 서버로 프록시
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
