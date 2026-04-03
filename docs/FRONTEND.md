# Frontend

## 공통 금지 사항

- **이모지를 UI 아이콘으로 사용 금지.** OS/브라우저마다 렌더링이 다르고, 텍스트와 간격이 맞지 않음. SVG 아이콘 또는 Remixicon 사용.
- **미구현 페이지로 링크 금지.** 페이지가 없으면 disabled 처리 + "준비 중" 태그 표시.
- **E2E 테스트는 로그인/비로그인 두 상태 모두 검증.**
- **디자인 리뷰 시 모든 상태의 스크린샷 확인 필수.**


## Overview

CTI Pharma Analyzer has **no frontend**. It is a pure backend MCP (Model Context Protocol) server that communicates via stdio transport.

## User Interfaces

All user interaction happens through MCP-compatible clients:

| Interface | Method | Description |
|-----------|--------|-------------|
| Claude Code Plugin | `claude plugin add github:hjsh200219/trading-by-clinical-trial` | Skills and MCP tools integrated into Claude Code CLI |
| Claude Desktop | MCP server configuration in `claude_desktop_config.json` | Tools appear in Claude Desktop's tool palette |
| Remote MCP | `https://clinical-trials-mcp.up.railway.app/mcp` | URL-based MCP connection (Railway deployment) |

## Output Format

All MCP tool responses are **Markdown-formatted text**. This ensures readability in Claude UI and compatibility with any Markdown renderer.

Response structure:
- Headers (`## Section`)
- Tables (`| Col1 | Col2 |`)
- Inline formatting (bold for key values)
- Footer disclaimer

## Skills (Claude Code Plugin)

When installed as a Claude Code plugin, 6 skills are exposed via `SKILL.md` files in `skills/`:

| Skill | Trigger |
|-------|---------|
| `analyze-stock` | "셀트리온 분석해줘", "analyze 068270" |
| `score-stock` | "068270 스코어", "score Samsung Biologics" |
| `competition-analysis` | "유방암 경쟁 환경", "breast cancer competition" |
| `upcoming-catalysts` | "카탈리스트 목록", "upcoming Phase 3 catalysts" |
| `pipeline-overview` | "파이프라인 현황", "pipeline ranking" |
| `stock-technicals` | "알테오젠 기술적 지표", "RSI for 196170" |
