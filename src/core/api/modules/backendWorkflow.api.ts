import odataClient from '../odataClient';
import type { SapIsolationHeader } from '../../types/isolation.types';
import type { PermitDeepInsertResponse } from '../../types/ptw.types';

const namespace = 'com.sap.gateway.srvd_a2x.zptw_services.v0001';
export type IsolationAction = 'completeIsolation' | 'approveIsolation' | 'normalizeIsolation';
export class WorkflowUnconfirmedError extends Error {}
export const entityKey = (value: string) => encodeURIComponent(value.replace(/'/g, "''")).replace(/'/g, '%27');

async function invoke<T>(url: string, etag?: string): Promise<T> {
  if (!etag || etag === '*') throw new Error('Reload the current SAP record. SAP must supply its ETag before a workflow action.');
  let response;
  try {
    response = await odataClient.post<T>(url, {}, { headers: { 'If-Match': etag, Prefer: 'return=representation' } });
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
    const result = await invoke<SapIsolationHeader>(`Isolation('${entityKey(certificate.IsolationNo)}')/${namespace}.${action}`, certificate['@odata.etag']);
    if (result.IsolationNo !== certificate.IsolationNo || !result.Status) throw new WorkflowUnconfirmedError('SAP did not confirm the requested isolation certificate. Check SAP before retrying.');
    return result;
  },
  async finalizeGas(permit: PermitDeepInsertResponse): Promise<PermitDeepInsertResponse> {
    if (permit.Status !== 'INTD') throw new Error('Finalize initial gas testing only for an INTD permit.');
    const result = await invoke<PermitDeepInsertResponse>(`PermitInfo('${entityKey(permit.Permit_No)}')/${namespace}.finalizeGasTest`, permit['@odata.etag']);
    if (result.Permit_No !== permit.Permit_No || !result.Status) throw new WorkflowUnconfirmedError('SAP did not confirm the requested permit. Check SAP before retrying.');
    return result;
  },
};
