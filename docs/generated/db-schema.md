# Data Schema (Generated)

> This project is a stateless MCP server with no database. All data is either fetched from external APIs at runtime or defined as static TypeScript constants.

## Static Data: Company Registry

**Source**: `src/data/kr-pharma-companies.ts`

```typescript
interface KrPharmaCompany {
  symbol: string;        // KRX ticker (e.g. "068270")
  nameKr: string;        // Korean name (e.g. "셀트리온")
  nameEn: string;        // English name (e.g. "Celltrion")
  sponsorNames: string[]; // ClinicalTrials.gov sponsor name variants
  aliases: string[];     // Short aliases
  market: 'KS' | 'KQ';  // KOSPI or KOSDAQ
}
```

**Record count**: 32 companies

## Runtime Data: Clinical Trials

**Source**: ClinicalTrials.gov API v2 (fetched per request, cached 1 hour)

```typescript
interface ClinicalTrial {
  nctId: string;
  drugName: string | null;
  condition: string | null;
  phase: string | null;
  status: string | null;
  estimatedCompletionDate: string | null;
  enrollment: number | null;
  hasResults: boolean;
  sponsor: string | null;
}
```

## Runtime Data: Market Data

**Source**: Naver Finance chart API (fetched per request, cached 15 minutes)

```typescript
interface OHLCVData {
  date: string;    // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockSummary {
  currentPrice: number;
  high52w: number;
  low52w: number;
  avgVolume: number;
  currency: string;  // Always "KRW"
}
```

## Computed Data: Scoring

```typescript
interface ScoreComponent {
  name: string;       // e.g. "temporal_proximity"
  points: number;     // Earned points
  maxPoints: number;  // Maximum possible
  details: string;    // Human-readable explanation
}

interface TrialScore {
  nctId: string;
  drugName: string | null;
  condition: string | null;
  phase: string | null;
  totalScore: number;         // 0-100
  components: ScoreComponent[]; // 6 components
  decision: TrialDecision;    // Label enum
}
```

## Cache Layer

**Implementation**: `src/lib/cache.ts` (TTLCache)

| Cache Owner | TTL | Key Pattern |
|-------------|-----|-------------|
| ClinicalTrialsApi | 1 hour | `search:{params}`, `detail:{nctId}` |
| NaverFinanceApi | 15 min | `naver-ohlcv:{symbol,range}`, `naver-summary:{symbol}` |

No persistent storage. Cache resets on process restart.
