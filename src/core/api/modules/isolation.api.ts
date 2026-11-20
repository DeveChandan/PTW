import { prepareIsolationCreate } from './isolation.validation';
import { entityKey, WorkflowUnconfirmedError, backendWorkflowApi } from './backendWorkflow.api';
import { odataClient } from '../odataClient';
import type { SapIsolationHeader, SapIsolationResponse } from '../../types/isolation.types';

export const FALLBACK_ISOLATION_DATA: SapIsolationHeader[] = [];

export interface IsolationListOptions {
  permitNo?: string;
  status?: string; // 'ALL' | 'CRTD' | 'ISOL' | 'NORM'
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  isTemplate?: boolean;
  top?: number;
  skip?: number;
  signal?: AbortSignal;
  forceRefresh?: boolean;
}

const SESSION_CACHE_PREFIX = 'ptw_iso_cache_';

const getSessionCachedData = (key: string): SapIsolationHeader[] | null => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const item = window.sessionStorage.getItem(`${SESSION_CACHE_PREFIX}${key}`);
      if (item) {
        const parsed = JSON.parse(item);
        if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          return parsed.data;
        }
      }
    }
  } catch {}
  return null;
};

const setSessionCachedData = (key: string, data: SapIsolationHeader[]) => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(
        `${SESSION_CACHE_PREFIX}${key}`,
        JSON.stringify({ timestamp: Date.now(), data })
      );
    }
  } catch {}
};

const clearSessionCache = () => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const keys = Object.keys(window.sessionStorage);
      for (const k of keys) {
        if (k.startsWith(SESSION_CACHE_PREFIX)) {
          window.sessionStorage.removeItem(k);
        }
      }
    }
  } catch {}
};

const getStoredPermitLinks = (): Record<string, string> => {
  try {
    if (import.meta.env.DEV && typeof window !== 'undefined' && window.localStorage) {
      return JSON.parse(window.localStorage.getItem('ptw_isolation_permit_links') || '{}');
    }
  } catch {}
  return {};
};

const setStoredPermitLink = (isoNo: string, permitNo: string) => {
  try {
    if (import.meta.env.DEV && typeof window !== 'undefined' && window.localStorage) {
      const map = JSON.parse(window.localStorage.getItem('ptw_isolation_permit_links') || '{}');
      if (permitNo?.trim()) {
        map[isoNo] = permitNo.trim();
      } else {
        delete map[isoNo];
      }
      window.localStorage.setItem('ptw_isolation_permit_links', JSON.stringify(map));
    }
  } catch {}
};

class IsolationApiService {
  private cache = new Map<string, { timestamp: number; data: SapIsolationHeader[] }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  public clearCache() {
    this.cache.clear();
    clearSessionCache();
  }

