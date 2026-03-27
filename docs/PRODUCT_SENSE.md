# Product Sense

## What This Product Does

CTI Pharma Analyzer transforms raw clinical trial data into actionable investment signals for Korean pharma/biotech stocks. It bridges the gap between complex clinical trial metadata (ClinicalTrials.gov) and stock market analysis by providing:

1. **Quantitative scoring** (100-point system) that normalizes diverse trial characteristics into a single comparable metric
2. **Decision labels** (6 levels) that classify signal strength without providing direct investment advice
3. **Technical indicators** (RSI, Bollinger, Volume) that complement trial-based analysis with market context
4. **Competition mapping** that contextualizes a trial within its global therapeutic landscape

## Who Uses It

- **Individual investors** analyzing Korean pharma/biotech stocks
- **AI agents** (Claude) that need structured pharma analysis as an MCP tool
- **Research analysts** seeking a clinical trial signal layer for their existing workflows

## What It Does NOT Do

- **Not financial advice**: All outputs are labeled as metadata-based analysis
- **No real-time data**: OHLCV data is cached (15 min) and delayed
- **No broker integration**: No KIS API, no order execution, no portfolio management
- **No short selling or institutional flow data**: Score is based on public trial data + OHLCV only
- **No global coverage**: Only 32 Korean pharma/biotech companies

## Product Capabilities

See [product-specs/index.md](product-specs/index.md) for the full capabilities list.

## Distribution Channels

| Channel | Audience | Setup |
|---------|----------|-------|
| Claude Code Plugin | Claude Code CLI users | `claude plugin add github:hjsh200219/trading-by-clinical-trial` |
| Remote MCP URL | Any MCP-compatible client | `https://clinical-trials-mcp.up.railway.app/mcp` |
| Local MCP | Developers | `node dist/index.js` via stdio |

## Key Metrics (Conceptual)

| Metric | What It Measures |
|--------|-----------------|
| Score accuracy | Correlation between high CTI scores and subsequent stock performance |
| Coverage completeness | Percentage of active KR pharma trials captured |
| Data freshness | Cache hit rates and staleness of OHLCV/trial data |
| Tool latency | End-to-end response time for `analyze_stock` |
