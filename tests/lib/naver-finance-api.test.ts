import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NaverFinanceApi } from '../../src/lib/naver-finance-api.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeNaverResponse(rows: [string, number, number, number, number, number, number][]) {
  const header = ['날짜', '시가', '고가', '저가', '종가', '거래량', '외국인소진율'];
  const data = [header, ...rows];
  // Naver returns a JS array literal with single quotes
  const text = JSON.stringify(data).replace(/"/g, "'");
  return {
    ok: true,
    text: async () => text,
  };
}

describe('NaverFinanceApi', () => {
  let api: NaverFinanceApi;

  beforeEach(() => {
    mockFetch.mockReset();
    api = new NaverFinanceApi(0); // TTL=0 to disable caching in tests
  });

  describe('getStockPrice', () => {
    it('should fetch OHLCV data for a KRX stock', async () => {
      const rows: [string, number, number, number, number, number, number][] = [
        ['20250101', 50000, 51000, 49000, 50500, 1000000, 22.14],
        ['20250102', 50500, 52000, 50000, 51500, 1200000, 22.14],
        ['20250103', 51500, 53000, 51000, 52500, 800000, 22.14],
      ];

      mockFetch.mockResolvedValueOnce(makeNaverResponse(rows));

      const result = await api.getStockPrice('068270', '3mo');
      expect(result).toHaveLength(3);
      expect(result[0].close).toBe(50500);
      expect(result[0].volume).toBe(1000000);
      expect(result[0].date).toBe('2025-01-01');
      expect(result[2].close).toBe(52500);
    });

    it('should strip .KS/.KQ suffix from symbol', async () => {
      const rows: [string, number, number, number, number, number, number][] = [
        ['20250101', 50000, 51000, 49000, 50500, 1000000, 22.14],
      ];

      mockFetch.mockResolvedValueOnce(makeNaverResponse(rows));

      const result = await api.getStockPrice('068270.KS', '3mo');
      expect(result).toHaveLength(1);
      // Verify the URL used the stripped symbol
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('symbol=068270');
      expect(calledUrl).not.toContain('.KS');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await api.getStockPrice('068270');
      expect(result).toEqual([]);
    });

    it('should handle empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '[]',
      });

      const result = await api.getStockPrice('999999');
      expect(result).toEqual([]);
    });
  });

  describe('getStockSummary', () => {
    it('should return stock summary with 52-week data', async () => {
      const rows: [string, number, number, number, number, number, number][] = Array.from(
        { length: 60 },
        (_, i) => [
          `2025${String(Math.floor(i / 28) + 1).padStart(2, '0')}${String((i % 28) + 1).padStart(2, '0')}`,
          50000 + i * 100,
          51000 + i * 100,
          49000 + i * 100,
          50500 + i * 100,
          1000000,
          22.14,
        ] as [string, number, number, number, number, number, number]
      );

      mockFetch.mockResolvedValueOnce(makeNaverResponse(rows));

      const summary = await api.getStockSummary('068270');
      expect(summary).toBeDefined();
      expect(summary!.currency).toBe('KRW');
      expect(summary!.currentPrice).toBeGreaterThan(0);
      expect(summary!.high52w).toBeGreaterThanOrEqual(summary!.low52w);
    });

    it('should return null when data unavailable', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'));

      const summary = await api.getStockSummary('999999');
      expect(summary).toBeNull();
    });
  });
});
