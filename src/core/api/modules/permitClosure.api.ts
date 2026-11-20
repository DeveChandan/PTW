import odataClient from '../odataClient';
import { ODATA_ACTIONS, ODATA_ENTITIES } from '../odataEndpoints';
import type { PermitDeepInsertResponse, PermitInfoRecord } from '../../types/ptw.types';

const SAP_NAMESPACE = 'com.sap.gateway.srvd_a2x.zptw_services.v0001';

export type ClosureWorkflowStep =
  | 'WORK_COMPLETION'   // Step 1: Acceptor confirms work is completed on site
  | 'ACCEPTOR_CLOSURE'  // Step 2: Acceptor completes closure and hands over permit
  | 'AREA_OPERATOR'     // Step 3: Area Operator verifies site restoration and completes clearance
  | 'ISSUER_FINAL'      // Step 4: Issuer authorizes final closure (Status -> CLSD)
  | 'CLOSED'            // Permit is archived / closed (CLSD or legacy CLOS)
  | 'NOT_READY';        // Not yet active for closure

export interface ClosureActionParams {
  permitNo: string;
  comments?: string;
  etag?: string;
}

export interface ClosureActionResult {
  success: boolean;
  permitNo: string;
  newStatus?: string;
  data?: any;
  message?: string;
}

export const CLOSURE_ROLES = {
  ACCEPTOR: [
    'ZPTW_ACCEPTOR',
    'PTW_ACCEPTOR',
    'PTW_ACCP',
    'ZPTW_HOLDER',
    'PTW_HOLDER',
    'PTW_HOLD',
    'ZPTW_ADMIN',
    'PTW_ADMIN'
  ],
  AREA_OPERATOR: [
    'ZPTW_AREA_OWNER',
    'PTW_AREA_OWNER',
    'PTW_AREA_OPP',
    'PTW_AOPR',
    'ZPTW_ADMIN',
    'PTW_ADMIN'
  ],
  ISSUER: [
    'ZPTW_ISSUER',
    'PTW_ISSUER',
    'ZPTW_ISSU',
    'PTW_ISSU',
    'ZPTW_APPROVER',
    'PTW_APPROVER',
    'PTW_APPR1',
    'PTW_APPR2',
    'PTW_APPR3',
    'ZPTW_ADMIN',
    'PTW_ADMIN'
  ]
} as const;

