/**
 * 5-Strategy Technical Analysis Engine
 *
 * Ported from coin-trading/src/lib/clinical/technical-scorer.ts
 * Adapted to use this project's OHLCVData type and existing indicator functions.
 *
 * Strategy 1: Elder BBP (Bull Bear Power + EMA + ADX)
 * Strategy 2: SuperTrend Pullback (SuperTrend + RSI + Stochastic + MACD)
 * Strategy 3: ICT IFVG (Inverted Fair Value Gap)
 * Strategy 4: Ross Cameron RSI + Bollinger Band Reversal (double bottom/top)
 * Strategy 5: Ross Cameron RSI Divergence + MACD Confirmation
 */

import type { OHLCVData, TechSignalDirection, TechStrategyResult, TechAnalysisSummary } from '../../types.js';

// ── Helper Indicator Functions ──

function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    result.push(sum / period);
  }
  return result;
}

function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result.push(sum / period);
  for (let i = period; i < values.length; i++) {
    result.push(values[i] * k + result[result.length - 1] * (1 - k));
  }
  return result;
}

function calcRSISeries(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];
  const rsiValues: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsiValues.push(avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + rs));

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const r = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + r));
  }
  return rsiValues;
}

function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9): { macd: number; signal: number; histogram: number }[] {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  if (emaFast.length === 0 || emaSlow.length === 0) return [];

  const offset = fast - 1;
  const macdLine: number[] = [];
  for (let i = 0; i < emaSlow.length; i++) {
    const fastIdx = i + (slow - fast);
    if (fastIdx >= 0 && fastIdx < emaFast.length) {
      macdLine.push(emaFast[fastIdx] - emaSlow[i]);
    }
  }
  if (macdLine.length < signal) return [];

  const signalLine = ema(macdLine, signal);
  const result: { macd: number; signal: number; histogram: number }[] = [];
  const signalOffset = macdLine.length - signalLine.length;
  for (let i = 0; i < signalLine.length; i++) {
    const m = macdLine[i + signalOffset];
    const s = signalLine[i];
    result.push({ macd: m, signal: s, histogram: m - s });
  }
  return result;
}

function calcStochastic(data: OHLCVData[], kPeriod = 14, dPeriod = 3): { k: number; d: number }[] {
  if (data.length < kPeriod) return [];
  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < data.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (data[j].high > highest) highest = data[j].high;
      if (data[j].low < lowest) lowest = data[j].low;
    }
    const range = highest - lowest;
    kValues.push(range === 0 ? 50 : ((data[i].close - lowest) / range) * 100);
  }
  const dValues = sma(kValues, dPeriod);
  const result: { k: number; d: number }[] = [];
  const dOffset = kValues.length - dValues.length;
  for (let i = 0; i < dValues.length; i++) {
    result.push({ k: kValues[i + dOffset], d: dValues[i] });
  }
  return result;
}

function calcBollingerBands(closes: number[], period = 20, mult = 2): { upper: number; middle: number; lower: number }[] {
  const result: { upper: number; middle: number; lower: number }[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    const mid = sum / period;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (closes[j] - mid) ** 2;
    const std = Math.sqrt(variance / period);
    result.push({ upper: mid + mult * std, middle: mid, lower: mid - mult * std });
  }
  return result;
}

function calcADX(data: OHLCVData[], period = 14): number[] {
  if (data.length < period * 2 + 1) return [];
  const trValues: number[] = [];
  const dmPlus: number[] = [];
  const dmMinus: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    trValues.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    const upMove = high - data[i - 1].high;
    const downMove = data[i - 1].low - low;
    dmPlus.push(upMove > downMove && upMove > 0 ? upMove : 0);
    dmMinus.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Wilder smoothing
  const smooth = (arr: number[]): number[] => {
    const result: number[] = [];
    let sum = 0;
    for (let i = 0; i < period; i++) sum += arr[i];
    result.push(sum);
    for (let i = period; i < arr.length; i++) {
      result.push(result[result.length - 1] - result[result.length - 1] / period + arr[i]);
    }
    return result;
  };

  const smoothTR = smooth(trValues);
  const smoothDMPlus = smooth(dmPlus);
  const smoothDMMinus = smooth(dmMinus);

  const dx: number[] = [];
  for (let i = 0; i < smoothTR.length; i++) {
    if (smoothTR[i] === 0) { dx.push(0); continue; }
    const diPlus = (smoothDMPlus[i] / smoothTR[i]) * 100;
    const diMinus = (smoothDMMinus[i] / smoothTR[i]) * 100;
    const sum = diPlus + diMinus;
    dx.push(sum === 0 ? 0 : (Math.abs(diPlus - diMinus) / sum) * 100);
  }

  if (dx.length < period) return [];
  const adx: number[] = [];
  let adxSum = 0;
  for (let i = 0; i < period; i++) adxSum += dx[i];
  adx.push(adxSum / period);
  for (let i = period; i < dx.length; i++) {
    adx.push((adx[adx.length - 1] * (period - 1) + dx[i]) / period);
  }
  return adx;
}

