// =============================================================================
// main.tsx - React 앱 엔트리포인트
// =============================================================================
// 이 파일은 React 앱을 DOM에 마운트하는 시작점이다.
//
// StrictMode:
//   - 개발 모드에서만 활성화되는 도구
//   - 잠재적 문제(deprecated API 사용, 부수효과 등)를 감지하여 경고
//   - 프로덕션 빌드에서는 아무 영향 없음
// =============================================================================
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
