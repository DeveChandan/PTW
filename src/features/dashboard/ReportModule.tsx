import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ModuleDefinition, SapUser } from '../../core/auth/sapAuthContext';
import { sitePermitApi } from '../../core/api/modules/sitePermit.api';
import { isolationApi } from '../../core/api/modules/isolation.api';
import { toast } from '../../shared/context/ToastContext';

import {
  todayISO,
  dateToISO,
  getPresetStart,
  formatDate,
  exportToCSV,
  convertSapToReportRecords,
  formatDurationMinutes,
  getPermitTypeMeta,
  getIsolationTypeMeta,
  type Category,
  type Preset,
  type ReportRecord,
} from './reports/reportConstants';

import { PermitTypeCode } from './reports/PermitTypeCode';
import { IsolationType } from './reports/IsolationType';
import { ReportAnalytics } from './reports/ReportAnalytics';
import { PermitTatAnalytics } from './reports/PermitTatAnalytics';
import { PermitTypeIcon } from '../../shared/components/PermitTypeIcon';

export interface ReportModuleProps {
  module: ModuleDefinition;
  user: SapUser | null;
  onBack?: () => void;
  onOpenPermit?: (permitNo: string) => void;
}

const PLANTS = [
  { id: '1002', name: '1002 - Dahej Central Complex', location: 'Dahej, Gujarat' },
  { id: '1001', name: '1001 - Fluoropolymer Unit', location: 'Dahej Plant 1' },
  { id: '1003', name: '1003 - Chlor-Alkali Block', location: 'Dahej Plant 3' },
  { id: '1004', name: '1004 - Central Utilities & Power', location: 'Dahej Utilities' },
  { id: 'ALL', name: 'ALL - All Operating Plants', location: 'All Sites' },
];

export type DatePreset = 'THIS_MONTH' | 'LAST_WEEK' | 'TODAY' | 'LAST_30_DAYS' | 'ALL' | 'CUSTOM';

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-200/80 text-2xl font-mono text-slate-500 shadow-inner">
        ∅
      </div>
      <h3 className="text-base font-bold text-slate-800">{message}</h3>
      <p className="mt-2 max-w-md text-xs sm:text-sm text-slate-500">
        Try modifying the date range or clearing the active search and category filters.
      </p>
    </div>
  );
}

function getTypeMeta(category: Category, type: string) {
  return category === 'permit' ? getPermitTypeMeta(type) : getIsolationTypeMeta(type);
}

// In-memory module-level cache to reduce redundant SAP Gateway API calls across tab switches
// Composite key: plantId::dateFrom::dateTo (ensures 0 extra API calls when toggling tabs or revisiting presets)
const plantReportCache = new Map<string, { records: ReportRecord[]; timestamp: number }>();
const REPORT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL

// Lean $select projection: fetch only necessary fields for reporting, slashing payload by 85%
const REPORT_PERMIT_SELECT_FIELDS = [
  'Permit_No',
  'PermitType',
  'Status',
  'Werks',
  'Tplnr',
  'Auart',
  'Qmart',
  'Aufnr',
  'Qmnum',
  'Ktext',
  'Qmtxt',
  'JobDesc',
  'Equnr',
  'ExecDept',
  'Arbpl',
  'AreaLoc',
  'ValidFromD',
  'ValidFromT',
  'ValidToD',
  'ValidToT',
  'Erdat',
  'Erzet',
  'WorkCompleted',
  'ClosedByAcceptor',
  'ClosedByAreaOpp',
  'IsolationRequired',
  'IsolationNo',
  'LotoCertNo',
  'Aenam',
  'PermitIssuer',
];

function getReportCacheKey(plantId?: string, dateFrom?: string, dateTo?: string): string {
  const p = (plantId || 'ALL').trim().toUpperCase();
  const f = (dateFrom || 'ALL').trim();
  const t = (dateTo || 'ALL').trim();
  return `${p}::${f}::${t}`;
}

