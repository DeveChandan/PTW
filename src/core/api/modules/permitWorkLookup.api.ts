import odataClient from '../odataClient';

export const WORK_CATEGORIES = ['Corrective', 'Predictive', 'Preventive', 'Inspection', 'Shutdown', 'Other'] as const;
export type WorkCategory = typeof WORK_CATEGORIES[number];
export type WorkSource = 'notification' | 'order' | 'shutdown';
export type ReferenceSource = 'NOTIFICATION' | 'ORDER';
export const ORDER_TYPES = ['PM01', 'PM03', 'PM05', 'PM06', 'PM07', 'PM08'] as const;

const CATEGORY_CODES: Record<WorkCategory, string> = {
  Corrective: 'CORRECTIVE', Predictive: 'PREDICTIVE', Preventive: 'PREVENTIVE',
  Inspection: 'INSPECTION', Shutdown: 'SHUTDOWN', Other: 'OTHER',
};
const CATEGORY_ORDER_TYPES: Record<WorkCategory, readonly string[]> = {
  Corrective: ['PM06'], Predictive: [], Preventive: ['PM01'],
  Inspection: ['PM05'], Shutdown: ['PM03'], Other: ['PM07', 'PM08'],
};

/** Exact PMIntegrationType from the supplied OData V4 metadata. */
export interface WorkReference {
  ReferenceId: string;
  ReferenceSource: ReferenceSource;
  WorkCategory: string;
  OrderNotifType: string;
  JobDescription: string;
  WorkDate: string | null;
  Plant: string;
  EquipmentTag: string;
  FunctionalLocation: string;
  PlannerGroup: string;
  Priority: string;
  SystemStatus: string;
}

export interface WorkSearch {
  category: WorkCategory;
  source: WorkSource;
  fromDate: string;
  toDate: string;
  orderType: string;
}
export interface WorkSelection extends WorkSearch { reference: WorkReference }

export function availableSources(category: WorkCategory): WorkSource[] {
  if (category === 'Predictive') return [];
  if (category === 'Shutdown') return ['shutdown'];
  if (category === 'Corrective') return ['notification', 'order'];
  return ['order'];
}
export function availableOrderTypes(category: WorkCategory): readonly string[] {
  return CATEGORY_ORDER_TYPES[category] || [];
}
export function referenceId(_source: WorkSource, row: WorkReference): string {
  return row.ReferenceId;
}
export function referenceKey(row: WorkReference): string {
  return `${row.ReferenceSource}:${row.ReferenceId}`;
}

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function validateWorkSearch(search: WorkSearch): string | null {
  if (!WORK_CATEGORIES.includes(search.category)) return 'Choose a valid work category.';
  if (search.category === 'Predictive') return 'Predictive work has no mapping in the current SAP service.';
  if (!availableSources(search.category).includes(search.source)) return 'Choose a reference source supported by this work category.';
  if (!isDate(search.fromDate) || !isDate(search.toDate)) return 'Choose valid From and To dates.';
  if (search.fromDate > search.toDate) return 'From date must be on or before To date.';
  if (search.orderType && (search.source === 'notification' || !availableOrderTypes(search.category).includes(search.orderType))) {
    return 'Choose an order type supported by this work category.';
  }
  return null;
}

export function buildWorkFilter(search: WorkSearch): string {
  const error = validateWorkSearch(search);
  if (error) throw new Error(error);
  const filters = [
    `WorkDate ge ${search.fromDate}`, `WorkDate le ${search.toDate}`,
    `WorkCategory eq '${CATEGORY_CODES[search.category]}'`,
    `ReferenceSource eq '${search.source === 'notification' ? 'NOTIFICATION' : 'ORDER'}'`,
  ];
  const types = search.source === 'notification' ? ['M2']
    : search.orderType ? [search.orderType] : availableOrderTypes(search.category);
  filters.push(`(${types.map(type => `OrderNotifType eq '${type}'`).join(' or ')})`);
  // Completed notifications and TECO orders are already excluded by the CDS view.
  return filters.join(' and ');
}

/** Translate the unified read model into the distinct PermitInfo linkage fields. */
export function toPermitReferenceFields(row: WorkReference) {
  const notification = row.ReferenceSource === 'NOTIFICATION';
  return {
    Aufnr: notification ? '' : row.ReferenceId,
    Qmnum: notification ? row.ReferenceId : '',
    Auart: notification ? '' : row.OrderNotifType,
    Qmart: notification ? row.OrderNotifType : '',
    Qmtxt: notification ? row.JobDescription : '',
    Qmdat: notification ? row.WorkDate : null,
    JobDesc: row.JobDescription, Equnr: row.EquipmentTag, Tplnr: row.FunctionalLocation,
    Werks: row.Plant, PlannerGroup: row.PlannerGroup, Priority: row.Priority,
    PmBasicStartD: notification ? null : row.WorkDate,
  };
}

function parseReference(value: unknown): WorkReference {
  if (!value || typeof value !== 'object') throw new Error('SAP returned an unexpected work reference response.');
  const row = value as Record<string, unknown>;
  const fields = ['ReferenceId', 'ReferenceSource', 'WorkCategory', 'OrderNotifType', 'JobDescription',
    'Plant', 'EquipmentTag', 'FunctionalLocation', 'PlannerGroup', 'Priority', 'SystemStatus'] as const;
  if (fields.some(field => typeof row[field] !== 'string')
    || !(row.ReferenceId as string).trim()
    || !['NOTIFICATION', 'ORDER'].includes((row.ReferenceSource as string).trim())
    || !(row.WorkDate === null || (typeof row.WorkDate === 'string' && isDate(row.WorkDate)))) {
    throw new Error('SAP returned an unexpected work reference response. Please check PMIntegration metadata.');
  }
  // Remove ABAP padding while preserving leading zeroes in SAP identifiers.
  return Object.fromEntries([...fields.map(field => [field, (row[field] as string).trim()]), ['WorkDate', row.WorkDate]]) as unknown as WorkReference;
}

export const permitWorkLookupApi = {
  async search(search: WorkSearch, signal?: AbortSignal, client?: string): Promise<WorkReference[]> {
    const filter = buildWorkFilter(search);
    const entity = import.meta.env.VITE_PTW_WORK_ENTITY || 'PMIntegration';
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(entity)) throw new Error('Invalid work lookup entity configuration.');
    const response = await odataClient.get<{ value: unknown[]; '@odata.nextLink'?: string }>(entity, {
      signal, params: { $filter: filter, ...(client ? { 'sap-client': client } : {}) },
    });
    if (!Array.isArray(response.data?.value)) throw new Error('SAP returned an unexpected work reference response.');
    if (response.data['@odata.nextLink']) throw new Error('There are more results than can be displayed. Narrow the date range and search again.');
    return response.data.value.map(parseReference);
  },
};
