# Layer Dependency Rules

## Layers (top to bottom)

```
┌─────────────────────────────────────┐
│  MCP Server (src/index.ts)          │  ← Tool definitions, formatting, transport
│  + tools-secondary.ts               │
├─────────────────────────────────────┤
│  Analysis Engine                    │  ← Orchestration, company resolution
│  (src/lib/analysis-engine.ts)       │
├─────────────────────────────────────┤
│  Domain Logic                       │  ← Scoring, decisions, competition mapping
│  scoring/*.ts                       │
│  decision-matrix.ts                 │
│  competition-mapper.ts              │
├─────────────────────────────────────┤
│  API Clients                        │  ← External service communication
│  clinicaltrials-api.ts              │
│  naver-finance-api.ts               │
│  (yahoo-finance-api.ts — legacy)    │
├─────────────────────────────────────┤
│  Technical Indicators               │  ← Pure math functions
│  technical/rsi.ts                   │
│  technical/bollinger.ts             │
│  technical/volume-ratio.ts          │
├─────────────────────────────────────┤
│  Data & Infrastructure              │  ← Static data, cache, types
│  data/kr-pharma-companies.ts        │
│  company-mapping.ts                 │
│  cache.ts                           │
│  types.ts                           │
└─────────────────────────────────────┘
```

## Dependency Rules

### MUST follow
1. **Types** (`types.ts`) — May be imported by any layer. Imports nothing from the project.
2. **Infrastructure** (`cache.ts`, `company-mapping.ts`, `data/*`) — May import only `types.ts`.
3. **Technical indicators** (`technical/*.ts`) — May import only `types.ts`. Must be pure functions (no side effects, no network).
4. **API clients** (`clinicaltrials-api.ts`, `naver-finance-api.ts`) — May import `types.ts` and `cache.ts`. Must not import scoring, decision, or analysis modules.
5. **Domain logic** (`scoring/*.ts`, `decision-matrix.ts`, `competition-mapper.ts`) — May import `types.ts`, `company-mapping.ts`, and `weights.ts`. Scorers must not import API clients or the analysis engine.
6. **Analysis engine** (`analysis-engine.ts`) — May import everything below it. Must not import `index.ts` or `tools-secondary.ts`.
7. **MCP server** (`index.ts`, `tools-secondary.ts`) — Top level. May import anything. Nothing should import from these.

### MUST NOT
- **Circular imports**: No module may create a circular dependency.
- **Scorer cross-imports**: Individual scorers must not import other scorers. They share only `weights.ts`.
- **Technical indicators importing API clients**: Technical functions are pure math — they receive arrays and return results.
- **Data layer importing domain logic**: `kr-pharma-companies.ts` and `company-mapping.ts` must not import scoring or decision modules.

## Module Responsibilities

| Module | Single Responsibility |
|--------|----------------------|
| `types.ts` | Type definitions only — no runtime logic |
| `cache.ts` | Generic TTL cache — no domain knowledge |
| `company-mapping.ts` | Symbol/sponsor lookup — no scoring, no API calls |
| Each scorer | Produce one `ScoreComponent` from inputs — no side effects |
| Each technical indicator | Compute one indicator from numeric arrays — no side effects |
| `decision-matrix.ts` | Map (trial, score, components, RSI) to a `DecisionResult` |
| `analysis-engine.ts` | Orchestrate data fetching + scoring into `StockAnalysis` |
| `index.ts` | Wire MCP tools, format responses, start transport |

## Adding New Components

### New Scorer
1. Create `src/lib/scoring/{name}-scorer.ts`
2. Export a function returning `ScoreComponent`
3. Add weight to `weights.ts` (adjust TOTAL to remain 100)
4. Wire into `AnalysisEngine.scoreTrial()`
5. Add tests in `tests/lib/scoring/{name}-scorer.test.ts`

### New Technical Indicator
1. Create `src/lib/technical/{name}.ts`
2. Export a pure function taking numeric array(s), returning a typed result
3. Add result type to `types.ts`
4. Wire into `AnalysisEngine.computeTechnicals()`
5. Add tests in `tests/technical/{name}.test.ts`

### New MCP Tool
1. Add to `index.ts` (tools 1-4) or `tools-secondary.ts` (tools 5+)
2. Define Zod schema for parameters
3. Add integration test in `tests/integration/mcp-tools.test.ts`
