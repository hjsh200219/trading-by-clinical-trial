# Product Specs Index

## Current Product

**CTI Pharma Analyzer** — Korean pharma/biotech clinical trial intelligence tool.

### Core Capabilities
1. **Stock Analysis** — Full analysis combining clinical trial data with market technicals
2. **Scoring** — 100-point composite score from 6 components
3. **Decision Labels** — 6-level classification (STRONG_POSITIVE to NEGATIVE)
4. **Competition Mapping** — Global competitor landscape for a therapeutic area
5. **Catalyst Tracking** — Upcoming trial completion events
6. **Pipeline Overview** — Ranking by active trial count
7. **Technical Indicators** — RSI, Bollinger %B, Volume Ratio

### Distribution Channels
| Channel | Method |
|---------|--------|
| Claude Code Plugin | `claude plugin add github:hjsh200219/trading-by-clinical-trial` |
| Remote MCP | `https://clinical-trials-mcp.up.railway.app/mcp` |
| Local MCP | `node dist/index.js` via stdio transport |

### Coverage
32 Korean pharma/biotech companies (KOSPI + KOSDAQ).

### Data Sources
- ClinicalTrials.gov API v2 (public, no auth)
- Naver Finance chart API (public, no auth)

### Constraints
- No KIS API (no short selling, institutional flow, real-time quotes)
- Not financial advice — metadata-based analysis only
