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
  WorkCenter: string;
  WorkCenterDesc: string;
  AreaLoc: string;
  LocationDesc: string;
  ColorNumber: number;
}

export interface WorkSearch {
  category: WorkCategory;
  source: WorkSource;
  fromDate: string;
  toDate: string;
  orderType: string;
  referenceId?: string;
  allDates?: boolean;
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
  if (!search.allDates) {
    if (!isDate(search.fromDate) || !isDate(search.toDate)) return 'Choose valid From and To dates.';
    if (search.fromDate > search.toDate) return 'From date must be on or before To date.';
  }
  if (search.orderType && (search.source === 'notification' || !availableOrderTypes(search.category).includes(search.orderType))) {
    return 'Choose an order type supported by this work category.';
  }
  return null;
}

export function buildWorkFilter(search: WorkSearch): string {
  const error = validateWorkSearch(search);
  if (error) throw new Error(error);
  const filters: string[] = [];
  if (!search.allDates && search.fromDate && search.toDate) {
    filters.push(`WorkDate ge ${search.fromDate}`, `WorkDate le ${search.toDate}`);
  }
  filters.push(
    `WorkCategory eq '${CATEGORY_CODES[search.category]}'`,
    `ReferenceSource eq '${search.source === 'notification' ? 'NOTIFICATION' : 'ORDER'}'`
  );
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
    JobDesc: row.JobDescription,
    Equnr: row.EquipmentTag,
    Tplnr: row.FunctionalLocation,
    Werks: row.Plant,
    PlannerGroup: row.PlannerGroup,
    Priority: row.Priority,
    PmBasicStartD: notification ? null : row.WorkDate,
    Arbpl: (row.WorkCenter || '').trim(),
    AreaLoc: (row.AreaLoc || '').trim(),
    WorkCenter: (row.WorkCenter || '').trim(),
    WorkCenterDesc: (row.WorkCenterDesc || '').trim(),
    LocationDesc: (row.LocationDesc || '').trim(),
    ColorNumber: typeof row.ColorNumber === 'number' ? row.ColorNumber : 0,
  };
}

function parseReference(value: unknown): WorkReference {
  if (!value || typeof value !== 'object') throw new Error('SAP returned an unexpected work reference response.');
  const row = value as Record<string, unknown>;
  const fields = ['ReferenceId', 'ReferenceSource', 'WorkCategory', 'OrderNotifType', 'JobDescription',
    'Plant', 'EquipmentTag', 'FunctionalLocation', 'PlannerGroup', 'Priority', 'SystemStatus'] as const;
  if (fields.some(field => row[field] !== null && row[field] !== undefined && typeof row[field] !== 'string')
    || !row.ReferenceId || typeof row.ReferenceId !== 'string' || !(row.ReferenceId as string).trim()
    || !row.ReferenceSource || typeof row.ReferenceSource !== 'string' || !['NOTIFICATION', 'ORDER'].includes((row.ReferenceSource as string).trim())
    || !(row.WorkDate === null || row.WorkDate === undefined || (typeof row.WorkDate === 'string' && isDate(row.WorkDate)))) {
    throw new Error('SAP returned an unexpected work reference response. Please check PMIntegration metadata.');
  }

  // Remove ABAP padding while preserving leading zeroes in SAP identifiers.
  const parsed: Record<string, unknown> = {
    WorkDate: typeof row.WorkDate === 'string' ? row.WorkDate : null,
    WorkCenter: typeof row.WorkCenter === 'string' ? row.WorkCenter.trim() : '',
    WorkCenterDesc: typeof row.WorkCenterDesc === 'string' ? row.WorkCenterDesc.trim() : '',
    AreaLoc: typeof row.AreaLoc === 'string' ? row.AreaLoc.trim() : '',
    LocationDesc: typeof row.LocationDesc === 'string' ? row.LocationDesc.trim() : '',
    ColorNumber: typeof row.ColorNumber === 'number'
      ? row.ColorNumber
      : (typeof row.ColorNumber === 'string' && !isNaN(Number(row.ColorNumber)) ? Number(row.ColorNumber) : 0),
  };
  for (const field of fields) {
    parsed[field] = typeof row[field] === 'string' ? (row[field] as string).trim() : '';
  }
  return parsed as unknown as WorkReference;
}

export const permitWorkLookupApi = {
  async search(search: WorkSearch, signal?: AbortSignal, client?: string): Promise<WorkReference[]> {
    const entity = import.meta.env.VITE_PTW_WORK_ENTITY || 'PMIntegration';
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(entity)) throw new Error('Invalid work lookup entity configuration.');

    const refSource = search.source === 'notification' ? 'NOTIFICATION' : 'ORDER';
    let filter: string;

    if (search.referenceId && search.referenceId.trim()) {
      filter = `ReferenceSource eq '${refSource}' and ReferenceId eq '${search.referenceId.trim()}'`;
    } else {
      filter = buildWorkFilter(search);
    }

    const fetchRows = async (f: string) => {
      const response = await odataClient.get<{ value: unknown[]; '@odata.nextLink'?: string }>(entity, {
        signal, params: { $filter: f, ...(client ? { 'sap-client': client } : {}) },
      });
      if (!Array.isArray(response.data?.value)) throw new Error('SAP returned an unexpected work reference response.');
      if (response.data['@odata.nextLink']) throw new Error('There are more results than can be displayed. Narrow the date range and search again.');
      return response.data.value.map(parseReference);
    };

    try {
      const results = await fetchRows(filter);
      // If strict filter returns 0 results (e.g. WorkCategory in SAP CDS view has description like
      // "Breakdown/Corrective" instead of "CORRECTIVE", or dates differ), fallback to live SAP filter:
      if (results.length === 0 && filter.includes('WorkCategory eq ')) {
        const liveFilter = `ReferenceSource eq '${refSource}'` +
          (!search.allDates && search.fromDate && search.toDate && isDate(search.fromDate) && isDate(search.toDate) ? ` and WorkDate ge ${search.fromDate} and WorkDate le ${search.toDate}` : '') +
          (search.orderType ? ` and OrderNotifType eq '${search.orderType}'` : '');
        try {
          const fallbackResults = await fetchRows(liveFilter);
          if (fallbackResults.length > 0) return fallbackResults;
          // If still empty and date was included, try source-only filter
          if (!search.allDates && (search.fromDate || search.toDate)) {
            const sourceOnlyResults = await fetchRows(`ReferenceSource eq '${refSource}'`);
            if (sourceOnlyResults.length > 0) return sourceOnlyResults;
          }
        } catch {
          // If fallback fails, return initial empty results
        }
      }
      return results;
    } catch (err) {
      if (filter.includes('WorkCategory eq ')) {
        try {
          return await fetchRows(`ReferenceSource eq '${refSource}'`);
        } catch {
          // keep original error
        }
      }
      throw err;
    }
  },
};
