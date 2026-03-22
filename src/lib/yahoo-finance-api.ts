import { TTLCache } from './cache.js';
import type { OHLCVData, StockSummary } from '../types.js';

export class YahooFinanceApi {
  private cache: TTLCache;
  private baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart';
  private lastRequestTime = 0;
  private minRequestInterval = 500; // ms

  constructor(cacheTtlMs: number = 900000) {
    this.cache = new TTLCache(cacheTtlMs);
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async fetchWithRetry(url: string, retries = 2, baseDelayMs = 100): Promise<Response> {
    let lastError: Error = new Error('Unknown error');
    for (let attempt = 0; attempt < retries; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt - 1)));
      }
      try {
        await this.throttle();
        const response = await fetch(url);
        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError;
  }

  async getStockPrice(yahooSymbol: string, range = '3mo', interval = '1d'): Promise<OHLCVData[]> {
    const cacheKey = TTLCache.buildKey('ohlcv', { symbol: yahooSymbol, range, interval });
    const cached = this.cache.get<OHLCVData[]>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const url = `${this.baseUrl}/${yahooSymbol}?range=${range}&interval=${interval}`;

    try {
      const response = await this.fetchWithRetry(url);
      const json = await response.json() as {
        chart: {
          result: Array<{
            meta: {
              currency: string;
              regularMarketPrice: number;
              fiftyTwoWeekHigh: number;
              fiftyTwoWeekLow: number;
            };
            timestamp: number[];
            indicators: {
              quote: Array<{
                open: number[];
                high: number[];
                low: number[];
                close: number[];
                volume: number[];
              }>;
            };
          }> | null;
          error: string | null;
        };
      };

      const result = json?.chart?.result;
      if (!result || result.length === 0) {
        return [];
      }

      const { timestamp, indicators } = result[0];
      const quote = indicators.quote[0];

      const data: OHLCVData[] = timestamp.map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i],
      }));

      this.cache.set(cacheKey, data);
      return data;
    } catch {
      return [];
    }
  }

  async getStockSummary(yahooSymbol: string): Promise<StockSummary | null> {
    const cacheKey = TTLCache.buildKey('summary', { symbol: yahooSymbol });
    const cached = this.cache.get<StockSummary>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const url = `${this.baseUrl}/${yahooSymbol}?range=1y&interval=1d`;

    try {
      const response = await this.fetchWithRetry(url);
      const json = await response.json() as {
        chart: {
          result: Array<{
            meta: {
              currency: string;
              regularMarketPrice: number;
              fiftyTwoWeekHigh: number;
              fiftyTwoWeekLow: number;
            };
            timestamp: number[];
            indicators: {
              quote: Array<{
                volume: number[];
              }>;
            };
          }> | null;
          error: string | null;
        };
      };

      const result = json?.chart?.result;
      if (!result || result.length === 0) {
        return null;
      }

      const { meta, indicators } = result[0];
      const volumes = indicators.quote[0].volume.filter(v => v != null && v > 0);
      const avgVolume = volumes.length > 0
        ? Math.round(volumes.reduce((sum, v) => sum + v, 0) / volumes.length)
        : 0;

      const summary: StockSummary = {
        currentPrice: meta.regularMarketPrice,
        high52w: meta.fiftyTwoWeekHigh,
        low52w: meta.fiftyTwoWeekLow,
        avgVolume,
        currency: meta.currency,
      };

      this.cache.set(cacheKey, summary);
      return summary;
    } catch {
      return null;
    }
  }
}
