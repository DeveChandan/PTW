import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { ReportRecord, DetailedPermitTat, GranularTatStep } from './reportConstants';
import {
  ALL_APPLICATION_PERMIT_TYPES,
  getPermitTypeMeta,
  formatDurationSeconds,
  exportToCSV,
  calculateGranularPermitTat,
} from './reportConstants';
import { auditLogApi } from '../../../core/api/modules/auditLog.api';
import { PermitTypeIcon } from '../../../shared/components/PermitTypeIcon';

export interface PermitTatAnalyticsProps {
  records: ReportRecord[];
  onOpenPermit?: (permitNo: string) => void;
}

interface PermitTypeTatSummary {
  type: string;
  label: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  icon: string;
  count: number;

  // Issuance averages (TAT 1..5)
  avgTat1Sec: number;
  avgTat2Sec: number;
  avgTat3Sec: number;
  avgTat4Sec: number;
  avgTat5Sec: number;
  avgIssuanceSec: number;
  issuanceRating: string;

  // Closing averages (TAT C1..C4)
  avgTatC1Sec: number;
  avgTatC2Sec: number;
  avgTatC3Sec: number;
  avgTatC4Sec: number;
  avgClosingSec: number;
  closingRating: string;

  // Lifecycle
  avgWorkSec: number;
  avgTotalCycleSec: number;
}