  public async list(
    optionsOrPermitNo?: string | IsolationListOptions,
    signalParam?: AbortSignal,
    forceRefreshParam = false
  ): Promise<SapIsolationHeader[]> {
    let permitNo: string | undefined;
    let status: string | undefined;
    let dateFrom: string | undefined;
    let dateTo: string | undefined;
    let top: number | undefined;
    let skip: number | undefined;
    let signal: AbortSignal | undefined = signalParam;
    let forceRefresh = forceRefreshParam;

    if (typeof optionsOrPermitNo === 'string') {
      permitNo = optionsOrPermitNo;
    } else if (optionsOrPermitNo && typeof optionsOrPermitNo === 'object') {
      permitNo = optionsOrPermitNo.permitNo;
      status = optionsOrPermitNo.status;
      dateFrom = optionsOrPermitNo.dateFrom;
      dateTo = optionsOrPermitNo.dateTo;
      top = optionsOrPermitNo.top;
      skip = optionsOrPermitNo.skip;
      if (optionsOrPermitNo.signal) signal = optionsOrPermitNo.signal;
      if (optionsOrPermitNo.forceRefresh !== undefined) forceRefresh = optionsOrPermitNo.forceRefresh;
    }

    const cleanPermitNo = permitNo?.trim();
    const cleanStatus = status?.trim();
    const sanitizeDate = (d?: string): string | undefined => {
      if (!d) return undefined;
      const str = String(d).trim();
      const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : undefined;
    };
    const cleanDateFrom = sanitizeDate(dateFrom);
    const cleanDateTo = sanitizeDate(dateTo);

    const isTemplateOnly = typeof optionsOrPermitNo === 'object' && optionsOrPermitNo !== null && Boolean(optionsOrPermitNo.isTemplate);
    const cacheKey = typeof optionsOrPermitNo === 'object' && optionsOrPermitNo !== null
      ? `ISO::${cleanPermitNo || ''}::${cleanStatus || 'ALL'}::${cleanDateFrom || ''}::${cleanDateTo || ''}::${isTemplateOnly ? 'TMPL' : 'ALL'}::${top || ''}::${skip || ''}`
      : (cleanPermitNo || '__ALL__');

    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return cached.data;
      }
      const sessionCached = getSessionCachedData(cacheKey);
      if (sessionCached) {
        this.cache.set(cacheKey, { timestamp: Date.now(), data: sessionCached });
        return sessionCached;
      }
    }

    let query = '';
    // If called with a simple permitNo string, preserve exact previous query shape
    if (typeof optionsOrPermitNo === 'string') {
      query = cleanPermitNo ? `&$filter=${encodeURIComponent("PermitNo eq '" + cleanPermitNo.replace(/'/g, "''") + "'")}` : '';
    } else {
      const filters: string[] = [];
      if (cleanPermitNo) {
        filters.push(`PermitNo eq '${cleanPermitNo.replace(/'/g, "''")}'`);
      }
      if (cleanStatus && cleanStatus !== 'ALL') {
        filters.push(`Status eq '${cleanStatus.replace(/'/g, "''")}'`);
      }
      if (cleanDateFrom && cleanDateTo) {
        if (cleanDateFrom === cleanDateTo) {
          filters.push(`RequestedDate eq ${cleanDateFrom}`);
        } else {
          filters.push(`RequestedDate ge ${cleanDateFrom} and RequestedDate le ${cleanDateTo}`);
        }
      } else if (cleanDateFrom) {
        filters.push(`RequestedDate ge ${cleanDateFrom}`);
      } else if (cleanDateTo) {
        filters.push(`RequestedDate le ${cleanDateTo}`);
      }
      if (isTemplateOnly) {
        filters.push("IsTemplate eq 'X'");
      }

      const queryParts: string[] = [];
      if (filters.length > 0) {
        queryParts.push(`$filter=${encodeURIComponent(filters.join(' and '))}`);
      }
      if (top !== undefined && top > 0) {
        queryParts.push(`$top=${top}`);
      }
      if (skip !== undefined && skip > 0) {
        queryParts.push(`$skip=${skip}`);
      }
      if (cleanDateFrom || cleanDateTo || cleanStatus) {
        queryParts.push(`$orderby=RequestedDate desc,IsolationNo desc`);
      }
      if (queryParts.length > 0) {
        query = `&${queryParts.join('&')}`;
      }
    }

    const response = await odataClient.get<SapIsolationResponse>(`Isolation?$expand=_Item${query}`, { signal });
    if (!Array.isArray(response.data?.value)) throw new Error('SAP did not return isolation certificates.');
    const localLinks = getStoredPermitLinks();
    const result = response.data.value.map((iso) => ({
      ...iso,
      PermitNo: iso.PermitNo?.trim() || localLinks[iso.IsolationNo] || ''
    }));

    this.cache.set(cacheKey, { timestamp: Date.now(), data: result });
    setSessionCachedData(cacheKey, result);
    return result;
  }

  /**
   * Fetches reusable master isolation templates directly from SAP backend where IsTemplate = 'X'.
   */
  public async fetchTemplates(signal?: AbortSignal, forceRefresh = false): Promise<SapIsolationHeader[]> {
    try {
      const results = await this.list({ isTemplate: true, forceRefresh, signal });
      if (results.length > 0) return results;
    } catch (filterErr) {
      console.warn('[IsolationApi] IsTemplate filter query rejected, scanning locally:', filterErr);
    }
    // In-memory fallback scan
    const all = await this.list({ forceRefresh, signal });
    return all.filter((iso) => (iso.IsTemplate || '').toString().trim().toUpperCase() === 'X');
  }
  public async read(isolationNo: string, signal?: AbortSignal): Promise<SapIsolationHeader | null> {
    const key = entityKey(isolationNo);
    let response;
    try {
      response = await odataClient.get<SapIsolationHeader>(`Isolation('${key}')?$expand=_Item`, { signal });
    } catch (reason: any) {
      if (reason?.response?.status === 404) {
        response = await odataClient.get<SapIsolationHeader>(`Isolation(IsolationNo='${key}')?$expand=_Item`, { signal });
      } else {
        throw reason;
      }
    }
    if (!response.data?.IsolationNo) throw new Error('SAP did not return this isolation certificate.');
    const localLinks = getStoredPermitLinks();
    return {
      ...response.data,
      PermitNo: response.data.PermitNo?.trim() || localLinks[response.data.IsolationNo] || '',
      '@odata.etag': response.data['@odata.etag'] || response.headers?.etag
    };
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
    if (payload.PermitNo?.trim()) {
      setStoredPermitLink(response.data.IsolationNo, payload.PermitNo.trim());
    }
    this.clearCache();
    return { ...response.data, '@odata.etag': response.data['@odata.etag'] || response.headers?.etag };
  }
  public async update(isolationNo: string, payload: Partial<SapIsolationHeader>, etag?: string): Promise<SapIsolationHeader> {
    if (Object.keys(payload).some(key => key !== 'Remarks' && key !== 'description' && key !== 'PermitNo')) {
      throw new Error('Only PermitNo, remarks, and description can be edited. Certificate number is immutable; use workflow actions for certificate status.');
    }
    if (payload.PermitNo !== undefined && payload.PermitNo.trim().length > 10) {
      throw new Error('Permit number must be at most 10 characters.');
    }
    if ((payload.Remarks || '').length > 255) throw new Error('Remarks must be at most 255 characters.');
    if ((payload.description || '').length > 255) throw new Error('Description must be at most 255 characters.');
    const patchBody: Record<string, string> = {};
    if (payload.PermitNo !== undefined) patchBody.PermitNo = payload.PermitNo.trim();
    if (payload.Remarks !== undefined) patchBody.Remarks = payload.Remarks || '';
    if (payload.description !== undefined) patchBody.description = payload.description || '';
    try {
      const effectiveEtag = etag?.trim() ? etag.trim() : '*';
      const response = await odataClient.patch<SapIsolationHeader>(
        `Isolation('${entityKey(isolationNo)}')`,
        patchBody,
        effectiveEtag,
        { headers: { Prefer: 'return=representation' } }
      );
      if (!response.data?.IsolationNo || response.data.SAP__Messages?.some(message => (message.numericSeverity || 0) >= 4)) {
        throw new WorkflowUnconfirmedError('SAP did not confirm the isolation update. Check SAP before retrying.');
      }
      if (payload.PermitNo !== undefined) {
        setStoredPermitLink(isolationNo, payload.PermitNo.trim());
      }
      // In OData V4 PATCH representations, SAP may omit unchanged properties or delta fields
      const resolvedPermitNo = (response.data.PermitNo !== undefined && response.data.PermitNo !== '')
        ? response.data.PermitNo
        : (payload.PermitNo !== undefined ? payload.PermitNo.trim() : (response.data.PermitNo || ''));

      this.clearCache();
      return {
        ...response.data,
        PermitNo: resolvedPermitNo,
        description: payload.description !== undefined ? payload.description : (response.data.description ?? ''),
        Remarks: payload.Remarks !== undefined ? payload.Remarks : (response.data.Remarks ?? ''),
        '@odata.etag': response.data['@odata.etag'] || response.headers?.etag || effectiveEtag
      };
    } catch (reason: any) {
      if ((!reason.response && !reason.beforeSend) || reason.response?.status >= 500) {
        throw new WorkflowUnconfirmedError('Isolation update outcome is unconfirmed. Check SAP before retrying.');
      }
      throw reason;
    }
  }
  public async normalizeItem(
    isolationNo: string,
    itemNo: string | number,
    reasonOrOptions?: string | { DeIsolatedState?: string; Reason?: string },
    deIsolatedState: string = 'NORMAL',
    etag?: string
  ): Promise<any> {
    const rawItem = String(itemNo ?? '').trim();
    const formattedItemNo = /^\d+$/.test(rawItem) ? rawItem.padStart(4, '0') : rawItem;
    const result = await backendWorkflowApi.normalizeItem(isolationNo, formattedItemNo, reasonOrOptions, deIsolatedState, etag);
    this.clearCache();
    return result;
  }
}
export const isolationApi = new IsolationApiService();
export default isolationApi;
