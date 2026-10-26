import type { PermitInfoRecord } from '../../../core/types/ptw.types';

export type Category = 'permit' | 'isolation';

export type WorkTypeMode = 'actual' | 'with-additional' | 'additional-only';

export type ReportRecord = {
  id: number;
  date: string; // YYYY-MM-DD
  department: string;
  category: Category;
  type: string;
  permitNo: string;
  status?: string;
  location?: string;
  additionalTypes?: string[];
  isAdditional?: boolean;
  actualType?: string;
};

export interface PermitTypeMeta {
  code: string;
  label: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
  icon: string;
  desc: string;
}

/**
 * Standard permit types used across the entire application (reflects PERMIT_CATEGORIES in siteProcedure.ts)
 */
export const ALL_APPLICATION_PERMIT_TYPES = [
  'COLD',
  'HOT',
  'CSE',
  'EXCV',
  'W@H',
  'LBRK',
  'RIG',
  'RAD',
  'HYD_PNEU',
  'ELEC',
  'OTHER',
] as const;

export type ApplicationPermitType = (typeof ALL_APPLICATION_PERMIT_TYPES)[number];

/**
 * Standard isolation types used across the application
 */
export const ALL_APPLICATION_ISOLATION_TYPES = [
  'MECHANICAL',
  'ELECTRICAL',
  'BLIND_FLANGE',
  'INSTRUMENT',
  'VALVE_LOCK',
] as const;

export type ApplicationIsolationType = (typeof ALL_APPLICATION_ISOLATION_TYPES)[number];

export function normalizePermitType(typeCode: string): string {
  if (!typeCode) return 'OTHER';
  const raw = typeCode.trim().toUpperCase();
  if (raw === 'CONF') return 'CSE';
  if (raw === 'HGHT') return 'W@H';
  if (raw === 'LINE') return 'LBRK';
  if (raw === 'RIGG') return 'RIG';
  if (raw === 'HYPN') return 'HYD_PNEU';
  if (raw === 'ELECTRICAL') return 'ELEC';
  return raw;
}