function calcSuperTrend(data: OHLCVData[], period = 10, multiplier = 3): { direction: 'up' | 'down' }[] {
  if (data.length < period + 1) return [];
  const atrValues: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    );
    atrValues.push(tr);
  }

  const atr: number[] = [];
  let atrSum = 0;
  for (let i = 0; i < period; i++) atrSum += atrValues[i];
  atr.push(atrSum / period);
  for (let i = period; i < atrValues.length; i++) {
    atr.push((atr[atr.length - 1] * (period - 1) + atrValues[i]) / period);
  }

  const results: { direction: 'up' | 'down' }[] = [];
  let upperBand = 0;
  let lowerBand = 0;
  let direction: 'up' | 'down' = 'up';

  for (let i = 0; i < atr.length; i++) {
    const dataIdx = i + period;
    if (dataIdx >= data.length) break;
    const hl2 = (data[dataIdx].high + data[dataIdx].low) / 2;
    const newUpper = hl2 + multiplier * atr[i];
    const newLower = hl2 - multiplier * atr[i];

    upperBand = i > 0 && newUpper < upperBand ? upperBand : newUpper;
    lowerBand = i > 0 && newLower > lowerBand ? lowerBand : newLower;

    if (data[dataIdx].close > upperBand) direction = 'up';
    else if (data[dataIdx].close < lowerBand) direction = 'down';

    results.push({ direction });
  }
  return results;
}

function calcBBP(data: OHLCVData[], period = 13): { bullPower: number; bearPower: number; netPower: number }[] {
  const closes = data.map(d => d.close);
  const emaValues = ema(closes, period);
  if (emaValues.length === 0) return [];
  const offset = data.length - emaValues.length;
  const result: { bullPower: number; bearPower: number; netPower: number }[] = [];
  for (let i = 0; i < emaValues.length; i++) {
    const idx = i + offset;
    const bullPower = data[idx].high - emaValues[i];
    const bearPower = data[idx].low - emaValues[i];
    result.push({ bullPower, bearPower, netPower: bullPower + bearPower });
  }
  return result;
}

// ── Strategy 1: Elder BBP ──

