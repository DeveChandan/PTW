import odataClient from '../odataClient';
import { buildODataQuery, ODATA_ENTITIES } from '../odataEndpoints';
import type { PermitDeepInsertResponse, PermitInfoRecord } from '../../types/ptw.types';

const literal = (value: string) => value.replace(/'/g, "''");
export const sitePermitApi = {
  async list(plant: string, search: string, skip = 0, signal?: AbortSignal): Promise<PermitInfoRecord[]> {
    const filters: string[] = [];
    if (plant.trim()) filters.push(`Werks eq '${literal(plant.trim())}'`);
    if (search.trim()) filters.push(`(contains(Permit_No,'${literal(search.trim())}') or contains(JobDesc,'${literal(search.trim())}'))`);
    const query = buildODataQuery({ $filter: filters.join(' and ') || undefined, $top: 25, $skip: skip, $orderby: 'Erdat desc,Erzet desc,Permit_No desc' });
    const response = await odataClient.get<{ value: PermitInfoRecord[] }>(`${ODATA_ENTITIES.PERMIT_INFO}${query}`, { signal });
    if (!Array.isArray(response.data?.value)) throw new Error('SAP did not return a permit list.');
    return response.data.value;
  },
  async read(number: string, signal?: AbortSignal): Promise<PermitDeepInsertResponse> {
    if (!number.trim() || number.length > 10) throw new Error('Enter a valid SAP permit number (up to 10 characters).');
    const query = buildODataQuery({ $expand: ['_Worker', '_PPE', '_Safety', '_HazardControl', '_Isolation', '_GasTest', '_Approval', '_ShiftRenewal', '_Attachment', '_AuditLog'] });
    const key = encodeURIComponent(literal(number)).replace(/'/g, '%27');
    const response = await odataClient.get<PermitDeepInsertResponse>(`${ODATA_ENTITIES.PERMIT_INFO}('${key}')${query}`, { signal });
    if (!response.data?.Permit_No) throw new Error('SAP did not return the requested permit.');
    return { ...response.data, '@odata.etag': response.data['@odata.etag'] || response.headers?.etag };
  },
};
