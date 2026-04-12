# draw.io 통합 (조건부 보조)

## 가용성 체크

draw.io는 MCP 서버 또는 CLI가 가용할 때만 병행 생성한다.
작업 시작 전 다음 순서로 체크한다:

1. MCP 서버 목록에서 `drawio` 키워드 검색
2. `which drawio` 로 CLI 바이너리 존재 확인
3. 둘 다 없으면 → mermaid only 로 진행 (이 파일의 나머지 무시)

## 현재 상태

이번 MVP 에서는 draw.io MCP 가 설치되어 있지 않다고 가정한다.
mermaid 다이어그램만 생성하며, draw.io 파일은 생성하지 않는다.

## 향후 draw.io MCP 설치 시

- `.drawio/` 디렉토리 하위에 mermaid 와 동일한 다이어그램을 draw.io XML 로 생성
- mermaid 는 git-friendly 원본으로 유지, draw.io 는 시각적 편집/공유용 보조
- 두 포맷 간 동기화는 수동 (자동 변환 도구가 성숙하지 않음)