function evaluateElderBBP(data: OHLCVData[]): TechStrategyResult {
  const neutral: TechStrategyResult = { strategy: 'Elder BBP', direction: 'NEUTRAL', confidence: 0, details: '' };
  if (data.length < 50) return { ...neutral, details: 'Insufficient data (need 50+ days)' };

  const closes = data.map(d => d.close);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const adxData = calcADX(data, 14);
  const bbpData = calcBBP(data, 13);

  if (ema20.length === 0 || ema50.length === 0 || adxData.length === 0 || bbpData.length === 0) {
    return { ...neutral, details: 'Indicator calculation failed' };
  }

  const latestEma20 = ema20[ema20.length - 1];
  const latestEma50 = ema50[ema50.length - 1];
  const latestAdx = adxData[adxData.length - 1];
  const latestBbp = bbpData[bbpData.length - 1];

  const isUptrend = latestEma20 > latestEma50;
  const emaCrossPct = Math.abs(latestEma20 - latestEma50) / latestEma50 * 100;
  const adxStrong = latestAdx >= 25;

  if (!adxStrong) {
    return { ...neutral, details: `ADX ${latestAdx.toFixed(1)} < 25 (weak trend), EMA20/50 ${isUptrend ? 'bullish' : 'bearish'}` };
  }

  let direction: TechSignalDirection = 'NEUTRAL';
  let confidence = 0;
  const details: string[] = [];

  details.push(`EMA20/50 ${isUptrend ? 'bullish' : 'bearish'} (${emaCrossPct.toFixed(1)}%)`);
  details.push(`ADX ${latestAdx.toFixed(1)}`);

  if (isUptrend) {
    if (latestBbp.bearPower > -0.5 * Math.abs(latestBbp.bullPower) && latestBbp.bearPower < 0) {
      direction = 'LONG'; confidence = 0.8;
      details.push('BBP: bearPower near 0 (buy timing)');
    } else if (latestBbp.netPower > 0) {
      direction = 'LONG'; confidence = 0.6;
      details.push(`BBP: netPower ${latestBbp.netPower.toFixed(0)} (buy bias)`);
    }
  } else {
    if (latestBbp.bullPower < 0.5 * Math.abs(latestBbp.bearPower) && latestBbp.bullPower > 0) {
      direction = 'SHORT'; confidence = 0.8;
      details.push('BBP: bullPower near 0 (sell timing)');
    } else if (latestBbp.netPower < 0) {
      direction = 'SHORT'; confidence = 0.6;
      details.push(`BBP: netPower ${latestBbp.netPower.toFixed(0)} (sell bias)`);
    }
  }

  if (latestAdx >= 40) confidence = Math.min(1, confidence + 0.1);
  return { strategy: 'Elder BBP', direction, confidence, details: details.join(' | ') };
}

// ── Strategy 2: SuperTrend Pullback ──

function evaluateSuperTrendPullback(data: OHLCVData[]): TechStrategyResult {
  const neutral: TechStrategyResult = { strategy: 'SuperTrend Pullback', direction: 'NEUTRAL', confidence: 0, details: '' };
  if (data.length < 30) return { ...neutral, details: 'Insufficient data (need 30+ days)' };

  const closes = data.map(d => d.close);
  const stData = calcSuperTrend(data, 10, 3);
  const rsiData = calcRSISeries(closes, 14);
  const stochData = calcStochastic(data, 14, 3);
  const macdData = calcMACD(closes, 12, 26, 9);

  if (stData.length === 0 || rsiData.length === 0) return { ...neutral, details: 'Indicator calculation failed' };

  const latestST = stData[stData.length - 1];
  const latestRSI = rsiData[rsiData.length - 1];
  const latestStoch = stochData.length > 0 ? stochData[stochData.length - 1] : null;
  const latestMACD = macdData.length > 0 ? macdData[macdData.length - 1] : null;

  const details: string[] = [];
  let score = 0;

  if (latestST.direction === 'up') { score += 1; details.push('SuperTrend: UP'); }
  else { score -= 1; details.push('SuperTrend: DOWN'); }

  if (latestRSI >= 70) { details.push(`RSI ${latestRSI.toFixed(0)} (overbought)`); }
  else if (latestRSI <= 30) { details.push(`RSI ${latestRSI.toFixed(0)} (oversold)`); }
  else if (latestRSI >= 50) { score += 1; details.push(`RSI ${latestRSI.toFixed(0)} (buy bias)`); }
  else { score -= 1; details.push(`RSI ${latestRSI.toFixed(0)} (sell bias)`); }

  if (latestStoch) {
    if (latestST.direction === 'up' && latestStoch.k < 30) {
      score += 1; details.push(`Stoch K=${latestStoch.k.toFixed(0)} (pullback buy)`);
    } else if (latestST.direction === 'down' && latestStoch.k > 70) {
      score -= 1; details.push(`Stoch K=${latestStoch.k.toFixed(0)} (pullback sell)`);
    } else {
      details.push(`Stoch K=${latestStoch.k.toFixed(0)}`);
    }
  }

  if (latestMACD) {
    if (latestMACD.histogram > 0) { score += 1; details.push('MACD histogram +'); }
    else { score -= 1; details.push('MACD histogram -'); }
  }

  if (latestRSI >= 70 && score > 0) score = Math.max(0, score - 1);
  if (latestRSI <= 30 && score < 0) score = Math.min(0, score + 1);

  const maxScore = 4;
  let direction: TechSignalDirection = 'NEUTRAL';
  let confidence = 0;

  if (score >= 2) { direction = 'LONG'; confidence = Math.min(1, score / maxScore); }
  else if (score <= -2) { direction = 'SHORT'; confidence = Math.min(1, Math.abs(score) / maxScore); }

  return { strategy: 'SuperTrend Pullback', direction, confidence, details: details.join(' | ') };
}

