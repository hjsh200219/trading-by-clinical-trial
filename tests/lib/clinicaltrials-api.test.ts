import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClinicalTrialsApi } from '../../src/lib/clinicaltrials-api.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('ClinicalTrialsApi', () => {
  let api: ClinicalTrialsApi;

  beforeEach(() => {
    mockFetch.mockReset();
    api = new ClinicalTrialsApi();
  });

  describe('searchTrials', () => {
    it('should search by sponsor name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          studies: [{
            protocolSection: {
              identificationModule: { nctId: 'NCT00001111' },
              armsInterventionsModule: {
                interventions: [{ type: 'DRUG', name: 'TestDrug' }]
              },
              conditionsModule: { conditions: ['Cancer'] },
              designModule: {
                phases: ['PHASE3'],
                enrollmentInfo: { count: 500 }
              },
              statusModule: {
                overallStatus: 'RECRUITING',
                completionDateStruct: { date: '2026-06' }
              },
              sponsorCollaboratorsModule: {
                leadSponsor: { name: 'TestSponsor' }
              }
            },
            hasResults: false
          }]
        })
      });

      const result = await api.searchTrials({ sponsor: 'TestSponsor' });
      expect(result).toHaveLength(1);
      expect(result[0].nctId).toBe('NCT00001111');
      expect(result[0].drugName).toBe('TestDrug');
      expect(result[0].condition).toBe('Cancer');
      expect(result[0].phase).toBe('PHASE3');
      expect(result[0].status).toBe('RECRUITING');
      expect(result[0].enrollment).toBe(500);
      expect(result[0].hasResults).toBe(false);
      expect(result[0].sponsor).toBe('TestSponsor');
    });

    it('should return cached results on second call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studies: [] })
      });

      await api.searchTrials({ sponsor: 'Test' });
      await api.searchTrials({ sponsor: 'Test' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studies: [] })
      });

      const result = await api.searchTrials({ sponsor: 'Nobody' });
      expect(result).toEqual([]);
    });

    it('should handle API errors with retry', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ studies: [] })
        });

      const result = await api.searchTrials({ sponsor: 'Test' });
      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should return empty array after all retries fail', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'));

      const result = await api.searchTrials({ sponsor: 'Test' });
      expect(result).toEqual([]);
    });
  });

  describe('getTrialDetail', () => {
    it('should fetch trial by NCT ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          protocolSection: {
            identificationModule: { nctId: 'NCT12345678' },
            armsInterventionsModule: {
              interventions: [{ type: 'DRUG', name: 'DrugA' }]
            },
            conditionsModule: { conditions: ['Diabetes', 'Obesity'] },
            designModule: {
              phases: ['PHASE2'],
              enrollmentInfo: { count: 200 }
            },
            statusModule: {
              overallStatus: 'ACTIVE_NOT_RECRUITING',
              completionDateStruct: { date: '2027-03' }
            },
            sponsorCollaboratorsModule: {
              leadSponsor: { name: 'SponsorX' }
            }
          },
          hasResults: true
        })
      });

      const trial = await api.getTrialDetail('NCT12345678');
      expect(trial).toBeDefined();
      expect(trial!.nctId).toBe('NCT12345678');
      expect(trial!.drugName).toBe('DrugA');
      expect(trial!.condition).toBe('Diabetes, Obesity');
      expect(trial!.phase).toBe('PHASE2');
      expect(trial!.enrollment).toBe(200);
      expect(trial!.hasResults).toBe(true);
    });
  });

  describe('field extraction edge cases', () => {
    it('should handle missing drug name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          studies: [{
            protocolSection: {
              identificationModule: { nctId: 'NCT00002222' },
              armsInterventionsModule: { interventions: [] },
              conditionsModule: { conditions: [] },
              designModule: { phases: [], enrollmentInfo: {} },
              statusModule: { overallStatus: 'COMPLETED', completionDateStruct: {} },
              sponsorCollaboratorsModule: { leadSponsor: { name: 'X' } }
            },
            hasResults: false
          }]
        })
      });

      const result = await api.searchTrials({ sponsor: 'X' });
      expect(result[0].drugName).toBeNull();
      expect(result[0].condition).toBeNull();
      expect(result[0].phase).toBeNull();
      expect(result[0].enrollment).toBeNull();
      expect(result[0].estimatedCompletionDate).toBeNull();
    });
  });
});
