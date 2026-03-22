import type { KrPharmaCompany } from '../types.js';
import { KR_PHARMA_COMPANIES } from '../data/kr-pharma-companies.js';

export function getCompanyBySymbol(symbol: string): KrPharmaCompany | undefined {
  return KR_PHARMA_COMPANIES.find(c => c.symbol === symbol);
}

export function getCompanyBySponsor(sponsorName: string): KrPharmaCompany | undefined {
  const lower = sponsorName.toLowerCase();
  return KR_PHARMA_COMPANIES.find(c =>
    c.sponsorNames.some(s => s.toLowerCase() === lower)
  );
}

export function getSponsorBySymbol(symbol: string): string[] | undefined {
  const company = getCompanyBySymbol(symbol);
  return company?.sponsorNames;
}

export function getYahooSymbol(symbol: string): string | undefined {
  const company = getCompanyBySymbol(symbol);
  if (!company) return undefined;
  return `${symbol}.${company.market}`;
}

export function getAllCompanies(): KrPharmaCompany[] {
  return KR_PHARMA_COMPANIES;
}
