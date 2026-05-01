# CTI Pharma Analyzer

Korean pharma/biotech clinical trial intelligence MCP server.
Scores stocks (100-point system) using ClinicalTrials.gov + Naver Finance public data.

## Quick Reference

```bash
npm install       # Install dependencies
npm run build     # TypeScript -> dist/
npm test          # Vitest (186 tests)
npm start         # Run MCP server (stdio)
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full details.

```
src/index.ts                       # MCP server + tools 1-4
src/types.ts                       # All shared type definitions
src/lib/analysis-engine.ts         # Orchestrator (resolve -> fetch -> score -> decide)
src/lib/tools-secondary.ts         # MCP tools 5-7 (catalysts, pipeline, technicals)
src/lib/scoring/*.ts               # 6 scoring components (100 pts total) + weights
src/lib/technical/*.ts             # RSI, Bollinger, Volume Ratio, Indicators (pure math)
src/lib/clinicaltrials-api.ts      # ClinicalTrials.gov v2 client
src/lib/naver-finance-api.ts       # Naver Finance chart client
src/lib/yahoo-finance-api.ts       # Yahoo Finance client (legacy, unused)
src/lib/combo-scorer.ts            # Signal Combo Scoring Engine (10 combo patterns)
src/lib/decision-matrix.ts         # Priority-based decision labels
src/lib/company-mapping.ts         # Symbol/sponsor lookup helpers
src/lib/competition-mapper.ts      # Builds competitor list from trial results
src/lib/cache.ts                   # TTLCache -- generic in-memory TTL cache
src/data/kr-pharma-companies.ts    # 32 company registry
```

## Layer Rules

See [docs/design-docs/layer-rules.md](docs/design-docs/layer-rules.md).

**Top-down dependency only:**
MCP Server -> Analysis Engine -> Domain Logic (scoring, decisions) -> API Clients -> Technical Indicators -> Data/Types

- Scorers are independent: no cross-scorer imports
- Technical indicators are pure functions: no network, no side effects
- Types (`types.ts`) may be imported by any layer

## Scoring (100 pts)

| Component | Max | Weight |
|-----------|-----|--------|
| Temporal Proximity | 30 | How close to trial completion |
| Impact | 25 | Phase level + enrollment size |
| Market Signal | 15 | RSI + Bollinger + Volume |
| Competition | 15 | Competitor count + phase advantage |
| Pipeline | 10 | Active trial portfolio |
| Data Richness | 5 | Metadata completeness |

## Decision Labels (priority order)

1. hasResults -> TRIAL_REVIEW
2. Low data -> TRIAL_WATCH
3. Phase 1 -> TRIAL_WATCH
4. Score>=75 + P3 + D-30 + RSI<50 -> TRIAL_STRONG_POSITIVE
5. Score>=75 + P3 + D-30 + RSI>70 -> TRIAL_WATCH
6. Score>=60 -> TRIAL_POSITIVE
7. Score 40-59 -> TRIAL_NEUTRAL
8. Score<40 -> TRIAL_WATCH

## Agent Architecture

This project uses a 3-tier agent orchestration system for stock analysis, plus direct MCP tool access for programmatic use.

```
User Request
     |
     v
stock-analyst (orchestrator)
     |
     +-- MCP tools (cti-mcp-plugin) --> quantitative data
     |
     +-- sector-researcher (sub-agent) --> qualitative analysis
     |         |
     |         +-- External MCP tools (Clinical Trials, PubMed, ChEMBL)
     |
     +-- investment-reporter (sub-agent) --> final report
```

### Agent Definitions

| Agent | File | Model | Role |
|-------|------|-------|------|
| stock-analyst | `.claude/agents/stock-analyst.md` | sonnet | Orchestrator: collects MCP data, delegates to sub-agents |
| sector-researcher | `.claude/agents/sector-researcher.md` | sonnet | Industry research: qualitative analysis using external MCP tools |
| investment-reporter | `.claude/agents/investment-reporter.md` | sonnet | Report writer: 6-section analyst report from quant + qual data |

## MCP Tools (cti-mcp-plugin)

| Tool | Purpose | Key Params |
|------|---------|-----------|
| `analyze_stock` | Full analysis (score + market + competition) | `symbol`, `sponsor` |
| `search_pharma_trials` | ClinicalTrials.gov search | `symbol`, `sponsor`, `keyword`, `phase`, `status` |
| `score_stock` | Score breakdown only | `symbol`, `sponsor` |
| `get_competition_analysis` | Competitive landscape | `nct_id`, `condition`, `exclude_sponsor` |
| `get_upcoming_catalysts` | Trial completion calendar | `months`, `phase`, `symbol` |
| `get_kr_pharma_pipeline` | Pipeline ranking | `top`, `phase` |
| `get_stock_technicals` | RSI / Bollinger / Volume | `symbol`, `range` |

## Plugin Skills

| Skill | Directory | Trigger Examples |
|-------|-----------|-----------------|
| analyze-stock | `skills/analyze-stock/` | "셀트리온 분석해줘" |
| score-stock | `skills/score-stock/` | "068270 스코어" |
| competition-analysis | `skills/competition-analysis/` | "유방암 경쟁 환경" |
| upcoming-catalysts | `skills/upcoming-catalysts/` | "카탈리스트 목록" |
| pipeline-overview | `skills/pipeline-overview/` | "파이프라인 현황" |
| stock-technicals | `skills/stock-technicals/` | "알테오젠 기술적 지표" |

## Key Files for Common Tasks

| Task | Files to Edit |
|------|--------------|
| Add a company | `src/data/kr-pharma-companies.ts` |
| Change scoring weights | `src/lib/scoring/weights.ts` |
| Modify decision logic | `src/lib/decision-matrix.ts` |
| Add a new scorer | `src/lib/scoring/` + wire in `analysis-engine.ts` |
| Add a new MCP tool | `src/index.ts` or `src/lib/tools-secondary.ts` |
| Add a technical indicator | `src/lib/technical/` + wire in `analysis-engine.ts` |
| Add a new agent | `.claude/agents/` |
| Add a new skill | `skills/{name}/SKILL.md` |

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) -- Architecture overview
- [docs/index.md](docs/index.md) -- Full documentation map (design, quality, plans, references)

> Be concise. No filler. Straight to the point. Use fewer words.


## TDD 필수

모든 새 기능/로직 변경은 반드시 TDD로 개발한다.
1. Red: 실패하는 테스트 먼저 작성
2. Green: 테스트를 통과하는 최소 코드 작성
3. Refactor: 코드 정리
테스트 없는 코드 변경은 허용하지 않는다.

---

## Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## 세션 시작 시 Handoff 강제

세션을 시작할 때 프로젝트 루트에 `handoff.md` 파일이 있는지 먼저 확인한다.
- `handoff.md`가 존재하면 다른 어떤 작업보다 먼저 **반드시 전체를 읽고 인수인계 컨텍스트를 파악한 뒤 시작**한다.
- 파일이 없으면 정상 진행한다.

이 규칙은 이전 세션의 미완료 작업·결정 사항·주의사항을 놓치지 않기 위한 강제 사항이다.

**이 프로젝트의 handoff 위치**: 없음 (생성 시 `.claude-project/HANDOFF.md` 권장)
