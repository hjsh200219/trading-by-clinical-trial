import type {
  KrPharmaCompany,
  ClinicalTrial,
  OHLCVData,
  RSIResult,
  BollingerResult,
  VolumeRatioResult,
  StockSummary,
  ScoreComponent,
  DecisionResult,
  TrialScore,
  StockAnalysis,
  MarketDataSection,
  CompetitorInfo,
} from '../types.js';
import { ClinicalTrialsApi } from './clinicaltrials-api.js';
import { YahooFinanceApi } from './yahoo-finance-api.js';
import {
  getCompanyBySymbol,
  getCompanyBySponsor,
  getYahooSymbol,
} from './company-mapping.js';
import { calculateRSI } from './technical/rsi.js';
import { calculateBollinger } from './technical/bollinger.js';
import { calculateVolumeRatio } from './technical/volume-ratio.js';
import { scoreTemporalProximity } from './scoring/temporal-proximity-scorer.js';
import { scoreImpact } from './scoring/impact-scorer.js';
import { scoreCompetition } from './scoring/competition-scorer.js';
import { scorePipeline } from './scoring/pipeline-scorer.js';
import { scoreDataRichness } from './scoring/data-richness-scorer.js';
import { scoreMarketSignal, type MarketSignalInput } from './scoring/market-signal-scorer.js';
import { makeDecision } from './decision-matrix.js';
import { mapCompetitors } from './competition-mapper.js';

const DISCLAIMER = 'Based on clinical trial metadata and public market data. Not financial advice.';

export class AnalysisEngine {
  private ctApi: ClinicalTrialsApi;
  private yahooApi: YahooFinanceApi;

  constructor(ctApi?: ClinicalTrialsApi, yahooApi?: YahooFinanceApi) {
    this.ctApi = ctApi ?? new ClinicalTrialsApi();
    this.yahooApi = yahooApi ?? new YahooFinanceApi();
  }

  resolveCompany(symbol?: string, sponsor?: string): KrPharmaCompany | undefined {
    if (symbol) {
      const bySymbol = getCompanyBySymbol(symbol.toUpperCase());
      if (bySymbol) return bySymbol;
    }
    if (sponsor) {
      const bySponsor = getCompanyBySponsor(sponsor);
      if (bySponsor) return bySponsor;
    }
    return undefined;
  }

  async computeTechnicals(yahooSymbol: string): Promise<{
    rsi: RSIResult | null;
    bollinger: BollingerResult | null;
    volumeRatio: VolumeRatioResult | null;
    summary: StockSummary | null;
  }> {
    const [ohlcv, summary] = await Promise.all([
      this.yahooApi.getStockPrice(yahooSymbol),
      this.yahooApi.getStockSummary(yahooSymbol),
    ]);

    const closes: number[] = (ohlcv as OHLCVData[])
      .map((d) => d.close)
      .filter((v) => v != null && !isNaN(v));
    const volumes: number[] = (ohlcv as OHLCVData[])
      .map((d) => d.volume)
      .filter((v) => v != null && !isNaN(v));

    let rsi: RSIResult | null = null;
    let bollinger: BollingerResult | null = null;
    let volumeRatio: VolumeRatioResult | null = null;

    try {
      if (closes.length >= 15) {
        rsi = calculateRSI(closes);
      }
    } catch {
      rsi = null;
    }

    try {
      if (closes.length >= 20) {
        bollinger = calculateBollinger(closes);
      }
    } catch {
      bollinger = null;
    }

    try {
      if (volumes.length >= 20) {
        volumeRatio = calculateVolumeRatio(volumes);
      }
    } catch {
      volumeRatio = null;
    }

    return { rsi, bollinger, volumeRatio, summary };
  }

