import { PERMIT_CATEGORIES, PREPARATIONS } from '../../../core/ptw/siteProcedure';
import type { PermitInfoRecord } from '../../../core/types/ptw.types';
import type { WorkReference } from '../../../core/api/modules/permitWorkLookup.api';

export interface MaintenanceWorkItem extends WorkReference {
  StatusBadge: 'PTW Active' | 'PTW Approved' | 'PTW Required' | 'PTW Closed' | 'Exempt';
  LinkedPermitNo?: string;
  EstimatedHours?: number;
  RiskLevel?: 'LOW' | 'MED' | 'HIGH' | 'CRIT';
  TradeDept?: string;
}

export interface ExecutiveReportMetrics {
  totalWorks: number;
  totalPermits: number;
  activePermits: number;
  intendedPermits: number;
  approvedPermits: number;
  draftPermits: number;
  closedPermits: number;
  rejectedPermits: number;
  criticalHighRiskPermits: number;
  lotoEnforcedPermits: number;
  lotoCompliancePct: number;
  gasTestRequiredPermits: number;
  gasCompliancePct: number;
  totalWorkersOnSite: number;
  procedureComplianceScore: number;
}

export interface CategoryBreakdownItem {
  code: string;
  sapCode: string;
  label: string;
  icon: string;
  desc: string;
  count: number;
  pct: number;
  activeCount: number;
  riskBand: 'LOW' | 'MED' | 'HIGH' | 'CRIT';
  requiresLoto: boolean;
  requiresGas: boolean;
}

export interface PreparationAuditSummary {
  code: string;
  label: string;
  page: number;
  appliesTo: string[];
  compliantCount: number;
  totalApplicable: number;
  compliancePct: number;
  status: 'FULL' | 'ATTENTION' | 'PENDING';
}


/**
 * Computes live executive summary metrics across combined works and permits
 */
export function computeExecutiveMetrics(
  permits: PermitInfoRecord[],
  works: MaintenanceWorkItem[]
): ExecutiveReportMetrics {
  const totalPermits = permits.length;
  const activePermits = permits.filter((p) => p.Status === 'ISSU' || p.Status === 'ACTV').length;
  const intendedPermits = permits.filter((p) => p.Status === 'INTD').length;
  const approvedPermits = permits.filter((p) => p.Status === 'APPR').length;
  const draftPermits = permits.filter((p) => p.Status === 'CRTD' || p.Status === 'DRAF').length;
  const closedPermits = permits.filter((p) => p.Status === 'CLOS' || p.Status === 'CANC').length;
  const rejectedPermits = permits.filter((p) => p.Status === 'REJT' || p.Status === 'REJC').length;

  const criticalHighRiskPermits = permits.filter((p) => {
    const t = p.PermitType?.toUpperCase() || '';
    return (
      t === 'HOT' ||
      t === 'CONF' ||
      t === 'CSE' ||
      t === 'HGHT' ||
      t === 'W@H' ||
      t === 'LBRK' ||
      t === 'LINE' ||
      t === 'RAD'
    );
  }).length;

  const lotoRequired = permits.filter((p) => p.IsolationRequired === 'Y' || p.IsolationRequired === 'X');
  const lotoEnforced = lotoRequired.filter((p) => Boolean(p.IsolationNo || p.LotoCertNo)).length;
  const lotoCompliancePct = lotoRequired.length > 0 ? Math.round((lotoEnforced / lotoRequired.length) * 100) : 100;

  const gasRequired = permits.filter((p) => p.GasTestRequired === 'Y' || p.GasTestRequired === 'X');
  const gasTested = gasRequired.filter(
    (p) => p.Status === 'ISSU' || p.Status === 'ACTV' || p.Status === 'CLOS'
  ).length;
  const gasCompliancePct = gasRequired.length > 0 ? Math.round((gasTested / gasRequired.length) * 100) : 100;

  const totalWorkersOnSite = permits
    .filter((p) => p.Status === 'ISSU' || p.Status === 'ACTV')
    .reduce((acc, p) => acc + (Number(p.PersonsQty) || 0), 0);

  // Procedure compliance rate across all active/approved permits
  const evaluatedPermits = permits.filter((p) => p.Status !== 'REJT' && p.Status !== 'DRAF');
  const compliantCount = evaluatedPermits.filter((p) => {
    const isLotoOk =
      (p.IsolationRequired !== 'Y' && p.IsolationRequired !== 'X') || Boolean(p.IsolationNo || p.LotoCertNo);
    const isGasOk =
      (p.GasTestRequired !== 'Y' && p.GasTestRequired !== 'X') || p.Status === 'ISSU' || p.Status === 'ACTV';
    return isLotoOk && isGasOk;
  }).length;

  const procedureComplianceScore =
    evaluatedPermits.length > 0 ? Math.round((compliantCount / evaluatedPermits.length) * 100) : 98;

  return {
    totalWorks: works.length,
    totalPermits,
    activePermits,
    intendedPermits,
    approvedPermits,
    draftPermits,
    closedPermits,
    rejectedPermits,
    criticalHighRiskPermits,
    lotoEnforcedPermits: lotoEnforced,
    lotoCompliancePct,
    gasTestRequiredPermits: gasRequired.length,
    gasCompliancePct,
    totalWorkersOnSite,
    procedureComplianceScore,
  };
}

