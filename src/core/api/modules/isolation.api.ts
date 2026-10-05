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
  private localStore: SapIsolationHeader[] = [...FALLBACK_ISOLATION_DATA];

  /**
   * Retrieves all Isolation certificates with their associated points
   * Endpoint: Isolation?$expand=*
   */
  public async list(filterStr?: string, signal?: AbortSignal): Promise<SapIsolationHeader[]> {
    try {
      let url = 'Isolation?$expand=*';
      if (filterStr && filterStr.trim()) {
        url += `&$filter=${encodeURIComponent(filterStr.trim())}`;
      }
      const response = await odataClient.get<SapIsolationResponse>(url, { signal });
      const records = response.data?.value || [];
      if (records.length > 0) {
        // Preserve any locally created records not yet synced/returned by the server
        const existingIds = new Set(records.map(r => r.IsolationNo));
        const localCreated = this.localStore.filter(r => !existingIds.has(r.IsolationNo));
        this.localStore = [...localCreated, ...records];
        return this.localStore;
      }
      return this.localStore;
    } catch (error) {
      console.warn('[IsolationApi] Live fetch for Isolation?$expand=* failed, using local store. Reason:', error);
      return this.localStore;
    }
  }

  /**
   * Reads a single Isolation certificate by ID
   * Endpoint: Isolation('{isolationNo}')?$expand=*
   */
  public async read(isolationNo: string, signal?: AbortSignal): Promise<SapIsolationHeader | null> {
    try {
      const encodedNo = encodeURIComponent(isolationNo);
      const url = `Isolation('${encodedNo}')?$expand=*`;
      const response = await odataClient.get<SapIsolationHeader>(url, { signal });
      if (response.data) {
        return response.data;
      }
      return this.localStore.find(i => i.IsolationNo === isolationNo) || null;
    } catch (error) {
      console.warn(`[IsolationApi] Live read for Isolation('${isolationNo}') failed, using local store. Reason:`, error);
      return this.localStore.find(i => i.IsolationNo === isolationNo) || null;
    }
  }

  /**
   * Creates a new Isolation Certificate with deep inserted items
   * Endpoint: POST Isolation
   */
  public async create(payload: Partial<SapIsolationHeader>): Promise<SapIsolationHeader> {
    const response = await odataClient.post<SapIsolationHeader>('Isolation', payload, {
      headers: { Prefer: 'return=representation' }
    });
    if (!response.data || !response.data.IsolationNo) {
      throw new Error('SAP did not return an Isolation Certificate number. Please check your SAP database connection.');
    }
    const errors = response.data.SAP__Messages?.filter(m => (m.numericSeverity || 0) >= 4);
    if (errors && errors.length > 0) {
      throw new Error(errors.map(m => m.message).join(' | '));
    }
    this.localStore.unshift(response.data);
    return response.data;
  }

  /**
   * Updates an existing Isolation Certificate (e.g. update or add PermitNo, Remarks, Status)
   * Endpoint: PATCH Isolation('{isolationNo}')
   */
  public async update(isolationNo: string, payload: Partial<SapIsolationHeader>): Promise<SapIsolationHeader> {
    const encodedNo = encodeURIComponent(isolationNo);
    const url = `Isolation('${encodedNo}')`;

    try {
      const response = await odataClient.patch<SapIsolationHeader>(url, payload, '*', {
        headers: {
          Prefer: 'return=representation'
        }
      });
      if (response.data) {
        const idx = this.localStore.findIndex(i => i.IsolationNo === isolationNo);
        if (idx !== -1) {
          this.localStore[idx] = { ...this.localStore[idx], ...response.data };
          return this.localStore[idx];
        }
        this.localStore.unshift(response.data);
        return response.data;
      }
    } catch (error) {
      console.warn(`[IsolationApi] Live PATCH for Isolation('${isolationNo}') failed, applying to local store. Reason:`, error);
    }

    // Fallback local store update
    const idx = this.localStore.findIndex(i => i.IsolationNo === isolationNo);
    if (idx !== -1) {
      this.localStore[idx] = {
        ...this.localStore[idx],
        ...payload,
        LastChangedAt: new Date().toISOString()
      };
      return this.localStore[idx];
    }

    const updated: SapIsolationHeader = {
      IsolationNo: isolationNo,
      PermitNo: payload.PermitNo || '',
      Status: payload.Status || 'CRTD',
      RequestedBy: payload.RequestedBy || 'VERTIF-V',
      RequestedDate: new Date().toISOString().slice(0, 10),
      RequestedTime: new Date().toTimeString().slice(0, 8),
      VerifiedBy: '',
      VerifiedDate: null,
      VerifiedTime: '00:00:00',
      ApprovedBy: '',
      ApprovedDate: null,
      ApprovedTime: '00:00:00',
      NormalizedBy: '',
      NormalizedDate: null,
      NormalizedTime: '00:00:00',
      Remarks: payload.Remarks || '',
      LastChangedAt: new Date().toISOString(),
      _Item: payload._Item || []
    };
    this.localStore.unshift(updated);
    return updated;
  }
}

export const isolationApi = new IsolationApiService();
export default isolationApi;
