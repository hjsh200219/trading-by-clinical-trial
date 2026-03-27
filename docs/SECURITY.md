# Security

## Authentication & Authorization

### MCP Server
- **No authentication required**: The MCP server itself has no auth layer. Access control is managed by the MCP client (Claude Desktop, Claude Code).
- **No user sessions**: Stateless server with no login mechanism.

### External APIs
| API | Auth Method | Credentials |
|-----|-------------|-------------|
| ClinicalTrials.gov v2 | None | Public API, no keys |
| Naver Finance (fchart) | None | Public endpoint, no keys |
| Yahoo Finance (legacy) | None | Public endpoint, no keys |

**No secrets or API keys are required** to run the MCP server.

## Data Security

### No Persistent Storage
- All data is in-memory (TTLCache) and lost on process restart
- No database, no filesystem writes, no logs to disk
- No PII (personally identifiable information) is collected or stored

### Data Sources
- **ClinicalTrials.gov**: Public clinical trial metadata (fully public domain)
- **Naver Finance**: Public market price data (publicly available)
- No proprietary, confidential, or non-public data is used

## Network Security

### Outbound Requests Only
The server makes outbound HTTPS requests to:
1. `https://clinicaltrials.gov/api/v2/*`
2. `https://fchart.stock.naver.com/siseJson.naver*`

No inbound network connections are accepted (stdio transport only for local MCP; Railway handles HTTPS termination for remote MCP).

### Rate Limiting
- **Naver Finance**: Self-imposed 300ms minimum between requests to avoid IP blocks
- **ClinicalTrials.gov**: `pageSize=100` cap per request; 3 retries with exponential backoff

## Supply Chain

### Dependencies (Minimal)
| Package | Purpose | Risk |
|---------|---------|------|
| `@modelcontextprotocol/sdk` | MCP protocol implementation | Low (Anthropic-maintained) |
| `zod` | Input validation | Low (widely audited) |
| `typescript` (dev) | Compiler | Low |
| `vitest` (dev) | Test runner | Low |
| `@types/node` (dev) | Type definitions | Low |

Total: 2 runtime dependencies, 3 dev dependencies.

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Malicious MCP tool inputs | Zod schema validation on all tool parameters |
| API injection via symbol/sponsor | Parameters passed as URL query params (not path segments); URLSearchParams handles encoding |
| Cache poisoning | In-memory cache with TTL; resets on restart |
| Denial of service | Retry limits (2-3 attempts) and throttling prevent infinite loops |
| Sensitive data exposure | No secrets stored; no PII collected; all data sources are public |

## Compliance Notes

- **Not financial advice**: All outputs include disclaimers
- **Public data only**: No regulatory concerns with data sourcing
- **MIT License**: Open source, no proprietary restrictions
