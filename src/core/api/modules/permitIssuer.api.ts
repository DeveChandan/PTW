import odataClient from '../odataClient';
import { ODATA_ENTITIES, ODATA_ACTIONS, buildODataQuery } from '../odataEndpoints';
import { PermitHeader } from '../../types/ptw.types';
import { ODataCollectionResponse } from '../../types/odata.types';

/**
 * Module API: Permit Issuer & Acceptor (Toolbox Briefing, Site Handover & Field Issuance)
 */
export const permitIssuerApi = {
  /**
   * Executes the SAP RAP bound action for permit acceptor accept:
   * POST /Approval/com.sap.gateway.srvd_a2x.zptw_services.v0001.acceptPermit
   * Payload: { PermitNo: string, Comments: string }
   */
  async executeAcceptPermitAction(params: { permitNo: string; comments?: string }): Promise<any> {
    const payload = {
      PermitNo: params.permitNo,
      Comments: params.comments || ''
    };
    const response = await odataClient.post(ODATA_ACTIONS.ACCEPT_PERMIT, payload);
    return response.data;
  },

  /**
   * Executes the SAP RAP bound action for permit acceptor reject:
   * POST /Approval/com.sap.gateway.srvd_a2x.zptw_services.v0001.rejectAcceptor
   * Payload: { PermitNo: string, Reason: string }
   */
  async executeRejectAcceptorAction(params: { permitNo: string; reason: string }): Promise<any> {
    const payload = {
      PermitNo: params.permitNo,
      Reason: params.reason || ''
    };
    const response = await odataClient.post(ODATA_ACTIONS.REJECT_ACCEPTOR, payload);
    return response.data;
  },

  /**
   * Convenience method to accept permit as acceptor
   */
  async acceptPermit(params: { permitNo: string; comments?: string }): Promise<any> {
    return this.executeAcceptPermitAction(params);
  },

  /**
   * Convenience method to reject permit as acceptor
   */
  async rejectAcceptor(params: { permitNo: string; reason: string }): Promise<any> {
    return this.executeRejectAcceptorAction(params);
  },

  /**
   * Alias for rejectAcceptor
   */
  async rejectPermit(params: { permitNo: string; reason: string }): Promise<any> {
    return this.executeRejectAcceptorAction(params);
  },
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
