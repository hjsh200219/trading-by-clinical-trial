import { describe, it, expect } from 'vitest';
import { getCompanyBySymbol, getCompanyBySponsor, getSponsorBySymbol, getYahooSymbol, getAllCompanies } from '../../src/lib/company-mapping.js';

describe('Company Mapping', () => {
  it('should find company by exact symbol', () => {
    const company = getCompanyBySymbol('068270');
    expect(company).toBeDefined();
    expect(company!.nameEn).toBe('Celltrion');
    expect(company!.market).toBe('KS');
  });

  it('should return undefined for unknown symbol', () => {
    expect(getCompanyBySymbol('999999')).toBeUndefined();
  });

  it('should find company by sponsor name', () => {
    const company = getCompanyBySponsor('Celltrion');
    expect(company).toBeDefined();
    expect(company!.symbol).toBe('068270');
  });

  it('should find company by sponsor name variation', () => {
    const company = getCompanyBySponsor('Celltrion, Inc.');
    expect(company).toBeDefined();
    expect(company!.symbol).toBe('068270');
  });

  it('should do case-insensitive sponsor matching', () => {
    const company = getCompanyBySponsor('celltrion');
    expect(company).toBeDefined();
    expect(company!.symbol).toBe('068270');
  });

  it('should return undefined for unknown sponsor', () => {
    expect(getCompanyBySponsor('NonexistentPharma')).toBeUndefined();
  });

  it('should get sponsor names by symbol', () => {
    const sponsors = getSponsorBySymbol('068270');
    expect(sponsors).toBeDefined();
    expect(sponsors!.length).toBeGreaterThan(0);
    expect(sponsors![0]).toContain('Celltrion');
  });

  it('should construct Yahoo Finance symbol for KOSPI', () => {
    expect(getYahooSymbol('068270')).toBe('068270.KS');
  });

  it('should construct Yahoo Finance symbol for KOSDAQ', () => {
    expect(getYahooSymbol('145020')).toBe('145020.KQ');
  });

  it('should return undefined Yahoo symbol for unknown stock', () => {
    expect(getYahooSymbol('999999')).toBeUndefined();
  });

  it('should return 30+ companies', () => {
    const companies = getAllCompanies();
    expect(companies.length).toBeGreaterThanOrEqual(30);
  });

  it('should have unique symbols', () => {
    const companies = getAllCompanies();
    const symbols = companies.map(c => c.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });
});
