import type { ClinicalTrial, CompetitorInfo } from '../types.js';
import { getCompanyBySponsor } from './company-mapping.js';

export function mapCompetitors(
  subjectSponsor: string,
  allTrials: ClinicalTrial[]
): CompetitorInfo[] {
  const subjectLower = subjectSponsor.toLowerCase();
  const subjectCompany = getCompanyBySponsor(subjectSponsor);
  const subjectSponsorNames = subjectCompany
    ? subjectCompany.sponsorNames.map(s => s.toLowerCase())
    : [subjectLower];

  return allTrials
    .filter(trial => {
      const sponsor = trial.sponsor ?? '';
      const sponsorLower = sponsor.toLowerCase();
      return !subjectSponsorNames.includes(sponsorLower) && sponsorLower !== subjectLower;
    })
    .map(trial => {
      const sponsor = trial.sponsor ?? '';
      const isKorean = sponsor !== '' ? getCompanyBySponsor(sponsor) !== undefined : false;

      return {
        sponsor,
        nctId: trial.nctId,
        phase: trial.phase ?? 'Unknown',
        status: trial.status ?? 'Unknown',
        condition: trial.condition ?? '',
        estimatedCompletion: trial.estimatedCompletionDate,
        isKorean,
      };
    });
}
