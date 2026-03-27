# Quality Standards

## Testing

### Framework
- **Vitest** with `globals: true`, 30s timeout per test
- Tests mirror `src/` structure under `tests/`

### Coverage Areas
| Area | Test File(s) | Focus |
|------|-------------|-------|
| Scoring (6 components) | `tests/lib/scoring/*.test.ts` | Edge cases, boundary values, weight consistency |
| Decision matrix | `tests/lib/decision-matrix.test.ts`, `decision-labels.test.ts` | Priority ordering, all label paths |
| Technical indicators | `tests/technical/rsi.test.ts`, `bollinger.test.ts`, `volume-ratio.test.ts` | Math accuracy, minimum data guards |
| API clients | `tests/lib/clinicaltrials-api.test.ts`, `naver-finance-api.test.ts`, `yahoo-finance-api.test.ts` | Parsing, caching, retry, error handling |
| Analysis engine | `tests/lib/analysis-engine.test.ts` | Orchestration, company resolution |
| MCP integration | `tests/integration/mcp-tools.test.ts` | Tool registration, input validation |
| Cache | `tests/lib/cache.test.ts` | TTL expiry, stale reads, key generation |
| Company mapping | `tests/lib/company-mapping.test.ts` | Symbol/sponsor lookup |
| Competition mapper | `tests/lib/competition-mapper.test.ts` | Sponsor exclusion, deduplication |

### Commands
```bash
npm test          # Run all tests once
npm run test:watch  # Watch mode
```

## Type Safety

- **strict: true** in tsconfig (all strict flags enabled)
- All external API responses typed or validated
- No `any` in application code (only `RawStudy = Record<string, any>` for ClinicalTrials.gov raw JSON)
- Zod schemas validate all MCP tool inputs

## Error Handling Patterns

1. **API clients**: Retry with exponential backoff (configurable attempts/delay). Return empty array/null on exhaustion — never throw to caller.
2. **Technical indicators**: Guard on minimum data length before calculation. Catch individually so partial results still return.
3. **MCP tools**: Wrap all handlers in try/catch. Return structured `errorResponse()` with user-friendly message + suggestion.
4. **Scoring**: Each scorer returns a valid ScoreComponent even with missing data (e.g., 0 or 1 point with explanatory detail string).

## Code Conventions

- ESM modules (`"type": "module"` in package.json)
- `.js` extensions in import paths (required for NodeNext resolution)
- Functions are pure where possible — state lives only in cache and API client instances
- No default exports — all exports are named
- Markdown-formatted MCP responses for readability in Claude UI

## Pre-commit Checks (recommended)

```bash
npm run build   # TypeScript compilation
npm test        # Vitest suite
```
