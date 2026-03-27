# Frontend

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