// ── Strategy 3: ICT IFVG ──

interface FVGZone { type: 'bullish' | 'bearish'; high: number; low: number; candleIndex: number; }

function detectFVGs(data: OHLCVData[], lookback: number): FVGZone[] {
  const zones: FVGZone[] = [];
  const start = Math.max(0, data.length - lookback);
  for (let i = start + 2; i < data.length; i++) {
    const c0 = data[i - 2];
    const c2 = data[i];
    if (c0.high < c2.low) zones.push({ type: 'bullish', high: c2.low, low: c0.high, candleIndex: i });
    if (c0.low > c2.high) zones.push({ type: 'bearish', high: c0.low, low: c2.high, candleIndex: i });
  }
  return zones;
}

function evaluateICTIFVG(data: OHLCVData[]): TechStrategyResult {
  const neutral: TechStrategyResult = { strategy: 'ICT IFVG', direction: 'NEUTRAL', confidence: 0, details: '' };
  if (data.length < 20) return { ...neutral, details: 'Insufficient data (need 20+ days)' };

  const fvgs = detectFVGs(data, 30);
  if (fvgs.length === 0) return { ...neutral, details: 'No FVG found in last 30 days' };

  const invertedSignals: { zone: FVGZone; inversionType: 'LONG' | 'SHORT' }[] = [];
  for (let fi = fvgs.length - 1; fi >= 0; fi--) {
    const zone = fvgs[fi];
    for (let ci = zone.candleIndex + 1; ci < data.length; ci++) {
      const candle = data[ci];
      if (zone.type === 'bullish' && candle.close < zone.low) {
        invertedSignals.push({ zone, inversionType: 'SHORT' }); break;
      } else if (zone.type === 'bearish' && candle.close > zone.high) {
        invertedSignals.push({ zone, inversionType: 'LONG' }); break;
      }
    }
  }

  if (invertedSignals.length === 0) {
    return { ...neutral, details: `${fvgs.length} FVGs found, no inversion (IFVG)` };
  }

  const latest = invertedSignals[invertedSignals.length - 1];
  const lastCandle = data[data.length - 1];
  const zoneCenter = (latest.zone.high + latest.zone.low) / 2;
  const distancePct = Math.abs(lastCandle.close - zoneCenter) / lastCandle.close * 100;
  const confidence = distancePct < 2 ? 0.8 : distancePct < 5 ? 0.6 : 0.4;

  return {
    strategy: 'ICT IFVG',
    direction: latest.inversionType,
    confidence,
    details: `${latest.zone.type} FVG → IFVG inversion | zone: ${latest.zone.low.toFixed(0)}~${latest.zone.high.toFixed(0)} | distance: ${distancePct.toFixed(1)}%`,
  };
}

// ── Strategy 4: RC Bollinger Reversal ──