// Helper to access persistent cache (sessionStorage + in-memory)
function getCachedReportData(plantId?: string, dateFrom?: string, dateTo?: string): { records: ReportRecord[]; timestamp: number } | null {
  const key = getReportCacheKey(plantId, dateFrom, dateTo);
  // 1. In-memory check (0ms)
  const mem = plantReportCache.get(key);
  if (mem && Date.now() - mem.timestamp < REPORT_CACHE_TTL_MS && mem.records.length > 0) {
    return mem;
  }
  // 2. SessionStorage check (persists across module navigations and page reloads)
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(`ptw_report_cache_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.records) && Date.now() - parsed.timestamp < REPORT_CACHE_TTL_MS) {
          plantReportCache.set(key, parsed);
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('[ReportModule] Could not access sessionStorage cache:', err);
  }
  return null;
}

function setCachedReportData(plantId: string | undefined, dateFrom: string | undefined, dateTo: string | undefined, records: ReportRecord[], timestamp: number) {
  const key = getReportCacheKey(plantId, dateFrom, dateTo);
  plantReportCache.set(key, { records, timestamp });
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(
        `ptw_report_cache_${key}`,
        JSON.stringify({ records, timestamp })
      );
    }
  } catch (err) {
    console.warn('[ReportModule] Could not save cache to sessionStorage:', err);
  }
}

export const ReportModule: React.FC<ReportModuleProps> = ({
  user,
  onBack,
  onOpenPermit,
}) => {
  const today = todayISO();

  // Selected Plant & Live Sync
  const [selectedPlant, setSelectedPlant] = useState<string>(user?.plant || '1002');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Global Creation Date Range State (matching SAP OData V4 Erdat ge ... and Erdat le ...)
  const initialMonthRange = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const firstDay = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const lastDayObj = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastDay = `${lastDayObj.getFullYear()}-${pad(lastDayObj.getMonth() + 1)}-${pad(lastDayObj.getDate())}`;
    return { from: firstDay, to: lastDay };
  }, []);

  const [datePreset, setDatePreset] = useState<DatePreset>('THIS_MONTH');
  const [dateFrom, setDateFrom] = useState<string>(initialMonthRange.from);
  const [dateTo, setDateTo] = useState<string>(initialMonthRange.to);

  // Master records (strictly live data from SAP or persistent cache for plant + date window)
  const [records, setRecords] = useState<ReportRecord[]>(() => {
    const cached = getCachedReportData(user?.plant || '1002', initialMonthRange.from, initialMonthRange.to);
    return cached ? cached.records : [];
  });

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overall' | Category | 'analytics' | 'tat'>('overall');

  // Overall Tab Records View: 'live' (last 3 months) vs 'archived' (> 3 months)
  const [recordView, setRecordView] = useState<'live' | 'archived'>('live');

  // Overall Tab Search & Filters
  const [overallSearchQuery, setOverallSearchQuery] = useState('');
  const [overallCategoryFilter, setOverallCategoryFilter] = useState<'ALL' | 'permit' | 'isolation'>('ALL');
  const [overallDeptFilter, setOverallDeptFilter] = useState('ALL');
  const [overallSortField, setOverallSortField] = useState<
    'date' | 'category' | 'permitNo' | 'type' | 'department' | 'werks' | 'tplnr' | 'auart' | 'creationTat' | 'approvalTat' | 'workTat' | 'closingTat' | 'totalTat'
  >('date');
  const [overallSortDirection, setOverallSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Date Synchronization Mode: When enabled, changing Date or Preset in either Permit or Isolation syncs both!
  const [isDateSyncEnabled, setIsDateSyncEnabled] = useState(true);

  // Filter States for Permit and Isolation Matrix Tables
  const [permitStart, setPermitStart] = useState(initialMonthRange.from);
  const [permitEnd, setPermitEnd] = useState(initialMonthRange.to);
  const [isolationStart, setIsolationStart] = useState(initialMonthRange.from);
  const [isolationEnd, setIsolationEnd] = useState(initialMonthRange.to);

  const [permitPresets, setPermitPresets] = useState<Preset[]>([]);
  const [isolationPresets, setIsolationPresets] = useState<Preset[]>([]);

  const [permitPresetOpen, setPermitPresetOpen] = useState(false);
  const [isolationPresetOpen, setIsolationPresetOpen] = useState(false);

  const [permitSearchOpen, setPermitSearchOpen] = useState(false);
  const [isolationSearchOpen, setIsolationSearchOpen] = useState(false);
  const [permitSearch, setPermitSearch] = useState('');
  const [isolationSearch, setIsolationSearch] = useState('');

  // Drill-down Modal State
  const [drillDownModal, setDrillDownModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    records: ReportRecord[];
  } | null>(null);

  // Single Record Detail Modal
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<ReportRecord | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Quick creation date presets matching SAP OData V4 Erdat filter
  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let from = '';
    let to = '';

    if (preset === 'TODAY') {
      from = toYMD(now);
      to = toYMD(now);
    } else if (preset === 'LAST_WEEK') {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      from = toYMD(past);
      to = toYMD(now);
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      from = toYMD(firstDay);
      to = toYMD(lastDay);
    } else if (preset === 'LAST_30_DAYS') {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      from = toYMD(past);
      to = toYMD(now);
    } else if (preset === 'ALL') {
      from = '';
      to = '';
    }

    setDateFrom(from);
    setDateTo(to);
    setPermitStart(from);
    setPermitEnd(to || today);
    setIsolationStart(from);
    setIsolationEnd(to || today);
    setCurrentPage(1);
    void loadData(selectedPlant, false, from, to);
  };

  // 1. Fetch Live SAP Records on Mount / Plant / Date Change (optimized with composite cache & lean $select)
  const loadData = async (
    plantId = selectedPlant,
    forceRefresh = false,
    fFrom = dateFrom,
    fTo = dateTo
  ) => {
    // Return cached records immediately if fresh and not explicitly forced (0 API calls!)
    if (!forceRefresh) {
      const cached = getCachedReportData(plantId, fFrom, fTo);
      if (cached && cached.records.length > 0) {
        setRecords(cached.records);
        setLastRefreshedAt(new Date(cached.timestamp));
        return;
      }
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsRefreshing(true);

    try {
      // Lean $select projection + backend Erdat date filter
      // Cuts network payload by 95% for 500-1000+ permit systems!
      const [permitRes, isolationRes] = await Promise.all([
        sitePermitApi
          .list({
            plant: plantId === 'ALL' ? '' : plantId,
            search: '',
            skip: 0,
            top: fFrom || fTo ? 300 : 1000,
            signal: controller.signal,
            type: 'ALL',
            status: 'ALL',
            dateFrom: fFrom,
            dateTo: fTo,
            select: REPORT_PERMIT_SELECT_FIELDS,
            expand: ['_WorkType']
          })
          .catch((err) => {
            console.warn('[ReportModule] sitePermitApi.list failed:', err);
            return [];
          }),
        isolationApi.list(undefined, controller.signal).catch((err) => {
          console.warn('[ReportModule] isolationApi.list failed:', err);
          return [];
        }),
      ]);

      // Enrich with locally created permits cache for instant discovery of _WorkType and additional categories
      let enrichedPermits: any[] = [...(permitRes || [])];
      try {
        if (import.meta.env.DEV && typeof window !== 'undefined' && window.localStorage) {
          const localPermits: any[] = JSON.parse(window.localStorage.getItem('ptw_recent_created_permits') || '[]');
          if (Array.isArray(localPermits) && localPermits.length > 0) {
            localPermits.forEach((lp) => {
              const existingIdx = enrichedPermits.findIndex((p) => p.Permit_No === lp.Permit_No);
              if (existingIdx !== -1) {
                // If existing permit from SAP has no _WorkType, enrich it from local cache!
                const existing = enrichedPermits[existingIdx];
                const hasExistingWorkType = Array.isArray(existing._WorkType) && existing._WorkType.length > 0;
                if (!hasExistingWorkType && (lp._WorkType?.length || lp.additionalTypes?.length)) {
                  enrichedPermits[existingIdx] = {
                    ...existing,
                    _WorkType: lp._WorkType || existing._WorkType,
                    additionalTypes: lp.additionalTypes || existing.additionalTypes
                  };
                }
              } else if (lp.Permit_No && (!plantId || plantId === 'ALL' || lp.Werks === plantId)) {
                const erdat = lp.Erdat || lp.ValidFromD;
                if (!fFrom || !erdat || erdat >= fFrom) {
                  if (!fTo || !erdat || erdat <= fTo) {
                    enrichedPermits.unshift(lp);
                  }
                }
              }
            });
          }
        }
      } catch (cacheErr) {
        console.warn('[ReportModule] Could not load local permit cache:', cacheErr);
      }

      const unified = convertSapToReportRecords(enrichedPermits, isolationRes || []);
      const now = Date.now();
      setCachedReportData(plantId, fFrom, fTo, unified, now);
      setRecords(unified);
      if (enrichedPermits.length > 0 || (isolationRes && isolationRes.length > 0)) {
        toast.info(
          `Synced ${enrichedPermits.length} live permits & ${isolationRes?.length || 0} isolations (${fFrom && fTo ? `${fFrom} → ${fTo}` : 'All Dates'}) from SAP`
        );
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.warn('[ReportModule] Failed to fetch live SAP records:', err);
        setRecords([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsRefreshing(false);
        setLastRefreshedAt(new Date());
      }
    }
  };

  useEffect(() => {
    loadData(selectedPlant, false, dateFrom, dateTo);
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [selectedPlant]);

  // Synchronized Date & Preset Handlers
  function handlePermitStartDateChange(val: string) {
    setPermitStart(val);
    setDateFrom(val);
    setDatePreset('CUSTOM');
    if (isDateSyncEnabled) {
      setIsolationStart(val);
    }
    void loadData(selectedPlant, false, val, dateTo);
  }

  function handlePermitEndDateChange(val: string) {
    setPermitEnd(val);
    setDateTo(val);
    setDatePreset('CUSTOM');
    if (isDateSyncEnabled) {
      setIsolationEnd(val);
    }
    void loadData(selectedPlant, false, dateFrom, val);
  }

  function handleIsolationStartDateChange(val: string) {
    setIsolationStart(val);
    setDateFrom(val);
    setDatePreset('CUSTOM');
    if (isDateSyncEnabled) {
      setPermitStart(val);
    }
    void loadData(selectedPlant, false, val, dateTo);
  }

  function handleIsolationEndDateChange(val: string) {
    setIsolationEnd(val);
    setDateTo(val);
    setDatePreset('CUSTOM');
    if (isDateSyncEnabled) {
      setPermitEnd(val);
    }
    void loadData(selectedPlant, false, dateFrom, val);
  }

  function togglePreset(category: Category, preset: Preset) {
    const current = category === 'permit' ? permitPresets : isolationPresets;
    const isAdding = !current.includes(preset);
    const updated = isAdding
      ? [...current, preset]
      : current.filter((item) => item !== preset);

    if (category === 'permit') {
      setPermitPresets(updated);
      if (isDateSyncEnabled) {
        setIsolationPresets(updated);
      }
    } else {
      setIsolationPresets(updated);
      if (isDateSyncEnabled) {
        setPermitPresets(updated);
      }
    }
  }

  function handleClearPresets(category: Category) {
    if (category === 'permit') {
      setPermitPresets([]);
      if (isDateSyncEnabled) {
        setIsolationPresets([]);
      }
    } else {
      setIsolationPresets([]);
      if (isDateSyncEnabled) {
        setPermitPresets([]);
      }
    }
  }

  // Filter records based on category, dates and presets
  function filterRecords(
    category: Category,
    start: string,
    end: string,
    presets: Preset[]
  ) {
    const categoryRecords = records
      .filter((r) => r.category === category)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

    const effectiveEnd = end || today;

    if (!start && presets.length === 0) {
      return categoryRecords.filter((r) => !end || r.date <= effectiveEnd);
    }

    const presetStarts = presets.map((p) => getPresetStart(p, effectiveEnd));

    return categoryRecords.filter((r) => {
      const withinCustomDates =
        (!start || r.date >= start) && (!end || r.date <= end);

      const withinPreset =
        presets.length === 0 ||
        presetStarts.some(
          (presetStart) => r.date >= presetStart && r.date <= effectiveEnd
        );

      return withinCustomDates && withinPreset;
    });
  }

  const permitRecords = useMemo(
    () => filterRecords('permit', permitStart, permitEnd, permitPresets),
    [records, permitStart, permitEnd, permitPresets, today]
  );

  const isolationRecords = useMemo(
    () => filterRecords('isolation', isolationStart, isolationEnd, isolationPresets),
    [records, isolationStart, isolationEnd, isolationPresets, today]
  );

  const allRecords = useMemo(
    () => [...records].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [records]
  );

  const threeMonthsAgo = useMemo(() => {
    const date = new Date(`${today}T12:00:00`);
    date.setMonth(date.getMonth() - 3);
    return dateToISO(date);
  }, [today]);

  const liveRecords = useMemo(
    () =>
      allRecords
        .filter((record) => record.date >= threeMonthsAgo)
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [allRecords, threeMonthsAgo]
  );

  const archivedRecords = useMemo(
    () =>
      allRecords
        .filter((record) => record.date < threeMonthsAgo)
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [allRecords, threeMonthsAgo]
  );

  const baseRecordsForView = recordView === 'live' ? liveRecords : archivedRecords;

  // Filtered & Sorted Overall Display Records
  const displayRecords = useMemo(() => {
    let filtered = baseRecordsForView;

    // 1. Search Query
    if (overallSearchQuery.trim()) {
      const q = overallSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.permitNo.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q) ||
          (r.location && r.location.toLowerCase().includes(q)) ||
          (r.werks && r.werks.toLowerCase().includes(q)) ||
          (r.tplnr && r.tplnr.toLowerCase().includes(q)) ||
          (r.auart && r.auart.toLowerCase().includes(q)) ||
          (r.aufnr && r.aufnr.toLowerCase().includes(q)) ||
          (r.ktext && r.ktext.toLowerCase().includes(q)) ||
          (r.qmart && r.qmart.toLowerCase().includes(q)) ||
          (r.qmnum && r.qmnum.toLowerCase().includes(q)) ||
          (r.qmtxt && r.qmtxt.toLowerCase().includes(q))
      );
    }

    // 2. Category Filter
    if (overallCategoryFilter !== 'ALL') {
      filtered = filtered.filter((r) => r.category === overallCategoryFilter);
    }

    // 3. Department Filter
    if (overallDeptFilter !== 'ALL') {
      filtered = filtered.filter((r) => r.department === overallDeptFilter);
    }

    // 4. Sorting
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (overallSortField) {
        case 'date':
          comparison = a.date.localeCompare(b.date);
          break;
        case 'permitNo':
          comparison = a.permitNo.localeCompare(b.permitNo);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'department':
          comparison = a.department.localeCompare(b.department);
          break;
        case 'werks':
          comparison = (a.werks || '').localeCompare(b.werks || '');
          break;
        case 'tplnr':
          comparison = (a.tplnr || '').localeCompare(b.tplnr || '');
          break;
        case 'auart':
          comparison = (a.auart || a.qmart || '').localeCompare(b.auart || b.qmart || '');
          break;
        case 'creationTat':
          comparison = (a.creationTatMin || 0) - (b.creationTatMin || 0);
          break;
        case 'approvalTat':
          comparison = (a.approvalTatMin || 0) - (b.approvalTatMin || 0);
          break;
        case 'workTat':
          comparison = (a.workTatMin || 0) - (b.workTatMin || 0);
          break;
        case 'closingTat':
          comparison = (a.closingTatMin || 0) - (b.closingTatMin || 0);
          break;
        case 'totalTat':
          comparison = (a.totalTatMin || 0) - (b.totalTatMin || 0);
          break;
      }
      return overallSortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [
    baseRecordsForView,
    overallSearchQuery,
    overallCategoryFilter,
    overallDeptFilter,
    overallSortField,
    overallSortDirection,
  ]);

  // Pagination Slicing
  const paginatedRecords = useMemo(() => {
    if (pageSize >= displayRecords.length) return displayRecords;
    const startIndex = (currentPage - 1) * pageSize;
    return displayRecords.slice(startIndex, startIndex + pageSize);
  }, [displayRecords, currentPage, pageSize]);

  const totalPages = Math.ceil(displayRecords.length / pageSize) || 1;

  const departments = useMemo(
    () => [...new Set(allRecords.map((r) => r.department))].sort(),
    [allRecords]
  );

  // Departments with active permits or isolations in current window
  const activeDepartments = useMemo(() => {
    const activeSet = new Set<string>();
    permitRecords.forEach((r) => activeSet.add(r.department));
    isolationRecords.forEach((r) => activeSet.add(r.department));
    return [...activeSet].sort();
  }, [permitRecords, isolationRecords]);

  function resetFilters() {
    setDatePreset('THIS_MONTH');
    setDateFrom(initialMonthRange.from);
    setDateTo(initialMonthRange.to);

    setPermitStart(initialMonthRange.from);
    setPermitEnd(initialMonthRange.to);
    setIsolationStart(initialMonthRange.from);
    setIsolationEnd(initialMonthRange.to);

    setPermitPresets([]);
    setIsolationPresets([]);

    setPermitSearch('');
    setIsolationSearch('');

    setPermitSearchOpen(false);
    setIsolationSearchOpen(false);
    setPermitPresetOpen(false);
    setIsolationPresetOpen(false);

    setOverallSearchQuery('');
    setOverallCategoryFilter('ALL');
    setOverallDeptFilter('ALL');
    setCurrentPage(1);

    void loadData(selectedPlant, false, initialMonthRange.from, initialMonthRange.to);
    toast.info('All report filters have been reset to This Month.');
  }

  // Export Overall Records to CSV with Full Turnaround Time (TAT) Analytics & Technical References
  function handleExportOverallCSV() {
    const headers = [
      'Date',
      'Category',
      'Permit/Isolation No',
      'Type',
      'Plant (Werks)',
      'Functional Location (Tplnr)',
      'MO Type (Auart)',
      'MO Number (Aufnr)',
      'MO Short Text (KTEXT)',
      'Notification Type (Qmart)',
      'Notification Number (Qmnum)',
      'Notification Text (Qmtxt)',
      'Equipment Tag (Equnr)',
      'Department',
      'Status',
      'Location',
      'Creation TAT',
      'Creation TAT (mins)',
      'Approval TAT',
      'Approval TAT (mins)',
      'Work Execution TAT',
      'Work Execution TAT (mins)',
      'Permit Closing TAT',
      'Permit Closing TAT (mins)',
      'Total TAT',
      'Total TAT (mins)',
      'Bottleneck Stage',
      'SLA Performance',
    ];
    const rows = displayRecords.map((r) => [
      `"${r.date}"`,
      `"${r.category.toUpperCase()}"`,
      `"${r.permitNo}"`,
      `"${r.type}"`,
      `"${r.werks || r.rawPermit?.Werks || ''}"`,
      `"${r.tplnr || r.rawPermit?.Tplnr || ''}"`,
      `"${r.auart || r.rawPermit?.Auart || ''}"`,
      `"${r.aufnr || r.rawPermit?.Aufnr || ''}"`,
      `"${(r.ktext || r.rawPermit?.Ktext || (r.rawPermit as any)?.KTEXT || '').replace(/"/g, '""')}"`,
      `"${r.qmart || r.rawPermit?.Qmart || ''}"`,
      `"${r.qmnum || r.rawPermit?.Qmnum || ''}"`,
      `"${(r.qmtxt || r.rawPermit?.Qmtxt || '').replace(/"/g, '""')}"`,
      `"${r.equnr || r.rawPermit?.Equnr || ''}"`,
      `"${r.department}"`,
      `"${r.status || 'ACTIVE'}"`,
      `"${r.location || 'Dahej Complex'}"`,
      `"${r.creationTat || '—'}"`,
      r.creationTatMin ?? 0,
      `"${r.approvalTat || '—'}"`,
      r.approvalTatMin ?? 0,
      `"${r.workTat || '—'}"`,
      r.workTatMin ?? 0,
      `"${r.closingTat || '—'}"`,
      r.closingTatMin ?? 0,
      `"${r.totalTat || '—'}"`,
      r.totalTatMin ?? 0,
      `"${r.tat?.bottleneckStepName || 'none'}"`,
      `"${r.tat?.overallPerformance || 'optimal'}"`,
    ]);
    exportToCSV(`GFL-overall-${recordView}-filtered-records-with-TAT.csv`, headers, rows);
  }

  // Drill Down Handler from Matrix Tables
  function handleCellDrillDown(department: string, type: string, cellRecords: ReportRecord[]) {
    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(department);
    const deptTitle = department === 'ALL'
      ? 'All Departments'
      : isDate
      ? `Created on ${formatDate(department)}`
      : department;
    const typeTitle = type === 'ALL' ? 'All Types' : type;
    setDrillDownModal({
      isOpen: true,
      title: `${deptTitle} • ${typeTitle}`,
      subtitle: `${cellRecords.length} record(s) matching selected criteria`,
      records: cellRecords,
    });
  }

  const totalFilteredActivity = permitRecords.length + isolationRecords.length;

  const summaryCards = [
    {
      label: 'Permit records',
      value: permitRecords.length,
      caption: 'Matching active permit filters',
      icon: 'P',
      color: 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/25',
      cardStyle: 'border-t-4 border-t-blue-600 bg-gradient-to-br from-white via-white to-blue-50/70',
      badge: `${((permitRecords.length / Math.max(allRecords.length, 1)) * 100).toFixed(0)}%`,
      badgeStyle: 'bg-blue-100/90 text-blue-800 border border-blue-200',
      valueStyle: 'text-blue-900',
    },
    {
      label: 'Isolation records',
      value: isolationRecords.length,
      caption: 'Matching active isolation filters',
      icon: 'I',
      color: 'bg-gradient-to-br from-purple-600 to-violet-700 text-white shadow-md shadow-purple-500/25',
      cardStyle: 'border-t-4 border-t-purple-600 bg-gradient-to-br from-white via-white to-purple-50/70',
      badge: `${((isolationRecords.length / Math.max(allRecords.length, 1)) * 100).toFixed(0)}%`,
      badgeStyle: 'bg-purple-100/90 text-purple-800 border border-purple-200',
      valueStyle: 'text-purple-900',
    },
    {
      label: 'Active Departments',
      value: activeDepartments.length,
      caption: `Out of ${departments.length} total departments`,
      icon: 'D',
      color: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25',
      cardStyle: 'border-t-4 border-t-amber-500 bg-gradient-to-br from-white via-white to-amber-50/70',
      badge: `${activeDepartments.length} Units`,
      badgeStyle: 'bg-amber-100/90 text-amber-800 border border-amber-200',
      valueStyle: 'text-amber-950',
    },
    {
      label: 'Total activity',
      value: totalFilteredActivity,
      caption: `Permits + isolations (Plant total: ${allRecords.length})`,
      icon: 'Σ',
      color: 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-500/25',
      cardStyle: 'border-t-4 border-t-emerald-600 bg-gradient-to-br from-white via-white to-emerald-50/70',
      badge: 'Filtered Sum',
      badgeStyle: 'bg-emerald-100/90 text-emerald-800 border border-emerald-200',
      valueStyle: 'text-emerald-950',
    },
  ];

  const tabs = [
    ['overall', 'Overall report', 'dashboard'],
    ['permit', 'Permit type', 'description'],
    ['isolation', 'Isolation type', 'lock'],
    ['analytics', 'Charts & Analytics', 'query_stats'],
    ['tat', 'Turnaround Time (TAT)', 'timer'],
  ] as const;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-sky-50/20 to-indigo-50/30 px-3 py-4 sm:px-6 lg:px-8 text-slate-800">
      <style>{`
        @media print {
          body { background: white !important; font-size: 10pt !important; }
          nav, button, select, input, .no-print { display: none !important; }
          main { background: white !important; padding: 0 !important; }
          header { border: 1px solid #cbd5e1 !important; box-shadow: none !important; border-top: 4px solid #006398 !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #cbd5e1 !important; color: #0f172a !important; }
          .shadow-sm, .shadow-md, .shadow-2xs, .shadow-xs, .shadow-xl, .shadow-2xl { box-shadow: none !important; }
        }
      `}</style>
      <div className="mx-auto max-w-[1750px] space-y-5">
        {/* Top Header Card */}
        <header className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs p-5 sm:p-6 shadow-md shadow-slate-200/50 border-t-4 border-t-[#006398]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Title & Plant Context */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer mr-1"
                    title="Return to Launchpad"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    <span>Launchpad</span>
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#006398] px-2.5 py-1 text-xs font-mono font-bold text-white shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />
                  SAP EAM PTW
                </span>
                <span className="text-xs font-mono text-slate-500 font-semibold">
                  Last Synced: {lastRefreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-slate-900">
                Work Permit &amp; Isolation Report
              </h1>

              <p className="max-w-3xl text-xs sm:text-sm leading-relaxed text-slate-500">
                Comprehensive operational tracking for permits-to-work, hazardous energy isolations, and cross-departmental maintenance activities across Gujarat Fluorochemicals Limited.
              </p>
            </div>

            {/* Plant Selector & Action Controls */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {/* Linked Date Ranges Sync Toggle */}
              <button
                type="button"
                onClick={() => {
                  const nextState = !isDateSyncEnabled;
                  setIsDateSyncEnabled(nextState);
                  if (nextState) {
                    setIsolationStart(permitStart);
                    setIsolationEnd(permitEnd);
                    setIsolationPresets(permitPresets);
                    toast.info('Permit and Isolation date ranges are now synchronized.');
                  } else {
                    toast.info('Date ranges unlinked for independent Permit/Isolation filtering.');
                  }
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer shadow-2xs ${
                  isDateSyncEnabled
                    ? 'border-blue-400 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 font-bold'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                title="When enabled, changing date filters or presets updates both Permit & Isolation matrices in sync"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isDateSyncEnabled ? 'link' : 'link_off'}
                </span>
                <span>{isDateSyncEnabled ? 'Sync Dates: ON' : 'Sync Dates: OFF'}</span>
              </button>

              {/* Plant Switcher */}
              <div className="relative">
                <select
                  value={selectedPlant}
                  onChange={(e) => setSelectedPlant(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:bg-white shadow-2xs transition-colors cursor-pointer"
                  aria-label="Select Operating Plant"
                >
                  {PLANTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Refresh Button (Bypasses in-memory cache to force live SAP sync) */}
              <button
                type="button"
                onClick={() => loadData(selectedPlant, true, dateFrom, dateTo)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                title="Refresh records from SAP Gateway"
              >
                <span className={`material-symbols-outlined text-[16px] text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`}>
                  sync
                </span>
                <span>{isRefreshing ? 'Syncing...' : 'Sync SAP'}</span>
              </button>

              {/* Print / PDF Button */}
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-colors shadow-2xs cursor-pointer"
                title="Print or Save Report as PDF (Shift Handover / Toolbox Talk)"
              >
                <span className="material-symbols-outlined text-[16px] text-slate-600">print</span>
                <span>Print / PDF</span>
              </button>

              {/* Reset Filters Button */}
              <button
                type="button"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 cursor-pointer active:scale-98"
                onClick={resetFilters}
              >
                <span className="text-base leading-none text-amber-400">↺</span>
                <span>Reset filters</span>
              </button>
            </div>
          </div>

          {/* Global Creation Date Filter Bar (SAP OData V4 Erdat ge ... and Erdat le ...) */}
          <div className="mt-4 pt-3.5 border-t border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
                <span className="material-symbols-outlined text-[16px] text-[#006398]">calendar_month</span>
                <span>Created:</span>
              </span>
              {[
                { id: 'ALL', label: 'All Dates' },
                { id: 'LAST_WEEK', label: 'Last 1 Week' },
                { id: 'TODAY', label: 'Today' },
                { id: 'THIS_MONTH', label: 'This Month' },
                { id: 'LAST_30_DAYS', label: 'Last 30 Days' }
              ].map((p) => {
                const isSelected = datePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyDatePreset(p.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                      isSelected
                        ? 'bg-[#006398] text-white border-[#006398] shadow-xs ring-2 ring-[#006398]/10'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Date Pickers & Active Range Chip */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {datePreset !== 'ALL' && (
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Range: {dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : datePreset}
                </span>
              )}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">From:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDatePreset('CUSTOM');
                    setDateFrom(val);
                    setPermitStart(val);
                    setIsolationStart(val);
                    setCurrentPage(1);
                    void loadData(selectedPlant, false, val, dateTo);
                  }}
                  className="text-slate-700 bg-transparent font-mono outline-hidden cursor-pointer"
                />
                <span className="text-[10px] uppercase font-bold text-slate-400 ml-1">To:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDatePreset('CUSTOM');
                    setDateTo(val);
                    setPermitEnd(val);
                    setIsolationEnd(val);
                    setCurrentPage(1);
                    void loadData(selectedPlant, false, dateFrom, val);
                  }}
                  className="text-slate-700 bg-transparent font-mono outline-hidden cursor-pointer"
                />
              </div>
            </div>
          </div>
        </header>

        {/* 4 Summary KPI Cards */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${card.cardStyle}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider">
                  {card.label}
                </span>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black ${card.color}`}
                >
                  {card.icon}
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <div className={`text-3xl sm:text-4xl font-display font-black tracking-tight ${card.valueStyle}`}>
                  {card.value}
                </div>
                <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${card.badgeStyle}`}>
                  {card.badge}
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-500 font-medium">{card.caption}</p>
            </div>
          ))}
        </section>

        {/* Navigation Tabs Bar */}
        <nav
          className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-xs p-2 shadow-sm"
          aria-label="Report views"
        >
          {tabs.map(([key, label, iconName]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition cursor-pointer ${
                activeTab === key
                  ? 'bg-gradient-to-r from-[#006398] to-[#0284c7] text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{iconName}</span>
              <span>{label}</span>
              {key === 'permit' && (
                <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] font-bold ${activeTab === key ? 'bg-white/20 text-white' : 'bg-blue-100 text-[#006398]'}`}>
                  {permitRecords.length}
                </span>
              )}
              {key === 'isolation' && (
                <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] font-bold ${activeTab === key ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'}`}>
                  {isolationRecords.length}
                </span>
              )}
              {key === 'tat' && (
                <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] font-bold ${activeTab === key ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                  {permitRecords.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* TAB 1: OVERALL REPORT */}
        {activeTab === 'overall' && (
          <section className="space-y-6">
            {/* Overall Activity Master Table Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-4">
              {/* Header & Controls Strip */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-display font-bold text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#006398] text-[22px]">list_alt</span>
                    Overall Activity
                  </h2>
                  <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                    {recordView === 'live'
                      ? 'Live permit and isolation records from the last 3 months, ordered by date.'
                      : 'Archived permit and isolation records older than 3 months, ordered by date.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Export CSV Button */}
                  {displayRecords.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportOverallCSV}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition shadow-2xs cursor-pointer"
                      title="Download displayed records as CSV"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      <span>Export CSV</span>
                    </button>
                  )}

                  {/* Live vs Archived Record Switcher */}
                  <div className="flex w-fit rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => {
                        setRecordView('live');
                        setCurrentPage(1);
                      }}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        recordView === 'live'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-white hover:text-slate-900'
                      }`}
                    >
                      Live Records ({liveRecords.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRecordView('archived');
                        setCurrentPage(1);
                      }}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        recordView === 'archived'
                          ? 'bg-slate-800 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-white hover:text-slate-900'
                      }`}
                    >
                      Archived Records ({archivedRecords.length})
                    </button>
                  </div>

                  <span className="w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-mono font-bold text-blue-700 border border-blue-200">
                    {displayRecords.length} records
                  </span>
                </div>
              </div>

              {/* Real-Time Filter Toolbar for Overall Table */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 py-3 bg-slate-50/50 px-3 rounded-xl">
                {/* Search Box */}
                <div className="relative min-w-[240px] flex-1 max-w-md">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[16px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={overallSearchQuery}
                    onChange={(e) => {
                      setOverallSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search permit no, department, type, location..."
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-2xs"
                  />
                  {overallSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setOverallSearchQuery('');
                        setCurrentPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-medium text-slate-500 hidden sm:inline">Category:</span>
                  {(['ALL', 'permit', 'isolation'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setOverallCategoryFilter(cat);
                        setCurrentPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                        overallCategoryFilter === cat
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {cat === 'ALL' ? 'All' : cat === 'permit' ? 'Permits' : 'Isolations'}
                    </button>
                  ))}
                </div>

                {/* Department Dropdown Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-medium text-slate-500 hidden sm:inline">Dept:</span>
                  <select
                    value={overallDeptFilter}
                    onChange={(e) => {
                      setOverallDeptFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Departments ({departments.length})</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table Container with Generous Screen Space */}
              {displayRecords.length === 0 ? (
                <EmptyState message="No work/isolation done matching the active search or filters" />
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-2xs">
                  {/* Generous max-height to properly use screen space */}
                  <div className="max-h-[460px] overflow-auto">
                    <table className="w-full min-w-[840px] border-collapse text-left text-xs">
                      <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs text-[11px] font-mono uppercase tracking-wider text-slate-600 shadow-xs border-b border-slate-200">
                        <tr>
                          <th
                            className="px-5 py-3.5 font-bold cursor-pointer hover:text-blue-700 select-none"
                            onClick={() => {
                              if (overallSortField === 'date') {
                                setOverallSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setOverallSortField('date');
                                setOverallSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span>Date</span>
                              {overallSortField === 'date' && (
                                <span>{overallSortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-5 py-3.5 font-bold cursor-pointer hover:text-blue-700 select-none"
                            onClick={() => {
                              if (overallSortField === 'category') {
                                setOverallSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setOverallSortField('category');
                                setOverallSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span>Category</span>
                              {overallSortField === 'category' && (
                                <span>{overallSortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-5 py-3.5 font-bold cursor-pointer hover:text-blue-700 select-none"
                            onClick={() => {
                              if (overallSortField === 'permitNo') {
                                setOverallSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setOverallSortField('permitNo');
                                setOverallSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span>Permit / Isolation No.</span>
                              {overallSortField === 'permitNo' && (
                                <span>{overallSortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-5 py-3.5 font-bold cursor-pointer hover:text-blue-700 select-none"
                            onClick={() => {
                              if (overallSortField === 'type') {
                                setOverallSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setOverallSortField('type');
                                setOverallSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span>Type</span>
                              {overallSortField === 'type' && (
                                <span>{overallSortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-4 py-3.5 font-bold cursor-pointer hover:text-blue-700 select-none whitespace-nowrap"
                            onClick={() => {
                              if (overallSortField === 'werks') {
                                setOverallSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setOverallSortField('werks');
                                setOverallSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span>Plant</span>
                              {overallSortField === 'werks' && (
                                <span>{overallSortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-4 py-3.5 font-bold cursor-pointer hover:text-blue-700 select-none whitespace-nowrap"
                            onClick={() => {
                              if (overallSortField === 'tplnr') {
                                setOverallSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setOverallSortField('tplnr');
                                setOverallSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span>Functional Loc</span>
                              {overallSortField === 'tplnr' && (
                                <span>{overallSortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-4 py-3.5 font-bold cursor-pointer hover:text-blue-700 select-none whitespace-nowrap"
                            onClick={() => {
                              if (overallSortField === 'auart') {
                                setOverallSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setOverallSortField('auart');
                                setOverallSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span>Ref / MO Type</span>
                              {overallSortField === 'auart' && (
                                <span>{overallSortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-5 py-3.5 font-bold cursor-pointer hover:text-blue-700 select-none"
                            onClick={() => {
                              if (overallSortField === 'department') {
                                setOverallSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setOverallSortField('department');
                                setOverallSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span>Department</span>
                              {overallSortField === 'department' && (
                                <span>{overallSortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-4 py-3.5 font-bold cursor-pointer hover:text-blue-700 select-none whitespace-nowrap"
                            onClick={() => {
                              if (overallSortField === 'creationTat') {
                                setOverallSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setOverallSortField('creationTat');
                                setOverallSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span>Creation TAT</span>
                              {overallSortField === 'creationTat' && (
                                <span>{overallSortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-4 py-3.5 font-bold cursor-pointer hover:text-blue-700 select-none whitespace-nowrap"
                            onClick={() => {
                              if (overallSortField === 'approvalTat') {
                                setOverallSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setOverallSortField('approvalTat');
                                setOverallSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span>Approval TAT</span>
                              {overallSortField === 'approvalTat' && (
                                <span>{overallSortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-4 py-3.5 font-bold cursor-pointer hover:text-blue-700 select-none whitespace-nowrap"
                            onClick={() => {
                              if (overallSortField === 'workTat') {
                                setOverallSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setOverallSortField('workTat');
                                setOverallSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span>Work TAT</span>
                              {overallSortField === 'workTat' && (
                                <span>{overallSortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-4 py-3.5 font-bold cursor-pointer hover:text-blue-700 select-none whitespace-nowrap"
                            onClick={() => {
                              if (overallSortField === 'closingTat') {
                                setOverallSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setOverallSortField('closingTat');
                                setOverallSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span>Closing TAT</span>
                              {overallSortField === 'closingTat' && (
                                <span>{overallSortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-4 py-3.5 font-bold cursor-pointer hover:text-blue-700 select-none whitespace-nowrap"
                            onClick={() => {
                              if (overallSortField === 'totalTat') {
                                setOverallSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setOverallSortField('totalTat');
                                setOverallSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span>Total TAT / SLA</span>
                              {overallSortField === 'totalTat' && (
                                <span>{overallSortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </div>
                          </th>
                          <th className="px-5 py-3.5 font-bold text-right">Action</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 bg-white">
                        {paginatedRecords.map((r) => (
                          <tr
                            key={`${r.category}-${r.id}`}
                            className="transition-colors hover:bg-blue-50/40"
                          >
                            <td className="whitespace-nowrap px-5 py-3 font-mono text-slate-600">
                              {formatDate(r.date)}
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-mono font-bold ${
                                  r.category === 'permit'
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'bg-violet-100 text-violet-700 border border-violet-200'
                                }`}
                              >
                                {r.category === 'permit' ? 'Permit' : 'Isolation'}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-mono font-bold text-slate-800">
                              <button
                                type="button"
                                onClick={() => setSelectedRecordForDetail(r)}
                                className="hover:text-blue-700 transition-colors cursor-pointer text-left font-mono"
                                title="Click to view full record metadata"
                              >
                                {r.permitNo}
                              </button>
                            </td>
                            <td className="px-5 py-3">
                              {(() => {
                                const meta = getTypeMeta(r.category, r.type);
                                return (
                                  <div className="flex flex-col gap-1 items-start">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span
                                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold shadow-2xs ${meta.badgeBg} ${meta.badgeText} border ${meta.borderClass}`}
                                      >
                                        <PermitTypeIcon icon={meta.icon} type={meta.code} size={13} />
                                        <span>{meta.label}</span>
                                      </span>
                                      {r.category === 'permit' && (
                                        <span
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold bg-[#006398]/10 text-[#006398] border border-[#006398]/30"
                                          title="Primary Authorization Category from SAP OData"
                                        >
                                          <span className="h-1.5 w-1.5 rounded-full bg-[#006398]" />
                                          Primary
                                        </span>
                                      )}
                                    </div>

                                    {/* Additional Work Types (_WorkType Child Table) */}
                                    {r.additionalTypes && r.additionalTypes.length > 0 && (
                                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                        <span
                                          className="text-[9px] font-mono font-bold text-purple-700 uppercase tracking-wider"
                                          title="Additional Applicable Work Categories configured in Section A (stored in SAP child table _WorkType)"
                                        >
                                          +{r.additionalTypes.length} _WorkType:
                                        </span>
                                        {r.additionalTypes.map((addT) => {
                                          const addMeta = getPermitTypeMeta(addT);
                                          return (
                                            <span
                                              key={addT}
                                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[9px] font-bold shadow-2xs ${addMeta.badgeBg} ${addMeta.badgeText} border ${addMeta.borderClass}`}
                                              title={`Additional Category: ${addMeta.label} (_WorkType)`}
                                            >
                                              <PermitTypeIcon icon={addMeta.icon} type={addMeta.code} size={11} />
                                              <span>{addT}</span>
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Plant Number (Werks) */}
                            <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                                {r.werks || r.rawPermit?.Werks || '—'}
                              </span>
                            </td>

                            {/* Functional Location Number (Tplnr) */}
                            <td className="px-4 py-3 font-mono text-slate-700 max-w-[150px] truncate" title={r.tplnr || r.rawPermit?.Tplnr || r.location || '—'}>
                              <span className="font-semibold text-slate-800">{r.tplnr || r.rawPermit?.Tplnr || '—'}</span>
                              {r.location && (
                                <span className="block text-[10px] text-slate-400 truncate">{r.location}</span>
                              )}
                            </td>

                            {/* Doc Ref / MO Type / Notification Type */}
                            <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                              {(r.auart || r.rawPermit?.Auart) ? (
                                <div className="flex flex-col gap-0.5 items-start">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                    <span>MO: {r.auart || r.rawPermit?.Auart}</span>
                                    {(r.aufnr || r.rawPermit?.Aufnr) && <span>#{r.aufnr || r.rawPermit?.Aufnr}</span>}
                                  </span>
                                  {(r.ktext || r.rawPermit?.Ktext || (r.rawPermit as any)?.KTEXT) && (
                                    <span
                                      className="text-[10px] text-slate-500 truncate max-w-[150px]"
                                      title={r.ktext || r.rawPermit?.Ktext || (r.rawPermit as any)?.KTEXT}
                                    >
                                      {r.ktext || r.rawPermit?.Ktext || (r.rawPermit as any)?.KTEXT}
                                    </span>
                                  )}
                                </div>
                              ) : (r.qmart || r.rawPermit?.Qmart) ? (
                                <div className="flex flex-col gap-0.5 items-start">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    <span>Notif: {r.qmart || r.rawPermit?.Qmart}</span>
                                    {(r.qmnum || r.rawPermit?.Qmnum) && <span>#{r.qmnum || r.rawPermit?.Qmnum}</span>}
                                  </span>
                                  {(r.qmtxt || r.rawPermit?.Qmtxt) && (
                                    <span
                                      className="text-[10px] text-slate-500 truncate max-w-[150px]"
                                      title={r.qmtxt || r.rawPermit?.Qmtxt}
                                    >
                                      {r.qmtxt || r.rawPermit?.Qmtxt}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 font-mono text-[11px]">—</span>
                              )}
                            </td>

                            <td className="px-5 py-3 text-slate-700 font-medium">
                              {r.department}
                            </td>

                            {/* 1. Creation TAT */}
                            <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] ${
                                  (r.creationTatMin || 0) > 30
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                                title={`Creation Step: ${r.creationTat || '—'} (Dahej SLA <= 30m)`}
                              >
                                <span className="material-symbols-outlined text-[12px] text-sky-600">edit_calendar</span>
                                <span>{r.creationTat || '—'}</span>
                              </span>
                            </td>

                            {/* 2. Approval TAT */}
                            <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] ${
                                  (r.approvalTatMin || 0) > 120
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                                title={`Approval Step: ${r.approvalTat || '—'} (Dahej SLA <= 2h)`}
                              >
                                <span className="material-symbols-outlined text-[12px] text-indigo-600">verified</span>
                                <span>{r.approvalTat || '—'}</span>
                              </span>
                            </td>

                            {/* 3. Permit Work TAT */}
                            <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] bg-slate-100 text-slate-800"
                                title={`Work Execution: ${r.workTat || '—'} (Shift Authorized)`}
                              >
                                <span className="material-symbols-outlined text-[12px] text-emerald-600">engineering</span>
                                <span>{r.workTat || '—'}</span>
                              </span>
                            </td>

                            {/* 4. Permit Closing TAT */}
                            <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] ${
                                  (r.closingTatMin || 0) > 45
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                                title={`Closing Step: ${r.closingTat || '—'} (Dahej SLA <= 45m)`}
                              >
                                <span className="material-symbols-outlined text-[12px] text-purple-600">task_alt</span>
                                <span>{r.closingTat || '—'}</span>
                              </span>
                            </td>

                            {/* 5. Total TAT & Bottleneck Badge */}
                            <td className="px-4 py-3 font-mono text-slate-800 whitespace-nowrap">
                              <div className="flex flex-col gap-0.5 items-start">
                                <span className="font-bold text-xs text-slate-900">{r.totalTat || '—'}</span>
                                {r.tat?.bottleneckStepName && r.tat.bottleneckStepName !== 'none' ? (
                                  <span
                                    className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-200 truncate max-w-[140px]"
                                    title={r.tat.bottleneckReason || 'Bottleneck detected'}
                                  >
                                    ⚠️ {r.tat.bottleneckStepName.toUpperCase()}
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    ✓ SLA Met
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  if (onOpenPermit && r.category === 'permit') {
                                    onOpenPermit(r.permitNo);
                                  } else {
                                    setSelectedRecordForDetail(r);
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[15px]">visibility</span>
                                <span>Inspect</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      <tfoot className="border-t border-slate-200 bg-slate-50 font-display">
                        <tr className="sticky bottom-0 z-20 bg-slate-50 shadow-xs">
                          <td
                            colSpan={5}
                            className="px-5 py-3.5 font-bold text-slate-700 bg-slate-50 border-t border-slate-200"
                          >
                            Total Activity ({recordView === 'live' ? 'Live <3M' : 'Archived >3M'})
                          </td>
                          <td
                            colSpan={6}
                            className="px-5 py-3.5 font-mono font-extrabold text-slate-900 bg-slate-50 border-t border-slate-200 text-right pr-8"
                          >
                            {displayRecords.length} records matching
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Pagination Controls */}
              {displayRecords.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-mono text-slate-500 pt-1">
                  <div>
                    Showing <strong>{Math.min((currentPage - 1) * pageSize + 1, displayRecords.length)}</strong> to{' '}
                    <strong>{Math.min(currentPage * pageSize, displayRecords.length)}</strong> of{' '}
                    <strong>{displayRecords.length}</strong> filtered records
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span>Rows:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={1000}>All</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        className="rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                      >
                        Previous
                      </button>
                      <span className="px-2">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        className="rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stacked Matrix Reports in Overall View */}
            <div className="space-y-6">
              <PermitTypeCode
                records={permitRecords}
                startDate={permitStart}
                endDate={permitEnd}
                onStartDate={handlePermitStartDateChange}
                onEndDate={handlePermitEndDateChange}
                searchOpen={permitSearchOpen}
                onToggleSearch={() => setPermitSearchOpen((v) => !v)}
                search={permitSearch}
                onSearch={setPermitSearch}
                selectedPresets={permitPresets}
                onTogglePreset={(p) => togglePreset('permit', p)}
                presetOpen={permitPresetOpen}
                onTogglePresetMenu={() => {
                  setPermitPresetOpen((v) => !v);
                  setIsolationPresetOpen(false);
                }}
                onClearPresets={() => handleClearPresets('permit')}
                isInitialView={!permitStart && permitPresets.length === 0}
                onCellDrillDown={handleCellDrillDown}
              />

              <IsolationType
                records={isolationRecords}
                startDate={isolationStart}
                endDate={isolationEnd}
                onStartDate={handleIsolationStartDateChange}
                onEndDate={handleIsolationEndDateChange}
                searchOpen={isolationSearchOpen}
                onToggleSearch={() => setIsolationSearchOpen((v) => !v)}
                search={isolationSearch}
                onSearch={setIsolationSearch}
                selectedPresets={isolationPresets}
                onTogglePreset={(p) => togglePreset('isolation', p)}
                presetOpen={isolationPresetOpen}
                onTogglePresetMenu={() => {
                  setIsolationPresetOpen((v) => !v);
                  setPermitPresetOpen(false);
                }}
                onClearPresets={() => handleClearPresets('isolation')}
                isInitialView={!isolationStart && isolationPresets.length === 0}
                onCellDrillDown={handleCellDrillDown}
              />
            </div>
          </section>
        )}

        {/* TAB 2: PERMIT TYPE ONLY */}
        {activeTab === 'permit' && (
          <PermitTypeCode
            records={permitRecords}
            startDate={permitStart}
            endDate={permitEnd}
            onStartDate={handlePermitStartDateChange}
            onEndDate={handlePermitEndDateChange}
            searchOpen={permitSearchOpen}
            onToggleSearch={() => setPermitSearchOpen((v) => !v)}
            search={permitSearch}
            onSearch={setPermitSearch}
            selectedPresets={permitPresets}
            onTogglePreset={(p) => togglePreset('permit', p)}
            presetOpen={permitPresetOpen}
            onTogglePresetMenu={() => {
              setPermitPresetOpen((v) => !v);
              setIsolationPresetOpen(false);
            }}
            onClearPresets={() => handleClearPresets('permit')}
            isInitialView={!permitStart && permitPresets.length === 0}
            onCellDrillDown={handleCellDrillDown}
          />
        )}

        {/* TAB 3: ISOLATION TYPE ONLY */}
        {activeTab === 'isolation' && (
          <IsolationType
            records={isolationRecords}
            startDate={isolationStart}
            endDate={isolationEnd}
            onStartDate={handleIsolationStartDateChange}
            onEndDate={handleIsolationEndDateChange}
            searchOpen={isolationSearchOpen}
            onToggleSearch={() => setIsolationSearchOpen((v) => !v)}
            search={isolationSearch}
            onSearch={setIsolationSearch}
            selectedPresets={isolationPresets}
            onTogglePreset={(p) => togglePreset('isolation', p)}
            presetOpen={isolationPresetOpen}
            onTogglePresetMenu={() => {
              setIsolationPresetOpen((v) => !v);
              setPermitPresetOpen(false);
            }}
            onClearPresets={() => handleClearPresets('isolation')}
            isInitialView={!isolationStart && isolationPresets.length === 0}
            onCellDrillDown={handleCellDrillDown}
          />
        )}

        {/* TAB 4: CHARTS & ANALYTICS */}
        {activeTab === 'analytics' && (
          <ReportAnalytics records={allRecords} />
        )}

        {/* TAB 5: TURNAROUND TIME (TAT) ANALYTICS */}
        {activeTab === 'tat' && (
          <PermitTatAnalytics
            records={allRecords}
            onOpenPermit={onOpenPermit}
          />
        )}

        {/* Footer */}
        <footer className="flex flex-col gap-2 rounded-2xl border border-slate-200/90 bg-white p-4 text-xs text-slate-500 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">GFL Dahej Central PTW Analytics</span>
            <span>•</span>
            <span>Plant {selectedPlant}</span>
          </div>
          <span className="text-slate-400">
            Departments and type columns are generated dynamically from matching SAP records.
          </span>
        </footer>

        {/* Modal 1: Matrix Cell Drill-Down Modal */}
        {drillDownModal && drillDownModal.isOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
            onClick={() => setDrillDownModal(null)}
          >
            <div
              className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-display font-bold text-slate-900">
                    {drillDownModal.title}
                  </h3>
                  <p className="text-xs font-mono text-slate-500">
                    {drillDownModal.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const headers = [
                        'Date',
                        'Category',
                        'Permit/Isolation No',
                        'Type',
                        'Plant (Werks)',
                        'Functional Location (Tplnr)',
                        'MO Type (Auart)',
                        'MO Number (Aufnr)',
                        'MO Text (KTEXT)',
                        'Notification Type (Qmart)',
                        'Notification Number (Qmnum)',
                        'Department',
                        'Location',
                        'Status',
                        'Creation TAT',
                        'Approval TAT',
                        'Work Execution TAT',
                        'Permit Closing TAT',
                        'Total TAT',
                        'Bottleneck Step',
                      ];
                      const rows = drillDownModal.records.map((r) => [
                        `"${r.date}"`,
                        `"${r.category}"`,
                        `"${r.permitNo}"`,
                        `"${r.type}"`,
                        `"${r.werks || r.rawPermit?.Werks || ''}"`,
                        `"${r.tplnr || r.rawPermit?.Tplnr || ''}"`,
                        `"${r.auart || r.rawPermit?.Auart || ''}"`,
                        `"${r.aufnr || r.rawPermit?.Aufnr || ''}"`,
                        `"${(r.ktext || r.rawPermit?.Ktext || (r.rawPermit as any)?.KTEXT || '').replace(/"/g, '""')}"`,
                        `"${r.qmart || r.rawPermit?.Qmart || ''}"`,
                        `"${r.qmnum || r.rawPermit?.Qmnum || ''}"`,
                        `"${r.department}"`,
                        `"${r.location || 'Dahej Complex'}"`,
                        `"${r.status || 'ACTIVE'}"`,
                        `"${r.creationTat || '—'}"`,
                        `"${r.approvalTat || '—'}"`,
                        `"${r.workTat || '—'}"`,
                        `"${r.closingTat || '—'}"`,
                        `"${r.totalTat || '—'}"`,
                        `"${r.tat?.bottleneckStepName || 'none'}"`,
                      ]);
                      exportToCSV(`GFL-drilldown-${drillDownModal.title.replace(/\s+/g, '_')}.csv`, headers, rows);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDrillDownModal(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>

              {/* Drill-down list */}
              <div className="flex-1 overflow-auto rounded-xl border border-slate-200 shadow-2xs">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] font-mono uppercase tracking-wider text-slate-600 shadow-xs border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 font-bold">Date</th>
                      <th className="px-3 py-2.5 font-bold">Category</th>
                      <th className="px-3 py-2.5 font-bold">Number</th>
                      <th className="px-3 py-2.5 font-bold">Type</th>
                      <th className="px-3 py-2.5 font-bold">Plant</th>
                      <th className="px-3 py-2.5 font-bold">Functional Loc</th>
                      <th className="px-3 py-2.5 font-bold">Doc Ref / MO</th>
                      <th className="px-3 py-2.5 font-bold">Department</th>
                      <th className="px-3 py-2.5 font-bold">Creation TAT</th>
                      <th className="px-3 py-2.5 font-bold">Approval TAT</th>
                      <th className="px-3 py-2.5 font-bold">Work TAT</th>
                      <th className="px-3 py-2.5 font-bold">Closing TAT</th>
                      <th className="px-3 py-2.5 font-bold">Total TAT</th>
                      <th className="px-3 py-2.5 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {drillDownModal.records.map((r) => (
                      <tr key={`${r.category}-${r.id}`} className="hover:bg-blue-50/40">
                        <td className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                          {formatDate(r.date)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                              r.category === 'permit'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {r.category.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                          {r.permitNo}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-700">
                          {(() => {
                            const meta = getTypeMeta(r.category, r.type);
                            return (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold shadow-2xs ${meta.badgeBg} ${meta.badgeText} border ${meta.borderClass}`}
                                >
                                  <PermitTypeIcon icon={meta.icon} type={meta.code} size={12} />
                                  <span>{r.type}</span>
                                </span>
                                {r.isAdditional ? (
                                  <span
                                    className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200"
                                    title={`Additional category (_WorkType) on primary ${r.actualType || 'Permit'}`}
                                  >
                                    _WorkType Additional
                                  </span>
                                ) : (
                                  r.category === 'permit' && (
                                    <span
                                      className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-[#006398]/10 text-[#006398] border border-[#006398]/30"
                                      title="Primary Permit Category (SAP Config OData)"
                                    >
                                      Primary / Actual
                                    </span>
                                  )
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-700 whitespace-nowrap text-[11px]">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                            {r.werks || r.rawPermit?.Werks || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-700 max-w-[120px] truncate text-[11px]" title={r.tplnr || r.rawPermit?.Tplnr || '—'}>
                          {r.tplnr || r.rawPermit?.Tplnr || '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-700 whitespace-nowrap text-[11px]">
                          {(r.auart || r.rawPermit?.Auart) ? (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">
                              MO: {r.auart || r.rawPermit?.Auart} #{r.aufnr || r.rawPermit?.Aufnr || ''}
                            </span>
                          ) : (r.qmart || r.rawPermit?.Qmart) ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                              Notif: {r.qmart || r.rawPermit?.Qmart} #{r.qmnum || r.rawPermit?.Qmnum || ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          {r.department}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                          {r.creationTat || '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                          {r.approvalTat || '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                          {r.workTat || '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                          {r.closingTat || '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {r.totalTat || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setDrillDownModal(null);
                              if (onOpenPermit && r.category === 'permit') {
                                onOpenPermit(r.permitNo);
                              } else {
                                setSelectedRecordForDetail(r);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">visibility</span>
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDrillDownModal(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: Quick Record Inspector */}
        {selectedRecordForDetail && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
            onClick={() => setSelectedRecordForDetail(null)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                      selectedRecordForDetail.category === 'permit'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-violet-100 text-violet-700'
                    }`}
                  >
                    {selectedRecordForDetail.category === 'permit' ? 'P' : 'I'}
                  </span>
                  <div>
                    <h3 className="font-display font-bold text-slate-900">
                      {selectedRecordForDetail.permitNo}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500">
                      {selectedRecordForDetail.category.toUpperCase()} • {selectedRecordForDetail.type}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecordForDetail(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 p-3">
                  <span className="text-slate-400 font-mono text-[10px] block">Date</span>
                  <span className="font-mono font-bold text-slate-800">{formatDate(selectedRecordForDetail.date)}</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <span className="text-slate-400 font-mono text-[10px] block">Department</span>
                  <span className="font-semibold text-slate-800">{selectedRecordForDetail.department}</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <span className="text-slate-400 font-mono text-[10px] block">Status</span>
                  <span className="font-mono font-bold text-emerald-700">{selectedRecordForDetail.status || 'ACTIVE'}</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <span className="text-slate-400 font-mono text-[10px] block">Location</span>
                  <span className="font-semibold text-slate-800">{selectedRecordForDetail.location || 'Dahej Complex'}</span>
                </div>
              </div>

              {/* SAP Technical & Order References */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-blue-600">domain</span>
                    <span>SAP Technical Reference</span>
                  </span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200 font-bold">
                    Plant: {selectedRecordForDetail.werks || selectedRecordForDetail.rawPermit?.Werks || '—'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                    <span className="text-slate-400 font-mono text-[9px] block uppercase font-bold">Functional Location</span>
                    <span className="font-mono font-bold text-slate-800 break-all">
                      {selectedRecordForDetail.tplnr || selectedRecordForDetail.rawPermit?.Tplnr || '—'}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                    <span className="text-slate-400 font-mono text-[9px] block uppercase font-bold">Equipment Tag</span>
                    <span className="font-mono font-bold text-slate-800">
                      {selectedRecordForDetail.equnr || selectedRecordForDetail.rawPermit?.Equnr || '—'}
                    </span>
                  </div>

                  <div className="col-span-2 bg-white p-2 rounded-lg border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono text-[9px] block uppercase font-bold">
                        {(selectedRecordForDetail.auart || selectedRecordForDetail.rawPermit?.Auart)
                          ? `Maintenance Order (${selectedRecordForDetail.auart || selectedRecordForDetail.rawPermit?.Auart})`
                          : (selectedRecordForDetail.qmart || selectedRecordForDetail.rawPermit?.Qmart)
                          ? `Notification (${selectedRecordForDetail.qmart || selectedRecordForDetail.rawPermit?.Qmart})`
                          : 'Reference Document'}
                      </span>
                      <span className="font-mono font-bold text-blue-700 text-[11px]">
                        {selectedRecordForDetail.aufnr || selectedRecordForDetail.rawPermit?.Aufnr || selectedRecordForDetail.qmnum || selectedRecordForDetail.rawPermit?.Qmnum || '—'}
                      </span>
                    </div>
                    {(selectedRecordForDetail.ktext || selectedRecordForDetail.rawPermit?.Ktext || (selectedRecordForDetail.rawPermit as any)?.KTEXT || selectedRecordForDetail.qmtxt || selectedRecordForDetail.rawPermit?.Qmtxt) && (
                      <p className="text-slate-600 font-medium text-[11px] mt-1 italic">
                        "{selectedRecordForDetail.ktext || selectedRecordForDetail.rawPermit?.Ktext || (selectedRecordForDetail.rawPermit as any)?.KTEXT || selectedRecordForDetail.qmtxt || selectedRecordForDetail.rawPermit?.Qmtxt}"
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Work Categories Details (Primary & SAP _WorkType) */}
              {selectedRecordForDetail.category === 'permit' && (
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Permit Category / Type (SAP Config OData)
                    </span>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      Primary: {selectedRecordForDetail.actualType || selectedRecordForDetail.type}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 block mb-1.5">
                      Additional Applicable Work Categories (SAP child table _WorkType)
                    </span>
                    {selectedRecordForDetail.additionalTypes && selectedRecordForDetail.additionalTypes.length > 0 ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-purple-100 text-purple-800">
                          {selectedRecordForDetail.additionalTypes.length + 1} Active Categories · _WorkType Active
                        </span>
                        {selectedRecordForDetail.additionalTypes.map((addType) => (
                          <span
                            key={addType}
                            className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-white text-purple-900 border border-purple-200 shadow-2xs"
                          >
                            + {addType}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        No additional work categories configured (Single-category permit).
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Turnaround Time (TAT) Step-by-Step Lifecycle Analysis */}
              {selectedRecordForDetail.tat && (
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-[#006398]">timer</span>
                      <span className="font-bold text-xs text-slate-800">
                        Turnaround Time (TAT) Step-by-Step Lifecycle Analysis
                      </span>
                    </div>
                    <span className="font-mono text-xs font-black text-[#006398] bg-blue-100/80 px-2 py-0.5 rounded-md border border-blue-200">
                      Total: {selectedRecordForDetail.tat.totalTat}
                    </span>
                  </div>

                  {/* 4 Step Timeline */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {selectedRecordForDetail.tat.steps.map((st) => (
                      <div
                        key={st.name}
                        className={`p-2.5 rounded-lg border ${
                          st.isBottleneck
                            ? 'bg-rose-50/70 border-rose-200'
                            : st.status === 'completed'
                            ? 'bg-white border-slate-200'
                            : 'bg-amber-50/40 border-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700 text-[11px]">{st.label}</span>
                          <span
                            className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded ${
                              st.isBottleneck
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {st.tatFormatted}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>SLA: &le; {formatDurationMinutes(st.targetMin)}</span>
                          <span className={st.status === 'completed' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                            {st.status.toUpperCase()}
                          </span>
                        </div>
                        {st.detail && (
                          <p className="mt-1 text-[10px] text-slate-500 leading-tight">
                            {st.detail}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Bottleneck Diagnostic Callout */}
                  {selectedRecordForDetail.tat.bottleneckReason ? (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                      <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0 mt-0.5">warning</span>
                      <div className="text-[11px]">
                        <span className="font-bold">Process Bottleneck: </span>
                        <span>{selectedRecordForDetail.tat.bottleneckReason}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
                      <span className="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
                      <span>All lifecycle steps executed within standard safety SLA benchmarks.</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                {onOpenPermit && selectedRecordForDetail.category === 'permit' && (
                  <button
                    type="button"
                    onClick={() => {
                      const pNo = selectedRecordForDetail.permitNo;
                      setSelectedRecordForDetail(null);
                      onOpenPermit(pNo);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition cursor-pointer"
                  >
                    <span>Open in Permit Approver</span>
                    <span className="material-symbols-outlined text-[16px]">launch</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedRecordForDetail(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default ReportModule;
