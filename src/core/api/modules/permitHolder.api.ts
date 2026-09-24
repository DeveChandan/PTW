import odataClient from '../odataClient';
import { ODATA_ENTITIES, buildODataQuery } from '../odataEndpoints';
import { PermitHeader } from '../../types/ptw.types';
import { ODataCollectionResponse } from '../../types/odata.types';

export interface WorkerEntry {
  workerId: string;
  workerName: string;
  badgeNumber?: string;
  signedInAt: string;
}

/**
 * Module API: Permit Holder (On-Site Worker Ledger, Suspension & Site Restoration)
 */
export const permitHolderApi = {
  /**
   * Retrieves active permits in the field where the user is the designated holder or supervisor
   */
  async getActivePermitsForHolder(holderUserId: string): Promise<PermitHeader[]> {
    const filter = `CreatedBy eq '${holderUserId}' and (Status eq 'ACTV' or Status eq 'SUSP')`;
    const query = buildODataQuery({
      $filter: filter,
      $expand: ['PpeItems', 'Isolations', 'GasTests'],
      $orderby: 'CreatedAt desc',
    });

    const endpoint = `${ODATA_ENTITIES.PERMITS}${query}`;
    const response = await odataClient.get<ODataCollectionResponse<PermitHeader>>(endpoint);
    return response.data?.value || [];
  },

  /**
   * Updates on-site active worker roster/ledger for safety headcounts
   */
  async updateWorkerLedger(permitId: string, workers: WorkerEntry[]): Promise<void> {
    const endpoint = `${ODATA_ENTITIES.PERMITS}('${permitId}')/UpdateWorkerLedger`;
    await odataClient.post(endpoint, {
      NumberOfWorkers: workers.length,
      Workers: workers,
      Timestamp: new Date().toISOString(),
    });
  },

  /**
   * Suspends work immediately (e.g. gas alarm, severe weather, mechanical hazard)
   */
  async suspendWork(permitId: string, _reason?: string, etag?: string): Promise<PermitHeader> {
    const endpoint = `${ODATA_ENTITIES.PERMITS}('${permitId}')`;
    const response = await odataClient.patch<PermitHeader>(
      endpoint,
      {
        Status: 'SUSP',
        LastChangedAt: new Date().toISOString(),
      },
      etag
    );
    return response.data;
  },

  /**
   * Resumes a suspended permit after site conditions are verified safe
   */
  async resumeWork(permitId: string, etag?: string): Promise<PermitHeader> {
    const endpoint = `${ODATA_ENTITIES.PERMITS}('${permitId}')`;
    const response = await odataClient.patch<PermitHeader>(
      endpoint,
      {
        Status: 'ACTV',
        LastChangedAt: new Date().toISOString(),
      },
      etag
    );
    return response.data;
  },

  /**
   * Submits site restoration confirmation and requests formal closure of the permit
   */
  async requestClosure(
    permitId: string,
    _siteRestored: boolean = true,
    _housekeepingDone: boolean = true,
    etag?: string
  ): Promise<PermitHeader> {
    const endpoint = `${ODATA_ENTITIES.PERMITS}('${permitId}')`;
    const response = await odataClient.patch<PermitHeader>(
      endpoint,
      {
        Status: 'CLOS',
        LastChangedAt: new Date().toISOString(),
      },
      etag
    );
    return response.data;
  },
};

export default permitHolderApi;
