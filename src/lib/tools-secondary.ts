import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ClinicalTrialsApi } from './clinicaltrials-api.js';
import { NaverFinanceApi } from './naver-finance-api.js';
import {
  getCompanyBySymbol,
  getAllCompanies,
} from './company-mapping.js';
import { calculateRSI } from './technical/rsi.js';
import { calculateBollinger } from './technical/bollinger.js';
import { calculateVolumeRatio } from './technical/volume-ratio.js';
import type { ClinicalTrial, KrPharmaCompany } from '../types.js';

export function registerSecondaryTools(
  server: McpServer,
  ctApi: ClinicalTrialsApi,
  financeApi: NaverFinanceApi
): void {
  // Tool 5: get_upcoming_catalysts
  server.tool(
    'get_upcoming_catalysts',
    'List upcoming clinical trial catalysts (completion dates) for Korean pharma companies within the next N months.',
    {
      months: z.number().int().min(1).max(36).optional(),
      phase: z.string().optional(),
      symbol: z.string().optional(),
    },
    async ({ months = 6, phase, symbol }) => {
      try {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() + months);
        const now = new Date();

        type CatalystRow = {
          date: string;
          company: KrPharmaCompany;
          trial: ClinicalTrial;
        };

        const rows: CatalystRow[] = [];

        if (symbol) {
          const company = getCompanyBySymbol(symbol);
          if (!company) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `## Error\n\nUnknown symbol: \`${symbol}\`. Please use a valid Korean pharma stock symbol.`,
                },
              ],
            };
          }
          for (const sponsorName of company.sponsorNames) {
            const trials = await ctApi.searchTrials({ sponsor: sponsorName });
            for (const trial of trials) {
              if (!trial.estimatedCompletionDate) continue;
              const d = new Date(trial.estimatedCompletionDate);
              if (d >= now && d <= cutoff) {
                if (phase && trial.phase !== phase) continue;
                rows.push({ date: trial.estimatedCompletionDate, company, trial });
              }
            }
          }
        } else {
          const companies = getAllCompanies();
          for (const company of companies) {
            for (const sponsorName of company.sponsorNames) {
              const trials = await ctApi.searchTrials({ sponsor: sponsorName });
              for (const trial of trials) {
                if (!trial.estimatedCompletionDate) continue;
                const d = new Date(trial.estimatedCompletionDate);
                if (d >= now && d <= cutoff) {
                  if (phase && trial.phase !== phase) continue;
                  rows.push({ date: trial.estimatedCompletionDate, company, trial });
                }
              }
            }
          }
        }

        rows.sort((a, b) => a.date.localeCompare(b.date));

        if (rows.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `## Upcoming Clinical Trial Catalysts\n\nNo catalysts found within the next ${months} month(s)${phase ? ` for phase \`${phase}\`` : ''}.`,
              },
            ],
          };
        }

        const header = `## Upcoming Clinical Trial Catalysts\n\n| Date | Company | Trial (NCT ID) | Drug | Condition | Phase |\n|------|---------|-----------------|------|-----------|-------|`;
        const tableRows = rows.map(({ date, company, trial }) => {
          const drug = trial.drugName ?? '—';
          const condition = trial.condition ?? '—';
          const trialPhase = trial.phase ?? '—';
          return `| ${date} | ${company.nameEn} | ${trial.nctId} | ${drug} | ${condition} | ${trialPhase} |`;
        });

        const text = [header, ...tableRows, '', '---', '_Based on clinical trial metadata. Not financial advice._'].join('\n');

        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: 'text' as const,
              text: `## Error\n\nFailed to fetch upcoming catalysts: ${msg}`,
            },
          ],
        };
      }
    }
  );

  // Tool 6: get_kr_pharma_pipeline
  server.tool(
    'get_kr_pharma_pipeline',
    'Overview of Korean pharma pipeline ranked by number of active clinical trials.',
    {
      top: z.number().int().min(1).max(50).optional(),
      phase: z.string().optional(),
    },
    async ({ top = 10, phase }) => {
      try {
        const companies = getAllCompanies();

        type PipelineRow = {
          company: KrPharmaCompany;
          trialCount: number;
          nearestCatalyst: string | null;
          phaseCounts: Record<string, number>;
        };

        const results: PipelineRow[] = [];

        for (const company of companies) {
          const allTrials: ClinicalTrial[] = [];
          for (const sponsorName of company.sponsorNames) {
            const params: { sponsor: string; phase?: string } = { sponsor: sponsorName };
            if (phase) params.phase = phase;
            const trials = await ctApi.searchTrials(params);
            allTrials.push(...trials);
          }

          if (allTrials.length === 0) continue;

          const phaseCounts: Record<string, number> = {};
          for (const trial of allTrials) {
            const p = trial.phase ?? 'Unknown';
            phaseCounts[p] = (phaseCounts[p] ?? 0) + 1;
          }

          const now = new Date();
          const futureDates = allTrials
            .map(t => t.estimatedCompletionDate)
            .filter((d): d is string => d !== null && new Date(d) >= now)
            .sort();

          results.push({
            company,
            trialCount: allTrials.length,
            nearestCatalyst: futureDates.length > 0 ? futureDates[0] : null,
            phaseCounts,
          });
        }

        results.sort((a, b) => b.trialCount - a.trialCount);
        const topResults = results.slice(0, top);

        if (topResults.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `## Korean Pharma Pipeline Overview\n\nNo pipeline data found${phase ? ` for phase \`${phase}\`` : ''}.`,
              },
            ],
          };
        }

        const formatPhaseMix = (phaseCounts: Record<string, number>): string => {
          return Object.entries(phaseCounts)
            .map(([p, count]) => {
              const short = p.replace('PHASE', 'P').replace('_', '').replace('phase', 'P').replace(' ', '');
              return `${short}:${count}`;
            })
            .join(' ');
        };

        const header = `## Korean Pharma Pipeline Overview\n\n| Rank | Company | Symbol | Active Trials | Nearest Catalyst | Phase Mix |\n|------|---------|--------|---------------|------------------|-----------| `;
        const tableRows = topResults.map(({ company, trialCount, nearestCatalyst, phaseCounts }, idx) => {
          const rank = idx + 1;
          const catalyst = nearestCatalyst ?? '—';
          const phaseMix = formatPhaseMix(phaseCounts);
          return `| ${rank} | ${company.nameEn} | ${company.symbol} | ${trialCount} | ${catalyst} | ${phaseMix} |`;
        });

        const text = [header, ...tableRows, '', '---', '_Based on clinical trial metadata. Not financial advice._'].join('\n');

        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: 'text' as const,
              text: `## Error\n\nFailed to fetch pipeline overview: ${msg}`,
            },
          ],
        };
      }
    }
  );

  // Tool 7: get_stock_technicals
  server.tool(
    'get_stock_technicals',
    'Get technical indicators (RSI, Bollinger Bands, Volume Ratio) for a Korean pharma stock.',
    {
      symbol: z.string(),
      range: z.string().optional(),
    },
    async ({ symbol, range = '3mo' }) => {
      try {
        const company = getCompanyBySymbol(symbol);
        if (!company) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `## Error\n\nUnknown symbol: \`${symbol}\`. Please use a valid Korean pharma stock symbol.`,
              },
            ],
          };
        }

        const [ohlcv, summary] = await Promise.all([
          financeApi.getStockPrice(company.symbol, range),
          financeApi.getStockSummary(company.symbol),
        ]);

        if (ohlcv.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `## Error\n\nNo price data available for \`${company.symbol}\` with range \`${range}\`.`,
              },
            ],
          };
        }

        const closes = ohlcv.map(d => d.close).filter(v => v != null && !isNaN(v));
        const volumes = ohlcv.map(d => d.volume).filter(v => v != null && !isNaN(v));

        let rsiRow = '| RSI (14) | N/A | Insufficient data |';
        let bollingerRow = '| Bollinger %B | N/A | Insufficient data |';
        let volumeRow = '| Volume Ratio | N/A | Insufficient data |';

        let summaryLine = 'Insufficient data for full technical analysis.';

        const interpretations: string[] = [];

        if (closes.length >= 15) {
          try {
            const rsi = calculateRSI(closes);
            rsiRow = `| RSI (14) | ${rsi.value} | ${rsi.interpretation} |`;
            interpretations.push(`RSI is ${rsi.interpretation} at ${rsi.value}`);
          } catch {
            // keep default
          }
        }

        if (closes.length >= 20) {
          try {
            const boll = calculateBollinger(closes);
            const bandPos = boll.percentB < 20 ? 'near lower band' : boll.percentB > 80 ? 'near upper band' : 'near middle band';
            bollingerRow = `| Bollinger %B | ${boll.percentB}% | ${bandPos} |`;
            interpretations.push(`price is ${bandPos} (${boll.percentB}%)`);
          } catch {
            // keep default
          }
        }

        if (volumes.length >= 21) {
          try {
            const vol = calculateVolumeRatio(volumes);
            volumeRow = `| Volume Ratio | ${vol.ratio}x | ${vol.interpretation} |`;
            interpretations.push(`volume is ${vol.interpretation} at ${vol.ratio}x average`);
          } catch {
            // keep default
          }
        }

        if (interpretations.length > 0) {
          summaryLine = interpretations.join('; ') + '.';
          summaryLine = summaryLine.charAt(0).toUpperCase() + summaryLine.slice(1);
        }

        const currentPrice = summary
          ? `${summary.currentPrice.toLocaleString()} ${summary.currency}`
          : `${closes[closes.length - 1]?.toLocaleString() ?? 'N/A'} KRW`;

        const lines = [
          `## ${company.nameEn} — Technical Indicators`,
          '',
          `**Symbol**: ${company.symbol}`,
          `**Current Price**: ${currentPrice}`,
          `**Range**: ${range}`,
          '',
          '| Indicator | Value | Interpretation |',
          '|-----------|-------|----------------|',
          rsiRow,
          bollingerRow,
          volumeRow,
          '',
          `**Summary**: ${summaryLine}`,
          '',
          '---',
          '_Based on public market data from Naver Finance. Not financial advice._',
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: 'text' as const,
              text: `## Error\n\nFailed to fetch technical indicators for \`${symbol}\`: ${msg}`,
            },
          ],
        };
      }
    }
  );
}
