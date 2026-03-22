# CTI MCP Plugin — Clinical Trial Intelligence for Korean Pharma

A Claude Desktop MCP plugin that analyzes Korean pharmaceutical stocks based on clinical trial data from ClinicalTrials.gov and public market data from Yahoo Finance.

No KIS API required — works entirely with public data sources.

## Installation

```bash
npm install
npm run build
```

## Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cti-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/trading-by-clincial-trial/dist/index.js"]
    }
  }
}
```

## Tools

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `analyze_stock` | Full clinical trial + market analysis | `symbol`, `sponsor` |
| `search_pharma_trials` | Search ClinicalTrials.gov | `symbol`, `sponsor`, `keyword`, `phase`, `status` |
| `score_stock` | 100-point score breakdown | `symbol`, `sponsor` |
| `get_competition_analysis` | Competitive landscape | `nct_id`, `condition`, `exclude_sponsor` |
| `get_upcoming_catalysts` | Upcoming trial completions | `months`, `phase`, `symbol` |
| `get_kr_pharma_pipeline` | Korean pharma pipeline overview | `top`, `phase` |
| `get_stock_technicals` | RSI, Bollinger, Volume Ratio | `symbol`, `range` |

### Example Usage

```
analyze_stock({ symbol: "068270" })       // Celltrion
analyze_stock({ sponsor: "Daewoong" })    // By sponsor name
score_stock({ symbol: "207940" })         // Samsung Biologics score
get_stock_technicals({ symbol: "068270" })
get_upcoming_catalysts({ months: 3, phase: "Phase 3" })
get_kr_pharma_pipeline({ top: 10 })
get_competition_analysis({ condition: "Breast Cancer" })
```

## Scoring Methodology (100 points)

| Component | Max Points | Description |
|-----------|-----------|-------------|
| Temporal Proximity | 30 | How close is the trial to completion? |
| Impact | 25 | Phase and enrollment size |
| Market Signal | 15 | Technical indicators (RSI, Bollinger, Volume) |
| Competition | 15 | Global competitor landscape |
| Pipeline | 10 | Company's active trial portfolio |
| Data Richness | 5 | Metadata completeness |

## Decision Labels

Clinical-trial-scoped labels (not financial advice labels):

| Label | Meaning |
|-------|---------|
| `TRIAL_STRONG_POSITIVE` | High-confidence positive trial signal (strong clinical + favorable technicals) |
| `TRIAL_POSITIVE` | Positive trial signal |
| `TRIAL_NEUTRAL` | Neutral — insufficient signal strength |
| `TRIAL_WATCH` | Worth monitoring, not actionable yet |
| `TRIAL_REVIEW` | Results available, manual review needed |
| `TRIAL_NEGATIVE` | Negative signal (no active trials, poor pipeline) |

## Technical Indicators

| Indicator | Method | Interpretation |
|-----------|--------|----------------|
| RSI (14) | Wilder's smoothing | < 30 oversold, 30-70 neutral, > 70 overbought |
| Bollinger %B | 20-day SMA, 2 std dev | Position relative to upper/lower bands |
| Volume Ratio | Current / 20-day avg | < 0.5 low, 0.5-1.5 normal, 1.5-3.0 high, > 3.0 surge |

## Data Sources & Limitations

| Source | Data | Cache TTL |
|--------|------|-----------|
| ClinicalTrials.gov API v2 | Trial metadata, phases, enrollment, completion dates | 1 hour |
| Yahoo Finance | OHLCV price data (`.KS` KOSPI, `.KQ` KOSDAQ) | 15 minutes |

**Not available** (no KIS API):
- Institutional investor flow data
- Short selling ratios
- Real-time order book data

When Yahoo Finance is unavailable, the Market Signal score defaults to 0 with an explanation.

## Coverage

30+ Korean pharma/bio companies including Celltrion, Samsung Biologics, SK Biopharmaceuticals, Yuhan, Daewoong, HLB, Alteogen, and more.

## Development

```bash
npm test          # Run all tests
npm run build     # TypeScript compile
```

---

_This tool provides analysis based on clinical trial metadata and public market data. Not financial advice._
