import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YahooFinanceApi } from '../../src/lib/yahoo-finance-api.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeYahooResponse(timestamps: number[], closes: number[], volumes: number[], opens?: number[], highs?: number[], lows?: number[]) {
  return {
    ok: true,
    json: async () => ({
      chart: {
        result: [{
          meta: {
            currency: 'KRW',
            regularMarketPrice: closes[closes.length - 1],
            fiftyTwoWeekHigh: Math.max(...closes),
            fiftyTwoWeekLow: Math.min(...closes),
          },
          timestamp: timestamps,
          indicators: {
            quote: [{
              open: opens ?? closes,
              high: highs ?? closes.map(c => c * 1.02),
              low: lows ?? closes.map(c => c * 0.98),
              close: closes,
              volume: volumes,
            }],
            adjclose: [{ adjclose: closes }],
          },
        }],
        error: null,
      },
    }),
  };
}

describe('YahooFinanceApi', () => {
  let api: YahooFinanceApi;

  beforeEach(() => {
    mockFetch.mockReset();
    api = new YahooFinanceApi();
  });

  describe('getStockPrice', () => {
    it('should fetch OHLCV data for a KOSPI stock', async () => {
      const timestamps = [1700000000, 1700086400, 1700172800];
      const closes = [50000, 51000, 52000];
      const volumes = [1000000, 1200000, 800000];

      mockFetch.mockResolvedValueOnce(makeYahooResponse(timestamps, closes, volumes));

      const result = await api.getStockPrice('068270.KS', '5d', '1d');
      expect(result).toHaveLength(3);
      expect(result[0].close).toBe(50000);
      expect(result[0].volume).toBe(1000000);
      expect(result[2].close).toBe(52000);
    });

    it('should return cached results on second call', async () => {
      mockFetch.mockResolvedValueOnce(makeYahooResponse([1700000000], [50000], [1000000]));

      await api.getStockPrice('068270.KS');
      await api.getStockPrice('068270.KS');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await api.getStockPrice('068270.KS');
      expect(result).toEqual([]);
    });

    it('should handle empty chart result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ chart: { result: null, error: 'Not found' } }),
      });

      const result = await api.getStockPrice('999999.KS');
      expect(result).toEqual([]);
    });
  });

  describe('getStockSummary', () => {
    it('should return stock summary with 52-week data', async () => {
      const closes = Array.from({ length: 60 }, (_, i) => 50000 + i * 100);
      const volumes = Array.from({ length: 60 }, () => 1000000);
      const timestamps = Array.from({ length: 60 }, (_, i) => 1700000000 + i * 86400);

      mockFetch.mockResolvedValueOnce(makeYahooResponse(timestamps, closes, volumes));

      const summary = await api.getStockSummary('068270.KS');
      expect(summary).toBeDefined();
      expect(summary!.currency).toBe('KRW');
      expect(summary!.currentPrice).toBeGreaterThan(0);
      expect(summary!.high52w).toBeGreaterThanOrEqual(summary!.low52w);
    });

    it('should return null when data unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fail')).mockRejectedValueOnce(new Error('fail'));

      const summary = await api.getStockSummary('999999.KS');
      expect(summary).toBeNull();
    });
  });
});
