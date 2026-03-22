#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AnalysisEngine } from './lib/analysis-engine.js';
import { ClinicalTrialsApi } from './lib/clinicaltrials-api.js';
import { NaverFinanceApi } from './lib/naver-finance-api.js';
import { mapCompetitors } from './lib/competition-mapper.js';
import { getAllCompanies } from './lib/company-mapping.js';
import { registerSecondaryTools } from './lib/tools-secondary.js';
import type {
  StockAnalysis,
  TrialScore,
  ScoreComponent,
  CompetitorInfo,
  MarketDataSection,
} from './types.js';

const SERVER_NAME = 'cti-mcp-plugin';
const SERVER_VERSION = '0.1.0';
const FOOTER = '_CTI MCP Plugin — Clinical trial metadata and public market data only. Not financial advice._';
const DISCLAIMER = 'Based on clinical trial metadata and public market data. Not financial advice.';

function errorResponse(message: string, suggestion: string): { content: [{ type: 'text'; text: string }] } {
  return {
    content: [
      {
        type: 'text',
        text: [
          '## Analysis Error',
          '',
          `**Status**: ERROR`,
          `**Message**: ${message}`,
          `**Suggestion**: ${suggestion}`,
          '---',
          FOOTER,
        ].join('\n'),
      },
    ],
  };
}

function formatDecision(decision: string): string {
  const map: Record<string, string> = {
    TRIAL_STRONG_POSITIVE: '🟢 STRONG POSITIVE',
    TRIAL_POSITIVE: '🟩 POSITIVE',
    TRIAL_NEUTRAL: '🟡 NEUTRAL',
    TRIAL_WATCH: '🟠 WATCH',
    TRIAL_REVIEW: '🔵 REVIEW',
    TRIAL_NEGATIVE: '🔴 NEGATIVE',
  };
  return map[decision] ?? decision;
}

function formatScoreComponents(components: ScoreComponent[]): string {
  return components
    .map((c) => `| ${c.name} | ${c.points} / ${c.maxPoints} | ${c.details} |`)
    .join('\n');
}

function formatTrialScore(t: TrialScore): string {
  return [
    `### ${t.nctId}`,
    `- **Drug**: ${t.drugName ?? 'N/A'}`,
    `- **Condition**: ${t.condition ?? 'N/A'}`,
    `- **Phase**: ${t.phase ?? 'N/A'}`,
    `- **Total Score**: ${t.totalScore}`,
    `- **Decision**: ${formatDecision(t.decision)}`,
    '',
    '| Component | Score | Details |',
    '|-----------|-------|---------|',
    formatScoreComponents(t.components),
  ].join('\n');
}

function formatMarketData(md: MarketDataSection): string {
  const lines = [
    '## Market Data',
    `- **Current Price**: ${md.currentPrice}`,
    `- **52W High**: ${md.high52w}`,
    `- **52W Low**: ${md.low52w}`,
  ];
  if (md.rsi) {
    lines.push(`- **RSI**: ${md.rsi.value.toFixed(1)} (${md.rsi.interpretation})`);
  }
  if (md.bollingerPercentB !== null) {
    lines.push(`- **Bollinger %B**: ${md.bollingerPercentB.toFixed(1)}%`);
  }
  if (md.volumeRatio) {
    lines.push(`- **Volume Ratio**: ${md.volumeRatio.ratio.toFixed(2)}x (${md.volumeRatio.interpretation})`);
  }
  if (md.stale) {
    lines.push('> _Note: Market data may be stale._');
  }
  return lines.join('\n');
}

function formatCompetitors(competitors: CompetitorInfo[]): string {
  if (competitors.length === 0) return '_No competitors found._';
  const rows = competitors
    .slice(0, 15)
    .map(
      (c) =>
        `| ${c.sponsor} | ${c.nctId} | ${c.phase} | ${c.status} | ${c.condition} | ${c.estimatedCompletion ?? 'N/A'} | ${c.isKorean ? 'KR' : '-'} |`
    )
    .join('\n');
  return [
    '| Sponsor | NCT ID | Phase | Status | Condition | Est. Completion | KR |',
    '|---------|--------|-------|--------|-----------|----------------|----|',
    rows,
  ].join('\n');
}

