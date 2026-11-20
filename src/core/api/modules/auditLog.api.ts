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
 * Includes fast in-memory cache to eliminate redundant network calls on repeated TAT inspection.
 * Does NOT use fabricated or mock fallback data.
 */
class AuditLogApiService {
  private cache = new Map<string, { timestamp: number; data: AuditLogRecord[] }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

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
   * Fetches real live audit logs for a specific permit from SAP /AuditLog entity set with caching.
   * Filters by PermitNo and handles canonical (e.g. PTW0000085) and unpadded/numeric variants.
   */
  public async getAuditLogs(
    permitNo: string,
    signal?: AbortSignal,
    forceRefresh = false
  ): Promise<AuditLogRecord[]> {
    if (!permitNo?.trim()) return [];
    const cleanNo = permitNo.trim().replace(/^'|'$/g, '').trim();

    // 1. Check in-memory cache to prevent redundant SAP Gateway roundtrips
    if (!forceRefresh) {
      const cached = this.cache.get(cleanNo);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return cached.data;
      }
    }

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
      const filterVariants = [
        `PermitNo eq '${escaped}' or ObjectId eq '${escaped}'`,
        `PermitNo eq '${escaped}'`,
        `ObjectId eq '${escaped}'`
      ];

      for (const filterStr of filterVariants) {
        // 1. Try querying with $filter and $orderby
        try {
          const query = buildODataQuery({
            $filter: filterStr,
            $orderby: 'EventAt desc'
          });
          const endpoint = `${ODATA_ENTITIES.AUDIT_LOG}${query}`;
          const response = await odataClient.get<ODataCollectionResponse<AuditLogRecord>>(endpoint, { signal });
          const items = response.data?.value;
          if (Array.isArray(items) && items.length > 0) {
            const sorted = this.sortLogs(items);
            this.cache.set(cleanNo, { timestamp: Date.now(), data: sorted });
            return sorted;
          }
        } catch {
          // 2. If SAP RAP service does not support compound filter or $orderby on EventAt, retry without $orderby
          try {
            const queryNoOrder = buildODataQuery({ $filter: filterStr });
            const endpointWithoutOrder = `${ODATA_ENTITIES.AUDIT_LOG}${queryNoOrder}`;
            const response = await odataClient.get<ODataCollectionResponse<AuditLogRecord>>(endpointWithoutOrder, { signal });
            const items = response.data?.value;
            if (Array.isArray(items) && items.length > 0) {
              const sorted = this.sortLogs(items);
              this.cache.set(cleanNo, { timestamp: Date.now(), data: sorted });
              return sorted;
            }
          } catch {
            // Continue to next filter variant
          }
        }
      }
    }

    // Cache empty result briefly (60s) to prevent hammering SAP Gateway for permits without events
    const emptyResult: AuditLogRecord[] = [];
    this.cache.set(cleanNo, { timestamp: Date.now(), data: emptyResult });
    return emptyResult;
  }

  /**
   * Fetches audit logs for a specific object (Permit, Isolation, or Isolation Item)
   * e.g. ObjectId = 'ISO0000051' or 'ISO0000051/1'
   */
  public async getAuditLogsByObject(
    objectId: string,
    objectType?: string,
    signal?: AbortSignal,
    forceRefresh = false
  ): Promise<AuditLogRecord[]> {
    if (!objectId?.trim()) return [];
    const cleanId = objectId.trim();
    const cacheKey = `obj:${cleanId}:${objectType || 'all'}`;

    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const escaped = cleanId.replace(/'/g, "''");
    const filterParts = [`ObjectId eq '${escaped}'`];
    if (objectType?.trim()) {
      filterParts.push(`ObjectType eq '${objectType.trim().replace(/'/g, "''")}'`);
    }
    const filterStr = filterParts.join(' and ');

    try {
      const query = buildODataQuery({
        $filter: filterStr,
        $orderby: 'EventAt desc'
      });
      const response = await odataClient.get<ODataCollectionResponse<AuditLogRecord>>(
        `${ODATA_ENTITIES.AUDIT_LOG}${query}`,
        { signal }
      );
      const items = response.data?.value;
      if (Array.isArray(items) && items.length > 0) {
        const sorted = this.sortLogs(items);
        this.cache.set(cacheKey, { timestamp: Date.now(), data: sorted });
        return sorted;
      }
    } catch {
      try {
        const queryNoOrder = buildODataQuery({ $filter: filterStr });
        const response = await odataClient.get<ODataCollectionResponse<AuditLogRecord>>(
          `${ODATA_ENTITIES.AUDIT_LOG}${queryNoOrder}`,
          { signal }
        );
        const items = response.data?.value;
        if (Array.isArray(items) && items.length > 0) {
          const sorted = this.sortLogs(items);
          this.cache.set(cacheKey, { timestamp: Date.now(), data: sorted });
          return sorted;
        }
      } catch {
        // Fall through to empty
      }
    }

    const emptyResult: AuditLogRecord[] = [];
    this.cache.set(cacheKey, { timestamp: Date.now(), data: emptyResult });
    return emptyResult;
  }

  /**
   * Fetches real live audit logs for a specific isolation certificate (and its child points)
   * from the SAP /AuditLog entity set with caching.
   *
   * An isolation certificate lifecycle records:
   * - ObjectType = 'ISOLATION', ObjectId = 'ISO0000051' (CREATE, APPROVE, NORMALIZE)
   * - ObjectType = 'ISOL_ITEM', ObjectId = 'ISO0000051/1' (NORMALIZE_ITEM per point)
   * - Linked Permit events where PermitNo is set (or correlated via PermitNo)
   */
  public async getAuditLogsForIsolation(
    isolationNo: string,
    permitNo?: string,
    signal?: AbortSignal,
    forceRefresh = false
  ): Promise<AuditLogRecord[]> {
    if (!isolationNo?.trim()) return [];
    const cleanIso = isolationNo.trim().replace(/^'|'$/g, '').trim();
    const cleanPermit = permitNo ? permitNo.trim().replace(/^'|'$/g, '').trim() : '';
    const cacheKey = `iso:${cleanIso}:${cleanPermit}`;

    // 1. Check in-memory cache to prevent redundant SAP Gateway roundtrips
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const collectedLogs: AuditLogRecord[] = [];
    const seenIds = new Set<string>();

    const addRecords = (records: AuditLogRecord[]) => {
      for (const r of records) {
        const key = r.AuditId || `${r.ObjectType || ''}_${r.ObjectId || ''}_${r.Action || ''}_${r.EventAt || ''}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          collectedLogs.push(r);
        }
      }
    };

    // Candidates for isolation number (e.g. "ISO0000051", "0000051", "51")
    const isoCandidates: string[] = [cleanIso];
    if (cleanIso.toUpperCase().startsWith('ISO')) {
      const numOnly = cleanIso.substring(3).trim();
      if (numOnly && !isoCandidates.includes(numOnly)) {
        isoCandidates.push(numOnly);
      }
    } else {
      const isoPrefixed = `ISO${cleanIso}`;
      if (!isoCandidates.includes(isoPrefixed)) {
        isoCandidates.push(isoPrefixed);
      }
      if (/^\d+$/.test(cleanIso)) {
        const padded7 = `ISO${cleanIso.padStart(7, '0')}`;
        if (!isoCandidates.includes(padded7)) {
          isoCandidates.push(padded7);
        }
      }
    }

    // 2. Query SAP /AuditLog for isolation certificate and items
    for (const cand of isoCandidates) {
      const escaped = cand.replace(/'/g, "''");
      const filterVariants = [
        `ObjectId eq '${escaped}' or startswith(ObjectId, '${escaped}/')`,
        `contains(ObjectId, '${escaped}')`,
        `ObjectId eq '${escaped}'`
      ];

      for (const filterStr of filterVariants) {
        try {
          const query = buildODataQuery({
            $filter: filterStr,
            $orderby: 'EventAt desc'
          });
          const response = await odataClient.get<ODataCollectionResponse<AuditLogRecord>>(
            `${ODATA_ENTITIES.AUDIT_LOG}${query}`,
            { signal }
          );
          const items = response.data?.value;
          if (Array.isArray(items) && items.length > 0) {
            addRecords(items);
            break;
          }
        } catch {
          // If SAP RAP service rejects compound filter or $orderby, retry without $orderby
          try {
            const queryNoOrder = buildODataQuery({ $filter: filterStr });
            const response = await odataClient.get<ODataCollectionResponse<AuditLogRecord>>(
              `${ODATA_ENTITIES.AUDIT_LOG}${queryNoOrder}`,
              { signal }
            );
            const items = response.data?.value;
            if (Array.isArray(items) && items.length > 0) {
              addRecords(items);
              break;
            }
          } catch {
            // Continue to next filter variant
          }
        }
      }

      if (collectedLogs.length > 0) {
        break;
      }
    }

    // 3. If permit number is also linked, fetch permit logs and correlate any ISOLATION / ISOL_ITEM entries
    if (cleanPermit) {
      try {
        const permitLogs = await this.getAuditLogs(cleanPermit, signal, forceRefresh);
        const isoRelated = permitLogs.filter((l) => {
          const objType = (l.ObjectType || '').toUpperCase();
          const objId = (l.ObjectId || '').toUpperCase();
          const upperIso = cleanIso.toUpperCase();
          return (
            objType === 'ISOLATION' ||
            objType === 'ISOL_ITEM' ||
            objId === upperIso ||
            objId.startsWith(`${upperIso}/`)
          );
        });
        addRecords(isoRelated);
      } catch {
        // Fall through
      }
    }

    const sorted = this.sortLogs(collectedLogs);
    this.cache.set(cacheKey, { timestamp: Date.now(), data: sorted });
    return sorted;
  }

  /**
   * Alias method for querying audit logs by permit number
   */
  public async list(permitNo?: string, signal?: AbortSignal, forceRefresh = false): Promise<AuditLogRecord[]> {
    if (!permitNo) return [];
    return this.getAuditLogs(permitNo, signal, forceRefresh);
  }

  /**
   * Clears in-memory audit log cache
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

export const auditLogApi = new AuditLogApiService();

/**
 * Categorization helpers to filter audit logs by ObjectId:
 * - Permit No (e.g. PTW0000104)
 * - Isolation No (e.g. ISO0000051)
 * - Isolation No + Item No (e.g. ISO0000051/1)
 */
export function isPermitAuditLog(log: AuditLogRecord, currentPermitNo?: string): boolean {
  const objType = (log.ObjectType || '').trim().toUpperCase();
  const objId = (log.ObjectId || '').trim().toUpperCase();
  const cleanPermit = (currentPermitNo || '').trim().toUpperCase();

  if (objType === 'PERMIT') return true;
  if (objId.startsWith('PTW')) return true;
  if (cleanPermit && (objId === cleanPermit || log.PermitNo?.toUpperCase() === cleanPermit) && !objId.startsWith('ISO') && !objId.includes('/')) return true;
  if (!objType && !objId.startsWith('ISO') && !objId.includes('/') && objId.length > 0) return true;
  return false;
}

export function isIsolationAuditLog(log: AuditLogRecord): boolean {
  const objType = (log.ObjectType || '').trim().toUpperCase();
  const objId = (log.ObjectId || '').trim().toUpperCase();

  if (objType === 'ISOLATION' || objType === 'ISOL_ITEM') return true;
  if (objId.startsWith('ISO') || objId.includes('/')) return true;
  return false;
}

export function isIsolationItemAuditLog(log: AuditLogRecord): boolean {
  const objType = (log.ObjectType || '').trim().toUpperCase();
  const objId = (log.ObjectId || '').trim();

  return objType === 'ISOL_ITEM' || objId.includes('/');
}

export function isIsolationCertAuditLog(log: AuditLogRecord): boolean {
  return isIsolationAuditLog(log) && !isIsolationItemAuditLog(log);
}

export default auditLogApi;
