# CTI Pharma Analyzer

Korean pharma/biotech clinical trial intelligence MCP server.
Scores stocks (100-point system) using ClinicalTrials.gov + Naver Finance public data.

## Quick Reference

```bash
npm install       # Install dependencies
npm run build     # TypeScript -> dist/
npm test          # Vitest (180 tests)
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

## MCP Tools

| Tool | Purpose |
|------|---------|
| `analyze_stock` | Full analysis |
| `search_pharma_trials` | Trial search |
| `score_stock` | Score breakdown |
| `get_competition_analysis` | Competitor landscape |
| `get_upcoming_catalysts` | Trial completion calendar |
| `get_kr_pharma_pipeline` | Pipeline ranking |
| `get_stock_technicals` | Technical indicators |

## Key Files for Agents

| Task | Files |
|------|-------|
| Add a company | `src/data/kr-pharma-companies.ts` |
| Change scoring weights | `src/lib/scoring/weights.ts` |
| Modify decision logic | `src/lib/decision-matrix.ts` |
| Add a new scorer | `src/lib/scoring/` + wire in `analysis-engine.ts` |
| Add a new MCP tool | `src/index.ts` or `src/lib/tools-secondary.ts` |
| Add a technical indicator | `src/lib/technical/` + wire in `analysis-engine.ts` |

## Docs Map

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) -- System design, data flow, dependencies
- [docs/QUALITY.md](docs/QUALITY.md) -- Testing, type safety, error handling
- [docs/RELIABILITY.md](docs/RELIABILITY.md) -- Resilience, caching, degradation
- [docs/design-docs/layer-rules.md](docs/design-docs/layer-rules.md) -- Module dependency constraints
- [docs/product-specs/index.md](docs/product-specs/index.md) -- Product capabilities
- [references/scoring-methodology.md](references/scoring-methodology.md) -- Scoring details
- [references/decision-matrix.md](references/decision-matrix.md) -- Decision label rules
