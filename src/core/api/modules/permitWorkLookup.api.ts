import odataClient from '../odataClient';
import { MaintenanceOrderLookupItem } from './permitCreate.api';

export const WORK_CATEGORIES = ['Corrective', 'Predictive', 'Preventive', 'Inspection', 'Shutdown', 'Other'] as const;
export type WorkCategory = typeof WORK_CATEGORIES[number];
export type WorkSource = 'notification' | 'order' | 'shutdown';
export const ORDER_TYPES = ['PM01', 'PM03', 'PM05', 'PM06', 'PM07', 'PM08'] as const;

export interface WorkReference extends Partial<MaintenanceOrderLookupItem> {
  PermitNo?: string;
  Status?: string;
  Qmart?: string;
  WorkDate?: string;
  IsShutdown?: boolean;
  Description?: string;
}

export interface WorkSearch {
  source: WorkSource;
  fromDate: string;
  toDate: string;
  orderType: string;
}

export interface WorkSelection extends WorkSearch {
  category: WorkCategory;
  reference: WorkReference;
}

export function referenceId(source: WorkSource, row: WorkReference): string {
  return (source === 'notification' ? row.Qmnum : source === 'order' ? row.Aufnr : row.Aufnr || row.Qmnum || row.PermitNo) || '';
}

export function validateWorkSearch(search: WorkSearch): string | null {
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!isDate(search.fromDate) || !isDate(search.toDate)) return 'Choose valid From and To dates.';
  if (search.fromDate > search.toDate) return 'From date must be on or before To date.';
  if (search.source === 'order' && search.orderType && !ORDER_TYPES.some(type => type === search.orderType)) {
    return 'Choose one of the available order types.';
  }
  return null;
}

/** Connection settings stay explicit until the SAP lookup metadata is supplied. */
function lookupConfig(): { entity: string; dateField: string } {
  const entity = import.meta.env.VITE_PTW_WORK_ENTITY || 'PMIntegration';
  const dateField = import.meta.env.VITE_PTW_WORK_DATE_FIELD || 'WorkDate';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(entity) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(dateField)) {
    throw new Error('The work lookup configuration is invalid. Please contact your SAP administrator.');
  }
  return { entity, dateField };
}

export function buildWorkFilter(search: WorkSearch, dateField: string, shutdownFilter?: string): string {
  const error = validateWorkSearch(search);
  if (error) throw new Error(error);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dateField)) throw new Error('Invalid lookup date field.');
  // The configured property must be Edm.Date; both dates are inclusive.
  const filters = [`${dateField} ge ${search.fromDate}`, `${dateField} le ${search.toDate}`];
  // Qmart, WorkDate and IsShutdown are required backend additions documented for this lookup.
  if (search.source === 'notification') filters.push("Qmnum ne ''", "Qmart eq 'M2'", "Auart eq 'PM02'", 'IsShutdown eq false');
  if (search.source === 'order') {
    const types = search.orderType ? [search.orderType] : [...ORDER_TYPES];
    filters.push(`(${types.map(type => `Auart eq '${type}'`).join(' or ')})`);
    filters.push("Aufnr ne ''", 'IsShutdown eq false');
  }
  if (search.source === 'shutdown') {
    if (!shutdownFilter?.trim()) throw new Error('Shutdown work lookup is not configured yet. Please contact your SAP administrator.');
    filters.push(`(${shutdownFilter})`);
  }
  return filters.join(' and ');
}

export const permitWorkLookupApi = {
  async search(search: WorkSearch, signal?: AbortSignal, client?: string): Promise<WorkReference[]> {
    const error = validateWorkSearch(search);
    if (error) throw new Error(error);
    const { entity, dateField } = lookupConfig();
    const response = await odataClient.get<{ value: WorkReference[]; '@odata.nextLink'?: string }>(entity, {
      signal,
      params: { $filter: buildWorkFilter(search, dateField, import.meta.env.VITE_PTW_SHUTDOWN_FILTER || 'IsShutdown eq true'), ...(client ? { 'sap-client': client } : {}) },
    });
    if (!Array.isArray(response.data?.value) || response.data.value.some(row =>
      !row || typeof row !== 'object' || typeof referenceId(search.source, row) !== 'string' || !referenceId(search.source, row))) {
      throw new Error('SAP returned an unexpected work reference response. Please contact your SAP administrator.');
    }
    // Do not silently present an incomplete list as all results.
    if (response.data['@odata.nextLink']) {
      throw new Error('There are more results than can be displayed. Narrow the date range and search again.');
    }
    return response.data.value;
  },
};
