import { TTLCache } from './cache.js';
import type { OHLCVData, StockSummary } from '../types.js';

/**
 * Naver Finance chart API client.
 * Replaces Yahoo Finance API for Korean stock data.
 * Uses https://fchart.stock.naver.com/siseJson.naver — no API key required.
 */
export class NaverFinanceApi {
  private cache: TTLCache;
  private baseUrl = 'https://fchart.stock.naver.com/siseJson.naver';
  private lastRequestTime = 0;
  private minRequestInterval = 300; // ms

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

  /**
   * Parse Naver Finance siseJson response.
   * Response is a JS array literal (not strict JSON):
   *   [['날짜','시가','고가','저가','종가','거래량','외국인소진율'],
   *    ["20250102", 180602, 181372, 173474, 173667, 599942, 22.14],
   *    ...]
   */
  private parseResponse(text: string): OHLCVData[] {
    try {
      // Remove whitespace and trailing commas before closing bracket
      const cleaned = text
        .replace(/'/g, '"')
        .replace(/,\s*]/g, ']')
        .replace(/,\s*,/g, ',')
        .trim();

      const parsed = JSON.parse(cleaned) as (string | number)[][];
      if (!Array.isArray(parsed) || parsed.length < 2) return [];

      // Skip header row
      return parsed.slice(1)
        .filter((row): row is [string, number, number, number, number, number, number] =>
          Array.isArray(row) && row.length >= 6 && typeof row[0] === 'string'
        )
        .map(row => ({
          date: `${row[0].substring(0, 4)}-${row[0].substring(4, 6)}-${row[0].substring(6, 8)}`,
          open: row[1],
          high: row[2],
          low: row[3],
          close: row[4],
          volume: row[5],
        }));
    } catch {
      return [];
    }
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  private rangeToStartDate(range: string): Date {
    const now = new Date();
    const match = range.match(/^(\d+)(mo|y|d)$/);
    if (!match) {
      // Default 3 months
      now.setMonth(now.getMonth() - 3);
      return now;
    }
    const [, numStr, unit] = match;
    const num = parseInt(numStr, 10);
    if (unit === 'mo') now.setMonth(now.getMonth() - num);
    else if (unit === 'y') now.setFullYear(now.getFullYear() - num);
    else if (unit === 'd') now.setDate(now.getDate() - num);
    return now;
  }

  /**
   * Get OHLCV price data for a Korean stock.
   * @param symbol KRX symbol (e.g. "068270") — NOT Yahoo format
   * @param range Range string: "3mo", "6mo", "1y", "90d" etc.
   */
  async getStockPrice(symbol: string, range = '3mo'): Promise<OHLCVData[]> {
    // Strip .KS / .KQ suffix if present
    const krxSymbol = symbol.replace(/\.(KS|KQ)$/i, '');

    const cacheKey = TTLCache.buildKey('naver-ohlcv', { symbol: krxSymbol, range });
    const cached = this.cache.get<OHLCVData[]>(cacheKey);
    if (cached !== undefined) return cached;

    const startDate = this.rangeToStartDate(range);
    const endDate = new Date();
    const url = `${this.baseUrl}?symbol=${krxSymbol}&requestType=1&startTime=${this.formatDate(startDate)}&endTime=${this.formatDate(endDate)}&timeframe=day`;

    try {
      const response = await this.fetchWithRetry(url);
      const text = await response.text();
      const data = this.parseResponse(text);
      this.cache.set(cacheKey, data);
      return data;
    } catch {
      return [];
    }
  }

  /**
   * Get stock summary (current price, 52w high/low, avg volume).
   * Uses 1-year data to compute 52-week stats.
   * @param symbol KRX symbol (e.g. "068270") — NOT Yahoo format
   */
  async getStockSummary(symbol: string): Promise<StockSummary | null> {
    const krxSymbol = symbol.replace(/\.(KS|KQ)$/i, '');

    const cacheKey = TTLCache.buildKey('naver-summary', { symbol: krxSymbol });
    const cached = this.cache.get<StockSummary>(cacheKey);
    if (cached !== undefined) return cached;

    const data = await this.getStockPrice(krxSymbol, '1y');
    if (data.length === 0) return null;

    const closes = data.map(d => d.close).filter(v => v != null && !isNaN(v));
    const highs = data.map(d => d.high).filter(v => v != null && !isNaN(v));
    const lows = data.map(d => d.low).filter(v => v != null && !isNaN(v));
    const volumes = data.map(d => d.volume).filter(v => v != null && v > 0);

    if (closes.length === 0) return null;

    const summary: StockSummary = {
      currentPrice: closes[closes.length - 1],
      high52w: Math.max(...highs),
      low52w: Math.min(...lows),
      avgVolume: volumes.length > 0
        ? Math.round(volumes.reduce((sum, v) => sum + v, 0) / volumes.length)
        : 0,
      currency: 'KRW',
    };

    this.cache.set(cacheKey, summary);
    return summary;
  }
}
