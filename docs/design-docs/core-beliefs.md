# Core Beliefs

## 1. Public Data Is Enough for Signal Generation

Clinical trial metadata from ClinicalTrials.gov and OHLCV price data from Naver Finance provide sufficient signal quality for pharma stock analysis. No proprietary broker API (KIS), short-selling data, or institutional flow is required for the core scoring engine.

## 2. Scoring Must Be Deterministic

Given the same inputs (trial metadata + OHLCV data), the same 100-point score and decision label must result. No randomness, no LLM-based scoring. All scoring logic is rule-based with fixed weights (30/25/15/15/10/5).

## 3. Every Scorer Owns Its Domain

Each of the 6 scoring components (temporal proximity, impact, market signal, competition, pipeline, data richness) is an independent module. Scorers must not import other scorers. This isolation ensures that changes to one scoring dimension never break another.

## 4. Graceful Degradation Over Hard Failure

When external APIs fail, the system must still return useful results. Missing OHLCV data means Market Signal = 0 (not an error). Missing trials mean a low-confidence result. The MCP server never crashes on data unavailability.

## 5. Technical Indicators Are Pure Math

RSI, Bollinger Bands, and Volume Ratio calculations are pure functions: arrays in, typed results out. They have no network calls, no side effects, no domain knowledge. This makes them independently testable and reusable.

## 6. Layer Boundaries Are Non-Negotiable

The dependency hierarchy (MCP Server -> Analysis Engine -> Domain Logic -> API Clients -> Technical Indicators -> Data/Types) must never be violated. Circular imports are forbidden. See `docs/design-docs/layer-rules.md`.

## 7. Decision Labels Are Not Investment Advice

Decision labels (TRIAL_STRONG_POSITIVE through TRIAL_NEGATIVE) represent clinical trial signal strength, not buy/sell recommendations. Every output includes a disclaimer. Agents must never reinterpret labels as direct investment advice.

## 8. Korean Pharma Focus Is Intentional

The 32-company registry is a curated, manually maintained list. Coverage is deliberately narrow to ensure high data quality per company. Adding companies requires code changes, not configuration.
