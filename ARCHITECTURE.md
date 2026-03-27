# Architecture

> Root-level architecture overview. For the full detailed version, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## System Type

**Stateless MCP server** -- Node.js (ES2022, ESM), TypeScript (strict), stdio transport.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Language | TypeScript (strict mode) |
| Protocol | MCP via `@modelcontextprotocol/sdk` |
| Validation | Zod v4 |
| Tests | Vitest (180 tests) |
| Deployment | Railway (remote MCP URL) + Claude Code Plugin |

## Layer Architecture

```
MCP Server (src/index.ts, tools-secondary.ts)
    |
Analysis Engine (src/lib/analysis-engine.ts)
    |
Domain Logic (scoring/*.ts, decision-matrix.ts, competition-mapper.ts)
    |
API Clients (clinicaltrials-api.ts, naver-finance-api.ts)
    |
Technical Indicators (technical/rsi.ts, bollinger.ts, volume-ratio.ts)
    |
Data & Types (data/kr-pharma-companies.ts, company-mapping.ts, cache.ts, types.ts)
```

**Rule**: Dependencies flow top-down only. No circular imports. Scorers are independent. Technical indicators are pure functions.

## Data Flow

```
User -> symbol/sponsor -> resolveCompany() -> KrPharmaCompany
    |                                              |
    +-- ClinicalTrials.gov API --> ClinicalTrial[] |
    +-- Naver Finance API ------> OHLCVData[]      |
    |                              StockSummary     |
    v                                               v
6 Scorers --> ScoreComponent[] --> makeDecision() --> TrialScore
    |
    v
StockAnalysis { bestTrial, allTrials, marketData, competitionSummary }
    |
    v
Markdown response --> MCP tool output
```

## External Dependencies

| Service | Data | Auth | Cache TTL |
|---------|------|------|-----------|
| ClinicalTrials.gov API v2 | Trial metadata | None (public) | 1 hour |
| Naver Finance (fchart) | OHLCV prices | None (public) | 15 min |

## Scoring (100 points)

| Component | Max | Scorer |
|-----------|-----|--------|
| Temporal Proximity | 30 | `temporal-proximity-scorer.ts` |
| Impact | 25 | `impact-scorer.ts` |
| Market Signal | 15 | `market-signal-scorer.ts` |
| Competition | 15 | `competition-scorer.ts` |
| Pipeline | 10 | `pipeline-scorer.ts` |
| Data Richness | 5 | `data-richness-scorer.ts` |

## Decision Labels (priority order)

1. hasResults -> TRIAL_REVIEW
2. Low data -> TRIAL_WATCH
3. Phase 1 -> TRIAL_WATCH
4. Score>=75 + P3 + D-30 + RSI<50 -> TRIAL_STRONG_POSITIVE
5. Score>=75 + P3 + D-30 + RSI>70 -> TRIAL_WATCH
6. Score>=60 -> TRIAL_POSITIVE
7. Score 40-59 -> TRIAL_NEUTRAL
8. Score<40 -> TRIAL_WATCH
