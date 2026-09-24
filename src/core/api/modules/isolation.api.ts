import odataClient from '../odataClient';
import { ODATA_ENTITIES } from '../odataEndpoints';
import { PermitIsolation } from '../../types/ptw.types';
import { ODataCollectionResponse } from '../../types/odata.types';

/**
 * Module API: LOTO Isolation (Zero-Energy Breaker, Valve Lock & Blind Flange Registry)
 */
export const isolationApi = {
  /**
   * Retrieves all Lockout/Tagout isolation points associated with a permit
   */
  async getIsolationsForPermit(permitId: string): Promise<PermitIsolation[]> {
    const filter = encodeURIComponent(`PermitId eq '${permitId}'`);
    const endpoint = `${ODATA_ENTITIES.ISOLATIONS}?$filter=${filter}&$orderby=TagNumber asc`;
    const response = await odataClient.get<ODataCollectionResponse<PermitIsolation>>(endpoint);
    return response.data?.value || [];
  },

  /**
   * Adds an engineered isolation point to a permit
   */
  async addIsolationPoint(
    isolation: Omit<PermitIsolation, 'IsolationId' | 'Status'>
  ): Promise<PermitIsolation> {
    const payload: Partial<PermitIsolation> = {
      ...isolation,
      Status: 'PLANNED',
    };
    const response = await odataClient.post<PermitIsolation>(ODATA_ENTITIES.ISOLATIONS, payload);
    return response.data;
  },

  /**
   * Applies physical lock and danger tag to an isolation point
   */
  async applyLockAndTag(
    isolationId: string,
    tagNumber: string,
    isolatedByUserId: string,
    etag?: string
  ): Promise<PermitIsolation> {
    const endpoint = `${ODATA_ENTITIES.ISOLATIONS}('${isolationId}')`;
    const payload: Partial<PermitIsolation> = {
      TagNumber: tagNumber,
      Status: 'LOCKED',
      IsolatedByUserId: isolatedByUserId,
      IsolatedAt: new Date().toISOString(),
    };
    const response = await odataClient.patch<PermitIsolation>(endpoint, payload, etag);
    return response.data;
  },

  /**
   * Verifies Zero-Energy state (try-step electrical test, bleed valve, pressure gauge check)
   */
  async verifyZeroEnergy(
    isolationId: string,
    verifiedByUserId: string,
    etag?: string
  ): Promise<PermitIsolation> {
    const endpoint = `${ODATA_ENTITIES.ISOLATIONS}('${isolationId}')`;
    const payload: Partial<PermitIsolation> = {
      Status: 'TAGGED',
      VerifiedByUserId: verifiedByUserId,
      VerifiedAt: new Date().toISOString(),
    };
    const response = await odataClient.patch<PermitIsolation>(endpoint, payload, etag);
    return response.data;
  },

  /**
   * De-isolates and restores normal operational state after work completion
   */
  async deIsolate(isolationId: string, deIsolatedByUserId: string, etag?: string): Promise<PermitIsolation> {
    const endpoint = `${ODATA_ENTITIES.ISOLATIONS}('${isolationId}')`;
    const payload: Partial<PermitIsolation> = {
      Status: 'DE_ISOLATED',
      VerifiedByUserId: deIsolatedByUserId,
      VerifiedAt: new Date().toISOString(),
    };
    const response = await odataClient.patch<PermitIsolation>(endpoint, payload, etag);
    return response.data;
  },
};

export default isolationApi;