function evaluateRCBollingerReversal(data: OHLCVData[]): TechStrategyResult {
  const neutral: TechStrategyResult = { strategy: 'RC BandReversal', direction: 'NEUTRAL', confidence: 0, details: '' };
  if (data.length < 25) return { ...neutral, details: 'Insufficient data (need 25+ days)' };

  const closes = data.map(d => d.close);
  const rsiData = calcRSISeries(closes, 14);
  const bbData = calcBollingerBands(closes, 20, 2);

  if (rsiData.length < 5 || bbData.length < 5) return { ...neutral, details: 'Indicator calculation failed' };

  const latestRSI = rsiData[rsiData.length - 1];
  const latestBB = bbData[bbData.length - 1];

  const lookback = Math.min(10, data.length - 1);
  const recentData = data.slice(-lookback);
  const recentBB = bbData.slice(-Math.min(lookback, bbData.length));

  // Buy: RSI ≤ 35 + lower band + double bottom
  if (latestRSI <= 35) {
    const lows: { idx: number; low: number; belowBand: boolean }[] = [];
    for (let i = 1; i < recentData.length - 1; i++) {
      if (recentData[i].low < recentData[i - 1].low && recentData[i].low <= (recentData[i + 1]?.low ?? Infinity)) {
        const bbIdx = Math.min(i, recentBB.length - 1);
        lows.push({ idx: i, low: recentData[i].low, belowBand: recentBB[bbIdx] ? recentData[i].low <= recentBB[bbIdx].lower : false });
      }
    }
    if (lows.length >= 2) {
      const first = lows[lows.length - 2];
      const second = lows[lows.length - 1];
      if (first.belowBand && !second.belowBand) {
        return { strategy: 'RC BandReversal', direction: 'LONG', confidence: latestRSI <= 30 ? 0.8 : 0.6, details: `RSI ${latestRSI.toFixed(0)} | double bottom (1st outside, 2nd inside band) | BB lower ${latestBB.lower.toFixed(0)}` };
      }
    }
    if (data[data.length - 1].low <= latestBB.lower) {
      return { strategy: 'RC BandReversal', direction: 'LONG', confidence: 0.4, details: `RSI ${latestRSI.toFixed(0)} oversold | BB lower touch (no double bottom)` };
    }
  }

  // Sell: RSI ≥ 65 + upper band + double top
  if (latestRSI >= 65) {
    const highs: { idx: number; high: number; aboveBand: boolean }[] = [];
    for (let i = 1; i < recentData.length - 1; i++) {
      if (recentData[i].high > recentData[i - 1].high && recentData[i].high >= (recentData[i + 1]?.high ?? -Infinity)) {
        const bbIdx = Math.min(i, recentBB.length - 1);
        highs.push({ idx: i, high: recentData[i].high, aboveBand: recentBB[bbIdx] ? recentData[i].high >= recentBB[bbIdx].upper : false });
      }
    }
    if (highs.length >= 2) {
      const first = highs[highs.length - 2];
      const second = highs[highs.length - 1];
      if (first.aboveBand && !second.aboveBand) {
        return { strategy: 'RC BandReversal', direction: 'SHORT', confidence: latestRSI >= 70 ? 0.8 : 0.6, details: `RSI ${latestRSI.toFixed(0)} | double top (1st outside, 2nd inside band) | BB upper ${latestBB.upper.toFixed(0)}` };
      }
    }
    if (data[data.length - 1].high >= latestBB.upper) {
      return { strategy: 'RC BandReversal', direction: 'SHORT', confidence: 0.4, details: `RSI ${latestRSI.toFixed(0)} overbought | BB upper touch (no double top)` };
    }
  }

  return { ...neutral, details: `RSI ${latestRSI.toFixed(0)} (no entry zone)` };
}

// ── Strategy 5: RC Divergence ──

