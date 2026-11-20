import odataClient from '../odataClient';
import type { SapIsolationHeader } from '../../types/isolation.types';
import type { PermitDeepInsertResponse } from '../../types/ptw.types';

const namespace = 'com.sap.gateway.srvd_a2x.zptw_services.v0001';
export type IsolationAction = 'completeIsolation' | 'approveIsolation' | 'normalizeIsolation';
export class WorkflowUnconfirmedError extends Error {}
export const entityKey = (value: string) => encodeURIComponent(value.replace(/'/g, "''")).replace(/'/g, '%27');

async function invoke<T>(url: string, etag?: string, requireEtag: boolean = false): Promise<T> {
  if (requireEtag && (!etag || etag === '*')) throw new Error('Reload the current SAP record. SAP must supply its ETag before a workflow action.');
  const headers: Record<string, string> = { Prefer: 'return=representation' };
  if (etag && etag !== '*') {
    headers['If-Match'] = etag;
  }
  let response;
  try {
    response = await odataClient.post<T>(url, {}, { headers });
  } catch (reason: any) {
    if ((!reason.response && !reason.beforeSend) || reason.response?.status >= 500) throw new WorkflowUnconfirmedError('SAP action outcome is unconfirmed. Check SAP evidence and audit before another action.');
    if (reason.response?.status === 412) throw new Error('The SAP record changed. Reload and review its current evidence before another action.');
    throw reason;
  }
  const result = response.data as T & { '@odata.etag'?: string; SAP__Messages?: { numericSeverity?: number; message: string }[] };
  if (!result || result.SAP__Messages?.some(message => (message.numericSeverity || 0) >= 4)) throw new WorkflowUnconfirmedError('SAP did not return a confirmed successful action result. Check SAP before retrying.');
  if (!result['@odata.etag'] && response.headers?.etag) result['@odata.etag'] = response.headers.etag;
  return result;
}

export const backendWorkflowApi = {
  async isolation(certificate: SapIsolationHeader, action: IsolationAction): Promise<SapIsolationHeader> {
    if (!['completeIsolation', 'approveIsolation', 'normalizeIsolation'].includes(action)) throw new Error('Unsupported isolation action.');
    if (!certificate.IsolationNo?.trim()) throw new Error('A saved SAP certificate is required.');
    const key = entityKey(certificate.IsolationNo);
    const shortUrl = `Isolation('${key}')/${namespace}.${action}`;
    let result: SapIsolationHeader;
    try {
      result = await invoke<SapIsolationHeader>(shortUrl, certificate['@odata.etag'], false);
    } catch (reason: any) {
      if (reason?.response?.status === 404) {
        const namedUrl = `Isolation(IsolationNo='${key}')/${namespace}.${action}`;
        result = await invoke<SapIsolationHeader>(namedUrl, certificate['@odata.etag'], false);
      } else {
        throw reason;
      }
    }
    if (result.IsolationNo !== certificate.IsolationNo || !result.Status) throw new WorkflowUnconfirmedError('SAP did not confirm the requested isolation certificate. Check SAP before retrying.');
    return result;
  },
  async finalizeGas(permit: PermitDeepInsertResponse): Promise<PermitDeepInsertResponse> {
    if (permit.Status !== 'INTD') throw new Error('Finalize initial gas testing only for an INTD permit.');
    const result = await invoke<PermitDeepInsertResponse>(`PermitInfo('${entityKey(permit.Permit_No)}')/${namespace}.finalizeGasTest`, permit['@odata.etag'], true);
    if (result.Permit_No !== permit.Permit_No || !result.Status) throw new WorkflowUnconfirmedError('SAP did not confirm the requested permit. Check SAP before retrying.');
    return result;
  },
  async normalizeItem(
    isolationNo: string,
    itemNo: string | number,
    reasonOrOptions?: string | { DeIsolatedState?: string; Reason?: string },
    deIsolatedState: string = 'NORMAL',
    etag?: string
  ): Promise<any> {
    const rawIso = String(isolationNo ?? '').trim();
    const rawItem = String(itemNo ?? '').trim();
    if (!rawIso || !rawItem) {
      throw new Error('Isolation number and Item number are required for normalization.');
    }
    // SAP ABAP NUMC(4) format requirement: pad numeric item numbers to 4 digits (e.g. '1' -> '0001')
    const formattedItemNo = /^\d+$/.test(rawItem) ? rawItem.padStart(4, '0') : rawItem;
    const isoKey = entityKey(rawIso);
    const itmKey = entityKey(formattedItemNo);
    const url = `Item(IsolationNo='${isoKey}',ItemNo='${itmKey}')/${namespace}.normalizeItem`;

    let finalReason = 'Restored state confirmed after de-isolation.';
    let finalState = 'NORMAL';

    if (typeof reasonOrOptions === 'object' && reasonOrOptions !== null) {
      if (reasonOrOptions.Reason) finalReason = reasonOrOptions.Reason.trim();
      if (reasonOrOptions.DeIsolatedState) finalState = reasonOrOptions.DeIsolatedState.trim();
    } else if (typeof reasonOrOptions === 'string') {
      if (reasonOrOptions.trim()) finalReason = reasonOrOptions.trim();
      if (deIsolatedState && deIsolatedState.trim()) finalState = deIsolatedState.trim();
    }

    const payload = {
      DeIsolatedState: finalState,
      Reason: finalReason
    };
    const headers: Record<string, string> = { Prefer: 'return=representation' };
    if (etag && etag !== '*') {
      headers['If-Match'] = etag;
    }
    let response;
    try {
      response = await odataClient.post(url, payload, { headers });
    } catch (reason: any) {
      if ((!reason.response && !reason.beforeSend) || reason.response?.status >= 500) {
        throw new WorkflowUnconfirmedError('SAP action outcome is unconfirmed. Check SAP evidence and audit before another action.');
      }
      if (reason.response?.status === 412) {
        throw new Error('The SAP record changed. Reload and review its current evidence before another action.');
      }
      throw reason;
    }
    const result = response.data as any;
    if (result?.SAP__Messages?.some((message: any) => (message.numericSeverity || 0) >= 4)) {
      throw new WorkflowUnconfirmedError('SAP did not return a confirmed successful action result. Check SAP before retrying.');
    }
    return result;
  },
};
