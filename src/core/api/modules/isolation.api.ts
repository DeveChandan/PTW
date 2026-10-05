import { prepareIsolationCreate } from './isolation.validation';
import { entityKey, WorkflowUnconfirmedError } from './backendWorkflow.api';
import { odataClient } from '../odataClient';
import type { SapIsolationHeader, SapIsolationResponse } from '../../types/isolation.types';

/**
 * Offline / Fallback Seed Data from SAP S/4HANA Gateway
 * Source: Isolation?$expand=*
 */
export const FALLBACK_ISOLATION_DATA: SapIsolationHeader[] = [
  {
    IsolationNo: 'ISO0000012',
    PermitNo: '',
    Status: 'CRTD',
    RequestedBy: 'VERTIF-V',
    RequestedDate: '2026-10-03',
    RequestedTime: '14:21:41',
    VerifiedBy: '',
    VerifiedDate: null,
    VerifiedTime: '00:00:00',
    ApprovedBy: '',
    ApprovedDate: null,
    ApprovedTime: '00:00:00',
    NormalizedBy: '',
    NormalizedDate: null,
    NormalizedTime: '00:00:00',
    Remarks: 'Routine isolation inspection check',
    LastChangedAt: null,
    SAP__Messages: [],
    _Item: [
      {
        IsolationNo: 'ISO0000012',
        ItemNo: '0',
        ReferenceType: 'EQUI',
        ReferenceId: '10000001',
        IsolationPoint: 'P-101 INLET',
        IsolType: 'MECH',
        IsolMethod: 'VALVE',
        IsolatedState: 'CLOSED',
        DeIsolatedState: '',
        LockTagNo: 'LT-0001',
        IsIsolated: '',
        IsolatedBy: '',
        IsolatedAt: null,
        ZeroEnergyConf: '',
        ZeroEnergyBy: '',
        ZeroEnergyAt: null,
        IsNormalized: '',
        NormalizedBy: '',
        NormalizedAt: null,
        Remarks: 'INITIAL ISOLATION POINT',
        SAP__Messages: []
      }
    ]
  },
  {
    IsolationNo: 'ISO0000013',
    PermitNo: 'PTW0000002',
    Status: 'CRTD',
    RequestedBy: 'VERTIF-V',
    RequestedDate: '2026-10-03',
    RequestedTime: '14:33:23',
    VerifiedBy: '',
    VerifiedDate: null,
    VerifiedTime: '00:00:00',
    ApprovedBy: '',
    ApprovedDate: null,
    ApprovedTime: '00:00:00',
    NormalizedBy: '',
    NormalizedDate: null,
    NormalizedTime: '00:00:00',
    Remarks: 'Permit linked pump overhaul isolation',
    LastChangedAt: null,
    SAP__Messages: [],
    _Item: [
      {
        IsolationNo: 'ISO0000013',
        ItemNo: '0',
        ReferenceType: 'EQUI',
        ReferenceId: '10000009',
        IsolationPoint: 'P-909 INLET',
        IsolType: 'MECH',
        IsolMethod: 'VALVE',
        IsolatedState: 'CLOSED',
        DeIsolatedState: '',
        LockTagNo: 'LT-0009',
        IsIsolated: '',
        IsolatedBy: '',
        IsolatedAt: null,
        ZeroEnergyConf: '',
        ZeroEnergyBy: '',
        ZeroEnergyAt: null,
        IsNormalized: '',
        NormalizedBy: '',
        NormalizedAt: null,
        Remarks: 'PERMIT LINKED ISOLATION TEST',
        SAP__Messages: []
      }
    ]
  }
];

class IsolationApiService {
  public async list(permitNo?: string, signal?: AbortSignal): Promise<SapIsolationHeader[]> {
    const query = permitNo?.trim() ? `&$filter=${encodeURIComponent("PermitNo eq '" + permitNo.trim().replace(/'/g, "''") + "'")}` : '';
    const response = await odataClient.get<SapIsolationResponse>(`Isolation?$expand=_Item${query}`, { signal });
    if (!Array.isArray(response.data?.value)) throw new Error('SAP did not return isolation certificates.');
    return response.data.value;
  }
  public async read(isolationNo: string, signal?: AbortSignal): Promise<SapIsolationHeader | null> {
    const response = await odataClient.get<SapIsolationHeader>(`Isolation('${entityKey(isolationNo)}')?$expand=_Item`, { signal });
    if (!response.data?.IsolationNo) throw new Error('SAP did not return this isolation certificate.');
    return { ...response.data, '@odata.etag': response.data['@odata.etag'] || response.headers?.etag };
  }
  public async create(payload: Partial<SapIsolationHeader>): Promise<SapIsolationHeader> {
    const body = prepareIsolationCreate(payload);
    let response;
    try { response = await odataClient.post<SapIsolationHeader>('Isolation', body, { headers: { Prefer: 'return=representation' } }); }
    catch (reason: any) {
      if ((!reason.response && !reason.beforeSend) || reason.response?.status >= 500) throw new WorkflowUnconfirmedError('Isolation save outcome is unconfirmed. Check SAP before creating another certificate.');
      throw reason;
    }
    if (!response.data?.IsolationNo || response.data.SAP__Messages?.some(message => (message.numericSeverity || 0) >= 4)) throw new WorkflowUnconfirmedError('SAP did not return a confirmed isolation certificate. Check SAP before retrying.');
    return { ...response.data, '@odata.etag': response.data['@odata.etag'] || response.headers?.etag };
  }
  public async update(isolationNo: string, payload: Partial<SapIsolationHeader>, etag?: string): Promise<SapIsolationHeader> {
    if (Object.keys(payload).some(key => key !== 'Remarks')) throw new Error('Only remarks can be edited. Permit linkage is immutable; use workflow actions for certificate status.');
    if (!etag || etag === '*') throw new Error('Reload the SAP certificate and its ETag before saving.');
    if ((payload.Remarks || '').length > 255) throw new Error('Remarks must be at most 255 characters.');
    try {
      const response = await odataClient.patch<SapIsolationHeader>(`Isolation('${entityKey(isolationNo)}')`, { Remarks: payload.Remarks || '' }, etag, { headers: { Prefer: 'return=representation' } });
      if (!response.data?.IsolationNo || response.data.SAP__Messages?.some(message => (message.numericSeverity || 0) >= 4)) throw new WorkflowUnconfirmedError('SAP did not confirm the remarks update. Check SAP before retrying.');
      return { ...response.data, '@odata.etag': response.data['@odata.etag'] || response.headers?.etag };
    } catch (reason: any) {
      if ((!reason.response && !reason.beforeSend) || reason.response?.status >= 500) throw new WorkflowUnconfirmedError('Isolation update outcome is unconfirmed. Check SAP before retrying.');
      throw reason;
    }
  }
}
export const isolationApi = new IsolationApiService();
export default isolationApi;