function evaluateRCDivergence(data: OHLCVData[]): TechStrategyResult {
  const neutral: TechStrategyResult = { strategy: 'RC Divergence', direction: 'NEUTRAL', confidence: 0, details: '' };
  if (data.length < 30) return { ...neutral, details: 'Insufficient data (need 30+ days)' };

  const closes = data.map(d => d.close);
  const rsiData = calcRSISeries(closes, 14);
  const macdData = calcMACD(closes, 12, 26, 9);

  if (rsiData.length < 10 || macdData.length < 3) return { ...neutral, details: 'Indicator calculation failed' };

  const rsiLookback = Math.min(20, rsiData.length);
  const recentRSI = rsiData.slice(-rsiLookback);
  const rsiOffset = data.length - rsiLookback;

  // Find RSI lows (bullish divergence)
  const rsiLows: { rsiVal: number; priceVal: number }[] = [];
  for (let i = 1; i < recentRSI.length - 1; i++) {
    if (recentRSI[i] < recentRSI[i - 1] && recentRSI[i] <= recentRSI[i + 1]) {
      const dataIdx = rsiOffset + i;
      if (dataIdx >= 0 && dataIdx < data.length) {
        rsiLows.push({ rsiVal: recentRSI[i], priceVal: data[dataIdx].low });
      }
    }
  }

  // Find RSI highs (bearish divergence)
  const rsiHighs: { rsiVal: number; priceVal: number }[] = [];
  for (let i = 1; i < recentRSI.length - 1; i++) {
    if (recentRSI[i] > recentRSI[i - 1] && recentRSI[i] >= recentRSI[i + 1]) {
      const dataIdx = rsiOffset + i;
      if (dataIdx >= 0 && dataIdx < data.length) {
        rsiHighs.push({ rsiVal: recentRSI[i], priceVal: data[dataIdx].high });
      }
    }
  }

  const latestMACD = macdData[macdData.length - 1];
  const prevMACD = macdData.length >= 2 ? macdData[macdData.length - 2] : null;

  // Bullish divergence: price low↓ + RSI low↑
  if (rsiLows.length >= 2) {
    const prev = rsiLows[rsiLows.length - 2];
    const curr = rsiLows[rsiLows.length - 1];
    if (curr.priceVal < prev.priceVal && curr.rsiVal > prev.rsiVal) {
      const macdGolden = prevMACD && prevMACD.histogram <= 0 && latestMACD.histogram > 0;
      if (macdGolden) {
        return { strategy: 'RC Divergence', direction: 'LONG', confidence: 0.8, details: 'Bullish divergence (price↓ RSI↑) + MACD golden cross' };
      }
      if (latestMACD.histogram > 0) {
        return { strategy: 'RC Divergence', direction: 'LONG', confidence: 0.5, details: 'Bullish divergence | MACD positive (cross unconfirmed)' };
      }
      return { ...neutral, details: 'Bullish divergence detected, waiting MACD cross' };
    }
  }

  // Bearish divergence: price high↑ + RSI high↓
  if (rsiHighs.length >= 2) {
    const prev = rsiHighs[rsiHighs.length - 2];
    const curr = rsiHighs[rsiHighs.length - 1];
    if (curr.priceVal > prev.priceVal && curr.rsiVal < prev.rsiVal) {
      const macdDead = prevMACD && prevMACD.histogram >= 0 && latestMACD.histogram < 0;
      if (macdDead) {
        return { strategy: 'RC Divergence', direction: 'SHORT', confidence: 0.8, details: 'Bearish divergence (price↑ RSI↓) + MACD death cross' };
      }
      if (latestMACD.histogram < 0) {
        return { strategy: 'RC Divergence', direction: 'SHORT', confidence: 0.5, details: 'Bearish divergence | MACD negative (cross unconfirmed)' };
      }
      return { ...neutral, details: 'Bearish divergence detected, waiting MACD cross' };
    }
  }

  return { ...neutral, details: 'No divergence detected' };
}

// ── Public API ──

/**
 * Run all 5 technical strategies and produce consensus signal.
 */
export function analyzeTechnicalStrategies(data: OHLCVData[]): TechAnalysisSummary {
  const strategies = [
    evaluateElderBBP(data),
    evaluateSuperTrendPullback(data),
    evaluateICTIFVG(data),
    evaluateRCBollingerReversal(data),
    evaluateRCDivergence(data),
  ];

  let totalScore = 0;
  let totalWeight = 0;

  for (const s of strategies) {
    const dirScore = s.direction === 'LONG' ? 1 : s.direction === 'SHORT' ? -1 : 0;
    totalScore += dirScore * s.confidence;
    totalWeight += s.confidence || 0.1;
  }

  const consensusScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  let consensus: TechSignalDirection = 'NEUTRAL';
  if (consensusScore >= 0.3) consensus = 'LONG';
  else if (consensusScore <= -0.3) consensus = 'SHORT';

  const activeStrategies = strategies.filter(s => s.direction !== 'NEUTRAL');
  const summary = activeStrategies.length > 0
    ? `Technical: ${consensus} (${activeStrategies.map(s => `${s.strategy}=${s.direction}`).join(', ')})`
    : 'Technical: No clear signal';

  return { strategies, consensus, consensusScore, summary };
}

/**
 * Format technical analysis for display.
 */
export function formatTechAnalysis(analysis: TechAnalysisSummary): string {
  const dirEmoji: Record<string, string> = { LONG: '📈', SHORT: '📉', NEUTRAL: '➡️' };
  const lines = [
    `${dirEmoji[analysis.consensus]} Technical: ${analysis.consensus} (score: ${(analysis.consensusScore * 100).toFixed(0)})`,
  ];
  for (const s of analysis.strategies) {
    if (s.direction !== 'NEUTRAL') {
      lines.push(`  ${s.strategy}: ${s.direction} (${(s.confidence * 100).toFixed(0)}%) — ${s.details}`);
    }
  }
  return lines.join('\n');
}
