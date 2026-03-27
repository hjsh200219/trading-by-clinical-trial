# Plans

## Current State

CTI Pharma Analyzer v0.1.0 is a working MCP server with:
- 7 MCP tools + ping
- 100-point scoring system (6 components)
- 6 decision labels
- 3 technical indicators (RSI, Bollinger, Volume Ratio)
- 32 Korean pharma/biotech companies
- 180 tests passing
- Deployed on Railway (remote MCP URL)
- Published as Claude Code plugin

## Execution Plans

Active and completed execution plans are tracked in `docs/exec-plans/`.

| Directory | Purpose |
|-----------|---------|
| [exec-plans/active/](exec-plans/active/) | Currently in-progress work |
| [exec-plans/completed/](exec-plans/completed/) | Finished plans (archive) |
| [exec-plans/tech-debt-tracker.md](exec-plans/tech-debt-tracker.md) | Known technical debt items |

## Potential Future Directions

> These are not committed plans. They represent areas that could add value based on the current architecture.

### Performance
- Parallelize trial scoring (currently sequential competitor lookups)
- Add circuit breaker for external APIs

### Coverage
- Expand company registry beyond 32 companies
- Add dynamic company discovery from DART filings

### Data Sources
- Integrate KIS API for institutional/short-selling signals (as described in `docs/clinical-trading-signal-logic.md`)
- Add FDA calendar events
- PubMed publication tracking for trial-related papers

### Analysis
- Backtest validation of scoring accuracy
- Historical score tracking and trend analysis
- AI-powered impact assessment (Azure OpenAI integration)
