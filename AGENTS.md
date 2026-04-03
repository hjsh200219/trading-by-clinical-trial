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
src/index.ts                 # MCP server + tools 1-4
src/lib/analysis-engine.ts   # Orchestrator (resolve -> fetch -> score -> decide)
src/lib/scoring/*.ts         # 6 scoring components (100 pts total)
src/lib/technical/*.ts       # RSI, Bollinger, Volume Ratio (pure math)
src/lib/clinicaltrials-api.ts  # ClinicalTrials.gov v2 client
src/lib/naver-finance-api.ts   # Naver Finance chart client
src/lib/combo-scorer.ts          # Signal Combo Scoring Engine (10 combo patterns)
src/lib/decision-matrix.ts     # Priority-based decision labels
src/data/kr-pharma-companies.ts  # 32 company registry
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

## Documentation Map

### Architecture & Design
- [ARCHITECTURE.md](ARCHITECTURE.md) -- Root-level architecture overview
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) -- Detailed system design, data flow, dependencies
- [docs/DESIGN.md](docs/DESIGN.md) -- Design philosophy and key decisions
- [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md) -- Core engineering beliefs
- [docs/design-docs/layer-rules.md](docs/design-docs/layer-rules.md) -- Module dependency constraints

### Product & Analysis
- [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md) -- What the product does and who uses it
- [docs/product-specs/index.md](docs/product-specs/index.md) -- Product capabilities list
- [docs/clinical-trading-signal-logic.md](docs/clinical-trading-signal-logic.md) -- Full system design (original spec)

### Quality & Reliability
- [docs/QUALITY.md](docs/QUALITY.md) -- Testing, type safety, error handling
- [docs/QUALITY_SCORE.md](docs/QUALITY_SCORE.md) -- Quality assessment and metrics
- [docs/RELIABILITY.md](docs/RELIABILITY.md) -- Resilience, caching, degradation
- [docs/SECURITY.md](docs/SECURITY.md) -- Security posture, threat model

### Operations & Planning
- [docs/PLANS.md](docs/PLANS.md) -- Current state and future directions
- [docs/FRONTEND.md](docs/FRONTEND.md) -- UI/output format (MCP responses)
- [docs/exec-plans/tech-debt-tracker.md](docs/exec-plans/tech-debt-tracker.md) -- Known tech debt
- [docs/generated/db-schema.md](docs/generated/db-schema.md) -- Data schema reference

### Reference Data
- [references/scoring-methodology.md](references/scoring-methodology.md) -- Scoring component details
- [references/decision-matrix.md](references/decision-matrix.md) -- Decision label rules
- [references/kr-pharma-companies.md](references/kr-pharma-companies.md) -- Company mapping data
