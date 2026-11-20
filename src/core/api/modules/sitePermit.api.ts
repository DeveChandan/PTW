import { gasTesterApi } from './gasTester.api';
import { permitApproverApi } from './permitApprover.api';
import { auditLogApi } from './auditLog.api';
import odataClient from '../odataClient';
import { buildODataQuery, ODATA_ENTITIES, ODATA_ACTIONS, ODATA_NAV_PROPERTIES } from '../odataEndpoints';
import { toSapPermitType } from '../../ptw/siteProcedure';
import type {
  ApprovalRecord,
  AuditLogRecord,
  PermitDeepInsertResponse,
  PermitInfoRecord,
  ShiftRenewalRecord
} from '../../types/ptw.types';

export interface ShiftRenewalCreatePayload {
  NewShift: string;
  NewValidToD: string;
  NewValidToT: string;
  Reason: string;
}

export interface PermitListResult extends Array<PermitInfoRecord> {
  totalCount: number;
}

export interface PlantPermitSummary {
  total: number;
  active: number;
  intended: number;
  approved: number;
  draft: number;
  rejected: number;
  closed: number;
  accepted?: number;
  pendingClearance?: number;
  hotOrConf: number;
  categoryCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  dateFrom?: string;
  dateTo?: string;
}

const literal = (value: string) => value.replace(/'/g, "''");

// In-memory caches to reduce redundant SAP Gateway roundtrips on permit display page
const permitDetailCache = new Map<string, { timestamp: number; data: PermitDeepInsertResponse }>();
const plantSummaryCache = new Map<string, { timestamp: number; data: PlantPermitSummary }>();
const permitCountCache = new Map<string, { timestamp: number; count: number }>();
const PERMIT_DETAIL_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes TTL
const PLANT_SUMMARY_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes TTL
const PERMIT_COUNT_CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

export interface PermitListOptions {
  plant?: string;
  search?: string;
  skip?: number;
  signal?: AbortSignal;
  type?: string;
  status?: string;
  top?: number;
  expand?: string[];
  select?: string[];
  dateFrom?: string;
  dateTo?: string;
  orderBy?: string;
  excludeClosed?: boolean;
  isTemplate?: boolean;
  directFilter?: string;
}

export interface PermitCountOptions {
  plant?: string;
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  excludeClosed?: boolean;
  filter?: string;
}

export const sitePermitApi = {
  invalidatePermitCache(permitNo?: string) {
    if (permitNo) {
      const cleanNo = permitNo.trim().replace(/^'|'$/g, '');
      permitDetailCache.delete(cleanNo);
    } else {
      permitDetailCache.clear();
    }
  },
  invalidatePlantSummaryCache(plant?: string) {
    if (plant) {
      const prefix = plant.trim();
      for (const key of Array.from(plantSummaryCache.keys())) {
        if (key === prefix || key.startsWith(`${prefix}::`)) {
          plantSummaryCache.delete(key);
        }
      }
    } else {
      plantSummaryCache.clear();
    }
  },
  invalidateCountCache(filterPrefix?: string) {
    if (filterPrefix) {
      for (const key of Array.from(permitCountCache.keys())) {
        if (key.includes(filterPrefix)) {
          permitCountCache.delete(key);
        }
      }
    } else {
      permitCountCache.clear();
    }
  },
  async list(
    plantOrOptions: string | PermitListOptions,
    searchArg = '',
    skipArg = 0,
    signalArg?: AbortSignal,
    typeArg?: string,
    statusArg?: string,
    topArg = 25,
    expandArg?: string[],
    selectArg?: string[],
    dateFromArg?: string,
    dateToArg?: string,
    orderByArg?: string
  ): Promise<PermitListResult> {
    const isOptionsObj = typeof plantOrOptions === 'object' && plantOrOptions !== null;
    const plant = isOptionsObj ? (plantOrOptions.plant || '') : (plantOrOptions || '');
    const search = isOptionsObj ? (plantOrOptions.search || '') : searchArg;
    const skip = isOptionsObj ? (plantOrOptions.skip ?? 0) : skipArg;
    const signal = isOptionsObj ? plantOrOptions.signal : signalArg;
    const type = isOptionsObj ? plantOrOptions.type : typeArg;
    const status = isOptionsObj ? plantOrOptions.status : statusArg;
    const top = isOptionsObj ? (plantOrOptions.top ?? 25) : topArg;
    const expand = isOptionsObj ? plantOrOptions.expand : expandArg;
    const select = isOptionsObj ? plantOrOptions.select : selectArg;
    const dateFrom = isOptionsObj ? plantOrOptions.dateFrom : dateFromArg;
    const dateTo = isOptionsObj ? plantOrOptions.dateTo : dateToArg;
    const orderBy = isOptionsObj ? plantOrOptions.orderBy : orderByArg;
    const excludeClosed = isOptionsObj ? plantOrOptions.excludeClosed : false;
    const isTemplate = isOptionsObj ? plantOrOptions.isTemplate : false;
    const directFilter = isOptionsObj ? plantOrOptions.directFilter : undefined;

    const filters: string[] = [];
    if (isTemplate) filters.push("IsTemplate eq 'X'");
    if (directFilter?.trim()) filters.push(directFilter.trim());
    if (plant.trim() && plant.trim().toUpperCase() !== 'ALL') filters.push(`Werks eq '${literal(plant.trim())}'`);
    if (search.trim()) filters.push(`(contains(Permit_No,'${literal(search.trim())}') or contains(JobDesc,'${literal(search.trim())}'))`);
    if (type && type !== 'ALL') {
      if (type === 'CRITICAL' || type === 'HOT_CONF') {
        filters.push(`(PermitType eq 'HOT' or PermitType eq 'CONF' or PermitType eq 'CSE')`);
      } else {
        const sapType = toSapPermitType(type);
        if (sapType && sapType !== type) {
          filters.push(`(PermitType eq '${literal(type.trim())}' or PermitType eq '${literal(sapType)}')`);
        } else {
          filters.push(`PermitType eq '${literal(type.trim())}'`);
        }
      }
    }
    if (status && status !== 'ALL') {
      if (status === 'APPROVER_QUEUE') {
        // Active review pipeline for Permit Approver: Excludes closed and cancelled permits
        filters.push(`(Status eq 'CRTD' or Status eq 'DRAF' or Status eq 'INTD' or Status eq 'APPR' or Status eq 'REJT') and Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
      } else if (status === 'ACCEPTOR_QUEUE') {
        // Active acceptance pipeline for Permit Acceptor: Excludes unapproved drafts and closed/cancelled permits
        filters.push(`(Status eq 'APPR' or Status eq 'ACCP' or Status eq 'REJT') and Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
      } else if (status === 'AREA_OPERATOR_QUEUE') {
        // Active clearance pipeline for Permit Area Operator: Excludes unapproved drafts and closed/cancelled permits
        filters.push(`(Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ACTV' or Status eq 'ACCL' or Status eq 'AROP' or Status eq 'REJT') and Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
      } else if (status === 'ACTIVE_NON_CLOSED') {
        filters.push(`Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
      } else if (status === 'ISSU' || status === 'ACTV') {
        filters.push(`(Status eq 'ISSU' or Status eq 'ACTV')`);
      } else if (status === 'CRTD' || status === 'DRAF') {
        filters.push(`(Status eq 'CRTD' or Status eq 'DRAF')`);
      } else if (status === 'APPROVED' || status === 'APPR_ALL') {
        filters.push(`(Status eq 'APPR' or Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ACTV')`);
      } else if (status === 'APPROVED_ACTIVE') {
        filters.push(`(Status eq 'APPR' or Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ACTV') and Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
      } else if (status === 'ACCEPTED') {
        filters.push(`(Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ACTV')`);
      } else if (status === 'ACCEPTED_ACTIVE') {
        filters.push(`(Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ACTV') and Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
      } else if (status === 'PENDING_CLEARANCE') {
        filters.push(`(Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ISSD' or Status eq 'APPR')`);
      } else if (status === 'CLEARANCE_COMPLETED') {
        filters.push(`(Status eq 'ACTV' or Status eq 'ACCL' or Status eq 'AROP') and Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
      } else if (status === 'CLOS' || status === 'CLSD') {
        filters.push(`(Status eq 'CLSD' or Status eq 'CLOS')`);
      } else if (status === 'CLOS_OR_CANC') {
        filters.push(`(Status eq 'CLSD' or Status eq 'CLOS' or Status eq 'CANC')`);
      } else if (status === 'ACCL') {
        filters.push(`Status eq 'ACCL'`);
      } else if (status === 'AROP') {
        filters.push(`Status eq 'AROP'`);
      } else if (status === 'REJT' || status === 'REJC') {
        filters.push(`(Status eq 'REJT' or Status eq 'REJC')`);
      } else {
        filters.push(`Status eq '${literal(status.trim())}'`);
      }
    }

    if (excludeClosed && status !== 'APPROVER_QUEUE' && status !== 'ACCEPTOR_QUEUE' && status !== 'AREA_OPERATOR_QUEUE' && status !== 'ACTIVE_NON_CLOSED' && status !== 'CLOS' && status !== 'CLSD' && status !== 'CLOS_OR_CANC') {
      filters.push(`Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
    }

    // SAP OData V4 Edm.Date filter for Erdat (e.g. Erdat ge 2026-11-01 and Erdat le 2026-11-30)
    const sanitizeDate = (d?: string): string | undefined => {
      if (!d) return undefined;
      const str = String(d).trim();
      const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : undefined;
    };

    const cleanDateFrom = sanitizeDate(dateFrom);
    const cleanDateTo = sanitizeDate(dateTo);

    if (cleanDateFrom && cleanDateTo) {
      if (cleanDateFrom === cleanDateTo) {
        filters.push(`Erdat eq ${cleanDateFrom}`);
      } else {
        filters.push(`Erdat ge ${cleanDateFrom} and Erdat le ${cleanDateTo}`);
      }
    } else if (cleanDateFrom) {
      filters.push(`Erdat ge ${cleanDateFrom}`);
    } else if (cleanDateTo) {
      filters.push(`Erdat le ${cleanDateTo}`);
    }

    const expandClause = expand !== undefined ? expand : ['_WorkType'];
    const effectiveOrderBy = orderBy || 'Erdat desc,Permit_No desc';

    const query = buildODataQuery({
      $filter: filters.join(' and ') || undefined,
      $select: select && select.length > 0 ? select : undefined,
      $top: top,
      $skip: skip,
      $count: true,
      $expand: expandClause.length > 0 ? expandClause : undefined,
      $orderby: effectiveOrderBy
    });

    try {
      const response = await odataClient.get<{ value: PermitInfoRecord[]; '@odata.count'?: number }>(
        `${ODATA_ENTITIES.PERMIT_INFO}${query}`,
        { signal }
      );
      if (!Array.isArray(response.data?.value)) throw new Error('SAP did not return a permit list.');

      const rawCount = response.data['@odata.count'] ?? (response.data as any)['__count'] ?? (response.data as any)['count'];
      let totalCount: number;
      if (typeof rawCount === 'number') {
        totalCount = rawCount;
      } else if (typeof rawCount === 'string') {
        const parsed = parseInt(rawCount.trim(), 10);
        totalCount = !Number.isNaN(parsed) ? parsed : response.data.value.length;
      } else {
        totalCount = response.data.value.length < top ? skip + response.data.value.length : Math.max(skip + response.data.value.length, 25);
      }

      const list = response.data.value as PermitListResult;
      list.totalCount = totalCount;
      return list;
    } catch (err) {
      if (expandClause.length > 0) {
        const fallbackQuery = buildODataQuery({
          $filter: filters.join(' and ') || undefined,
          $select: select && select.length > 0 ? select : undefined,
          $top: top,
          $skip: skip,
          $count: true,
          $orderby: effectiveOrderBy
        });
        const fallbackResp = await odataClient.get<{ value: PermitInfoRecord[]; '@odata.count'?: number }>(
          `${ODATA_ENTITIES.PERMIT_INFO}${fallbackQuery}`,
          { signal }
        );
        if (Array.isArray(fallbackResp.data?.value)) {
          const list = fallbackResp.data.value as PermitListResult;
          const rawFbCount = fallbackResp.data['@odata.count'] ?? (fallbackResp.data as any)['__count'] ?? (fallbackResp.data as any)['count'];
          let fbTotal = list.length;
          if (typeof rawFbCount === 'number') {
            fbTotal = rawFbCount;
          } else if (typeof rawFbCount === 'string') {
            const parsed = parseInt(rawFbCount.trim(), 10);
            if (!Number.isNaN(parsed)) fbTotal = parsed;
          }
          list.totalCount = fbTotal;
          return list;
        }
      }
      throw err;
    }
  },

  /**
   * Fetches the exact permit count matching an OData V4 filter using /PermitInfo/$count
   * Example: PermitInfo/$count?$filter=Erdat ge 2026-11-01 and Erdat le 2026-11-30 and Status eq 'CLSD'
   * Provides ultra-low network overhead (0 KB entity payload) and in-memory TTL caching.
   */
  async count(
    optionsOrFilter?: string | PermitCountOptions,
    signal?: AbortSignal,
    forceRefresh = false
  ): Promise<number> {
    const isOptionsObj = typeof optionsOrFilter === 'object' && optionsOrFilter !== null;
    const directFilter = typeof optionsOrFilter === 'string'
      ? optionsOrFilter.trim()
      : (isOptionsObj ? optionsOrFilter.filter?.trim() : undefined);

    let effectiveFilter = '';
    if (directFilter) {
      effectiveFilter = directFilter;
    } else if (isOptionsObj) {
      const filters: string[] = [];
      const { plant, status, type, dateFrom, dateTo, excludeClosed } = optionsOrFilter;
      if (plant?.trim() && plant.trim().toUpperCase() !== 'ALL') filters.push(`Werks eq '${literal(plant.trim())}'`);
      if (type && type !== 'ALL') {
        if (type === 'CRITICAL' || type === 'HOT_CONF') {
          filters.push(`(PermitType eq 'HOT' or PermitType eq 'CONF' or PermitType eq 'CSE')`);
        } else {
          const sapType = toSapPermitType(type);
          if (sapType && sapType !== type) {
            filters.push(`(PermitType eq '${literal(type.trim())}' or PermitType eq '${literal(sapType)}')`);
          } else {
            filters.push(`PermitType eq '${literal(type.trim())}'`);
          }
        }
      }
      if (status && status !== 'ALL') {
        if (status === 'APPROVER_QUEUE') {
          filters.push(`(Status eq 'CRTD' or Status eq 'DRAF' or Status eq 'INTD' or Status eq 'APPR' or Status eq 'REJT') and Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
        } else if (status === 'ACCEPTOR_QUEUE') {
          filters.push(`(Status eq 'APPR' or Status eq 'ACCP' or Status eq 'REJT') and Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
        } else if (status === 'AREA_OPERATOR_QUEUE') {
          filters.push(`(Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ACTV' or Status eq 'ACCL' or Status eq 'AROP' or Status eq 'REJT') and Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
        } else if (status === 'ACTIVE_NON_CLOSED') {
          filters.push(`Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
        } else if (status === 'ISSU' || status === 'ACTV') {
          filters.push(`(Status eq 'ISSU' or Status eq 'ACTV')`);
        } else if (status === 'CRTD' || status === 'DRAF') {
          filters.push(`(Status eq 'CRTD' or Status eq 'DRAF')`);
        } else if (status === 'APPROVED' || status === 'APPR_ALL') {
          filters.push(`(Status eq 'APPR' or Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ACTV')`);
        } else if (status === 'APPROVED_ACTIVE') {
          filters.push(`(Status eq 'APPR' or Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ACTV') and Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
        } else if (status === 'ACCEPTED') {
          filters.push(`(Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ACTV')`);
        } else if (status === 'ACCEPTED_ACTIVE') {
          filters.push(`(Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ACTV') and Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
        } else if (status === 'PENDING_CLEARANCE') {
          filters.push(`(Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ISSD' or Status eq 'APPR')`);
        } else if (status === 'CLEARANCE_COMPLETED') {
          filters.push(`(Status eq 'ACTV' or Status eq 'ACCL' or Status eq 'AROP') and Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
        } else if (status === 'CLOS' || status === 'CLSD') {
          filters.push(`(Status eq 'CLSD' or Status eq 'CLOS')`);
        } else if (status === 'CLOS_OR_CANC') {
          filters.push(`(Status eq 'CLSD' or Status eq 'CLOS' or Status eq 'CANC')`);
        } else if (status === 'ACCL') {
          filters.push(`Status eq 'ACCL'`);
        } else if (status === 'AROP') {
          filters.push(`Status eq 'AROP'`);
        } else if (status === 'REJT' || status === 'REJC') {
          filters.push(`(Status eq 'REJT' or Status eq 'REJC')`);
        } else {
          filters.push(`Status eq '${literal(status.trim())}'`);
        }
      }

      if (excludeClosed && status !== 'APPROVER_QUEUE' && status !== 'ACCEPTOR_QUEUE' && status !== 'AREA_OPERATOR_QUEUE' && status !== 'ACTIVE_NON_CLOSED' && status !== 'CLOS' && status !== 'CLSD' && status !== 'CLOS_OR_CANC') {
        filters.push(`Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'`);
      }

      const sanitizeDate = (d?: string): string | undefined => {
        if (!d) return undefined;
        const str = String(d).trim();
        const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : undefined;
      };
      const cleanDateFrom = sanitizeDate(dateFrom);
      const cleanDateTo = sanitizeDate(dateTo);

      if (cleanDateFrom && cleanDateTo) {
        if (cleanDateFrom === cleanDateTo) {
          filters.push(`Erdat eq ${cleanDateFrom}`);
        } else {
          filters.push(`Erdat ge ${cleanDateFrom} and Erdat le ${cleanDateTo}`);
        }
      } else if (cleanDateFrom) {
        filters.push(`Erdat ge ${cleanDateFrom}`);
      } else if (cleanDateTo) {
        filters.push(`Erdat le ${cleanDateTo}`);
      }
      effectiveFilter = filters.join(' and ');
    }

    const cacheKey = effectiveFilter || '__TOTAL__';
    if (!forceRefresh) {
      const cached = permitCountCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PERMIT_COUNT_CACHE_TTL_MS) {
        return cached.count;
      }
    }

    const queryStr = effectiveFilter ? `?$filter=${encodeURI(effectiveFilter)}` : '';

    try {
      // Primary: standard SAP OData V4 raw count path /PermitInfo/$count?$filter=...
      const response = await odataClient.get<any>(
        `${ODATA_ENTITIES.PERMIT_INFO}/$count${queryStr}`,
        { signal }
      );

      let parsedCount: number | null = null;
      if (typeof response.data === 'number') {
        parsedCount = response.data;
      } else if (typeof response.data === 'string') {
        const num = parseInt(response.data.trim(), 10);
        if (!Number.isNaN(num)) parsedCount = num;
      } else if (response.data && typeof response.data['@odata.count'] === 'number') {
        parsedCount = response.data['@odata.count'];
      } else if (response.data && typeof response.data.value === 'number') {
        parsedCount = response.data.value;
      }

      if (parsedCount !== null) {
        permitCountCache.set(cacheKey, { timestamp: Date.now(), count: parsedCount });
        return parsedCount;
      }
      throw new Error('Unrecognized count payload format');
    } catch (countErr) {
      // Fallback: standard OData V4 collection query with $top=0&$count=true
      const fallbackQuery = buildODataQuery({
        $filter: effectiveFilter || undefined,
        $top: 0,
        $count: true,
      });
      const fallbackResp = await odataClient.get<any>(
        `${ODATA_ENTITIES.PERMIT_INFO}${fallbackQuery}`,
        { signal }
      );
      if (typeof fallbackResp.data?.['@odata.count'] === 'number') {
        const c = fallbackResp.data['@odata.count'];
        permitCountCache.set(cacheKey, { timestamp: Date.now(), count: c });
        return c;
      }
      throw countErr;
    }
  },

  async getPlantSummary(
    plant: string,
    signal?: AbortSignal,
    forceRefresh = false,
    dateFrom?: string,
    dateTo?: string
  ): Promise<PlantPermitSummary> {
    const cleanPlant = plant.trim();
    const sanitizeDate = (d?: string): string | undefined => {
      if (!d) return undefined;
      const str = String(d).trim();
      const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : undefined;
    };
    const cleanDateFrom = sanitizeDate(dateFrom);
    const cleanDateTo = sanitizeDate(dateTo);
    const cacheKey = `${cleanPlant}::${cleanDateFrom || ''}::${cleanDateTo || ''}`;

    if (!forceRefresh) {
      const cached = plantSummaryCache.get(cacheKey) || (!cleanDateFrom && !cleanDateTo ? plantSummaryCache.get(cleanPlant) : undefined);
      if (cached && Date.now() - cached.timestamp < PLANT_SUMMARY_CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const filters: string[] = [];
    if (cleanPlant && cleanPlant.toUpperCase() !== 'ALL') filters.push(`Werks eq '${literal(cleanPlant)}'`);

    if (cleanDateFrom && cleanDateTo) {
      if (cleanDateFrom === cleanDateTo) {
        filters.push(`Erdat eq ${cleanDateFrom}`);
      } else {
        filters.push(`Erdat ge ${cleanDateFrom} and Erdat le ${cleanDateTo}`);
      }
    } else if (cleanDateFrom) {
      filters.push(`Erdat ge ${cleanDateFrom}`);
    } else if (cleanDateTo) {
      filters.push(`Erdat le ${cleanDateTo}`);
    }

    const query = buildODataQuery({
      $filter: filters.join(' and ') || undefined,
      $select: ['Permit_No', 'PermitType', 'Status'],
      $top: 2000
    });
    const response = await odataClient.get<{ value: Array<{ Permit_No: string; PermitType: string; Status: string }> }>(
      `${ODATA_ENTITIES.PERMIT_INFO}${query}`,
      { signal }
    );
    const records = Array.isArray(response.data?.value) ? response.data.value : [];

    const categoryCounts: Record<string, number> = {
      ALL: records.length,
      HOT: records.filter(p => p.PermitType === 'HOT').length,
      COLD: records.filter(p => p.PermitType === 'COLD').length,
      CONF: records.filter(p => p.PermitType === 'CONF' || p.PermitType === 'CSE').length,
      HGHT: records.filter(p => p.PermitType === 'HGHT' || p.PermitType === 'W@H').length,
      ELEC: records.filter(p => p.PermitType === 'ELEC').length,
    };

    const statusCounts: Record<string, number> = {
      ALL: records.length,
      ISSU: records.filter(p => p.Status === 'ISSU' || p.Status === 'ACTV').length,
      INTD: records.filter(p => p.Status === 'INTD').length,
      APPR: records.filter(p => p.Status === 'APPR').length,
      ACCP: records.filter(p => p.Status === 'ACCP').length,
      CRTD: records.filter(p => p.Status === 'CRTD' || p.Status === 'DRAF').length,
      REJT: records.filter(p => p.Status === 'REJT' || p.Status === 'REJC').length,
      CLOS: records.filter(p => p.Status === 'CLOS' || p.Status === 'CLSD' || p.Status === 'CANC').length,
      CLSD: records.filter(p => p.Status === 'CLSD' || p.Status === 'CLOS').length,
      ACCL: records.filter(p => p.Status === 'ACCL').length,
      AROP: records.filter(p => p.Status === 'AROP').length,
    };

    const summary: PlantPermitSummary = {
      total: records.length,
      active: statusCounts.ISSU,
      intended: statusCounts.INTD,
      approved: statusCounts.APPR,
      accepted: statusCounts.ACCP,
      pendingClearance: records.filter(p => p.Status === 'ACCP' || p.Status === 'ISSU' || p.Status === 'ISSD' || p.Status === 'APPR').length,
      draft: statusCounts.CRTD,
      rejected: statusCounts.REJT,
      closed: statusCounts.CLOS,
      hotOrConf: records.filter(p => p.PermitType === 'HOT' || p.PermitType === 'CONF' || p.PermitType === 'CSE').length,
      categoryCounts,
      statusCounts,
      dateFrom: cleanDateFrom,
      dateTo: cleanDateTo
    };

    plantSummaryCache.set(cacheKey, { timestamp: Date.now(), data: summary });
    if (!cleanDateFrom && !cleanDateTo) {
      plantSummaryCache.set(cleanPlant, { timestamp: Date.now(), data: summary });
    }
    return summary;
  },

  async read(number: string, signal?: AbortSignal, forceRefresh = false): Promise<PermitDeepInsertResponse> {
    const cleanNo = number.trim().replace(/^'|'$/g, '');
    if (!forceRefresh) {
      const cached = permitDetailCache.get(cleanNo);
      if (cached && Date.now() - cached.timestamp < PERMIT_DETAIL_CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const query = buildODataQuery({ $expand: ['_Worker', '_PPE', '_Safety', '_HazardControl', '_Isolation($expand=_Item)', '_Approval', '_ShiftRenewal', '_Attachment', '_WorkType', '_CHK', '_Equipment', '_NATW'] });
    const key = encodeURIComponent(literal(cleanNo)).replace(/'/g, '%27');
    const response = await odataClient.get<PermitDeepInsertResponse>(`${ODATA_ENTITIES.PERMIT_INFO}('${key}')${query}`, { signal });
    if (!response.data?.Permit_No) throw new Error('SAP did not return the requested permit.');
    const canonicalNo = response.data.Permit_No || cleanNo;

    // Deduplicate: If _Approval is already expanded and returned by SAP, reuse it directly
    const hasExpandedApprovals = Array.isArray(response.data._Approval) && response.data._Approval.length > 0;

    // Run remaining companion queries concurrently in parallel with Promise.all
    const [gases, approvals, auditLogs] = await Promise.all([
      gasTesterApi.list(canonicalNo, signal).catch(() => []),
      hasExpandedApprovals
        ? Promise.resolve(response.data._Approval!)
        : permitApproverApi.getApprovals(canonicalNo, signal).catch(() => []),
      auditLogApi.getAuditLogs(canonicalNo, signal).catch(() => [])
    ]);

    const mergedApprovals = (approvals && approvals.length > 0)
      ? approvals
      : (response.data._Approval || []);

    const result: PermitDeepInsertResponse = {
      ...response.data,
      _GasTest: gases,
      _Approval: mergedApprovals,
      _AuditLog: auditLogs,
      '@odata.etag': response.data['@odata.etag'] || response.headers?.etag
    };

    permitDetailCache.set(cleanNo, { timestamp: Date.now(), data: result });

    return result;
  },

  /**
   * Fetches reusable master permit templates directly from SAP backend where IsTemplate = 'X'.
   * Expands all child collections (_Worker, _PPE, _Safety, _HazardControl, _Equipment, _NATW, _WorkType).
   * Features resilient 3-tier fallbacks:
   * 1. Query with IsTemplate eq 'X' and full child expansions
   * 2. Query with IsTemplate eq 'X' without child expansions
   * 3. In-memory scan of recent permits filtering for IsTemplate === 'X'
   *    (safeguard for SAP CDS / SEGW services where IsTemplate is not declared as a filterable property).
   */
  async getTemplatePermits(plant?: string, signal?: AbortSignal): Promise<PermitInfoRecord[]> {
    try {
      const result = await this.list({
        plant: plant || '',
        isTemplate: true,
        top: 50,
        orderBy: 'Erdat desc,Permit_No desc',
        expand: ['_Worker', '_PPE', '_Safety', '_HazardControl', '_Equipment', '_NATW', '_WorkType'],
        signal
      });
      if (Array.isArray(result) && result.length > 0) return result;
    } catch (err) {
      console.warn('Failed to fetch template permits with expand, retrying without expand:', err);
    }

    try {
      const result = await this.list({
        plant: plant || '',
        isTemplate: true,
        top: 50,
        orderBy: 'Erdat desc,Permit_No desc',
        expand: [],
        signal
      });
      if (Array.isArray(result) && result.length > 0) return result;
    } catch (innerErr) {
      console.warn('Failed to fetch template permits without expand:', innerErr);
    }

    // 3. Resilient in-memory scan: Query recent permits without IsTemplate filter in case SAP Gateway rejects filter
    try {
      const recent = await this.list({
        plant: plant || '',
        top: 100,
        orderBy: 'Erdat desc,Permit_No desc',
        expand: [],
        signal
      });
      if (Array.isArray(recent)) {
        const matching = recent.filter((p) => {
          const val = (p.IsTemplate || (p as any).isTemplate || '').toString().trim().toUpperCase();
          return val === 'X' || val === 'TRUE' || val === '1';
        });
        if (matching.length > 0) {
          return matching;
        }
      }
    } catch (fallbackErr) {
      console.warn('Failed to scan recent permits for templates:', fallbackErr);
    }

    return [];
  },
  async updateIsolationLink(permitNo: string, isolationNo: string, etag?: string): Promise<PermitInfoRecord | null> {
    if (!permitNo?.trim()) return null;
    const cleanNo = permitNo.trim().replace(/^'|'$/g, '');
    // SAP Alpha conversion: pad purely numeric permit numbers to 10 digits
    const normalizedNo = /^\d+$/.test(cleanNo) && cleanNo.length < 10
      ? cleanNo.padStart(10, '0')
      : cleanNo;

    if (normalizedNo.length > 10) {
      console.warn('[sitePermitApi] Permit number exceeds 10 characters:', normalizedNo);
      return null;
    }

    const key = encodeURIComponent(literal(normalizedNo)).replace(/'/g, '%27');
    try {
      const response = await odataClient.patch<PermitInfoRecord>(
        `${ODATA_ENTITIES.PERMIT_INFO}('${key}')`,
        {
          IsolationNo: isolationNo.trim(),
          LotoCertNo: isolationNo.trim()
        },
        etag?.trim() ? etag.trim() : '*'
      );
      this.invalidatePermitCache(normalizedNo);
      return response.data;
    } catch (err: any) {
      const errMsg = err?.response?.data?.error?.message || err?.message || 'SAP Gateway Error';
      console.error(`[sitePermitApi] Could not patch IsolationNo on PermitInfo('${normalizedNo}'):`, errMsg, err);
      throw new Error(`SAP Permit ${normalizedNo} rejected Isolation link (${isolationNo}): ${errMsg}`);
    }
  },
  async getApprovals(permitNo: string, signal?: AbortSignal): Promise<ApprovalRecord[]> {
    return permitApproverApi.getApprovals(permitNo, signal);
  },
  async getAuditLogs(permitNo: string, signal?: AbortSignal): Promise<AuditLogRecord[]> {
    return auditLogApi.getAuditLogs(permitNo, signal);
  },
  async submitApproval(record: ApprovalRecord): Promise<ApprovalRecord> {
    this.invalidatePermitCache(record.PermitNo || (record as any).Permit_No);
    return permitApproverApi.submitApproval(record);
  },
  async executeAcceptPermitAction(params: { permitNo: string; comments?: string }): Promise<any> {
    this.invalidatePermitCache(params.permitNo);
    return permitApproverApi.executeAcceptPermitAction(params);
  },
  async executeRejectAcceptorAction(params: { permitNo: string; reason: string }): Promise<any> {
    this.invalidatePermitCache(params.permitNo);
    return permitApproverApi.executeRejectAcceptorAction(params);
  },
  /**
   * Updates (PATCH) mutable header fields on an existing permit in SAP
   */
  async updatePermit(permitNo: string, updates: Partial<PermitInfoRecord>, etag?: string): Promise<PermitInfoRecord> {
    if (!permitNo?.trim()) throw new Error('Valid permit number is required');
    const cleanNo = permitNo.trim().replace(/^'|'$/g, '');
    const key = encodeURIComponent(literal(cleanNo)).replace(/'/g, '%27');
    const url = `${ODATA_ENTITIES.PERMIT_INFO}('${key}')`;
    const response = await odataClient.patch<PermitInfoRecord>(url, updates, etag?.trim() ? etag.trim() : '*', {
      headers: { Prefer: 'return=representation' }
    });
    return { ...response.data, '@odata.etag': response.data?.['@odata.etag'] || response.headers?.etag };
  },

  /**
   * Revises permit fields according to rejection remarks and executes the .Resubmit bound action
   */
  async reviseAndResubmit(
    permitNo: string,
    updates: Partial<PermitInfoRecord>,
    comments?: string,
    etag?: string
  ): Promise<PermitDeepInsertResponse> {
    let currentEtag = etag;
    if (updates && Object.keys(updates).length > 0) {
      const updated = await this.updatePermit(permitNo, updates, etag);
      currentEtag = updated['@odata.etag'];
      // A 204 PATCH may omit the new version; read only the header before the action if available.
      if (!currentEtag || currentEtag === '*') {
        try {
          const cleanNo = permitNo.trim().replace(/^'|'$/g, '');
          const key = encodeURIComponent(literal(cleanNo)).replace(/'/g, '%27');
          const latest = await odataClient.get<PermitInfoRecord>(`${ODATA_ENTITIES.PERMIT_INFO}('${key}')`);
          currentEtag = latest.data?.['@odata.etag'] || latest.headers?.etag || currentEtag;
        } catch {
          // If read fails or entity lacks ETag concurrency, proceed with action without blocking
        }
      }
    }
    try {
      return await this.resubmit(permitNo, comments, currentEtag);
    } catch (error: any) {
      const detail = error?.response?.data?.error?.message || error?.message || 'SAP could not confirm resubmission.';
      if (Object.keys(updates || {}).length > 0) {
        throw new Error(`Header changes were saved, but resubmission was not confirmed. Refresh the permit before retrying. ${detail}`);
      }
      throw error;
    }
  },

  /**
   * Executes the SAP RAP bound action for permit resubmission:
   * POST /PermitInfo('<key>')/com.sap.gateway.srvd_a2x.zptw_services.v0001.Resubmit
   * Flow Step 2: Starts the next approval cycle
   */
  async resubmit(permitNo: string, comments?: string, etag?: string): Promise<PermitDeepInsertResponse> {
    const cleanNo = permitNo.trim().replace(/^'|'$/g, '');
    const key = encodeURIComponent(literal(cleanNo)).replace(/'/g, '%27');
    const url = `${ODATA_ENTITIES.PERMIT_INFO}('${key}')/${ODATA_ACTIONS.RESUBMIT}`;
    const payload = comments?.trim() ? { Comments: comments.trim(), Reason: comments.trim() } : {};
    const headers: Record<string, string> = {
      Prefer: 'return=representation'
    };
    if (etag && etag.trim() && etag !== '*') {
      headers['If-Match'] = etag.trim();
    }
    try {
      const response = await odataClient.post<PermitDeepInsertResponse>(url, payload, { headers });
      return response.data;
    } catch (err: any) {
      // 1. If SAP RAP action was defined parameterless (action Resubmit result [1] $self;),
      // sending { Comments: ... } returns 400 Bad Request. Fallback to empty body {}.
      if (err?.response?.status === 400 && Object.keys(payload).length > 0) {
        const retryResponse = await odataClient.post<PermitDeepInsertResponse>(url, {}, { headers });
        return retryResponse.data;
      }
      // 2. If SAP RAP expects unquoted key in the URL, retry unquoted
      if (err?.response?.status === 404 && url.includes("('")) {
        const unquotedUrl = `${ODATA_ENTITIES.PERMIT_INFO}(${key})/${ODATA_ACTIONS.RESUBMIT}`;
        const retryResponse = await odataClient.post<PermitDeepInsertResponse>(unquotedUrl, payload, { headers });
        return retryResponse.data;
      }
      throw err;
    }
  },
  async executeCompleteAreaOperatorAction(params: { permitNo: string; comments?: string }): Promise<any> {
    return permitApproverApi.executeCompleteAreaOperatorAction(params);
  },
  async executeRejectAreaOperatorAction(params: { permitNo: string; reason: string }): Promise<any> {
    return permitApproverApi.executeRejectAreaOperatorAction(params);
  },

  /**
   * Submits a shift renewal / validity extension to SAP child navigation:
   * POST /PermitInfo('<PermitNo>')/_ShiftRenewal
   */
  async renewShift(
    permitNo: string,
    payload: ShiftRenewalCreatePayload
  ): Promise<ShiftRenewalRecord> {
    if (!permitNo?.trim()) {
      throw new Error('Valid permit number is required for shift renewal.');
    }
    const newShift = (payload.NewShift || '').trim();
    const newValidToD = (payload.NewValidToD || '').trim();
    const rawTime = (payload.NewValidToT || '').trim();
    const reason = (payload.Reason || '').trim();

    if (!newShift) {
      throw new Error('Select the target shift for renewal.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newValidToD) || !Number.isFinite(Date.parse(newValidToD))) {
      throw new Error('Select a valid extended end date (YYYY-MM-DD).');
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(rawTime)) {
      throw new Error('Select a valid extended end time (HH:mm or HH:mm:ss).');
    }
    if (!reason) {
      throw new Error('Provide a reason for the shift renewal.');
    }
    if (reason.length > 255) {
      throw new Error('Renewal reason must be at most 255 characters.');
    }

    const normalizedTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
    const cleanNo = permitNo.trim().replace(/^'|'$/g, '');
    const key = encodeURIComponent(literal(cleanNo)).replace(/'/g, '%27');
    const url = `${ODATA_ENTITIES.PERMIT_INFO}('${key}')/${ODATA_NAV_PROPERTIES.SHIFT_RENEWAL}`;
    const body: ShiftRenewalCreatePayload = {
      NewShift: newShift,
      NewValidToD: newValidToD,
      NewValidToT: normalizedTime,
      Reason: reason
    };

    let response;
    try {
      response = await odataClient.post<ShiftRenewalRecord>(url, body, {
        headers: { Prefer: 'return=representation' }
      });
    } catch (err: any) {
      if (err?.response?.status === 404 && url.includes("('")) {
        const namedUrl = `${ODATA_ENTITIES.PERMIT_INFO}(Permit_No='${key}')/${ODATA_NAV_PROPERTIES.SHIFT_RENEWAL}`;
        response = await odataClient.post<ShiftRenewalRecord>(namedUrl, body, {
          headers: { Prefer: 'return=representation' }
        });
      } else {
        throw err;
      }
    }

    const created = response.data;
    if (!created || (!created.PermitNo && !created.RenewalNo) || created.SAP__Messages?.some((m) => (m.numericSeverity || 0) >= 4)) {
      const sapMsg = created?.SAP__Messages?.map((m) => m.message).filter(Boolean).join(' | ');
      throw new Error(sapMsg || 'SAP did not confirm the shift renewal.');
    }
    return created;
  }
};
