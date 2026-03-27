# Tech Debt Tracker

## Active Tech Debt

### TD-001: Yahoo Finance API Client (Legacy, Unused)
- **File**: `src/lib/yahoo-finance-api.ts`
- **Impact**: Low (dead code)
- **Description**: Yahoo Finance was replaced by Naver Finance due to Yahoo blocking Korean stock requests. The Yahoo client remains in the codebase with tests but is not imported by any production code path.
- **Action**: Consider removing the file and its tests, or keep as a fallback adapter.
- **Priority**: Low

### TD-002: Sequential Trial Scoring
- **File**: `src/lib/analysis-engine.ts` (lines 162-178)
- **Impact**: Medium (performance)
- **Description**: Each trial's competitor lookup is a separate `searchTrials()` call. A company with many trials generates many sequential API requests. Could be parallelized or batched.
- **Priority**: Medium

### TD-003: Static Company Registry
- **File**: `src/data/kr-pharma-companies.ts`
- **Impact**: Low (maintenance burden)
- **Description**: Adding new companies requires a code change, rebuild, and redeploy. No dynamic discovery or configuration file.
- **Priority**: Low

### TD-004: No Circuit Breaker for External APIs
- **File**: `src/lib/clinicaltrials-api.ts`, `src/lib/naver-finance-api.ts`
- **Impact**: Medium (latency under failure)
- **Description**: When an external API is fully down, retry exhaustion adds latency to every request. A circuit breaker would fail fast after repeated failures.
- **Priority**: Medium

### TD-005: Plugin JSON References Yahoo Finance
- **File**: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
- **Impact**: Low (cosmetic)
- **Description**: Plugin metadata still references Yahoo Finance in descriptions, despite the switch to Naver Finance.
- **Priority**: Low

## Resolved Tech Debt

| ID | Description | Resolution | Date |
|----|-------------|------------|------|
| — | Yahoo Finance API blocking KR stocks | Replaced with Naver Finance API | 2025-03 |
