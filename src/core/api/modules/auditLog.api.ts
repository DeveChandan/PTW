import odataClient from '../odataClient';
import { ODATA_ENTITIES, buildODataQuery } from '../odataEndpoints';
import type { AuditLogRecord } from '../../types/ptw.types';
import type { ODataCollectionResponse } from '../../types/odata.types';

/**
 * SAP AuditLog API Service
 * Service Namespace: com.sap.gateway.srvd_a2x.zptw_services.v0001
 * Live Endpoint: /sap/opu/odata4/sap/zptw_mamagement_srv/srvd_a2x/sap/zptw_services/0001/AuditLog
 *
 * Provides real-time lifecycle event audit logs directly from SAP S/4HANA CDS/RAP AuditLog entity set.
 * Does NOT use fabricated or mock fallback data.
 */
class AuditLogApiService {
  /**
   * Sorts audit logs chronologically by timestamp (newest event first).
   */
  private sortLogs(logs: AuditLogRecord[]): AuditLogRecord[] {
    return [...logs].sort((a, b) => {
      const dtA = a.EventAt ? Date.parse(a.EventAt) : 0;
      const dtB = b.EventAt ? Date.parse(b.EventAt) : 0;
      if (dtA !== dtB) return dtB - dtA;
      return (b.AuditId || '').localeCompare(a.AuditId || '');
    });
  }

  /**
   * Fetches real live audit logs for a specific permit from SAP /AuditLog entity set.
   * Filters by PermitNo and handles canonical (e.g. PTW0000085) and unpadded/numeric variants.
   */
  public async getAuditLogs(permitNo: string, signal?: AbortSignal): Promise<AuditLogRecord[]> {
    if (!permitNo?.trim()) return [];
    const cleanNo = permitNo.trim().replace(/^'|'$/g, '').trim();

    // Generate possible permit number candidates (e.g. "PTW0000085", "0000085", "85")
    const candidates: string[] = [cleanNo];
    if (cleanNo.toUpperCase().startsWith('PTW')) {
      const numOnly = cleanNo.substring(3).trim();
      if (numOnly && !candidates.includes(numOnly)) {
        candidates.push(numOnly);
      }
    } else {
      const ptwPrefixed = `PTW${cleanNo}`;
      if (!candidates.includes(ptwPrefixed)) {
        candidates.push(ptwPrefixed);
      }
      if (/^\d+$/.test(cleanNo)) {
        const padded7 = `PTW${cleanNo.padStart(7, '0')}`;
        if (!candidates.includes(padded7)) {
          candidates.push(padded7);
        }
      }
    }

    for (const cand of candidates) {
      const escaped = cand.replace(/'/g, "''");
      // 1. Try querying with $filter and $orderby
      try {
        const query = buildODataQuery({
          $filter: `PermitNo eq '${escaped}'`,
          $orderby: 'EventAt desc'
        });
        const endpoint = `${ODATA_ENTITIES.AUDIT_LOG}${query}`;
        const response = await odataClient.get<ODataCollectionResponse<AuditLogRecord>>(endpoint, { signal });
        const items = response.data?.value;
        if (Array.isArray(items) && items.length > 0) {
          return this.sortLogs(items);
        }
      } catch {
        // 2. If SAP RAP service does not support $orderby on EventAt, retry without $orderby
        try {
          const endpointWithoutOrder = `${ODATA_ENTITIES.AUDIT_LOG}?$filter=PermitNo eq '${escaped}'`;
          const response = await odataClient.get<ODataCollectionResponse<AuditLogRecord>>(endpointWithoutOrder, { signal });
          const items = response.data?.value;
          if (Array.isArray(items) && items.length > 0) {
            return this.sortLogs(items);
          }
        } catch {
          // Continue to next candidate
        }
      }
    }

    // No fallback / mock data: strictly live SAP audit logs
    return [];
  }

  /**
   * Alias method for querying audit logs by permit number
   */
  public async list(permitNo?: string, signal?: AbortSignal): Promise<AuditLogRecord[]> {
    if (!permitNo) return [];
    return this.getAuditLogs(permitNo, signal);
  }
}

export const auditLogApi = new AuditLogApiService();
export default auditLogApi;