export const PERMIT_TYPE_META: Record<string, PermitTypeMeta> = {
  HOT: {
    code: 'HOT',
    label: 'Hot Work',
    color: '#ef4444',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
    borderClass: 'border-rose-300',
    icon: 'local_fire_department',
    desc: 'Welding, torch cutting, open flame',
  },
  COLD: {
    code: 'COLD',
    label: 'Cold Work',
    color: '#0284c7',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-800',
    borderClass: 'border-sky-300',
    icon: 'build',
    desc: 'General maintenance, non-sparking work',
  },
  CSE: {
    code: 'CSE',
    label: 'Confined Space',
    color: '#f59e0b',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    borderClass: 'border-amber-300',
    icon: 'door_open',
    desc: 'Entry into tanks, vessels, silos, pits',
  },
  CONF: {
    code: 'CONF',
    label: 'Confined Space',
    color: '#f59e0b',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    borderClass: 'border-amber-300',
    icon: 'door_open',
    desc: 'Entry into tanks, vessels, silos, pits',
  },
  ELEC: {
    code: 'ELEC',
    label: 'Electrical Work',
    color: '#6366f1',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-800',
    borderClass: 'border-indigo-300',
    icon: 'electric_bolt',
    desc: 'High/low voltage energization & isolation',
  },
  'W@H': {
    code: 'W@H',
    label: 'Work at Height',
    color: '#8b5cf6',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    borderClass: 'border-purple-300',
    icon: 'height',
    desc: 'Elevated structures at/above 1.8m',
  },
  HGHT: {
    code: 'HGHT',
    label: 'Work at Height',
    color: '#8b5cf6',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    borderClass: 'border-purple-300',
    icon: 'height',
    desc: 'Elevated structures at/above 1.8m',
  },
  LBRK: {
    code: 'LBRK',
    label: 'Line Breaking',
    color: '#0d9488',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
    borderClass: 'border-teal-300',
    icon: 'link_off',
    desc: 'Process line decoupling & chemical opening',
  },
  LINE: {
    code: 'LINE',
    label: 'Line Breaking',
    color: '#0d9488',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
    borderClass: 'border-teal-300',
    icon: 'link_off',
    desc: 'Process line decoupling & chemical opening',
  },
  EXCV: {
    code: 'EXCV',
    label: 'Excavation',
    color: '#10b981',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    borderClass: 'border-emerald-300',
    icon: 'landslide',
    desc: 'Ground trenching, civil digging, road opening',
  },
  RAD: {
    code: 'RAD',
    label: 'Radiation / NDT',
    color: '#ec4899',
    badgeBg: 'bg-pink-100',
    badgeText: 'text-pink-800',
    borderClass: 'border-pink-300',
    icon: 'radioactive',
    desc: 'Industrial radiography, X-ray inspection',
  },
  RIG: {
    code: 'RIG',
    label: 'Rigging & Crane',
    color: '#006398',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-900',
    borderClass: 'border-cyan-300',
    icon: 'precision_manufacturing',
    desc: 'Critical crane lifts & heavy hoisting',
  },
  RIGG: {
    code: 'RIGG',
    label: 'Rigging & Crane',
    color: '#006398',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-900',
    borderClass: 'border-cyan-300',
    icon: 'precision_manufacturing',
    desc: 'Critical crane lifts & heavy hoisting',
  },
  HYD_PNEU: {
    code: 'HYD_PNEU',
    label: 'Hydraulic / Pneumatic',
    color: '#d97706',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    borderClass: 'border-amber-300',
    icon: 'speed',
    desc: 'Pressure vessel hydrostatic testing',
  },
  HYPN: {
    code: 'HYPN',
    label: 'Hydraulic / Pneumatic',
    color: '#d97706',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    borderClass: 'border-amber-300',
    icon: 'speed',
    desc: 'Pressure vessel hydrostatic testing',
  },
  OTHER: {
    code: 'OTHER',
    label: 'Other Specialized',
    color: '#64748b',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    borderClass: 'border-slate-300',
    icon: 'more_horiz',
    desc: 'Other non-standard hazardous activity',
  },
};

export function getPermitTypeMeta(typeCode: string): PermitTypeMeta {
  const code = normalizePermitType(typeCode);
  return (
    PERMIT_TYPE_META[code] || {
      code,
      label: code || 'General',
      color: '#64748b',
      badgeBg: 'bg-slate-100',
      badgeText: 'text-slate-800',
      borderClass: 'border-slate-300',
      icon: 'description',
      desc: 'Work Activity',
    }
  );
}

export const ISOLATION_TYPE_META: Record<string, PermitTypeMeta> = {
  MECHANICAL: {
    code: 'MECHANICAL',
    label: 'Mechanical Isolation',
    color: '#0284c7',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-900',
    borderClass: 'border-sky-300',
    icon: 'precision_manufacturing',
    desc: 'Physical decoupling & equipment mechanical lock',
  },
  ELECTRICAL: {
    code: 'ELECTRICAL',
    label: 'Electrical LOTO',
    color: '#d97706',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    borderClass: 'border-amber-300',
    icon: 'electric_bolt',
    desc: 'Breaker lockout, tagout & de-energization',
  },
  BLIND_FLANGE: {
    code: 'BLIND_FLANGE',
    label: 'Blind / Spade Flange',
    color: '#0d9488',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-900',
    borderClass: 'border-teal-300',
    icon: 'block',
    desc: 'Positive pipeline blind isolation & spade insertion',
  },
  INSTRUMENT: {
    code: 'INSTRUMENT',
    label: 'Instrument & Control',
    color: '#7c3aed',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-900',
    borderClass: 'border-purple-300',
    icon: 'tune',
    desc: 'Sensor, loop and automated interlock bypass',
  },
  VALVE_LOCK: {
    code: 'VALVE_LOCK',
    label: 'Valve Lockout',
    color: '#e11d48',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-900',
    borderClass: 'border-rose-300',
    icon: 'lock',
    desc: 'Manual valve chaining, car seal & padlocking',
  },
};

