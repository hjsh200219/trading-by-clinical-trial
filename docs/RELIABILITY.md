# Reliability

## External Service Resilience

### ClinicalTrials.gov API v2
- **Retry**: 3 attempts, exponential backoff (100ms base)
- **Cache TTL**: 1 hour — avoids hammering the public API
- **Failure mode**: Returns empty array `[]`. Scoring proceeds with 0 trials, producing a low-confidence result.
- **Rate limit**: No formal limit, but `pageSize=100` caps per-request volume.

### Naver Finance (fchart.stock.naver.com)
- **Retry**: 2 attempts, exponential backoff (100ms base)
- **Throttle**: 300ms minimum between requests to avoid IP blocks
- **Cache TTL**: 15 minutes — balances freshness with courtesy
- **Failure mode**: Returns empty OHLCV array. Technical indicators degrade gracefully to null. Market Signal score becomes 0.
- **Stale serve**: `TTLCache.getStale()` allows serving expired data when the API is temporarily down (currently not used in hot path but available).

### Yahoo Finance (legacy client)
- Same retry/throttle pattern as Naver
- **Not used in production** — `NaverFinanceApi` replaced it due to Yahoo blocking Korean stock requests

## Graceful Degradation

The system is designed so no single data source failure prevents a response:

| Missing Data | Effect |
|-------------|--------|
| No trials found | `bestTrial: null`, all trial scores empty, decision is TRIAL_WATCH |
| No OHLCV data | RSI/Bollinger/Volume all null, Market Signal = 0 pts |
| No stock summary | `marketData: null` in response |
| Partial technical data | Each indicator calculated independently; partial results still returned |
| No competitors found | Competition score = 15 (first mover advantage) |
| Missing trial fields | Data Richness score reflects gaps; Decision Matrix may downgrade to TRIAL_WATCH |

## Cache Behavior

```
Request --> Cache HIT (fresh)?  --> Return cached
                    |
                    NO
                    |
         Fetch from external API
                    |
            Success? --> Cache SET + Return
                    |
                    NO (all retries failed)
                    |
         Return fallback (empty/null)
```

- Cache is in-memory `Map` — cleared on process restart
- No cross-instance cache sharing (stateless MCP server)
- Each API client owns its own TTLCache instance

## Monitoring

- Fatal startup errors logged to stderr and trigger `process.exit(1)`
- MCP tool errors returned as structured error responses (never crash the server)
- No metrics/alerting infrastructure (single-process MCP server)

## Known Limitations

1. **No persistent storage**: All cache is lost on process restart. First request after restart incurs full API latency.
2. **Sequential trial scoring**: Each trial's competitor lookup is a separate API call. A company with many trials can result in many sequential ClinicalTrials.gov requests.
3. **Static company registry**: New companies require a code change to `kr-pharma-companies.ts`.
4. **No circuit breaker**: If ClinicalTrials.gov is fully down, retry exhaustion adds latency to every request.
5. **Single-threaded**: Node.js event loop handles all requests. CPU-bound scoring is fast, but network-bound API calls are the bottleneck.