export const entityKey = (value: string): string =>
  encodeURIComponent(value.replace(/'/g, "''")).replace(/'/g, '%27');

/**
 * Executes an instance-bound action on PermitInfo with automatic 404 fallback
 * between named key syntax `PermitInfo(Permit_No='{key}')/...` and short syntax `PermitInfo('{key}')/...`.
 */
async function invokePermitInfoAction<T = any>(
  permitNo: string,
  actionName: string,
  payload: Record<string, any>,
  etag?: string
): Promise<T> {
  const cleanNo = permitNo.trim().replace(/^'|'$/g, '');
  const cleanKey = entityKey(cleanNo);
  const primaryUrl = `${ODATA_ENTITIES.PERMIT_INFO}(Permit_No='${cleanKey}')/${SAP_NAMESPACE}.${actionName}`;
  const fallbackUrl = `${ODATA_ENTITIES.PERMIT_INFO}('${cleanKey}')/${SAP_NAMESPACE}.${actionName}`;

  const headers: Record<string, string> = {
    Prefer: 'return=representation',
    'Content-Type': 'application/json'
  };
  if (etag && etag !== '*') {
    headers['If-Match'] = etag;
  }

  try {
    const response = await odataClient.post<T>(primaryUrl, payload, { headers });
    return response.data;
  } catch (error: any) {
    // If 412 Precondition Failed, retry without If-Match header
    if (error?.response?.status === 412 && headers['If-Match']) {
      delete headers['If-Match'];
      const retryResponse = await odataClient.post<T>(primaryUrl, payload, { headers });
      return retryResponse.data;
    }
    if (error?.response?.status === 404) {
      // Fall back to short key syntax
      delete headers['If-Match'];
      const fallbackResponse = await odataClient.post<T>(fallbackUrl, payload, { headers });
      return fallbackResponse.data;
    }
    throw error;
  }
}

export const permitClosureApi = {
  /**
   * Step 1: Acceptor — confirm work completion
   * Endpoint: POST PermitInfo(Permit_No='PTW0000001')/com.sap.gateway.srvd_a2x.zptw_services.v0001.confirmWorkCompletion
   * Payload: { "Comments": "Work completed and site cleaned." }
   * Expected: WorkCompleted = "X"; status remains ACTV.
   */
  async confirmWorkCompletion(params: ClosureActionParams): Promise<ClosureActionResult> {
    if (!params.permitNo?.trim()) {
      throw new Error('Permit number is required to confirm work completion.');
    }
    const cleanNo = params.permitNo.trim().replace(/^'|'$/g, '');
    const payload = {
      Comments: params.comments?.trim() || 'Work completed and site cleaned.'
    };

    const data = await invokePermitInfoAction(
      cleanNo,
      'confirmWorkCompletion',
      payload,
      params.etag
    );

    return {
      success: true,
      permitNo: cleanNo,
      newStatus: data?.Status || 'ACTV',
      data,
      message: 'Work completion confirmed successfully in SAP. Site cleaned and ready for handover.'
    };
  },

  /**
   * Step 2: Acceptor — complete closure
   * Endpoint: POST Approval/com.sap.gateway.srvd_a2x.zptw_services.v0001.completeAcceptorClosure
   * Payload: { "PermitNo": "PTW0000001", "Comments": "Acceptor handover and closure confirmed." }
   * Expected: ClosedByAcceptor = "X"; status changes ACTV -> ACCL.
   */
  async completeAcceptorClosure(params: ClosureActionParams): Promise<ClosureActionResult> {
    if (!params.permitNo?.trim()) {
      throw new Error('Permit number is required to complete acceptor closure.');
    }
    const cleanNo = params.permitNo.trim().replace(/^'|'$/g, '');
    const payload = {
      PermitNo: cleanNo,
      Comments: params.comments?.trim() || 'Acceptor handover and closure confirmed.'
    };

    const headers = {
      Prefer: 'return=representation',
      'Content-Type': 'application/json'
    };

    const response = await odataClient.post<any>(
      ODATA_ACTIONS.COMPLETE_ACCEPTOR_CLOSURE,
      payload,
      { headers }
    );

    return {
      success: true,
      permitNo: cleanNo,
      newStatus: response.data?.Status || 'ACCL',
      data: response.data,
      message: 'Acceptor handover confirmed in SAP. Status updated to ACCL. Ready for Area Operator clearance.'
    };
  },

  /**
   * Step 3: Area Operator — complete closure
   * Endpoint: POST Approval/com.sap.gateway.srvd_a2x.zptw_services.v0001.completeAreaOperatorClosure
   * Payload: { "PermitNo": "PTW0000001", "Comments": "Area checked and restored. Area Operator closure confirmed." }
   * Expected: ClosedByAreaOpp = "X"; status changes ACCL -> AROP.
   */
  async completeAreaOperatorClosure(params: ClosureActionParams): Promise<ClosureActionResult> {
    if (!params.permitNo?.trim()) {
      throw new Error('Permit number is required to complete area operator closure.');
    }
    const cleanNo = params.permitNo.trim().replace(/^'|'$/g, '');
    const payload = {
      PermitNo: cleanNo,
      Comments: params.comments?.trim() || 'Area checked and restored. Area Operator closure confirmed.'
    };

    const headers = {
      Prefer: 'return=representation',
      'Content-Type': 'application/json'
    };

    const response = await odataClient.post<any>(
      ODATA_ACTIONS.COMPLETE_AREA_OPERATOR_CLOSURE,
      payload,
      { headers }
    );

    return {
      success: true,
      permitNo: cleanNo,
      newStatus: response.data?.Status || 'AROP',
      data: response.data,
      message: 'Area checked and restored in SAP. Status updated to AROP. Ready for final Issuer closure.'
    };
  },

  /**
   * Step 4: Issuer — final closure
   * Endpoint: POST PermitInfo(Permit_No='PTW0000001')/com.sap.gateway.srvd_a2x.zptw_services.v0001.completeIssuerClosure
   * Payload: { "Comments": "Final permit closure approved and archived." }
   * Expected: Status changes AROP -> CLSD.
   */
  async completeIssuerClosure(params: ClosureActionParams): Promise<ClosureActionResult> {
    if (!params.permitNo?.trim()) {
      throw new Error('Permit number is required for final issuer closure.');
    }
    const cleanNo = params.permitNo.trim().replace(/^'|'$/g, '');
    const payload = {
      Comments: params.comments?.trim() || 'Final permit closure approved and archived.'
    };

    const data = await invokePermitInfoAction(
      cleanNo,
      'completeIssuerClosure',
      payload,
      params.etag
    );

    return {
      success: true,
      permitNo: cleanNo,
      newStatus: data?.Status || 'CLSD',
      data,
      message: 'Permit successfully closed and archived in SAP (CLSD).'
    };
  },

  /**
   * Evaluates the current closure workflow step for a given permit record.
   */
  getClosureStep(
    permit?: Partial<PermitInfoRecord | PermitDeepInsertResponse> | null
  ): ClosureWorkflowStep {
    if (!permit) return 'NOT_READY';

    const status = (permit.Status || '').trim().toUpperCase();
    const isWorkCompleted = permit.WorkCompleted === 'X' || permit.WorkCompleted === 'Y';
    const isClosedByAcceptor = permit.ClosedByAcceptor === 'X' || permit.ClosedByAcceptor === 'Y';
    const isClosedByAreaOpp = permit.ClosedByAreaOpp === 'X' || permit.ClosedByAreaOpp === 'Y';

    // Final Closed
    if (status === 'CLSD' || status === 'CLOS') {
      return 'CLOSED';
    }

    // Step 4: Final Issuer Closure
    if (status === 'AROP' || isClosedByAreaOpp) {
      return 'ISSUER_FINAL';
    }

    // Step 3: Area Operator Clearance
    if (status === 'ACCL' || (status === 'ACTV' && isClosedByAcceptor)) {
      return 'AREA_OPERATOR';
    }

    // Step 1 & 2: Active in Field
    if (status === 'ACTV' || status === 'ISSU') {
      if (isWorkCompleted && !isClosedByAcceptor) {
        return 'ACCEPTOR_CLOSURE';
      }
      return 'WORK_COMPLETION';
    }

    return 'NOT_READY';
  },

  /**
   * Checks whether the given user roles permit executing a specific closure step.
   */
  canExecuteClosureStep(userRoles: string[] = [], step: ClosureWorkflowStep): boolean {
    const roles = userRoles.map(r => r.toUpperCase());
    const isAdmin = roles.includes('PTW_ADMIN') || roles.includes('ZPTW_ADMIN');
    if (isAdmin) return true;

    switch (step) {
      case 'WORK_COMPLETION':
      case 'ACCEPTOR_CLOSURE':
        return CLOSURE_ROLES.ACCEPTOR.some(r => roles.includes(r));
      case 'AREA_OPERATOR':
        return CLOSURE_ROLES.AREA_OPERATOR.some(r => roles.includes(r));
      case 'ISSUER_FINAL':
        return CLOSURE_ROLES.ISSUER.some(r => roles.includes(r));
      default:
        return false;
    }
  }
};

export default permitClosureApi;

