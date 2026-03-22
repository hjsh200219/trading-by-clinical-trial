import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisEngine } from '../../src/lib/analysis-engine.js';
import { ClinicalTrialsApi } from '../../src/lib/clinicaltrials-api.js';
import { YahooFinanceApi } from '../../src/lib/yahoo-finance-api.js';
import type { ClinicalTrial, OHLCVData, StockSummary } from '../../src/types.js';

// --- Helpers ---

function makeTrial(overrides: Partial<ClinicalTrial> = {}): ClinicalTrial {
  return {
    nctId: 'NCT00000001',
    drugName: 'CT-P13',
    condition: 'Rheumatoid Arthritis',
    phase: 'Phase 3',
    status: 'COMPLETED',
    estimatedCompletionDate: null,
    enrollment: 500,
    hasResults: false,
    sponsor: 'Celltrion',
    ...overrides,
  };
}

function makeOHLCV(count = 30): OHLCVData[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2024-01-${String(i + 1).padStart(2, '0')}`,
    open: 50000 + i * 100,
    high: 51000 + i * 100,
    low: 49000 + i * 100,
    close: 50500 + i * 100,
    volume: 200000 + i * 1000,
  }));
}

function makeSummary(): StockSummary {
  return {
    currentPrice: 180000,
    high52w: 220000,
    low52w: 140000,
    avgVolume: 500000,
    currency: 'KRW',
  };
}

// --- Mock setup ---

vi.mock('../../src/lib/clinicaltrials-api.js');
vi.mock('../../src/lib/yahoo-finance-api.js');

describe('AnalysisEngine', () => {
  let engine: AnalysisEngine;
  let ctApi: ClinicalTrialsApi;
  let yahooApi: YahooFinanceApi;

  beforeEach(() => {
    vi.clearAllMocks();
    ctApi = new ClinicalTrialsApi();
    yahooApi = new YahooFinanceApi();
    engine = new AnalysisEngine(ctApi, yahooApi);
  });

  // ── resolveCompany ──────────────────────────────────────────────────────────

  describe('resolveCompany', () => {
    it('resolves company by valid symbol', () => {
      const company = engine.resolveCompany('068270');
      expect(company).toBeDefined();
      expect(company?.nameEn).toBe('Celltrion');
    });

    it('resolves company by valid sponsor name', () => {
      const company = engine.resolveCompany(undefined, 'Celltrion Inc.');
      expect(company).toBeDefined();
      expect(company?.symbol).toBe('068270');
    });

    it('returns undefined for unrecognised input', () => {
      const company = engine.resolveCompany('ZZZZZZ', 'Unknown Pharma Corp');
      expect(company).toBeUndefined();
    });
  });

  // ── scoreTrial ──────────────────────────────────────────────────────────────

  describe('scoreTrial', () => {
    it('returns all 6 scoring components', async () => {
      const trial = makeTrial();
      const { components } = await engine.scoreTrial(trial, [trial], [], null);
      expect(components).toHaveLength(6);
    });

    it('totalScore equals sum of all component points', async () => {
      const trial = makeTrial();
      const { totalScore, components } = await engine.scoreTrial(
        trial,
        [trial],
        [],
        null
      );
      const sum = components.reduce((acc, c) => acc + c.points, 0);
      expect(totalScore).toBe(sum);
    });
  });

  // ── analyzeCompany ──────────────────────────────────────────────────────────

  describe('analyzeCompany', () => {
    it('returns StockAnalysis with all required fields populated', async () => {
      const trial = makeTrial();
      vi.mocked(ClinicalTrialsApi.prototype.searchTrials).mockResolvedValue([trial]);
      vi.mocked(YahooFinanceApi.prototype.getStockPrice).mockResolvedValue(makeOHLCV(30));
      vi.mocked(YahooFinanceApi.prototype.getStockSummary).mockResolvedValue(makeSummary());

      const company = engine.resolveCompany('068270')!;
      const result = await engine.analyzeCompany(company);

      expect(result.company).toBeDefined();
      expect(result.allTrials).toBeDefined();
      expect(result.disclaimer).toBeDefined();
      expect(result.competitionSummary).toBeDefined();
    });

    it('selects the trial with the highest totalScore as bestTrial', async () => {
      const trialLow = makeTrial({
        nctId: 'NCT00000001',
        phase: 'Phase 1',
        hasResults: false,
        enrollment: 10,
        estimatedCompletionDate: null,
      });
      const trialHigh = makeTrial({
        nctId: 'NCT00000002',
        phase: 'Phase 3',
        hasResults: false,
        enrollment: 600,
        estimatedCompletionDate: '2025-12-01',
      });

      vi.mocked(ClinicalTrialsApi.prototype.searchTrials).mockResolvedValue([
        trialLow,
        trialHigh,
      ]);
      vi.mocked(YahooFinanceApi.prototype.getStockPrice).mockResolvedValue(makeOHLCV(30));
      vi.mocked(YahooFinanceApi.prototype.getStockSummary).mockResolvedValue(makeSummary());

      const company = engine.resolveCompany('068270')!;
      const result = await engine.analyzeCompany(company);

      expect(result.bestTrial).not.toBeNull();
      // bestTrial must have score >= all others
      for (const t of result.allTrials) {
        expect(result.bestTrial!.totalScore).toBeGreaterThanOrEqual(t.totalScore);
      }
    });

    it('sets bestTrial to null when company has no trials', async () => {
      vi.mocked(ClinicalTrialsApi.prototype.searchTrials).mockResolvedValue([]);
      vi.mocked(YahooFinanceApi.prototype.getStockPrice).mockResolvedValue([]);
      vi.mocked(YahooFinanceApi.prototype.getStockSummary).mockResolvedValue(makeSummary());

      const company = engine.resolveCompany('068270')!;
      const result = await engine.analyzeCompany(company);

      expect(result.bestTrial).toBeNull();
      expect(result.allTrials).toHaveLength(0);
    });
  });

  // ── computeTechnicals ───────────────────────────────────────────────────────

  describe('computeTechnicals', () => {
    it('returns null indicators when Yahoo Finance returns empty array', async () => {
      vi.mocked(YahooFinanceApi.prototype.getStockPrice).mockResolvedValue([]);
      vi.mocked(YahooFinanceApi.prototype.getStockSummary).mockResolvedValue(makeSummary());

      const result = await engine.computeTechnicals('068270.KS');

      expect(result.rsi).toBeNull();
      expect(result.bollinger).toBeNull();
      expect(result.volumeRatio).toBeNull();
    });
  });
});