export const PermitTatAnalytics: React.FC<PermitTatAnalyticsProps> = ({
  records,
  onOpenPermit,
}) => {
  // 1. Filter out only permit records that have granular TAT
  const permitRecords = useMemo(() => {
    return records.filter((r) => r.category === 'permit' && r.granularTat);
  }, [records]);

  // 2. Filter & UI View Mode states
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPermitNo, setSelectedPermitNo] = useState<string | null>(null);
  const [tableStepView, setTableStepView] = useState<'all' | 'issuance' | 'closing'>('all');
  const [inspectorStage, setInspectorStage] = useState<'issuance' | 'closing' | 'all'>('issuance');

  // 3. Optimized client-side audit log cache to reduce API calls on permit inspection
  const [enrichedAuditMap, setEnrichedAuditMap] = useState<Record<string, DetailedPermitTat>>({});
  const pendingFetchRef = useRef<Set<string>>(new Set());

  // Lazy-load audit log for inspected permit if not already loaded or cached
  useEffect(() => {
    if (!selectedPermitNo) return;
    const permitNo = selectedPermitNo;

    if (enrichedAuditMap[permitNo]) return;

    const matchedRecord = permitRecords.find((r) => r.permitNo === permitNo);
    if (!matchedRecord) return;

    const rawAudit = (matchedRecord.rawPermit as any)?._AuditLog;
    if (Array.isArray(rawAudit) && rawAudit.length > 0) return;

    if (pendingFetchRef.current.has(permitNo)) return;
    pendingFetchRef.current.add(permitNo);

    // Fetches through cached auditLogApi (5-min cache prevents network hammering)
    auditLogApi
      .getAuditLogs(permitNo)
      .then((logs) => {
        pendingFetchRef.current.delete(permitNo);
        if (Array.isArray(logs) && logs.length > 0 && matchedRecord.rawPermit) {
          const enrichedPermit = {
            ...matchedRecord.rawPermit,
            _AuditLog: logs,
          };
          const newGranular = calculateGranularPermitTat(enrichedPermit as any);
          setEnrichedAuditMap((prev) => ({ ...prev, [permitNo]: newGranular }));
        }
      })
      .catch((err) => {
        pendingFetchRef.current.delete(permitNo);
        console.warn('[PermitTatAnalytics] Error fetching live audit logs for permit:', permitNo, err);
      });
  }, [selectedPermitNo, permitRecords, enrichedAuditMap]);

  // 4. Compute Per-Permit-Type TAT Aggregates (both Issuance & Closing)
  const permitTypeSummaries = useMemo<PermitTypeTatSummary[]>(() => {
    const map = new Map<string, { items: DetailedPermitTat[] }>();

    // Initialize all application permit types
    ALL_APPLICATION_PERMIT_TYPES.forEach((t) => {
      map.set(t, { items: [] });
    });

    permitRecords.forEach((r) => {
      const g = enrichedAuditMap[r.permitNo] || r.granularTat;
      if (!g) return;
      const typeKey = g.permitType || r.type || 'OTHER';
      if (!map.has(typeKey)) {
        map.set(typeKey, { items: [] });
      }
      map.get(typeKey)!.items.push(g);
    });

    const summaries: PermitTypeTatSummary[] = [];

    map.forEach((val, typeKey) => {
      const meta = getPermitTypeMeta(typeKey);
      const count = val.items.length;

      if (count === 0) {
        summaries.push({
          type: typeKey,
          label: meta.label,
          color: meta.color,
          badgeBg: meta.badgeBg,
          badgeText: meta.badgeText,
          icon: meta.icon,
          count: 0,
          avgTat1Sec: 0,
          avgTat2Sec: 0,
          avgTat3Sec: 0,
          avgTat4Sec: 0,
          avgTat5Sec: 0,
          avgIssuanceSec: 0,
          issuanceRating: '—',
          avgTatC1Sec: 0,
          avgTatC2Sec: 0,
          avgTatC3Sec: 0,
          avgTatC4Sec: 0,
          avgClosingSec: 0,
          closingRating: '—',
          avgWorkSec: 0,
          avgTotalCycleSec: 0,
        });
        return;
      }

      // Issuance sums
      const sumTat1 = val.items.reduce((acc, curr) => acc + curr.tat1Sec, 0);
      const sumTat2 = val.items.reduce((acc, curr) => acc + curr.tat2Sec, 0);
      const sumTat3 = val.items.reduce((acc, curr) => acc + curr.tat3Sec, 0);
      const sumTat4 = val.items.reduce((acc, curr) => acc + curr.tat4Sec, 0);
      const sumTat5 = val.items.reduce((acc, curr) => acc + curr.tat5Sec, 0);
      const sumIssuance = val.items.reduce((acc, curr) => acc + curr.issuanceTatSec, 0);

      // Closing sums (only consider permits with closing initiated or closed)
      const closedOrClosing = val.items.filter((item) => item.closingTatSec > 0 || ['ACCL', 'AROP', 'CLSD', 'CLOS'].includes(item.status));
      const closingCount = closedOrClosing.length || count;
      const sumTatC1 = closedOrClosing.reduce((acc, curr) => acc + curr.tatC1Sec, 0);
      const sumTatC2 = closedOrClosing.reduce((acc, curr) => acc + curr.tatC2Sec, 0);
      const sumTatC3 = closedOrClosing.reduce((acc, curr) => acc + curr.tatC3Sec, 0);
      const sumTatC4 = closedOrClosing.reduce((acc, curr) => acc + curr.tatC4Sec, 0);
      const sumClosing = closedOrClosing.reduce((acc, curr) => acc + curr.closingTatSec, 0);

      // Overall sums
      const sumWork = val.items.reduce((acc, curr) => acc + curr.workTatSec, 0);
      const sumCycle = val.items.reduce((acc, curr) => acc + curr.totalCycleTatSec, 0);

      const avgTat1Sec = Math.round(sumTat1 / count);
      const avgTat2Sec = Math.round(sumTat2 / count);
      const avgTat3Sec = Math.round(sumTat3 / count);
      const avgTat4Sec = Math.round(sumTat4 / count);
      const avgTat5Sec = Math.round(sumTat5 / count);
      const avgIssuanceSec = Math.round(sumIssuance / count);

      const avgTatC1Sec = Math.round(sumTatC1 / closingCount);
      const avgTatC2Sec = Math.round(sumTatC2 / closingCount);
      const avgTatC3Sec = Math.round(sumTatC3 / closingCount);
      const avgTatC4Sec = Math.round(sumTatC4 / closingCount);
      const avgClosingSec = Math.round(sumClosing / closingCount);

      const avgWorkSec = Math.round(sumWork / count);
      const avgTotalCycleSec = Math.round(sumCycle / count);

      let issuanceRating = '🟢 Optimal';
      if (avgIssuanceSec <= 60) issuanceRating = '🟢 Excellent';
      else if (avgIssuanceSec <= 3600) issuanceRating = '🟢 Optimal';
      else if (avgIssuanceSec <= 7200) issuanceRating = '🟡 Acceptable';
      else issuanceRating = '🔴 Overrun';

      let closingRating = '🟢 Optimal';
      if (avgClosingSec <= 120) closingRating = '🟢 Excellent';
      else if (avgClosingSec <= 2700) closingRating = '🟢 Optimal';
      else if (avgClosingSec <= 3600) closingRating = '🟡 Acceptable';
      else closingRating = '🔴 Overrun';

      summaries.push({
        type: typeKey,
        label: meta.label,
        color: meta.color,
        badgeBg: meta.badgeBg,
        badgeText: meta.badgeText,
        icon: meta.icon,
        count,
        avgTat1Sec,
        avgTat2Sec,
        avgTat3Sec,
        avgTat4Sec,
        avgTat5Sec,
        avgIssuanceSec,
        issuanceRating,
        avgTatC1Sec,
        avgTatC2Sec,
        avgTatC3Sec,
        avgTatC4Sec,
        avgClosingSec,
        closingRating,
        avgWorkSec,
        avgTotalCycleSec,
      });
    });

    return summaries.sort((a, b) => b.count - a.count);
  }, [permitRecords, enrichedAuditMap]);

  // 5. Overall Top KPIs (Issuance + Closing)
  const overallMetrics = useMemo(() => {
    if (permitRecords.length === 0) {
      return {
        totalPermits: 0,
        avgIssuanceSec: 0,
        avgTat1Sec: 0,
        avgTat2Tat3Sec: 0,
        avgTat4Tat5Sec: 0,
        fastestIssuanceType: '—',
        fastestIssuanceTime: '—',

        avgClosingSec: 0,
        avgTatC1TatC2Sec: 0,
        avgTatC3TatC4Sec: 0,
        fastestClosingType: '—',
        fastestClosingTime: '—',
      };
    }

    const total = permitRecords.length;
    let sumIssuance = 0;
    let sumTat1 = 0;
    let sumTat2Tat3 = 0;
    let sumTat4Tat5 = 0;

    let sumClosing = 0;
    let sumTatC1TatC2 = 0;
    let sumTatC3TatC4 = 0;
    let closedCount = 0;

    permitRecords.forEach((r) => {
      const g = enrichedAuditMap[r.permitNo] || r.granularTat;
      if (!g) return;
      sumIssuance += g.issuanceTatSec;
      sumTat1 += g.tat1Sec;
      sumTat2Tat3 += g.tat2Sec + g.tat3Sec;
      sumTat4Tat5 += g.tat4Sec + g.tat5Sec;

      if (g.closingTatSec > 0 || ['ACCL', 'AROP', 'CLSD', 'CLOS'].includes(g.status)) {
        closedCount++;
        sumClosing += g.closingTatSec;
        sumTatC1TatC2 += g.tatC1Sec + g.tatC2Sec;
        sumTatC3TatC4 += g.tatC3Sec + g.tatC4Sec;
      }
    });

    const activeSummaries = permitTypeSummaries.filter((s) => s.count > 0);
    const sortedByIssuance = [...activeSummaries].sort((a, b) => a.avgIssuanceSec - b.avgIssuanceSec);
    const fastestIssuance = sortedByIssuance[0];

    const sortedByClosing = [...activeSummaries].filter((s) => s.avgClosingSec > 0).sort((a, b) => a.avgClosingSec - b.avgClosingSec);
    const fastestClosing = sortedByClosing[0];

    const cDivisor = closedCount || total;

    return {
      totalPermits: total,
      avgIssuanceSec: Math.round(sumIssuance / total),
      avgTat1Sec: Math.round(sumTat1 / total),
      avgTat2Tat3Sec: Math.round(sumTat2Tat3 / total),
      avgTat4Tat5Sec: Math.round(sumTat4Tat5 / total),
      fastestIssuanceType: fastestIssuance ? fastestIssuance.label : '—',
      fastestIssuanceTime: fastestIssuance ? formatDurationSeconds(fastestIssuance.avgIssuanceSec, true) : '—',

      avgClosingSec: Math.round(sumClosing / cDivisor),
      avgTatC1TatC2Sec: Math.round(sumTatC1TatC2 / cDivisor),
      avgTatC3TatC4Sec: Math.round(sumTatC3TatC4 / cDivisor),
      fastestClosingType: fastestClosing ? fastestClosing.label : '—',
      fastestClosingTime: fastestClosing ? formatDurationSeconds(fastestClosing.avgClosingSec, true) : '—',
    };
  }, [permitRecords, permitTypeSummaries, enrichedAuditMap]);

  // 6. Filtered Records for Table and Live Inspector
  const filteredRecords = useMemo(() => {
    return permitRecords.map((r) => {
      const enriched = enrichedAuditMap[r.permitNo];
      if (enriched) {
        return { ...r, granularTat: enriched };
      }
      return r;
    }).filter((r) => {
      const g = r.granularTat;
      if (!g) return false;

      // Type filter
      if (selectedTypeFilter !== 'ALL') {
        const pType = g.permitType || r.type;
        if (pType !== selectedTypeFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesPermitNo = r.permitNo.toLowerCase().includes(q);
        const matchesDept = r.department.toLowerCase().includes(q);
        const matchesType = (g.permitType || r.type).toLowerCase().includes(q);
        const matchesActor = g.allLifecycleSteps.some((s) => (s.actor || '').toLowerCase().includes(q));
        if (!matchesPermitNo && !matchesDept && !matchesType && !matchesActor) {
          return false;
        }
      }

      return true;
    });
  }, [permitRecords, selectedTypeFilter, searchQuery, enrichedAuditMap]);

  const [isInspectorDismissed, setIsInspectorDismissed] = useState(false);

  // Currently inspected permit (defaults to first in list or selected)
  const inspectedRecord = useMemo(() => {
    if (isInspectorDismissed) return null;
    if (selectedPermitNo) {
      const match = filteredRecords.find((r) => r.permitNo === selectedPermitNo);
      if (match) return match;
    }
    return filteredRecords[0] || null;
  }, [filteredRecords, selectedPermitNo, isInspectorDismissed]);

  // Active steps for currently inspected permit
  const activeInspectorSteps = useMemo(() => {
    if (!inspectedRecord?.granularTat) return [];
    if (inspectorStage === 'closing') return inspectedRecord.granularTat.closingSteps;
    if (inspectorStage === 'issuance') return inspectedRecord.granularTat.steps;
    return inspectedRecord.granularTat.allLifecycleSteps;
  }, [inspectedRecord, inspectorStage]);

  // Executive KPI summary for inspected permit
  const inspectorMetrics = useMemo(() => {
    if (!activeInspectorSteps.length) return { fastest: null, longest: null, completedCount: 0 };
    const completed = activeInspectorSteps.filter(
      (s) => s.status === 'completed' && s.durationSec !== undefined && s.durationSec >= 0
    );
    const fastest = completed.length > 0
      ? completed.reduce((min, s) => (s.durationSec! < min.durationSec! ? s : min), completed[0])
      : null;
    const longest = completed.length > 0
      ? completed.reduce((max, s) => (s.durationSec! > max.durationSec! ? s : max), completed[0])
      : null;
    return { fastest, longest, completedCount: completed.length };
  }, [activeInspectorSteps]);

  // Handle Export Combined TAT CSV (Both Issuance & Closing)
  const handleExportCSV = () => {
    const headers = [
      'Permit No',
      'Permit Type',
      'Department',
      'Status',
      // Issuance Steps
      'Permit Created',
      'Gas Test Logged',
      'TAT 1: Gas/Prep (sec)',
      'TAT 1 Formatted',
      'TAT 1 Rating',
      'Approver 1 Signed',
      'TAT 2: Appr 1 (sec)',
      'TAT 2 Formatted',
      'TAT 2 Rating',
      'Approver 2 Signed',
      'TAT 3: Appr 2 (sec)',
      'TAT 3 Formatted',
      'TAT 3 Rating',
      'Acceptor Accepted',
      'TAT 4: Acceptor (sec)',
      'TAT 4 Formatted',
      'TAT 4 Rating',
      'Area Operator Signed',
      'TAT 5: Area Op (sec)',
      'TAT 5 Formatted',
      'TAT 5 Rating',
      'Total Issuance TAT',
      'Issuance SLA Rating',
      // Work Execution
      'Work Execution TAT',
      // Closing Steps
      'Work Completion Confirmed',
      'TAT C1: Work Complete (sec)',
      'TAT C1 Formatted',
      'TAT C1 Rating',
      'Acceptor Handover (ACCL)',
      'TAT C2: Acceptor Closure (sec)',
      'TAT C2 Formatted',
      'TAT C2 Rating',
      'Area Clearance (AROP)',
      'TAT C3: Site Inspection (sec)',
      'TAT C3 Formatted',
      'TAT C3 Rating',
      'Final Closed (CLSD)',
      'TAT C4: Final Archival (sec)',
      'TAT C4 Formatted',
      'TAT C4 Rating',
      'Total Closing TAT',
      'Closing SLA Rating',
      'Total End-to-End Cycle TAT',
    ];

    const rows = filteredRecords.map((r) => {
      const g = r.granularTat;
      return [
        `"${r.permitNo}"`,
        `"${g?.permitType || r.type}"`,
        `"${r.department}"`,
        `"${r.status || 'CRTD'}"`,
        // Issuance
        `"${g?.createdTime || '—'}"`,
        `"${g?.gasTestTime || '—'}"`,
        g?.tat1Sec ?? 0,
        `"${g?.tat1Formatted || '—'}"`,
        `"${g?.tat1Rating || '—'}"`,
        `"${g?.appr1Time || '—'}"`,
        g?.tat2Sec ?? 0,
        `"${g?.tat2Formatted || '—'}"`,
        `"${g?.tat2Rating || '—'}"`,
        `"${g?.appr2Time || '—'}"`,
        g?.tat3Sec ?? 0,
        `"${g?.tat3Formatted || '—'}"`,
        `"${g?.tat3Rating || '—'}"`,
        `"${g?.acceptorTime || '—'}"`,
        g?.tat4Sec ?? 0,
        `"${g?.tat4Formatted || '—'}"`,
        `"${g?.tat4Rating || '—'}"`,
        `"${g?.areaOpTime || '—'}"`,
        g?.tat5Sec ?? 0,
        `"${g?.tat5Formatted || '—'}"`,
        `"${g?.tat5Rating || '—'}"`,
        `"${g?.issuanceTatFormatted || '—'}"`,
        `"${g?.issuanceRating || '—'}"`,
        // Work
        `"${g?.workTatFormatted || '—'}"`,
        // Closing
        `"${g?.workCompleteTime || '—'}"`,
        g?.tatC1Sec ?? 0,
        `"${g?.tatC1Formatted || '—'}"`,
        `"${g?.tatC1Rating || '—'}"`,
        `"${g?.acceptorClosureTime || '—'}"`,
        g?.tatC2Sec ?? 0,
        `"${g?.tatC2Formatted || '—'}"`,
        `"${g?.tatC2Rating || '—'}"`,
        `"${g?.areaOpClosureTime || '—'}"`,
        g?.tatC3Sec ?? 0,
        `"${g?.tatC3Formatted || '—'}"`,
        `"${g?.tatC3Rating || '—'}"`,
        `"${g?.closedTime || '—'}"`,
        g?.tatC4Sec ?? 0,
        `"${g?.tatC4Formatted || '—'}"`,
        `"${g?.tatC4Rating || '—'}"`,
        `"${g?.closingTatFormatted || '—'}"`,
        `"${g?.closingRating || '—'}"`,
        `"${g?.totalCycleTatFormatted || '—'}"`,
      ];
    });

    exportToCSV(`PTW_Full_Lifecycle_TAT_Analysis_${selectedTypeFilter}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Filter Navigation */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-[#006398]">
                <span className="material-symbols-outlined text-[20px]">timer</span>
              </span>
              <h2 className="text-lg font-bold text-slate-800">
                PTW Turnaround Time (TAT) &amp; Lifecycle Benchmarking
              </h2>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Sub-minute metrics for both Permit Issuance (TAT 1–5) and Permit Closing (TAT C1–C4) with in-memory caching.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">
                search
              </span>
              <input
                type="text"
                placeholder="Search permit # or actor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-64 rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-xs font-medium text-slate-700 placeholder-slate-400 focus:border-[#006398] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#006398]/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-emerald-600">download</span>
              <span>Export Full TAT CSV</span>
            </button>
          </div>
        </div>

        {/* Permit Type Filter Pills */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
              Permit Type:
            </span>
            <button
              type="button"
              onClick={() => setSelectedTypeFilter('ALL')}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer ${
                selectedTypeFilter === 'ALL'
                  ? 'bg-[#006398] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>All Types</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  selectedTypeFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {permitRecords.length}
              </span>
            </button>

            {permitTypeSummaries.map((summary) => {
              const isSelected = selectedTypeFilter === summary.type;
              return (
                <button
                  key={summary.type}
                  type="button"
                  onClick={() => setSelectedTypeFilter(summary.type)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#006398] text-white shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  <PermitTypeIcon
                    icon={summary.icon}
                    type={summary.type}
                    size={15}
                    style={{ color: isSelected ? '#ffffff' : summary.color }}
                  />
                  <span>{summary.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {summary.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards Strip: Issuance & Closing */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* KPI 1: Avg Issuance TAT */}
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-sky-50/30 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Avg Issuance TAT</span>
            <span className="material-symbols-outlined text-[18px] text-[#006398]">speed</span>
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900 font-mono">
            {formatDurationSeconds(overallMetrics.avgIssuanceSec, true)}
          </div>
          <div className="mt-1 flex items-center gap-1">
            <span className="inline-flex items-center rounded bg-emerald-100 px-1 py-0.2 text-[10px] font-bold text-emerald-800">
              🟢 Steps 1–5
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">Creation → Issuance</p>
        </div>

        {/* KPI 2: Avg Gas & Prep (TAT 1) */}
        <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/80 to-fuchsia-50/30 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Gas &amp; Prep (TAT 1)</span>
            <span className="material-symbols-outlined text-[18px] text-purple-700">science</span>
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900 font-mono">
            {formatDurationSeconds(overallMetrics.avgTat1Sec, true)}
          </div>
          <div className="mt-1 flex items-center gap-1">
            <span className="inline-flex items-center rounded bg-purple-100 px-1 py-0.2 text-[10px] font-bold text-purple-800">
              🟢 Sub-minute
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">Pre-check benchmark</p>
        </div>

        {/* KPI 3: Avg Approvals (TAT 2+3) */}
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-blue-50/30 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Approvals (TAT 2+3)</span>
            <span className="material-symbols-outlined text-[18px] text-indigo-700">verified_user</span>
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900 font-mono">
            {formatDurationSeconds(overallMetrics.avgTat2Tat3Sec, true)}
          </div>
          <div className="mt-1 flex items-center gap-1">
            <span className="inline-flex items-center rounded bg-indigo-100 px-1 py-0.2 text-[10px] font-bold text-indigo-800">
              🟢 Multi-Tier
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">Appr 1 &amp; Appr 2 sign-off</p>
        </div>

        {/* KPI 4: Avg Closing TAT (TAT C1–C4) */}
        <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/80 to-emerald-50/30 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Avg Closing TAT</span>
            <span className="material-symbols-outlined text-[18px] text-teal-700">inventory_2</span>
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900 font-mono">
            {formatDurationSeconds(overallMetrics.avgClosingSec, true)}
          </div>
          <div className="mt-1 flex items-center gap-1">
            <span className="inline-flex items-center rounded bg-teal-100 px-1 py-0.2 text-[10px] font-bold text-teal-800">
              🟢 Steps C1–C4
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">Handover → Final CLSD</p>
        </div>

        {/* KPI 5: Avg Work Completion Confirmation (TAT C1+C2) */}
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-green-50/30 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Acceptor Close (C1+C2)</span>
            <span className="material-symbols-outlined text-[18px] text-emerald-700">task_alt</span>
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900 font-mono">
            {formatDurationSeconds(overallMetrics.avgTatC1TatC2Sec, true)}
          </div>
          <div className="mt-1 flex items-center gap-1">
            <span className="inline-flex items-center rounded bg-emerald-100 px-1 py-0.2 text-[10px] font-bold text-emerald-800">
              🟢 Site Handover
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">Cleaned &amp; ACCL</p>
        </div>

        {/* KPI 6: Area Clearance & Archival (TAT C3+C4) */}
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-orange-50/30 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Area &amp; CLSD (C3+C4)</span>
            <span className="material-symbols-outlined text-[18px] text-amber-600">lock_reset</span>
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900 font-mono">
            {formatDurationSeconds(overallMetrics.avgTatC3TatC4Sec, true)}
          </div>
          <div className="mt-1 flex items-center gap-1">
            <span className="inline-flex items-center rounded bg-amber-100 px-1 py-0.2 text-[10px] font-bold text-amber-800">
              🟢 Normalization
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">AROP &amp; Final Archive</p>
        </div>
      </div>

      {/* 3. SEPARATE TAT FOR EACH PERMIT TYPE - Matrix with View Toggle */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#006398]">category</span>
              Separate Turnaround Time (TAT) by Permit Type
            </h3>
            <p className="text-xs text-slate-500">
              Granular benchmarks across Hot, Cold, CSE, Height, and Electrical for both Issuance and Closing stages.
            </p>
          </div>

          {/* Table Step View Toggle */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-bold text-slate-700">
            <button
              type="button"
              onClick={() => setTableStepView('all')}
              className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                tableStepView === 'all' ? 'bg-white text-[#006398] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Lifecycle Steps
            </button>
            <button
              type="button"
              onClick={() => setTableStepView('issuance')}
              className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                tableStepView === 'issuance' ? 'bg-white text-[#006398] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Issuance (TAT 1–5)
            </button>
            <button
              type="button"
              onClick={() => setTableStepView('closing')}
              className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                tableStepView === 'closing' ? 'bg-white text-[#006398] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Closing (TAT C1–C4)
            </button>
          </div>
        </div>

        {/* Benchmark Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-3">Permit Type</th>
                <th className="px-3 py-3 text-center">Permits</th>

                {/* Issuance Columns */}
                {(tableStepView === 'all' || tableStepView === 'issuance') && (
                  <>
                    <th className="px-2.5 py-3 text-center bg-purple-50/60 text-purple-900">
                      TAT 1 (Gas)
                    </th>
                    <th className="px-2.5 py-3 text-center bg-sky-50/60 text-sky-900">
                      TAT 2 (Appr1)
                    </th>
                    <th className="px-2.5 py-3 text-center bg-indigo-50/60 text-indigo-900">
                      TAT 3 (Appr2)
                    </th>
                    <th className="px-2.5 py-3 text-center bg-teal-50/60 text-teal-900">
                      TAT 4 (Acceptor)
                    </th>
                    <th className="px-2.5 py-3 text-center bg-emerald-50/60 text-emerald-900">
                      TAT 5 (Area Op)
                    </th>
                    <th className="px-3 py-3 text-center bg-blue-50 font-black text-blue-950">
                      Issuance TAT
                    </th>
                  </>
                )}

                {/* Closing Columns */}
                {(tableStepView === 'all' || tableStepView === 'closing') && (
                  <>
                    <th className="px-2.5 py-3 text-center bg-amber-50/60 text-amber-900">
                      TAT C1 (Work Done)
                    </th>
                    <th className="px-2.5 py-3 text-center bg-orange-50/60 text-orange-900">
                      TAT C2 (ACCL)
                    </th>
                    <th className="px-2.5 py-3 text-center bg-rose-50/60 text-rose-900">
                      TAT C3 (AROP)
                    </th>
                    <th className="px-2.5 py-3 text-center bg-red-50/60 text-red-900">
                      TAT C4 (CLSD)
                    </th>
                    <th className="px-3 py-3 text-center bg-emerald-50 font-black text-emerald-950">
                      Closing TAT
                    </th>
                    <th className="px-3 py-3 text-center">Closing SLA</th>
                  </>
                )}

                <th className="px-3 py-3 text-right">Quick Filter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {permitTypeSummaries.map((s) => {
                const isSelected = selectedTypeFilter === s.type;
                const hasData = s.count > 0;
                return (
                  <tr
                    key={s.type}
                    className={`transition ${
                      isSelected ? 'bg-blue-50/60 font-semibold' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Permit Type Info */}
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <PermitTypeIcon
                          icon={s.icon}
                          type={s.type}
                          size={18}
                          style={{ color: s.color }}
                        />
                        <div>
                          <div className="font-bold text-slate-900">{s.label}</div>
                          <div className="text-[10px] font-mono text-slate-400">{s.type}</div>
                        </div>
                      </div>
                    </td>

                    {/* Count */}
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex rounded-md px-2 py-0.5 font-mono text-xs font-bold ${
                        hasData ? 'bg-slate-100 text-slate-800' : 'text-slate-400'
                      }`}>
                        {s.count}
                      </span>
                    </td>

                    {/* Issuance Values */}
                    {(tableStepView === 'all' || tableStepView === 'issuance') && (
                      <>
                        <td className="px-2.5 py-3 text-center font-mono text-xs bg-purple-50/20">
                          {hasData ? <span className="font-bold text-purple-900">{formatDurationSeconds(s.avgTat1Sec, false)}</span> : '—'}
                        </td>
                        <td className="px-2.5 py-3 text-center font-mono text-xs bg-sky-50/20">
                          {hasData ? <span className="font-bold text-sky-900">{formatDurationSeconds(s.avgTat2Sec, false)}</span> : '—'}
                        </td>
                        <td className="px-2.5 py-3 text-center font-mono text-xs bg-indigo-50/20">
                          {hasData ? <span className="font-bold text-indigo-900">{formatDurationSeconds(s.avgTat3Sec, false)}</span> : '—'}
                        </td>
                        <td className="px-2.5 py-3 text-center font-mono text-xs bg-teal-50/20">
                          {hasData ? <span className="font-bold text-teal-900">{formatDurationSeconds(s.avgTat4Sec, false)}</span> : '—'}
                        </td>
                        <td className="px-2.5 py-3 text-center font-mono text-xs bg-emerald-50/20">
                          {hasData ? <span className="font-bold text-emerald-900">{formatDurationSeconds(s.avgTat5Sec, false)}</span> : '—'}
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-xs bg-blue-50/40">
                          {hasData ? <span className="font-black text-[#006398]">{formatDurationSeconds(s.avgIssuanceSec, true)}</span> : '—'}
                        </td>
                      </>
                    )}

                    {/* Closing Values */}
                    {(tableStepView === 'all' || tableStepView === 'closing') && (
                      <>
                        <td className="px-2.5 py-3 text-center font-mono text-xs bg-amber-50/20">
                          {hasData && s.avgTatC1Sec > 0 ? <span className="font-bold text-amber-900">{formatDurationSeconds(s.avgTatC1Sec, false)}</span> : '—'}
                        </td>
                        <td className="px-2.5 py-3 text-center font-mono text-xs bg-orange-50/20">
                          {hasData && s.avgTatC2Sec > 0 ? <span className="font-bold text-orange-900">{formatDurationSeconds(s.avgTatC2Sec, false)}</span> : '—'}
                        </td>
                        <td className="px-2.5 py-3 text-center font-mono text-xs bg-rose-50/20">
                          {hasData && s.avgTatC3Sec > 0 ? <span className="font-bold text-rose-900">{formatDurationSeconds(s.avgTatC3Sec, false)}</span> : '—'}
                        </td>
                        <td className="px-2.5 py-3 text-center font-mono text-xs bg-red-50/20">
                          {hasData && s.avgTatC4Sec > 0 ? <span className="font-bold text-red-900">{formatDurationSeconds(s.avgTatC4Sec, false)}</span> : '—'}
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-xs bg-emerald-50/40">
                          {hasData && s.avgClosingSec > 0 ? <span className="font-black text-emerald-900">{formatDurationSeconds(s.avgClosingSec, true)}</span> : '—'}
                        </td>
                        <td className="px-3 py-3 text-center text-xs">
                          {hasData && s.avgClosingSec > 0 ? (
                            <span className="inline-flex rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                              {s.closingRating}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </>
                    )}

                    {/* Quick Filter Button */}
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedTypeFilter(s.type === selectedTypeFilter ? 'ALL' : s.type)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#006398] text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? 'Filtered' : 'Filter'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. LIVE PERMIT AUDIT INSPECTOR (STEP-BY-STEP ISSUANCE & CLOSING) */}
      {inspectedRecord && inspectedRecord.granularTat && (
        <div className="rounded-2xl border-2 border-[#006398]/30 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#006398] text-white shadow-sm">
                <span className="material-symbols-outlined text-[22px]">verified</span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Live Audit Log Step-by-Step Turnaround Time
                  </h3>
                  <span className="font-mono text-sm font-bold text-[#006398] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    {inspectedRecord.permitNo}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {inspectedRecord.type}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Exact interval timestamps extracted from SAP CDS audit logs &amp; approval actions (in-memory cached)
                </p>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                    Plant: {inspectedRecord.werks || inspectedRecord.rawPermit?.Werks || '—'}
                  </span>
                  <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200" title="Functional Location">
                    FLoc: {inspectedRecord.tplnr || inspectedRecord.rawPermit?.Tplnr || '—'}
                  </span>
                  {(inspectedRecord.auart || inspectedRecord.rawPermit?.Auart) && (
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                      MO: {inspectedRecord.auart || inspectedRecord.rawPermit?.Auart} #{inspectedRecord.aufnr || inspectedRecord.rawPermit?.Aufnr || ''}
                      {(inspectedRecord.ktext || inspectedRecord.rawPermit?.Ktext || (inspectedRecord.rawPermit as any)?.KTEXT) ? ` • ${inspectedRecord.ktext || inspectedRecord.rawPermit?.Ktext || (inspectedRecord.rawPermit as any)?.KTEXT}` : ''}
                    </span>
                  )}
                  {(inspectedRecord.qmart || inspectedRecord.rawPermit?.Qmart) && (
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      Notif: {inspectedRecord.qmart || inspectedRecord.rawPermit?.Qmart} #{inspectedRecord.qmnum || inspectedRecord.rawPermit?.Qmnum || ''}
                      {(inspectedRecord.qmtxt || inspectedRecord.rawPermit?.Qmtxt) ? ` • ${inspectedRecord.qmtxt || inspectedRecord.rawPermit?.Qmtxt}` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Stage Selector in Inspector */}
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-bold text-slate-700">
                <button
                  type="button"
                  onClick={() => setInspectorStage('issuance')}
                  className={`rounded-lg px-2.5 py-1.5 transition cursor-pointer ${
                    inspectorStage === 'issuance' ? 'bg-white text-[#006398] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Issuance (1–5)
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorStage('closing')}
                  className={`rounded-lg px-2.5 py-1.5 transition cursor-pointer ${
                    inspectorStage === 'closing' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Closing (C1–C4)
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorStage('all')}
                  className={`rounded-lg px-2.5 py-1.5 transition cursor-pointer ${
                    inspectorStage === 'all' ? 'bg-white text-indigo-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Full Lifecycle
                </button>
              </div>

              {onOpenPermit && (
                <button
                  type="button"
                  onClick={() => onOpenPermit(inspectedRecord.permitNo)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#006398] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0284c7] transition cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>Open Permit</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsInspectorDismissed(true)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                title="Dismiss Inspector"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Visual Step Display matching the requested user format */}
            <div className="lg:col-span-7 flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-4 font-mono text-xs sm:text-sm text-slate-800 space-y-3">
              <div className="font-bold text-[11px] uppercase tracking-wider text-slate-500 font-sans border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-emerald-700">radio_button_checked</span>
                  <span>
                    {inspectorStage === 'closing'
                      ? 'Permit Closing Milestones (TAT C1–C4)'
                      : inspectorStage === 'issuance'
                      ? 'Permit Issuance Milestones (TAT 1–5)'
                      : 'End-to-End Permit Lifecycle (Issuance & Closing)'}
                  </span>
                </span>
                <span className="font-bold text-emerald-700 font-mono text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Live SAP Events
                </span>
              </div>

              {/* Side-by-side columns when All Lifecycle is selected */}
              {inspectorStage === 'all' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 flex-1">
                  {/* Stage 1: Issuance Sub-Column */}
                  <div className="space-y-2">
                    <div className="font-bold text-[11px] uppercase tracking-wider text-blue-900 font-sans border-b border-blue-200/60 pb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-[#006398]">verified_user</span>
                        Stage 1: Issuance
                      </span>
                      <span className="font-mono text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">5 Steps</span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs text-xs">
                      <span className="font-semibold text-slate-700">Permit Created:</span>
                      <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {inspectedRecord.granularTat.createdTime}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs text-xs">
                      <span className="font-semibold text-slate-700">Gas Test Logged:</span>
                      <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {inspectedRecord.granularTat.gasTestTime}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-emerald-900 font-bold text-xs">
                      <span>→ TAT 1 = {inspectedRecord.granularTat.tat1Formatted}</span>
                      <span className="text-[11px] font-black">({inspectedRecord.granularTat.tat1Rating})</span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs text-xs">
                      <span className="font-semibold text-slate-700">Approver 1 Signed:</span>
                      <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {inspectedRecord.granularTat.appr1Time}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-emerald-900 font-bold text-xs">
                      <span>→ TAT 2 = {inspectedRecord.granularTat.tat2Formatted}</span>
                      <span className="text-[11px] font-black">({inspectedRecord.granularTat.tat2Rating})</span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs text-xs">
                      <span className="font-semibold text-slate-700">Approver 2 Signed:</span>
                      <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {inspectedRecord.granularTat.appr2Time}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-emerald-900 font-bold text-xs">
                      <span>→ TAT 3 = {inspectedRecord.granularTat.tat3Formatted}</span>
                      <span className="text-[11px] font-black">({inspectedRecord.granularTat.tat3Rating})</span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs text-xs">
                      <span className="font-semibold text-slate-700">Acceptor Accepted:</span>
                      <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {inspectedRecord.granularTat.acceptorTime}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-emerald-900 font-bold text-xs">
                      <span>→ TAT 4 = {inspectedRecord.granularTat.tat4Formatted}</span>
                      <span className="text-[11px] font-black">({inspectedRecord.granularTat.tat4Rating})</span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs text-xs">
                      <span className="font-semibold text-slate-700">Area Operator Signed:</span>
                      <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {inspectedRecord.granularTat.areaOpTime}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-emerald-900 font-bold text-xs">
                      <span>→ TAT 5 = {inspectedRecord.granularTat.tat5Formatted}</span>
                      <span className="text-[11px] font-black">({inspectedRecord.granularTat.tat5Rating})</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 px-3.5 py-2 text-white font-bold shadow-2xs text-xs mt-2">
                      <span>Total Issuance: {inspectedRecord.granularTat.issuanceTatFormatted}</span>
                      <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-black">
                        {inspectedRecord.granularTat.issuanceRating}
                      </span>
                    </div>
                  </div>

                  {/* Stage 2: Closing Sub-Column */}
                  <div className="space-y-2">
                    <div className="font-bold text-[11px] uppercase tracking-wider text-teal-900 font-sans border-b border-teal-200/60 pb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-teal-700">lock_reset</span>
                        Stage 2: Closing
                      </span>
                      <span className="font-mono text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-bold">4 Steps</span>
                    </div>

                    {/* Step C1: Work Completion */}
                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs text-xs">
                      <span className="font-semibold text-slate-700">Work Completed:</span>
                      <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {inspectedRecord.granularTat.workCompleteTime || 'Pending'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-amber-900 font-bold text-xs">
                      <span>→ TAT C1 = {inspectedRecord.granularTat.tatC1Formatted}</span>
                      <span className="text-[11px] font-black">({inspectedRecord.granularTat.tatC1Rating})</span>
                    </div>

                    {/* Step C2: Acceptor Closure */}
                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs text-xs">
                      <span className="font-semibold text-slate-700">Acceptor Handover:</span>
                      <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {inspectedRecord.granularTat.acceptorClosureTime || 'Pending'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-orange-50 border border-orange-200 px-2.5 py-1.5 text-orange-900 font-bold text-xs">
                      <span>→ TAT C2 = {inspectedRecord.granularTat.tatC2Formatted}</span>
                      <span className="text-[11px] font-black">({inspectedRecord.granularTat.tatC2Rating})</span>
                    </div>

                    {/* Step C3: Area Clearance */}
                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs text-xs">
                      <span className="font-semibold text-slate-700">Area Clearance:</span>
                      <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {inspectedRecord.granularTat.areaOpClosureTime || 'Pending'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-rose-900 font-bold text-xs">
                      <span>→ TAT C3 = {inspectedRecord.granularTat.tatC3Formatted}</span>
                      <span className="text-[11px] font-black">({inspectedRecord.granularTat.tatC3Rating})</span>
                    </div>

                    {/* Step C4: Final Issuer Close */}
                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs text-xs">
                      <span className="font-semibold text-slate-700">Issuer Final Close:</span>
                      <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {inspectedRecord.granularTat.closedTime || 'Pending'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5 text-red-900 font-bold text-xs">
                      <span>→ TAT C4 = {inspectedRecord.granularTat.tatC4Formatted}</span>
                      <span className="text-[11px] font-black">({inspectedRecord.granularTat.tatC4Rating})</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-teal-700 to-emerald-600 px-3.5 py-2 text-white font-bold shadow-2xs text-xs mt-2">
                      <span>Total Closing: {inspectedRecord.granularTat.closingTatFormatted}</span>
                      <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-black">
                        {inspectedRecord.granularTat.closingRating}
                      </span>
                    </div>
                  </div>
                </div>
              ) : inspectorStage === 'issuance' ? (
                /* Single column Issuance */
                <div className="space-y-2.5 flex-1">
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="font-semibold text-slate-700">Permit Created:</span>
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {inspectedRecord.granularTat.createdTime}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="font-semibold text-slate-700">Gas Test Logged:</span>
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {inspectedRecord.granularTat.gasTestTime}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-900 font-bold">
                    <span>→ TAT 1 = {inspectedRecord.granularTat.tat1Formatted}</span>
                    <span className="text-xs font-black">({inspectedRecord.granularTat.tat1Rating})</span>
                  </div>

                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="font-semibold text-slate-700">Approver 1 Signed:</span>
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {inspectedRecord.granularTat.appr1Time}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-900 font-bold">
                    <span>→ TAT 2 = {inspectedRecord.granularTat.tat2Formatted}</span>
                    <span className="text-xs font-black">({inspectedRecord.granularTat.tat2Rating})</span>
                  </div>

                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="font-semibold text-slate-700">Approver 2 Signed:</span>
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {inspectedRecord.granularTat.appr2Time}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-900 font-bold">
                    <span>→ TAT 3 = {inspectedRecord.granularTat.tat3Formatted}</span>
                    <span className="text-xs font-black">({inspectedRecord.granularTat.tat3Rating})</span>
                  </div>

                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="font-semibold text-slate-700">Acceptor Accepted:</span>
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {inspectedRecord.granularTat.acceptorTime}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-900 font-bold">
                    <span>→ TAT 4 = {inspectedRecord.granularTat.tat4Formatted}</span>
                    <span className="text-xs font-black">({inspectedRecord.granularTat.tat4Rating})</span>
                  </div>

                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="font-semibold text-slate-700">Area Operator Signed:</span>
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {inspectedRecord.granularTat.areaOpTime}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-900 font-bold">
                    <span>→ TAT 5 = {inspectedRecord.granularTat.tat5Formatted}</span>
                    <span className="text-xs font-black">({inspectedRecord.granularTat.tat5Rating})</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 px-4 py-3 text-white font-bold shadow-sm">
                    <span className="text-sm">Total Issuance TAT: {inspectedRecord.granularTat.issuanceTatFormatted}</span>
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-black">
                      ({inspectedRecord.granularTat.issuanceRating})
                    </span>
                  </div>
                </div>
              ) : (
                /* Single column Closing */
                <div className="space-y-2.5 flex-1">
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="font-semibold text-slate-700">Work Completed Confirmed:</span>
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {inspectedRecord.granularTat.workCompleteTime || 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900 font-bold">
                    <span>→ TAT C1 (Work Completion) = {inspectedRecord.granularTat.tatC1Formatted}</span>
                    <span className="text-xs font-black">({inspectedRecord.granularTat.tatC1Rating})</span>
                  </div>

                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="font-semibold text-slate-700">Acceptor Handover (ACCL):</span>
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {inspectedRecord.granularTat.acceptorClosureTime || 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-orange-900 font-bold">
                    <span>→ TAT C2 (Acceptor Closure) = {inspectedRecord.granularTat.tatC2Formatted}</span>
                    <span className="text-xs font-black">({inspectedRecord.granularTat.tatC2Rating})</span>
                  </div>

                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="font-semibold text-slate-700">Area Operator Clearance (AROP):</span>
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {inspectedRecord.granularTat.areaOpClosureTime || 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-rose-900 font-bold">
                    <span>→ TAT C3 (Site Inspection &amp; De-Isolation) = {inspectedRecord.granularTat.tatC3Formatted}</span>
                    <span className="text-xs font-black">({inspectedRecord.granularTat.tatC3Rating})</span>
                  </div>

                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="font-semibold text-slate-700">Issuer Final Closure (CLSD):</span>
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {inspectedRecord.granularTat.closedTime || 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-900 font-bold">
                    <span>→ TAT C4 (Final Archival) = {inspectedRecord.granularTat.tatC4Formatted}</span>
                    <span className="text-xs font-black">({inspectedRecord.granularTat.tatC4Rating})</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-teal-700 to-emerald-600 px-4 py-3 text-white font-bold shadow-sm">
                    <span className="text-sm">Total Closing TAT: {inspectedRecord.granularTat.closingTatFormatted}</span>
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-black">
                      (Closing Cycle: {inspectedRecord.granularTat.closingRating})
                    </span>
                  </div>
                </div>
              )}

              {/* End-to-End Grand Total Banner spanning across */}
              {inspectorStage === 'all' && (
                <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-slate-800 to-indigo-900 px-4 py-3 text-white font-bold shadow-sm mt-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-indigo-300">all_inclusive</span>
                    <span className="text-xs sm:text-sm">Full Lifecycle Turnaround Time: {inspectedRecord.granularTat.totalCycleTatFormatted}</span>
                  </div>
                  <span className="text-[11px] bg-white/20 px-2.5 py-0.5 rounded font-mono font-black">
                    End-to-End Cycle
                  </span>
                </div>
              )}
            </div>

            {/* Audit Timeline & Responsibilities - OPTIMIZED SPACE & NO VERTICAL GAPS */}
            <div className="lg:col-span-5 flex flex-col rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
              <div className="font-bold text-[11px] uppercase tracking-wider text-slate-500 font-sans border-b border-slate-100 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-800">
                  <span className="material-symbols-outlined text-[17px] text-[#006398]">timeline</span>
                  <span>Timeline &amp; Actor Responsibilities</span>
                </div>
                <span className="text-[10px] text-slate-600 font-mono bg-slate-100 px-2.5 py-0.5 rounded-full font-bold">
                  {inspectorStage === 'closing'
                    ? '4 Closing Steps'
                    : inspectorStage === 'issuance'
                    ? '5 Issuance Steps'
                    : '9 Lifecycle Steps'}
                </span>
              </div>

              {/* Executive Performance Strip: Utilizes space cleanly and shows actionable SLA insights */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/70 text-[11px]">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Fastest Step</span>
                  <span
                    className="font-bold text-emerald-700 truncate"
                    title={inspectorMetrics.fastest ? `${inspectorMetrics.fastest.label} (${inspectorMetrics.fastest.durationFormatted})` : undefined}
                  >
                    {inspectorMetrics.fastest ? `⚡ Step ${inspectorMetrics.fastest.stepNo}: ${inspectorMetrics.fastest.durationFormatted}` : '—'}
                  </span>
                </div>
                <div className="flex flex-col border-x border-slate-200/70 px-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Longest Step</span>
                  <span
                    className="font-bold text-amber-700 truncate"
                    title={inspectorMetrics.longest ? `${inspectorMetrics.longest.label} (${inspectorMetrics.longest.durationFormatted})` : undefined}
                  >
                    {inspectorMetrics.longest ? `⏱️ Step ${inspectorMetrics.longest.stepNo}: ${inspectorMetrics.longest.durationFormatted}` : '—'}
                  </span>
                </div>
                <div className="flex flex-col pl-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Milestones</span>
                  <span className="font-bold text-[#006398] truncate">
                    ✓ {inspectorMetrics.completedCount} of {activeInspectorSteps.length} Logged
                  </span>
                </div>
              </div>

              {/* Timeline Cards Container: Starts immediately below header, tightly stacked */}
              <div className="space-y-2.5 overflow-y-auto max-h-[580px] pr-1 text-xs">
                {activeInspectorSteps.map((step: GranularTatStep) => (
                  <div
                    key={step.id}
                    className={`flex flex-col gap-1.5 rounded-xl border p-3 transition-all ${
                      step.status === 'completed'
                        ? 'border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 shadow-2xs'
                        : step.status === 'in_progress'
                        ? 'border-blue-300 bg-blue-50/40 shadow-xs'
                        : 'border-dashed border-slate-200 bg-white opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-slate-800">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-mono font-bold ${
                          String(step.stepNo).startsWith('C')
                            ? 'bg-teal-100 text-teal-800 border border-teal-200'
                            : 'bg-blue-100 text-[#006398] border border-blue-200'
                        }`}>
                          {step.stepNo}
                        </span>
                        <span className="truncate">{step.label}</span>
                      </div>
                      <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-full ${
                        step.performance === 'optimal' || step.performance === 'excellent'
                          ? 'bg-emerald-100 text-emerald-800'
                          : step.performance === 'acceptable'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {step.performanceLabel}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                      <span className="truncate max-w-[240px] text-slate-500">{step.fromEvent} → {step.toEvent}</span>
                      <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                        {step.durationFormatted}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 mt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-slate-400">person</span>
                        <span>Actor: <strong className="text-slate-700">{step.actor || 'Authorized Safety Officer'}</strong></span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-slate-500">
                        <span className="material-symbols-outlined text-[13px] text-slate-400">schedule</span>
                        <span>{step.startTimestamp || '—'} → {step.endTimestamp || '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Permit Quick Meta */}
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span>Department: <strong className="text-slate-700">{inspectedRecord.department}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Permit: <strong className="text-slate-700 font-mono">{inspectedRecord.permitNo}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>Status:</span>
                  <span className="font-bold text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {inspectedRecord.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. GRANULAR MASTER TABLE */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#006398]">table_chart</span>
              Granular Turnaround Time Master Ledger ({filteredRecords.length} Permits)
            </h3>
            <p className="text-xs text-slate-500">
              Select any permit row to inspect step intervals.
            </p>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-xs text-slate-500">
            No permits found matching your search or filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3">Permit #</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Plant</th>
                  <th className="px-3 py-3">Functional Loc</th>
                  <th className="px-3 py-3">Ref / MO Type</th>
                  <th className="px-3 py-3">Department</th>

                  {/* Issuance columns */}
                  <th className="px-2.5 py-3 text-center bg-purple-50/60 text-purple-900">
                    TAT 1 (Gas)
                  </th>
                  <th className="px-2.5 py-3 text-center bg-sky-50/60 text-sky-900">
                    TAT 2 (Appr1)
                  </th>
                  <th className="px-2.5 py-3 text-center bg-indigo-50/60 text-indigo-900">
                    TAT 3 (Appr2)
                  </th>
                  <th className="px-2.5 py-3 text-center bg-teal-50/60 text-teal-900">
                    TAT 4 (Acceptor)
                  </th>
                  <th className="px-2.5 py-3 text-center bg-emerald-50/60 text-emerald-900">
                    TAT 5 (Area Op)
                  </th>
                  <th className="px-3 py-3 text-center bg-blue-50 font-black text-blue-950">
                    Issuance TAT
                  </th>

                  {/* Closing columns */}
                  <th className="px-2.5 py-3 text-center bg-amber-50/60 text-amber-900">
                    TAT C1 (Work)
                  </th>
                  <th className="px-2.5 py-3 text-center bg-orange-50/60 text-orange-900">
                    TAT C2 (ACCL)
                  </th>
                  <th className="px-2.5 py-3 text-center bg-rose-50/60 text-rose-900">
                    TAT C3 (AROP)
                  </th>
                  <th className="px-2.5 py-3 text-center bg-red-50/60 text-red-900">
                    TAT C4 (CLSD)
                  </th>
                  <th className="px-3 py-3 text-center bg-emerald-50 font-black text-emerald-950">
                    Closing TAT
                  </th>

                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredRecords.map((r) => {
                  const g = r.granularTat;
                  const isCurrent = inspectedRecord?.permitNo === r.permitNo;
                  return (
                    <tr
                      key={r.permitNo}
                      onClick={() => {
                        setSelectedPermitNo(r.permitNo);
                        setIsInspectorDismissed(false);
                      }}
                      className={`cursor-pointer transition ${
                        isCurrent ? 'bg-blue-50/70 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Permit No */}
                      <td className="px-3 py-2.5 font-mono font-bold text-[#006398]">
                        {r.permitNo}
                      </td>

                      {/* Type */}
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                          {g?.permitType || r.type}
                        </span>
                      </td>

                      {/* Plant */}
                      <td className="px-3 py-2.5 font-mono text-slate-700 whitespace-nowrap text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold">
                          {r.werks || r.rawPermit?.Werks || '—'}
                        </span>
                      </td>

                      {/* Functional Location */}
                      <td className="px-3 py-2.5 font-mono text-slate-700 max-w-[130px] truncate text-[11px]" title={r.tplnr || r.rawPermit?.Tplnr || '—'}>
                        {r.tplnr || r.rawPermit?.Tplnr || '—'}
                      </td>

                      {/* Ref / MO Type */}
                      <td className="px-3 py-2.5 font-mono text-slate-700 whitespace-nowrap text-[11px]">
                        {(r.auart || r.rawPermit?.Auart) ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 w-fit">
                              MO: {r.auart || r.rawPermit?.Auart} #{r.aufnr || r.rawPermit?.Aufnr || ''}
                            </span>
                            {(r.ktext || r.rawPermit?.Ktext || (r.rawPermit as any)?.KTEXT) && (
                              <span
                                className="text-[10px] text-slate-500 truncate max-w-[130px]"
                                title={r.ktext || r.rawPermit?.Ktext || (r.rawPermit as any)?.KTEXT}
                              >
                                {r.ktext || r.rawPermit?.Ktext || (r.rawPermit as any)?.KTEXT}
                              </span>
                            )}
                          </div>
                        ) : (r.qmart || r.rawPermit?.Qmart) ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 w-fit">
                              Notif: {r.qmart || r.rawPermit?.Qmart} #{r.qmnum || r.rawPermit?.Qmnum || ''}
                            </span>
                            {(r.qmtxt || r.rawPermit?.Qmtxt) && (
                              <span
                                className="text-[10px] text-slate-500 truncate max-w-[130px]"
                                title={r.qmtxt || r.rawPermit?.Qmtxt}
                              >
                                {r.qmtxt || r.rawPermit?.Qmtxt}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Department */}
                      <td className="px-3 py-2.5 max-w-[140px] truncate text-slate-600">
                        {r.department}
                      </td>

                      {/* Issuance Steps */}
                      <td className="px-2.5 py-2.5 text-center font-mono bg-purple-50/20">
                        <span className="font-bold text-purple-900">{g?.tat1Formatted || '—'}</span>
                      </td>
                      <td className="px-2.5 py-2.5 text-center font-mono bg-sky-50/20">
                        <span className="font-bold text-sky-900">{g?.tat2Formatted || '—'}</span>
                      </td>
                      <td className="px-2.5 py-2.5 text-center font-mono bg-indigo-50/20">
                        <span className="font-bold text-indigo-900">{g?.tat3Formatted || '—'}</span>
                      </td>
                      <td className="px-2.5 py-2.5 text-center font-mono bg-teal-50/20">
                        <span className="font-bold text-teal-900">{g?.tat4Formatted || '—'}</span>
                      </td>
                      <td className="px-2.5 py-2.5 text-center font-mono bg-emerald-50/20">
                        <span className="font-bold text-emerald-900">{g?.tat5Formatted || '—'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono bg-blue-50/40">
                        <span className="font-black text-[#006398]">{g?.issuanceTatFormatted || '—'}</span>
                      </td>

                      {/* Closing Steps */}
                      <td className="px-2.5 py-2.5 text-center font-mono bg-amber-50/20">
                        <span className="font-bold text-amber-900">{g?.tatC1Formatted || '—'}</span>
                      </td>
                      <td className="px-2.5 py-2.5 text-center font-mono bg-orange-50/20">
                        <span className="font-bold text-orange-900">{g?.tatC2Formatted || '—'}</span>
                      </td>
                      <td className="px-2.5 py-2.5 text-center font-mono bg-rose-50/20">
                        <span className="font-bold text-rose-900">{g?.tatC3Formatted || '—'}</span>
                      </td>
                      <td className="px-2.5 py-2.5 text-center font-mono bg-red-50/20">
                        <span className="font-bold text-red-900">{g?.tatC4Formatted || '—'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono bg-emerald-50/40">
                        <span className="font-black text-emerald-900">{g?.closingTatFormatted || '—'}</span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                          {r.status || 'CRTD'}
                        </span>
                      </td>

                      {/* Inspect Button */}
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPermitNo(r.permitNo);
                            setIsInspectorDismissed(false);
                          }}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                            isCurrent
                              ? 'bg-[#006398] text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {isCurrent ? 'Viewing' : 'Inspect'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