  async scoreTrial(
    trial: ClinicalTrial,
    allCompanyTrials: ClinicalTrial[],
    competitorTrials: ClinicalTrial[],
    marketSignal: MarketSignalInput | null
  ): Promise<{ totalScore: number; components: ScoreComponent[]; decision: DecisionResult }> {
    const components: ScoreComponent[] = [
      scoreTemporalProximity(trial),
      scoreImpact(trial),
      scoreCompetition(trial, competitorTrials),
      scorePipeline(allCompanyTrials),
      scoreDataRichness(trial),
      scoreMarketSignal(marketSignal),
    ];

    const totalScore = components.reduce((sum, c) => sum + c.points, 0);
    const decision = makeDecision(trial, totalScore, components, marketSignal?.rsi ?? null);

    return { totalScore, components, decision };
  }

  async analyzeCompany(company: KrPharmaCompany): Promise<StockAnalysis> {
    const yahooSymbol = getYahooSymbol(company.symbol);

    // Fetch trials for all sponsor names in parallel
    const trialArrays = await Promise.all(
      company.sponsorNames.map((sponsor) => this.ctApi.searchTrials({ sponsor }))
    );

    // Merge and deduplicate by nctId
    const trialMap = new Map<string, ClinicalTrial>();
    for (const arr of trialArrays) {
      for (const t of arr) {
        trialMap.set(t.nctId, t);
      }
    }
    const allCompanyTrials = Array.from(trialMap.values());

    // Compute technicals if yahoo symbol is available
    let technicals: Awaited<ReturnType<AnalysisEngine['computeTechnicals']>> = {
      rsi: null,
      bollinger: null,
      volumeRatio: null,
      summary: null,
    };
    if (yahooSymbol) {
      technicals = await this.computeTechnicals(yahooSymbol);
    }

    const marketSignal: MarketSignalInput | null =
      technicals.rsi !== null || technicals.bollinger !== null || technicals.volumeRatio !== null
        ? {
            rsi: technicals.rsi,
            bollingerPercentB: technicals.bollinger?.percentB ?? null,
            volumeRatio: technicals.volumeRatio,
          }
        : null;

    // Score each trial
    const allTrialScores: TrialScore[] = [];
    for (const trial of allCompanyTrials) {
      // Competitors: trials in same condition but different sponsor
      const competitorTrials = trial.condition
        ? await this.ctApi.searchTrials({ keyword: trial.condition })
        : [];
      const filteredCompetitors = competitorTrials.filter(
        (t) => t.nctId !== trial.nctId && !company.sponsorNames.some(
          (s) => s.toLowerCase() === (t.sponsor ?? '').toLowerCase()
        )
      );

      const { totalScore, components, decision } = await this.scoreTrial(
        trial,
        allCompanyTrials,
        filteredCompetitors,
        marketSignal
      );

      allTrialScores.push({
        nctId: trial.nctId,
        drugName: trial.drugName,
        condition: trial.condition,
        phase: trial.phase,
        totalScore,
        components,
        decision: decision.decision,
      });
    }

    // Select best trial by totalScore
    const bestTrial =
      allTrialScores.length > 0
        ? allTrialScores.reduce((best, t) => (t.totalScore > best.totalScore ? t : best))
        : null;

    // Competition for best trial's condition
    let competitionSummary: CompetitorInfo[] = [];
    if (bestTrial?.condition) {
      const conditionTrials = await this.ctApi.searchTrials({ keyword: bestTrial.condition });
      const primarySponsor = company.sponsorNames[0] ?? company.nameEn;
      competitionSummary = mapCompetitors(primarySponsor, conditionTrials);
    }

    // Market data section
    let marketData: MarketDataSection | null = null;
    if (technicals.summary) {
      marketData = {
        currentPrice: technicals.summary.currentPrice,
        high52w: technicals.summary.high52w,
        low52w: technicals.summary.low52w,
        rsi: technicals.rsi,
        bollingerPercentB: technicals.bollinger?.percentB ?? null,
        volumeRatio: technicals.volumeRatio,
        stale: false,
      };
    }

    return {
      company,
      bestTrial,
      allTrials: allTrialScores,
      marketData,
      competitionSummary,
      disclaimer: DISCLAIMER,
    };
  }
}