export function getIsolationTypeMeta(typeCode: string): PermitTypeMeta {
  const clean = (typeCode || '').trim().toUpperCase();
  return (
    ISOLATION_TYPE_META[clean] || {
      code: clean,
      label: clean || 'Isolation',
      color: '#7c3aed',
      badgeBg: 'bg-purple-100',
      badgeText: 'text-purple-900',
      borderClass: 'border-purple-300',
      icon: 'lock',
      desc: 'Energy isolation procedure',
    }
  );
}

/**
 * Returns dynamic heatmap styling for matrix cell counts
 * - Low (1-2): Subtle tinted badge
 * - Medium (3-5): Richer color with higher contrast
 * - High (6+): Deep tone with alert ring and high-risk indicator
 */
export function getCountDensityBadge(
  count: number,
  baseBadgeBg: string,
  baseBadgeText: string,
  baseBorder: string
): { badgeClass: string; isHigh: boolean } {
  if (count <= 0) {
    return { badgeClass: '', isHigh: false };
  }
  if (count >= 6) {
    return {
      badgeClass: `${baseBadgeBg} ${baseBadgeText} border-2 ${baseBorder} font-black shadow-xs ring-1 ring-offset-1 ring-amber-400`,
      isHigh: true,
    };
  }
  if (count >= 3) {
    return {
      badgeClass: `${baseBadgeBg} ${baseBadgeText} border ${baseBorder} font-bold shadow-2xs`,
      isHigh: false,
    };
  }
  return {
    badgeClass: `${baseBadgeBg} ${baseBadgeText} border ${baseBorder} font-semibold shadow-2xs`,
    isHigh: false,
  };
}

/**
 * Expands or filters report records based on WorkTypeMode:
 * - 'actual': only actual primary permit records (1 count per permit)
 * - 'with-additional': includes primary permit records PLUS generated virtual rows for each additional work type
 * - 'additional-only': returns only the additional work types
 */
export function expandRecordsWithWorkTypes(
  records: ReportRecord[],
  mode: WorkTypeMode = 'actual'
): ReportRecord[] {
  if (mode === 'actual') {
    return records.filter((r) => !r.isAdditional);
  }

  const result: ReportRecord[] = [];

  records.forEach((record) => {
    // If it's an isolation record, pass through untouched
    if (record.category !== 'permit') {
      result.push(record);
      return;
    }

    if (mode === 'with-additional') {
      // Keep primary record
      result.push({
        ...record,
        isAdditional: false,
        actualType: record.type,
      });
    }

    // Expand virtual entries for each additional work type
    if (record.additionalTypes && Array.isArray(record.additionalTypes)) {
      record.additionalTypes.forEach((addType, idx) => {
        const cleanType = (addType || '').trim().toUpperCase();
        if (cleanType && cleanType !== record.type.toUpperCase()) {
          result.push({
            ...record,
            id: record.id * 1000 + (idx + 1),
            type: cleanType,
            isAdditional: true,
            actualType: record.type,
          });
        }
      });
    }
  });

  return result;
}

export const PRESETS = [
  'Last day',
  'Last 7 days',
  'Last 10 days',
  'Last 15 days',
  'Last 20 days',
  'Month',
  'Quarter',
  '6 months',
  'Year',
  'MTD',
  'YTD',
] as const;

export type Preset = (typeof PRESETS)[number];

export const DEPARTMENT_COLORS = [
  '#006398', // Dahej Corporate Blue
  '#7c3aed', // Royal Violet
  '#f59e0b', // Amber Gold
  '#059669', // Emerald
  '#0284c7', // Sky Blue
  '#e11d48', // Rose Crimson
  '#8b5cf6', // Light Purple
  '#0891b2', // Deep Cyan
  '#ea580c', // Safety Orange
  '#4f46e5', // Indigo
  '#10b981', // Mint Green
  '#ec4899', // Hot Pink
  '#d97706', // Ochre Gold
  '#06b6d4', // Bright Cyan
  '#6366f1', // Electric Indigo
  '#14b8a6', // Teal
  '#f43f5e', // Coral
  '#a855f7', // Electric Violet
  '#84cc16', // Lime Green
  '#64748b', // Slate
];

