import { TTLCache } from './cache.js';
import type { ClinicalTrial } from '../types.js';

interface SearchParams {
  sponsor?: string;
  keyword?: string;
  phase?: string;
  status?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawStudy = Record<string, any>;

export class ClinicalTrialsApi {
  private cache: TTLCache;
  private baseUrl = 'https://clinicaltrials.gov/api/v2';
  private retryDelayMs: number;

  constructor(cacheTtlMs: number = 3600000, retryDelayMs: number = 100) {
    this.cache = new TTLCache(cacheTtlMs);
    this.retryDelayMs = retryDelayMs;
  }

  async searchTrials(params: SearchParams): Promise<ClinicalTrial[]> {
    const cacheKey = TTLCache.buildKey('search', params as Record<string, unknown>);
    const cached = this.cache.get<ClinicalTrial[]>(cacheKey);
    if (cached !== undefined) return cached;

    const url = this.buildSearchUrl(params);
    const data = await this.fetchWithRetry(url);
    if (!data) return [];

    const studies: RawStudy[] = data.studies ?? [];
    const results = studies.map((s: RawStudy) => this.parseTrial(s));
    this.cache.set(cacheKey, results);
    return results;
  }

  async getTrialDetail(nctId: string): Promise<ClinicalTrial | null> {
    const cacheKey = `detail:${nctId}`;
    const cached = this.cache.get<ClinicalTrial>(cacheKey);
    if (cached !== undefined) return cached;

    const url = `${this.baseUrl}/studies/${nctId}`;
    const data = await this.fetchWithRetry(url);
    if (!data) return null;

    const trial = this.parseTrialDetail(data);
    this.cache.set(cacheKey, trial);
    return trial;
  }

  private buildSearchUrl(params: SearchParams): string {
    const query = new URLSearchParams({ pageSize: '100' });
    if (params.sponsor) query.set('query.spons', params.sponsor);
    if (params.keyword) query.set('query.term', params.keyword);
    if (params.phase) query.set('filter.advanced', `AREA[Phase]${params.phase}`);
    if (params.status) query.set('filter.overallStatus', params.status);
    return `${this.baseUrl}/studies?${query.toString()}`;
  }

  private async fetchWithRetry(url: string, maxAttempts: number = 3): Promise<RawStudy | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json() as RawStudy;
      } catch {
        if (attempt < maxAttempts - 1) {
          await this.delay(this.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseTrial(raw: RawStudy): ClinicalTrial {
    const proto = raw.protocolSection ?? {};
    return this.extractFields(proto, raw.hasResults ?? false);
  }

  private parseTrialDetail(raw: RawStudy): ClinicalTrial {
    const proto = raw.protocolSection ?? {};
    return this.extractFields(proto, raw.hasResults ?? false);
  }

  private extractFields(proto: RawStudy, hasResults: boolean): ClinicalTrial {
    const id = proto.identificationModule ?? {};
    const arms = proto.armsInterventionsModule ?? {};
    const conds = proto.conditionsModule ?? {};
    const design = proto.designModule ?? {};
    const status = proto.statusModule ?? {};
    const sponsor = proto.sponsorCollaboratorsModule ?? {};

    const interventions: RawStudy[] = arms.interventions ?? [];
    const drugIntervention = interventions.find(
      (i: RawStudy) => i.type === 'DRUG'
    );

    const conditions: string[] = conds.conditions ?? [];
    const phases: string[] = design.phases ?? [];
    const enrollmentInfo = design.enrollmentInfo ?? {};
    const completionDateStruct = status.completionDateStruct ?? {};

    const drugName = drugIntervention?.name ?? null;
    const condition = conditions.length > 0 ? conditions.join(', ') : null;
    const phase = phases.length > 0 ? phases[phases.length - 1] : null;
    const enrollment =
      enrollmentInfo.count != null ? (enrollmentInfo.count as number) : null;
    const estimatedCompletionDate = this.normalizeDate(completionDateStruct.date);

    return {
      nctId: id.nctId ?? '',
      drugName,
      condition,
      phase,
      status: status.overallStatus ?? null,
      estimatedCompletionDate,
      enrollment,
      hasResults,
      sponsor: sponsor.leadSponsor?.name ?? null,
    };
  }

  private normalizeDate(dateStr: string | undefined): string | null {
    if (!dateStr) return null;
    // Normalize YYYY-MM or YYYY-MM-DD to YYYY-MM-01
    const match = dateStr.match(/^(\d{4}-\d{2})/);
    if (!match) return null;
    return `${match[1]}-01`;
  }
}