/**
 * Computes category distribution across standard 11 categories
 */
export function computeCategoryBreakdown(permits: PermitInfoRecord[]): CategoryBreakdownItem[] {
  const total = Math.max(permits.length, 1);
  return PERMIT_CATEGORIES.map((cat) => {
    const matches = permits.filter((p) => {
      const t = (p.PermitType || '').toUpperCase();
      return t === cat.code.toUpperCase() || t === cat.sapCode.toUpperCase();
    });
    const active = matches.filter((p) => p.Status === 'ISSU' || p.Status === 'ACTV').length;
    const count = matches.length;
    const pct = Math.round((count / total) * 100);

    let riskBand: 'LOW' | 'MED' | 'HIGH' | 'CRIT' = 'MED';
    if (['HOT', 'CONF', 'CSE', 'LBRK', 'LINE'].includes(cat.sapCode)) riskBand = 'CRIT';
    else if (['W@H', 'HGHT', 'EXCV', 'RAD', 'RIG'].includes(cat.sapCode)) riskBand = 'HIGH';
    else if (cat.code === 'COLD') riskBand = 'LOW';

    return {
      code: cat.code,
      sapCode: cat.sapCode,
      label: cat.label,
      icon: cat.icon,
      desc: cat.desc,
      count,
      pct,
      activeCount: active,
      riskBand,
      requiresLoto: ['CSE', 'LBRK', 'CONF', 'LINE', 'HYD_PNEU', 'ELEC'].includes(cat.sapCode),
      requiresGas: ['HOT', 'CSE', 'CONF', 'LBRK', 'LINE'].includes(cat.sapCode),
    };
  });
}

/**
 * Computes safety preparations audit summary against the 25 standard items in HSE/SAF/P/01
 */
export function computePreparationsAudit(permits: PermitInfoRecord[]): PreparationAuditSummary[] {
  return PREPARATIONS.map((prep) => {
    // Determine how many permits this preparation applies to
    const appliesTo = prep.applies || ['ALL'];
    const applicablePermits = prep.applies
      ? permits.filter((p) => {
          const t = (p.PermitType || '').toUpperCase();
          return prep.applies?.some(
            (a) => a.toUpperCase() === t || a.toUpperCase() === (p.PermitType || '').toUpperCase()
          );
        })
      : permits;

    const totalApplicable = applicablePermits.length;
    // Approximated compliance rate based on verified permits
    const verifiedPermits = applicablePermits.filter(
      (p) => p.Status === 'ISSU' || p.Status === 'ACTV' || p.Status === 'APPR' || p.Status === 'CLOS'
    );
    const compliantCount = verifiedPermits.length;
    const compliancePct = totalApplicable > 0 ? Math.round((compliantCount / totalApplicable) * 100) : 100;

    let status: 'FULL' | 'ATTENTION' | 'PENDING' = 'FULL';
    if (compliancePct < 75) status = 'PENDING';
    else if (compliancePct < 90) status = 'ATTENTION';

    return {
      code: prep.code,
      label: prep.label,
      page: prep.page,
      appliesTo,
      compliantCount,
      totalApplicable,
      compliancePct,
      status,
    };
  });
}

/**
 * Converts array of records into downloadable CSV string
 */
export function exportToCsv(rows: Record<string, any>[], filename = 'export.csv'): void {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          let val = row[header];
          if (val === null || val === undefined) val = '';
          val = String(val).replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(',')
    ),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
