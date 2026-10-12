import { gasTesterApi } from './gasTester.api';
import odataClient from '../odataClient';
import { buildODataQuery, ODATA_ENTITIES } from '../odataEndpoints';
import { toSapPermitType } from '../../ptw/siteProcedure';
import type { PermitDeepInsertResponse, PermitInfoRecord } from '../../types/ptw.types';

const literal = (value: string) => value.replace(/'/g, "''");
export const sitePermitApi = {
  async list(plant: string, search: string, skip = 0, signal?: AbortSignal, type?: string, status?: string): Promise<PermitInfoRecord[]> {
    const filters: string[] = [];
    if (plant.trim()) filters.push(`Werks eq '${literal(plant.trim())}'`);
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
      if (status === 'ISSU' || status === 'ACTV') {
        filters.push(`(Status eq 'ISSU' or Status eq 'ACTV')`);
      } else if (status === 'CRTD' || status === 'DRAF') {
        filters.push(`(Status eq 'CRTD' or Status eq 'DRAF')`);
      } else if (status === 'CLOS' || status === 'CANC') {
        filters.push(`(Status eq 'CLOS' or Status eq 'CANC')`);
      } else {
        filters.push(`Status eq '${literal(status.trim())}'`);
      }
    }
    const query = buildODataQuery({ $filter: filters.join(' and ') || undefined, $top: 25, $skip: skip, $orderby: 'Erdat desc,Erzet desc,Permit_No desc' });
    const response = await odataClient.get<{ value: PermitInfoRecord[] }>(`${ODATA_ENTITIES.PERMIT_INFO}${query}`, { signal });
    if (!Array.isArray(response.data?.value)) throw new Error('SAP did not return a permit list.');
    return response.data.value;
  },
  async read(number: string, signal?: AbortSignal): Promise<PermitDeepInsertResponse> {
    if (!number.trim() || number.length > 10) throw new Error('Enter a valid SAP permit number (up to 10 characters).');
    const query = buildODataQuery({ $expand: ['_Worker', '_PPE', '_Safety', '_HazardControl', '_Isolation($expand=_Item)', '_Approval', '_ShiftRenewal', '_Attachment', '_AuditLog', '_WorkType', '_CHK', '_Equipment', '_NATW'] });
    const key = encodeURIComponent(literal(number)).replace(/'/g, '%27');
    const response = await odataClient.get<PermitDeepInsertResponse>(`${ODATA_ENTITIES.PERMIT_INFO}('${key}')${query}`, { signal });
    if (!response.data?.Permit_No) throw new Error('SAP did not return the requested permit.');
    const gases = await gasTesterApi.list(number, signal);
    return { ...response.data, _GasTest: gases, '@odata.etag': response.data['@odata.etag'] || response.headers?.etag };
  },
  async updateIsolationLink(permitNo: string, isolationNo: string, etag?: string): Promise<PermitInfoRecord | null> {
    if (!permitNo?.trim() || permitNo.trim().length > 10) return null;
    const key = encodeURIComponent(literal(permitNo.trim())).replace(/'/g, '%27');
    try {
      const response = await odataClient.patch<PermitInfoRecord>(
        `${ODATA_ENTITIES.PERMIT_INFO}('${key}')`,
        {
          IsolationNo: isolationNo.trim(),
          LotoCertNo: isolationNo.trim()
        },
        etag?.trim() ? etag.trim() : '*'
      );
      return response.data;
    } catch (err) {
      console.warn('[sitePermitApi] Could not patch IsolationNo on PermitInfo:', err);
      return null;
    }
  },
};
