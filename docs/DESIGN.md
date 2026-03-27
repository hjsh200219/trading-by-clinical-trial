# Design

## Design Philosophy

CTI Pharma Analyzer follows a layered, deterministic design optimized for agent-driven usage as an MCP server.

### Key Design Decisions

1. **Stateless MCP Server**: No database, no persistent state. All data is fetched from public APIs at runtime and cached in-memory. This simplifies deployment (single Node.js process) and eliminates data synchronization issues.

2. **Naver Finance over Yahoo Finance**: Yahoo Finance API frequently blocks Korean stock requests. Naver Finance's `siseJson.naver` endpoint provides reliable KRX OHLCV data without API keys or authentication.

3. **Pure Scoring (No KIS API)**: The scoring engine uses only publicly available data: clinical trial metadata from ClinicalTrials.gov and OHLCV data from Naver Finance. No broker API, no short selling data, no institutional flow. This makes the system freely deployable without any credentials.

4. **Company Registry as Code**: 32 Korean pharma/biotech companies are defined as a TypeScript constant array in `src/data/kr-pharma-companies.ts`. This ensures type safety and eliminates runtime data loading concerns. Trade-off: adding companies requires a code change.

5. **6-Component Scoring System**: The 100-point score decomposes into 6 independent, weighted components (30/25/15/15/10/5). Each component has its own scorer module, enabling isolated development and testing.

6. **Priority-Based Decision Matrix**: Decision labels are assigned by a strict priority-ordered rule chain in `src/lib/decision-matrix.ts`. The first matching rule wins. This prevents ambiguous or conflicting labels.

7. **3-Agent Orchestration**: Claude Code agents are structured as a 3-tier system:
   - `stock-analyst` (orchestrator): collects MCP data, delegates analysis
   - `sector-researcher`: adds qualitative industry context using external MCP tools
   - `investment-reporter`: compiles final reports from quantitative + qualitative inputs

## Design Documents

| Document | Description |
|----------|-------------|
| [design-docs/index.md](design-docs/index.md) | Design document index |
| [design-docs/core-beliefs.md](design-docs/core-beliefs.md) | Core engineering beliefs |
| [design-docs/layer-rules.md](design-docs/layer-rules.md) | Module dependency constraints |

## Related

- [ARCHITECTURE.md](ARCHITECTURE.md) -- System architecture and data flow
- [RELIABILITY.md](RELIABILITY.md) -- Resilience and degradation patterns
- [clinical-trading-signal-logic.md](clinical-trading-signal-logic.md) -- Original full-system design spec (includes planned KIS API features not implemented in MCP server)