function formatFullAnalysis(analysis: StockAnalysis): string {
  const { company, bestTrial, allTrials, marketData, competitionSummary, disclaimer } = analysis;

  const sections: string[] = [
    `# CTI Analysis: ${company.nameEn} (${company.symbol})`,
    `**Korean Name**: ${company.nameKr}`,
    `**Market**: ${company.market}`,
    `**Sponsor Names**: ${company.sponsorNames.join(', ')}`,
    '',
  ];

  if (marketData) {
    sections.push(formatMarketData(marketData), '');
  }

  if (bestTrial) {
    sections.push('## Best Trial', formatTrialScore(bestTrial), '');
  } else {
    sections.push('## Best Trial', '_No trials found._', '');
  }

  if (allTrials.length > 1) {
    sections.push(`## All Trials (${allTrials.length} total)`);
    for (const t of allTrials) {
      sections.push(formatTrialScore(t), '');
    }
  }

  if (competitionSummary.length > 0) {
    sections.push('## Competition Landscape', formatCompetitors(competitionSummary), '');
  }

  sections.push('---', `_${disclaimer}_`);
  return sections.join('\n');
}

function formatScoreOnly(analysis: StockAnalysis): string {
  const { company, bestTrial, allTrials, marketData } = analysis;

  const sections: string[] = [
    `# Score Breakdown: ${company.nameEn} (${company.symbol})`,
    '',
  ];

  if (marketData?.rsi) {
    sections.push(`**RSI**: ${marketData.rsi.value.toFixed(1)} (${marketData.rsi.interpretation})`, '');
  }

  if (bestTrial) {
    sections.push(`## Best Trial — ${formatDecision(bestTrial.decision)}`, formatTrialScore(bestTrial), '');
  } else {
    sections.push('_No trials found._', '');
  }

  if (allTrials.length > 1) {
    sections.push('## Score Summary');
    for (const t of allTrials) {
      sections.push(`- **${t.nctId}** | ${t.phase ?? 'N/A'} | Score: ${t.totalScore} | ${formatDecision(t.decision)}`);
    }
    sections.push('');
  }

  sections.push('---', `_${DISCLAIMER}_`);
  return sections.join('\n');
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const ctApi = new ClinicalTrialsApi();
  const financeApi = new NaverFinanceApi();
  const engine = new AnalysisEngine(ctApi, financeApi);

  // Register tools 5-7 (upcoming catalysts, pipeline, technicals)
  registerSecondaryTools(server, ctApi, financeApi);

  // ── ping ─────────────────────────────────────────────────────────────────
  server.tool('ping', 'Health check — returns pong', {}, async () => ({
    content: [{ type: 'text', text: 'pong' }],
  }));

  // ── Tool 1: analyze_stock ─────────────────────────────────────────────────
  server.tool(
    'analyze_stock',
    'Full clinical trial + market analysis for a Korean pharma company. Provide symbol (e.g. "005930") or sponsor name.',
    {
      symbol: z.string().optional().describe('KRX ticker symbol, e.g. "207940"'),
      sponsor: z.string().optional().describe('Sponsor/company name as it appears in ClinicalTrials.gov'),
    },
    async ({ symbol, sponsor }) => {
      try {
        const company = engine.resolveCompany(symbol, sponsor);
        if (!company) {
          const known = getAllCompanies()
            .slice(0, 10)
            .map((c) => `${c.symbol} (${c.nameEn})`)
            .join(', ');
          return errorResponse(
            `Company not found for symbol="${symbol ?? ''}" sponsor="${sponsor ?? ''}"`,
            `Provide a valid KRX symbol or sponsor name. Examples: ${known}`
          );
        }

        const analysis = await engine.analyzeCompany(company);
        return {
          content: [{ type: 'text', text: formatFullAnalysis(analysis) }],
        };
      } catch (err) {
        return errorResponse(
          err instanceof Error ? err.message : String(err),
          'Check that the symbol/sponsor is correct and try again.'
        );
      }
    }
  );

  // ── Tool 2: search_pharma_trials ──────────────────────────────────────────
  server.tool(
    'search_pharma_trials',
    'Search ClinicalTrials.gov for Korean pharma company trials. Resolves symbol to sponsor names automatically.',
    {
      symbol: z.string().optional().describe('KRX ticker symbol — resolves to sponsor names automatically'),
      sponsor: z.string().optional().describe('Sponsor name to search directly'),
      keyword: z.string().optional().describe('Keyword search (condition, drug, etc.)'),
      phase: z.string().optional().describe('Trial phase, e.g. "Phase 3"'),
      status: z.string().optional().describe('Trial status, e.g. "RECRUITING"'),
    },
    async ({ symbol, sponsor, keyword, phase, status }) => {
      try {
        // Resolve symbol to sponsor names if provided
        let sponsorQuery = sponsor;
        let companyLabel = sponsor ?? keyword ?? 'query';

        if (symbol) {
          const company = engine.resolveCompany(symbol);
          if (company) {
            // Use first sponsor name for the API call; label with company info
            sponsorQuery = company.sponsorNames[0];
            companyLabel = `${company.nameEn} (${company.symbol})`;
          }
        }

        const trials = await ctApi.searchTrials({
          sponsor: sponsorQuery,
          keyword,
          phase,
          status,
        });

        if (trials.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: [
                  `## Search Results: ${companyLabel}`,
                  '',
                  '_No trials found matching the search criteria._',
                  '',
                  '---',
                  `_${DISCLAIMER}_`,
                ].join('\n'),
              },
            ],
          };
        }

        const rows = trials
          .map(
            (t) =>
              `| ${t.nctId} | ${t.drugName ?? 'N/A'} | ${t.condition ?? 'N/A'} | ${t.phase ?? 'N/A'} | ${t.status ?? 'N/A'} | ${t.estimatedCompletionDate ?? 'N/A'} | ${t.enrollment ?? 'N/A'} |`
          )
          .join('\n');

        const text = [
          `## Search Results: ${companyLabel}`,
          `**Total**: ${trials.length} trial(s)`,
          '',
          '| NCT ID | Drug | Condition | Phase | Status | Est. Completion | Enrollment |',
          '|--------|------|-----------|-------|--------|----------------|------------|',
          rows,
          '',
          '---',
          `_${DISCLAIMER}_`,
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (err) {
        return errorResponse(
          err instanceof Error ? err.message : String(err),
          'Check your search parameters and try again.'
        );
      }
    }
  );

  // ── Tool 3: score_stock ───────────────────────────────────────────────────
  server.tool(
    'score_stock',
    'Score breakdown for a Korean pharma company — shows all 6 scoring components and the decision.',
    {
      symbol: z.string().optional().describe('KRX ticker symbol, e.g. "207940"'),
      sponsor: z.string().optional().describe('Sponsor/company name'),
    },
    async ({ symbol, sponsor }) => {
      try {
        const company = engine.resolveCompany(symbol, sponsor);
        if (!company) {
          return errorResponse(
            `Company not found for symbol="${symbol ?? ''}" sponsor="${sponsor ?? ''}"`,
            'Provide a valid KRX symbol or sponsor name.'
          );
        }

        const analysis = await engine.analyzeCompany(company);
        return {
          content: [{ type: 'text', text: formatScoreOnly(analysis) }],
        };
      } catch (err) {
        return errorResponse(
          err instanceof Error ? err.message : String(err),
          'Check that the symbol/sponsor is correct and try again.'
        );
      }
    }
  );

  // ── Tool 4: get_competition_analysis ──────────────────────────────────────
  server.tool(
    'get_competition_analysis',
    'Map the competitive landscape for a given condition or specific trial. Returns all competing sponsors.',
    {
      nct_id: z.string().optional().describe('NCT ID to look up the condition from, e.g. "NCT04123456"'),
      condition: z.string().optional().describe('Condition/disease area to search competitors for'),
      exclude_sponsor: z.string().optional().describe('Sponsor name to exclude from results (the subject company)'),
    },
    async ({ nct_id, condition, exclude_sponsor }) => {
      try {
        let searchCondition = condition;

        if (nct_id && !searchCondition) {
          const trial = await ctApi.getTrialDetail(nct_id);
          if (!trial) {
            return errorResponse(
              `Trial ${nct_id} not found.`,
              'Verify the NCT ID is correct and the trial exists on ClinicalTrials.gov.'
            );
          }
          searchCondition = trial.condition ?? undefined;
          if (!searchCondition) {
            return errorResponse(
              `Trial ${nct_id} has no condition data.`,
              'Provide a condition keyword directly using the condition parameter.'
            );
          }
        }

        if (!searchCondition) {
          return errorResponse(
            'No condition or NCT ID provided.',
            'Provide either nct_id or condition to identify the therapeutic area.'
          );
        }

        const allTrials = await ctApi.searchTrials({ keyword: searchCondition });
        const subjectSponsor = exclude_sponsor ?? '';
        const competitors = subjectSponsor
          ? mapCompetitors(subjectSponsor, allTrials)
          : allTrials.map((t) => ({
              sponsor: t.sponsor ?? '',
              nctId: t.nctId,
              phase: t.phase ?? 'Unknown',
              status: t.status ?? 'Unknown',
              condition: t.condition ?? '',
              estimatedCompletion: t.estimatedCompletionDate,
              isKorean: false,
            }));

        const text = [
          `## Competition Analysis: ${searchCondition}`,
          `**Total competitors**: ${competitors.length}`,
          '',
          formatCompetitors(competitors),
          '',
          '---',
          `_${DISCLAIMER}_`,
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (err) {
        return errorResponse(
          err instanceof Error ? err.message : String(err),
          'Check parameters and try again.'
        );
      }
    }
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
