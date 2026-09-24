import odataClient from '../odataClient';
import { ODATA_ENTITIES, buildODataQuery } from '../odataEndpoints';
import { PermitHeader } from '../../types/ptw.types';
import { ODataCollectionResponse } from '../../types/odata.types';

/**
 * Module API: Permit Issuer (Toolbox Briefing, Site Handover & Field Issuance)
 */
export const permitIssuerApi = {
  /**
   * Retrieves permits that have completed all approvals and are ready for field issuance
   */
  async getPermitsReadyForIssue(plant?: string): Promise<PermitHeader[]> {
    const filters: string[] = ["Status eq 'APPR'"];
    if (plant) {
      filters.push(`Plant eq '${plant}'`);
    }

    const query = buildODataQuery({
      $filter: filters.join(' and '),
      $expand: ['PpeItems', 'Isolations', 'GasTests'],
      $orderby: 'CreatedAt desc',
    });

    const endpoint = `${ODATA_ENTITIES.PERMITS}${query}`;
    const response = await odataClient.get<ODataCollectionResponse<PermitHeader>>(endpoint);
    return response.data?.value || [];
  },

  /**
   * Records completed toolbox safety briefing prior to issuing the permit
   */
  async recordToolboxTalk(
    permitId: string,
    workerCount: number,
    briefingNotes?: string
  ): Promise<void> {
    const endpoint = `${ODATA_ENTITIES.PERMITS}('${permitId}')/RecordToolboxTalk`;
    await odataClient.post(endpoint, {
      WorkerCount: workerCount,
      BriefingNotes: briefingNotes || 'Standard safety toolbox briefing completed on site.',
      Timestamp: new Date().toISOString(),
    });
  },

  /**
   * Issues the permit to the field (Status changes APPR -> ACTV)
   */
  async issueToField(permitId: string, _issuerUserId?: string, etag?: string): Promise<PermitHeader> {
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
   * Surrenders an active permit before work finishes (e.g. shift change or adverse weather)
   */
  async surrenderPermit(permitId: string, _reason?: string, etag?: string): Promise<PermitHeader> {
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
};

export default permitIssuerApi;