export function todayISO(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function dateToISO(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getPresetStart(preset: Preset, endISO: string): string {
  const end = new Date(`${endISO}T12:00:00`);
  const start = new Date(end);

  switch (preset) {
    case 'Last day':
      start.setDate(start.getDate() - 1);
      break;
    case 'Last 7 days':
      start.setDate(start.getDate() - 6);
      break;
    case 'Last 10 days':
      start.setDate(start.getDate() - 9);
      break;
    case 'Last 15 days':
      start.setDate(start.getDate() - 14);
      break;
    case 'Last 20 days':
      start.setDate(start.getDate() - 19);
      break;
    case 'Month':
      start.setMonth(start.getMonth() - 1);
      start.setDate(start.getDate() + 1);
      break;
    case 'Quarter':
      start.setMonth(start.getMonth() - 3);
      start.setDate(start.getDate() + 1);
      break;
    case '6 months':
      start.setMonth(start.getMonth() - 6);
      start.setDate(start.getDate() + 1);
      break;
    case 'Year':
      start.setFullYear(start.getFullYear() - 1);
      start.setDate(start.getDate() + 1);
      break;
    case 'MTD':
      start.setDate(1);
      break;
    case 'YTD':
      start.setMonth(0, 1);
      break;
  }

  return dateToISO(start);
}

export function formatDate(value: string): string {
  if (!value) return '—';
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

export const formatPercentage = (value: number): string => {
  return Number(value.toFixed(1)).toString() + '%';
};

export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const csvContent =
    '\uFEFF' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Standard Dahej Complex Departments
 */
export const DAHEJ_DEPARTMENTS = [
  'Mechanical Maintenance',
  'Electrical Engineering',
  'Instrumentation & Control',
  'Production Operations',
  'Civil & Structural',
  'Piping & Line Breaking',
  'Static Equipment & Inspection',
  'Quality & NDT',
  'Utilities & Power'
];

/**
 * Converts live SAP permits and isolations into ReportRecord array
 */
export function convertSapToReportRecords(
  sapPermits: PermitInfoRecord[] = [],
  sapIsolations: Array<{
    IsolationNo?: string;
    PermitNo?: string;
    Status?: string;
    RequestedDate?: string | null;
    _Item?: Array<{ IsolType?: string; IsolationPoint?: string }>;
  }> = []
): ReportRecord[] {
  if ((!sapPermits || sapPermits.length === 0) && (!sapIsolations || sapIsolations.length === 0)) {
    return [];
  }

  const liveConverted: ReportRecord[] = (sapPermits || []).map((p, idx) => {
    const rawDept = p.ExecDept || p.Arbpl || 'Mechanical Maintenance';
    const cleanDept = rawDept.includes('ELEC')
      ? 'Electrical Engineering'
      : rawDept.includes('CIVIL')
      ? 'Civil & Structural'
      : rawDept.includes('INSP')
      ? 'Static Equipment & Inspection'
      : rawDept.includes('PIPE')
      ? 'Piping & Line Breaking'
      : rawDept.includes('UTIL')
      ? 'Utilities & Power'
      : rawDept;

    const normalizedPrimary = normalizePermitType((p.PermitType || 'COLD').trim().toUpperCase());

    const rawAdditional: string[] = [];
    const pAny = p as unknown as {
      _WorkType?: Array<{ WorkType?: string; SeqNo?: string }> | { results?: Array<{ WorkType?: string; SeqNo?: string }> };
      additionalTypes?: string[];
      _Safety?: Array<{ Type?: string; Desc?: string }>;
    };

    // 1. Child table _WorkType (supports both direct array and OData V2 results wrapper)
    const workTypes = Array.isArray(pAny._WorkType)
      ? pAny._WorkType
      : Array.isArray((pAny._WorkType as any)?.results)
      ? (pAny._WorkType as any).results
      : [];

    workTypes.forEach((wt: any) => {
      const wtCode = normalizePermitType((wt.WorkType || '').trim().toUpperCase());
      if (wtCode && wtCode !== normalizedPrimary && !rawAdditional.includes(wtCode)) {
        rawAdditional.push(wtCode);
      }
    });

    // 2. Additional types array from local session draft or payload
    if (Array.isArray(pAny.additionalTypes)) {
      pAny.additionalTypes.forEach((t) => {
        const code = normalizePermitType((t || '').trim().toUpperCase());
        if (code && code !== normalizedPrimary && !rawAdditional.includes(code)) {
          rawAdditional.push(code);
        }
      });
    }

    // 3. Fallback: check _Safety TYPE entries if applicable
    if (Array.isArray(pAny._Safety)) {
      pAny._Safety.forEach((s) => {
        if (s.Type) {
          const sType = normalizePermitType(s.Type.trim().toUpperCase());
          if (
            ALL_APPLICATION_PERMIT_TYPES.includes(sType as any) &&
            sType !== normalizedPrimary &&
            !rawAdditional.includes(sType)
          ) {
            rawAdditional.push(sType);
          }
        }
      });
    }

    return {
      id: 1000 + idx,
      date: p.ValidFromD || p.Erdat || todayISO(),
      department: cleanDept,
      category: 'permit',
      type: normalizedPrimary,
      actualType: normalizedPrimary,
      permitNo: p.Permit_No,
      status: p.Status,
      location: p.AreaLoc,
      additionalTypes: rawAdditional.length > 0 ? rawAdditional : undefined,
    };
  });

  // Extract isolations linked to permits or from sapIsolations
  const isolationConverted: ReportRecord[] = [];

  // 1. Linked isolations on permit headers
  (sapPermits || []).forEach((p, idx) => {
    if ((p.IsolationRequired === 'Y' || p.IsolationRequired === 'X') && (p.IsolationNo || p.LotoCertNo)) {
      const pType = (p.PermitType || '').toUpperCase();
      const isolType = pType === 'ELEC'
        ? 'ELECTRICAL'
        : pType === 'LBRK' || pType === 'LINE'
        ? 'BLIND_FLANGE'
        : pType === 'CSE' || pType === 'CONF'
        ? 'MECHANICAL'
        : 'VALVE_LOCK';

      isolationConverted.push({
        id: 2000 + idx,
        date: p.ValidFromD || p.Erdat || todayISO(),
        department: p.ExecDept || 'Electrical Engineering',
        category: 'isolation',
        type: isolType,
        permitNo: p.IsolationNo || p.LotoCertNo,
        status: 'ISOL',
        location: p.AreaLoc,
      });
    }
  });

  // 2. Direct isolations collection from SAP
  (sapIsolations || []).forEach((iso, idx) => {
    if (iso.IsolationNo && !isolationConverted.some((c) => c.permitNo === iso.IsolationNo)) {
      const firstItemType = iso._Item?.[0]?.IsolType || 'MECHANICAL';
      const type = firstItemType.includes('ELEC')
        ? 'ELECTRICAL'
        : firstItemType.includes('BLIND')
        ? 'BLIND_FLANGE'
        : firstItemType.includes('INST')
        ? 'INSTRUMENT'
        : 'MECHANICAL';

      isolationConverted.push({
        id: 3000 + idx,
        date: iso.RequestedDate || todayISO(),
        department: 'Electrical Engineering',
        category: 'isolation',
        type,
        permitNo: iso.IsolationNo,
        status: iso.Status || 'CRTD',
        location: iso._Item?.[0]?.IsolationPoint || 'Dahej Complex',
      });
    }
  });

  const combined = [...liveConverted, ...isolationConverted];
  return combined.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}
