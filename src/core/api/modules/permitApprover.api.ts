import odataClient from '../odataClient';
import { ODATA_ENTITIES, buildODataQuery } from '../odataEndpoints';
import { PermitApproval, PermitHeader } from '../../types/ptw.types';
import { ODataCollectionResponse } from '../../types/odata.types';

/**
 * Module API: Permit Approver (Multi-Tier Approval Chain & Digital Signatures)
 */
export const permitApproverApi = {
  /**
   * Fetches permits awaiting review/approval for a specific plant or role
   */
  async getPendingApprovals(plant?: string): Promise<PermitHeader[]> {
    const filters: string[] = ["(Status eq 'SUBM' or Status eq 'HSE_A' or Status eq 'AREA_A')"];
    if (plant) {
      filters.push(`Plant eq '${plant}'`);
    }

    const query = buildODataQuery({
      $filter: filters.join(' and '),
      $expand: ['Approvals', 'Hazards'],
      $orderby: 'CreatedAt asc',
    });

    const endpoint = `${ODATA_ENTITIES.PERMITS}${query}`;
    const response = await odataClient.get<ODataCollectionResponse<PermitHeader>>(endpoint);
    return response.data?.value || [];
  },

  /**
   * Retrieves the approval workflow nodes and signatures for a permit
   */
  async getApprovalChain(permitId: string): Promise<PermitApproval[]> {
    const filter = encodeURIComponent(`PermitId eq '${permitId}'`);
    const endpoint = `${ODATA_ENTITIES.APPROVALS}?$filter=${filter}&$orderby=StepNumber asc`;
    const response = await odataClient.get<ODataCollectionResponse<PermitApproval>>(endpoint);
    return response.data?.value || [];
  },

  /**
   * Approves a specific approval tier with a cryptographic or base64 digital signature
   */
  async approveStep(
    approvalStepId: string,
    approverUserId: string,
    signatureToken: string,
    comments?: string,
    etag?: string
  ): Promise<PermitApproval> {
    const payload: Partial<PermitApproval> = {
      ApproverUserId: approverUserId,
      Status: 'APPROVED',
      SignatureToken: signatureToken,
      Comments: comments || 'Approved in accordance with Plant Safety Standard',
      ActionTimestamp: new Date().toISOString(),
    };

    const endpoint = `${ODATA_ENTITIES.APPROVALS}('${approvalStepId}')`;
    const response = await odataClient.patch<PermitApproval>(endpoint, payload, etag);
    return response.data;
  },

  /**
   * Rejects an approval tier, returning the permit to draft with mandatory comments
   */
  async rejectStep(
    approvalStepId: string,
    approverUserId: string,
    comments: string,
    etag?: string
  ): Promise<PermitApproval> {
    const payload: Partial<PermitApproval> = {
      ApproverUserId: approverUserId,
      Status: 'REJECTED',
      Comments: comments,
      ActionTimestamp: new Date().toISOString(),
    };

    const endpoint = `${ODATA_ENTITIES.APPROVALS}('${approvalStepId}')`;
    const response = await odataClient.patch<PermitApproval>(endpoint, payload, etag);
    return response.data;
  },
};

export default permitApproverApi;
