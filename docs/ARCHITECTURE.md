# Architecture

## System Overview

CTI Pharma Analyzer is an MCP (Model Context Protocol) server that scores Korean pharma/biotech stocks based on clinical trial metadata and public market data. It produces a 100-point composite score and a decision label per trial.

## Technology Stack

- **Runtime**: Node.js (ES2022, ESM)
- **Language**: TypeScript (strict mode)
- **Protocol**: MCP via `@modelcontextprotocol/sdk` (stdio transport)
- **Validation**: Zod (v4)
- **Tests**: Vitest (180 tests)
- **Deployment**: Railway (remote MCP URL) + Claude Code Plugin

## Directory Layout

```
src/
  index.ts                    # MCP server bootstrap + tools 1-4
  types.ts                    # All shared type definitions
  data/
    kr-pharma-companies.ts    # Static registry of 32 KR pharma companies
  lib/
    analysis-engine.ts        # Orchestrator: resolves company, fetches data, scores
    cache.ts                  # TTLCache — generic in-memory TTL cache
    clinicaltrials-api.ts     # ClinicalTrials.gov API v2 client
    naver-finance-api.ts      # Naver Finance chart API client (primary)
    yahoo-finance-api.ts      # Yahoo Finance API client (legacy, unused)
    company-mapping.ts        # Symbol/sponsor lookup helpers
    competition-mapper.ts     # Builds competitor list from trial results
    decision-matrix.ts        # Priority-based decision label assignment
    tools-secondary.ts        # MCP tools 5-7 (catalysts, pipeline, technicals)
    scoring/
      weights.ts              # Central weight constants (30/25/15/15/10/5)
      temporal-proximity-scorer.ts
      impact-scorer.ts
      competition-scorer.ts
      pipeline-scorer.ts
      data-richness-scorer.ts
      market-signal-scorer.ts
    technical/
      indicators.ts           # Barrel export for all technical indicators
      rsi.ts                  # RSI(14) — Wilder's smoothing
      bollinger.ts            # Bollinger %B — 20-SMA, 2 sigma
      volume-ratio.ts         # Current / 20-day average volume
skills/                       # Claude Code plugin skill definitions (SKILL.md)
tests/                        # Mirror of src/ structure for Vitest
references/                   # Human-readable methodology docs
```

## Data Flow

```
User Request (symbol/sponsor)
       |
  AnalysisEngine.resolveCompany()  --> kr-pharma-companies.ts registry
       |
  +----+----+
  |         |
  v         v
ClinicalTrialsApi      NaverFinanceApi
  searchTrials()       getStockPrice() / getStockSummary()
  |                    |
  v                    v
ClinicalTrial[]        OHLCVData[] / StockSummary
  |                    |
  +--------+-----------+
           |
    AnalysisEngine.scoreTrial()  (6 scorers)
           |
    DecisionMatrix.makeDecision()
           |
           v
    StockAnalysis { bestTrial, allTrials, marketData, competitionSummary }
           |
    Format as Markdown --> MCP tool response
```

## MCP Tools (7 + ping)

| # | Tool | Purpose |
|---|------|---------|
| 0 | `ping` | Health check |
| 1 | `analyze_stock` | Full analysis (trials + market + score + competition) |
| 2 | `search_pharma_trials` | Search ClinicalTrials.gov with auto symbol-to-sponsor mapping |
| 3 | `score_stock` | Score breakdown only |
| 4 | `get_competition_analysis` | Competitive landscape for a condition |
| 5 | `get_upcoming_catalysts` | Trial completion calendar within N months |
| 6 | `get_kr_pharma_pipeline` | Pipeline ranking by active trial count |
| 7 | `get_stock_technicals` | RSI / Bollinger / Volume for a symbol |

## Scoring System (100 points)

| Component | Max | Scorer Module |
|-----------|-----|---------------|
| Temporal Proximity | 30 | `temporal-proximity-scorer.ts` |
| Impact | 25 | `impact-scorer.ts` |
| Market Signal | 15 | `market-signal-scorer.ts` |
| Competition | 15 | `competition-scorer.ts` |
| Pipeline | 10 | `pipeline-scorer.ts` |
| Data Richness | 5 | `data-richness-scorer.ts` |

## Decision Labels

Priority-ordered in `decision-matrix.ts`:

1. `hasResults` -> TRIAL_REVIEW
2. Low data confidence -> TRIAL_WATCH
3. Phase 1 / Early Phase 1 -> TRIAL_WATCH
4. Score >= 75 + Phase 3 + D-30 + RSI < 50 -> TRIAL_STRONG_POSITIVE
5. Score >= 75 + Phase 3 + D-30 + RSI > 70 -> TRIAL_WATCH (overbought)
6. Score >= 60 -> TRIAL_POSITIVE
7. Score 40-59 -> TRIAL_NEUTRAL
8. Score < 40 -> TRIAL_WATCH

## External Dependencies

| Service | Usage | Auth |
|---------|-------|------|
| ClinicalTrials.gov API v2 | Trial metadata | None (public) |
| Naver Finance (fchart) | OHLCV price data for KRX | None (public) |
| Yahoo Finance (legacy) | Not currently used in production | None |

## Caching Strategy

- `TTLCache` — in-memory Map with configurable TTL
- ClinicalTrials.gov: 1 hour TTL (3,600,000 ms)
- Naver Finance: 15 min TTL (900,000 ms)
- Stale-serve fallback available via `getStale()`

## Key Design Decisions

1. **Naver Finance over Yahoo Finance**: Yahoo Finance API frequently blocks KR stock requests; Naver Finance's siseJson endpoint provides reliable KRX data without API keys.
2. **Pure scoring (no KIS API)**: Scoring uses only publicly available clinical trial metadata and OHLCV data. No broker API, no short selling data, no institutional flow.
3. **Stateless MCP server**: No database, no persistent state. All caching is in-memory per process lifetime.
4. **Company registry as code**: 32 companies are defined as a TypeScript constant array, not fetched dynamically.
