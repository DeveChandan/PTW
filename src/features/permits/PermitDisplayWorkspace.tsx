import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { SapUser } from '../../core/auth/sapAuthContext';
import type { PermitDeepInsertResponse, PermitInfoRecord } from '../../core/types/ptw.types';
import { sitePermitApi } from '../../core/api/modules/sitePermit.api';
import { PERMIT_CATEGORIES, PROCEDURE } from '../../core/ptw/siteProcedure';
import { PrerequisitePanel } from './PrerequisitePanel';
import { SectionCard } from '../../shared/components/SectionCard';
import { toast } from '../../shared/context/ToastContext';
import { PermitAnnexPrintView } from './PermitAnnexPrintView';
import { PermitPrintModal } from './PermitPrintModal';

interface PermitDisplayWorkspaceProps {
  user: SapUser | null;
  onBack: () => void;
  initialPermitNo?: string;
}

type TabType =
  | 'overview'
  | 'procedure'
  | 'crew_hazards'
  | 'ppe'
  | 'isolation'
  | 'gastest'
  | 'approvals'
  | 'renewals_audit';

export const PermitDisplayWorkspace: React.FC<PermitDisplayWorkspaceProps> = ({
  user,
  onBack,
  initialPermitNo
}) => {
  // Navigation & View Mode
  const [viewMode, setViewMode] = useState<'list' | 'detail'>(initialPermitNo ? 'detail' : 'list');
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Search & Filtering State (Server-side)
  const [plant, setPlant] = useState<string>(user?.plant || '1002');
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [quickLookupNo, setQuickLookupNo] = useState<string>(initialPermitNo || '');

  // Local Findability State (Instant Client-side Filter & Inspect)
  const [tableQuery, setTableQuery] = useState<string>('');
  const [expandedPermitNo, setExpandedPermitNo] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [jsaFilter, setJsaFilter] = useState<'ALL' | 'YES' | 'NO' | 'NA'>('ALL');
  const [jsaSearch, setJsaSearch] = useState<string>('');
  const [dossierSearch, setDossierSearch] = useState<string>('');
  const [ppeFilter, setPpeFilter] = useState<'ALL' | 'REQ'>('ALL');

  // Data State
  const [permits, setPermits] = useState<PermitInfoRecord[]>([]);
  const [allPermits, setAllPermits] = useState<PermitInfoRecord[]>([]);
  const lastBaselinePlantRef = useRef<string>(plant);
  const [selectedPermit, setSelectedPermit] = useState<PermitDeepInsertResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [offset, setOffset] = useState<number>(0);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [updatingPrereq, setUpdatingPrereq] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Copy to clipboard helper
  const handleCopy = (text: string, label: string) => {
    if (!text || text === '—') return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedText(text);
      toast.success(`${label} (${text}) copied to clipboard`, { title: 'Copied' });
      setTimeout(() => setCopiedText(null), 2200);
    }).catch(() => {
      toast.info(`Selected: ${text}`);
    });
  };

  // Load Permit List from SAP OData V4
  const loadPermitList = async (skip = 0, overrideCategory?: string, overrideStatus?: string) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError('');
    const effCategory = overrideCategory !== undefined ? overrideCategory : categoryFilter;
    const effStatus = overrideStatus !== undefined ? overrideStatus : statusFilter;

    try {
      const data = await sitePermitApi.list(plant, search, skip, controller.signal, effCategory, effStatus);
      if (!controller.signal.aborted) {
        setPermits(data);
        if (effCategory === 'ALL' && effStatus === 'ALL' && !search.trim()) {
          setAllPermits(data);
          lastBaselinePlantRef.current = plant;
        } else if (plant !== lastBaselinePlantRef.current || allPermits.length === 0) {
          lastBaselinePlantRef.current = plant;
          void sitePermitApi.list(plant, '', 0, controller.signal, 'ALL', 'ALL')
            .then(baseData => {
              if (!controller.signal.aborted) setAllPermits(baseData);
            })
            .catch(() => {});
        }
        setOffset(skip);
        setHasSearched(true);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve permits from SAP Gateway.';
        setError(msg);
        toast.error(msg, { title: 'SAP Gateway Error' });
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  // Load Single Permit Deep Details (All 10 Collections expanded)
  const loadPermitDetail = async (permitNo: string) => {
    if (!permitNo.trim()) return;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoadingDetail(true);
    setError('');
    try {
      const data = await sitePermitApi.read(permitNo.trim(), controller.signal);
      if (!controller.signal.aborted) {
        setSelectedPermit(data);
        setViewMode('detail');
        setActiveTab('overview');
        setDossierSearch('');
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const msg = err instanceof Error ? err.message : `Unable to load details for permit ${permitNo}.`;
        setError(msg);
        toast.error(msg, { title: 'Permit Details Error' });
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingDetail(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    if (initialPermitNo) {
      void loadPermitDetail(initialPermitNo);
    } else {
      void loadPermitList(0);
    }
    return () => abortControllerRef.current?.abort();
  }, []);

  // Quick lookup handler
  const handleQuickLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickLookupNo.trim()) {
      void loadPermitDetail(quickLookupNo.trim());
    } else {
      toast.warning('Please enter a permit number to search.', { title: 'Mandatory Field Missing' });
    }
  };

  // Print PTW handler: opens official A4 preview modal
  const handlePrint = () => {
    if (!selectedPermit) {
      toast.warning('Please select a permit to print.', { title: 'Print' });
      return;
    }
    setShowPrintModal(true);
  };

  // KPI Calculations based on plant-wide baseline
  const kpiStats = useMemo(() => {
    const source = allPermits.length > 0 ? allPermits : permits;
    const total = source.length;
    const active = source.filter(p => p.Status === 'ISSU' || p.Status === 'ACTV').length;
    const intended = source.filter(p => p.Status === 'INTD').length;
    const draft = source.filter(p => p.Status === 'CRTD' || p.Status === 'DRAF').length;
    const approved = source.filter(p => p.Status === 'APPR').length;
    const closed = source.filter(p => p.Status === 'CLOS' || p.Status === 'CANC').length;
    const hotOrConf = source.filter(p => p.PermitType === 'HOT' || p.PermitType === 'CONF' || p.PermitType === 'CSE').length;
    return { total, active, intended, draft, approved, closed, hotOrConf };
  }, [allPermits, permits]);

  // Category counts based on plant-wide baseline
  const categoryCounts = useMemo(() => {
    const source = allPermits.length > 0 ? allPermits : permits;
    return {
      ALL: source.length,
      HOT: source.filter(p => p.PermitType === 'HOT').length,
      COLD: source.filter(p => p.PermitType === 'COLD').length,
      CONF: source.filter(p => p.PermitType === 'CONF' || p.PermitType === 'CSE').length,
      HGHT: source.filter(p => p.PermitType === 'HGHT' || p.PermitType === 'W@H').length,
      ELEC: source.filter(p => p.PermitType === 'ELEC').length,
    };
  }, [allPermits, permits]);

  // Status counts based on plant-wide baseline
  const statusCounts = useMemo(() => {
    const source = allPermits.length > 0 ? allPermits : permits;
    return {
      ALL: source.length,
      ISSU: source.filter(p => p.Status === 'ISSU' || p.Status === 'ACTV').length,
      INTD: source.filter(p => p.Status === 'INTD').length,
      APPR: source.filter(p => p.Status === 'APPR').length,
      CRTD: source.filter(p => p.Status === 'CRTD' || p.Status === 'DRAF').length,
      CLOS: source.filter(p => p.Status === 'CLOS' || p.Status === 'CANC').length,
    };
  }, [allPermits, permits]);

  // Client-filtered permits for instant search-as-you-type
  const displayedPermits = useMemo(() => {
    if (!tableQuery.trim()) return permits;
    const q = tableQuery.toLowerCase().trim();
    return permits.filter(p =>
      (p.Permit_No && p.Permit_No.toLowerCase().includes(q)) ||
      (p.Aufnr && p.Aufnr.toLowerCase().includes(q)) ||
      (p.Qmnum && p.Qmnum.toLowerCase().includes(q)) ||
      (p.Equnr && p.Equnr.toLowerCase().includes(q)) ||
      (p.Tplnr && p.Tplnr.toLowerCase().includes(q)) ||
      (p.JobDesc && p.JobDesc.toLowerCase().includes(q)) ||
      (p.AreaLoc && p.AreaLoc.toLowerCase().includes(q)) ||
      (p.Werks && p.Werks.toLowerCase().includes(q)) ||
      (p.SupvName && p.SupvName.toLowerCase().includes(q)) ||
      (p.PermitType && p.PermitType.toLowerCase().includes(q)) ||
      (p.Status && p.Status.toLowerCase().includes(q))
    );
  }, [permits, tableQuery]);

  // Helper: Status Badges with enhanced color depth
  const renderStatusBadge = (status: string, compact = false) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'ISSU':
      case 'ACTV':
        return (
          <span className={`inline-flex items-center gap-1.5 ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} rounded-full font-bold font-mono bg-emerald-100/90 text-emerald-800 border border-emerald-300 shadow-xs`}>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span>ISSUED & ACTIVE</span>
          </span>
        );
      case 'APPR':
        return (
          <span className={`inline-flex items-center gap-1.5 ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} rounded-full font-bold font-mono bg-amber-100/90 text-amber-800 border border-amber-300 shadow-xs`}>
            <span className="material-symbols-outlined text-[14px] shrink-0 text-amber-700">verified</span>
            <span>APPROVED</span>
          </span>
        );
      case 'INTD':
        return (
          <span className={`inline-flex items-center gap-1.5 ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} rounded-full font-bold font-mono bg-indigo-100/90 text-indigo-800 border border-indigo-300 shadow-xs`}>
            <span className="material-symbols-outlined text-[14px] shrink-0 text-indigo-700">pending_actions</span>
            <span>INTENDED (PREREQ)</span>
          </span>
        );
      case 'CRTD':
      case 'DRAF':
        return (
          <span className={`inline-flex items-center gap-1.5 ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} rounded-full font-bold font-mono bg-slate-100 text-slate-700 border border-slate-300 shadow-xs`}>
            <span className="material-symbols-outlined text-[14px] shrink-0 text-slate-500">edit_document</span>
            <span>DRAFT / CREATED</span>
          </span>
        );
      case 'CLOS':
        return (
          <span className={`inline-flex items-center gap-1.5 ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} rounded-full font-bold font-mono bg-blue-100 text-blue-800 border border-blue-300 shadow-xs`}>
            <span className="material-symbols-outlined text-[14px] shrink-0 text-blue-700">task_alt</span>
            <span>CLOSED / RESTORED</span>
          </span>
        );
      case 'SUSP':
        return (
          <span className={`inline-flex items-center gap-1.5 ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} rounded-full font-bold font-mono bg-rose-100 text-rose-800 border border-rose-300 shadow-xs`}>
            <span className="material-symbols-outlined text-[14px] shrink-0 text-rose-700">pause_circle</span>
            <span>SUSPENDED</span>
          </span>
        );
      case 'CANC':
        return (
          <span className={`inline-flex items-center gap-1.5 ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} rounded-full font-bold font-mono bg-gray-100 text-gray-700 border border-gray-300 shadow-xs`}>
            <span className="material-symbols-outlined text-[14px] shrink-0 text-gray-600">cancel</span>
            <span>CANCELLED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-800 border border-slate-200">
            {status || 'UNKNOWN'}
          </span>
        );
    }
  };

  // Helper: Category Info
  const getCategoryInfo = (code: string) => {
    const found = PERMIT_CATEGORIES.find(c => c.code === code || c.sapCode === code);
    return {
      label: found?.label || code,
      icon: found?.icon || 'description',
      desc: found?.desc || 'Permit Activity',
      code
    };
  };

  // Helper: Calculate Validity Status & Time remaining
  const calculateValidity = (validFromD: string | null, validFromT: string, validToD: string | null, validToT: string) => {
    if (!validFromD || !validToD) return { status: 'UNKNOWN', text: 'No dates set', percent: 0, color: 'text-slate-500', badgeBg: 'bg-slate-100 text-slate-600' };
    const now = Date.now();
    const start = new Date(`${validFromD}T${validFromT || '00:00:00'}+05:30`).getTime();
    const end = new Date(`${validToD}T${validToT || '23:59:59'}+05:30`).getTime();

    if (isNaN(start) || isNaN(end)) return { status: 'INVALID', text: 'Invalid time format', percent: 0, color: 'text-slate-500', badgeBg: 'bg-slate-100 text-slate-600' };

    if (now < start) {
      const hrsUntil = Math.max(0, Math.round((start - now) / 3600000));
      return { status: 'UPCOMING', text: `Starts in ~${hrsUntil}h`, percent: 0, color: 'text-sky-600', badgeBg: 'bg-sky-50 text-sky-700 border-sky-200' };
    }
    if (now > end) {
      return { status: 'EXPIRED', text: 'Validity Ended', percent: 100, color: 'text-rose-600', badgeBg: 'bg-rose-50 text-rose-700 border-rose-200' };
    }
    const total = end - start;
    const elapsed = now - start;
    const percent = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    const remainingHrs = Math.max(0, ((end - now) / 3600000)).toFixed(1);
    const isCritical = percent > 85;
    return {
      status: 'ACTIVE',
      text: `${remainingHrs}h left (${percent}%)`,
      percent,
      color: isCritical ? 'text-amber-600' : 'text-emerald-600',
      badgeBg: isCritical ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
    };
  };

  // Interactive KPI card click handler
  const handleKpiFilter = (mode: 'ALL' | 'ACTIVE' | 'PENDING' | 'CRITICAL' | 'CLOSED' | 'DRAFT') => {
    switch (mode) {
      case 'ALL':
        setStatusFilter('ALL');
        setCategoryFilter('ALL');
        void loadPermitList(0, 'ALL', 'ALL');
        break;
      case 'ACTIVE':
        setStatusFilter('ISSU');
        setCategoryFilter('ALL');
        void loadPermitList(0, 'ALL', 'ISSU');
        break;
      case 'PENDING':
        setStatusFilter('INTD');
        setCategoryFilter('ALL');
        void loadPermitList(0, 'ALL', 'INTD');
        break;
      case 'DRAFT':
        setStatusFilter('CRTD');
        setCategoryFilter('ALL');
        void loadPermitList(0, 'ALL', 'CRTD');
        break;
      case 'CRITICAL':
        setStatusFilter('ALL');
        setCategoryFilter('CRITICAL');
        void loadPermitList(0, 'CRITICAL', 'ALL');
        break;
      case 'CLOSED':
        setStatusFilter('CLOS');
        setCategoryFilter('ALL');
        void loadPermitList(0, 'ALL', 'CLOS');
        break;
    }
  };

  return (
    <div className="mx-auto max-w-[1536px] px-3 sm:px-6 py-4 sm:py-5 font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP APPLICATION COMMAND BAR & BREADCRUMBS */}
      {/* ========================================================================= */}
      <header className="no-print mb-4 pb-3 border-b border-slate-200/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Breadcrumb & Screen Title */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={viewMode === 'detail' && !initialPermitNo ? () => setViewMode('list') : onBack}
              className="group inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:border-[#006398] hover:bg-sky-50/50 hover:text-[#006398]"
            >
              <span className="material-symbols-outlined text-[16px] transition-transform group-hover:-translate-x-0.5">
                arrow_back
              </span>
              <span>{viewMode === 'detail' && !initialPermitNo ? 'Back to Permit Register' : 'Return to Launchpad'}</span>
            </button>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>/</span>
              <span className="text-slate-600 font-medium">PTW Suite</span>
              <span>/</span>
              {viewMode === 'detail' && selectedPermit ? (
                <span className="font-bold text-[#006398] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">file_open</span>
                  <span>Permit {selectedPermit.Permit_No}</span>
                </span>
              ) : (
                <span className="font-semibold text-slate-800">Master Register</span>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-200 text-[11px] font-mono text-slate-500">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span>SAP Gateway Live (V4) · Plant {plant}</span>
            </div>
          </div>

          {/* Quick Lookup Bar & Header Actions */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <form onSubmit={handleQuickLookup} className="flex items-center gap-1.5 relative">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2 text-[16px] text-slate-400">
                  search
                </span>
                <input
                  type="text"
                  value={quickLookupNo}
                  onChange={e => setQuickLookupNo(e.target.value.toUpperCase())}
                  placeholder="Direct Jump (e.g. PTW0000013)"
                  className="w-48 sm:w-60 pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006398] focus:ring-1 focus:ring-[#006398]/30 shadow-xs"
                />
              </div>
              <button
                type="submit"
                disabled={loadingDetail || !quickLookupNo.trim()}
                title="Open Permit Dossier"
                className="px-3 py-1.5 bg-[#006398] hover:bg-[#004e78] text-white rounded-xl text-xs font-semibold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1 shrink-0"
              >
                {loadingDetail ? (
                  <span className="material-symbols-outlined animate-spin text-[15px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[15px]">visibility</span>
                )}
                <span className="hidden sm:inline">Jump</span>
              </button>
            </form>

            {viewMode === 'detail' && (
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1 shrink-0"
                title="Print Official Certificate"
              >
                <span className="material-symbols-outlined text-[15px]">print</span>
                <span className="hidden sm:inline">Print PTW</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Global Error Banner */}
      {error && (
        <div role="alert" className="no-print mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3 shadow-xs">
          <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0">error</span>
          <div className="flex-1">
            <h4 className="font-bold uppercase tracking-wider text-[11px] mb-0.5">SAP Gateway Notice</h4>
            <p className="leading-relaxed">{error}</p>
          </div>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MODE: PERMIT DIRECTORY / LIST VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Interactive KPI Quick-Filter Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Total */}
            <button
              type="button"
              onClick={() => handleKpiFilter('ALL')}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                statusFilter === 'ALL' && categoryFilter === 'ALL'
                  ? 'bg-gradient-to-br from-white to-slate-100/90 border-[#006398] ring-2 ring-[#006398]/30 shadow-md'
                  : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-600">Total Register</span>
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                  <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight leading-none">{kpiStats.total}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-600">All Records</span>
              </div>
            </button>

            {/* Active In-Field */}
            <button
              type="button"
              onClick={() => handleKpiFilter('ACTIVE')}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                statusFilter === 'ISSU' || statusFilter === 'ACTV'
                  ? 'bg-gradient-to-br from-emerald-50/80 to-emerald-100/60 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
                  : 'bg-white border-slate-200/90 hover:border-emerald-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-emerald-800">Active In-Field</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <span className="material-symbols-outlined text-[16px] animate-pulse">radio_button_checked</span>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl sm:text-3xl font-bold font-display text-emerald-950 tracking-tight leading-none">{kpiStats.active}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-100 text-emerald-800">Executing</span>
              </div>
            </button>

            {/* Intended / Prereq */}
            <button
              type="button"
              onClick={() => handleKpiFilter('PENDING')}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                statusFilter === 'INTD'
                  ? 'bg-gradient-to-br from-indigo-50/80 to-indigo-100/60 border-indigo-500 ring-2 ring-indigo-500/30 shadow-md'
                  : 'bg-white border-slate-200/90 hover:border-indigo-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-indigo-800">Intended / Prereq</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                </div>
              </div>
              <div className="flex items-end justify-between gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold font-display text-indigo-950 tracking-tight leading-none">{kpiStats.intended}</span>
                <div className="flex flex-col items-end gap-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-100 text-indigo-800">Verification</span>
                  {kpiStats.draft > 0 && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleKpiFilter('DRAFT');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          handleKpiFilter('DRAFT');
                        }
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        statusFilter === 'CRTD'
                          ? 'bg-slate-800 text-white shadow-xs ring-1 ring-slate-400'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                      }`}
                      title="Click to view Draft / Created permits"
                    >
                      {kpiStats.draft} Draft
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Critical: Hot / Confined */}
            <button
              type="button"
              onClick={() => handleKpiFilter('CRITICAL')}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                categoryFilter === 'CRITICAL' || categoryFilter === 'HOT' || categoryFilter === 'CONF'
                  ? 'bg-gradient-to-br from-amber-50/80 to-amber-100/60 border-amber-500 ring-2 ring-amber-500/30 shadow-md'
                  : 'bg-white border-slate-200/90 hover:border-amber-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-amber-800">Hot / Confined</span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl sm:text-3xl font-bold font-display text-amber-950 tracking-tight leading-none">{kpiStats.hotOrConf}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-100 text-amber-800">High Risk</span>
              </div>
            </button>

            {/* Closed / Restored */}
            <button
              type="button"
              onClick={() => handleKpiFilter('CLOSED')}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between col-span-2 sm:col-span-1 ${
                statusFilter === 'CLOS'
                  ? 'bg-gradient-to-br from-sky-50/80 to-sky-100/60 border-sky-500 ring-2 ring-sky-500/30 shadow-md'
                  : 'bg-white border-slate-200/90 hover:border-sky-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-sky-800">Closed / Restored</span>
                <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-[#006398]">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl sm:text-3xl font-bold font-display text-[#004f7a] tracking-tight leading-none">{kpiStats.closed}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-sky-100 text-[#006398]">Completed</span>
              </div>
            </button>
          </div>

          {/* Unified Filter & Search Strip */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
            {/* Top Row: Search Controls */}
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              {/* Instant In-Table Quick Filter */}
              <div className="flex-1 relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">
                  filter_list
                </span>
                <input
                  type="text"
                  value={tableQuery}
                  onChange={e => setTableQuery(e.target.value)}
                  placeholder="Instant filter by Permit #, MO #, Equipment, Area, Job Description, or Contractor..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#006398] focus:ring-1 focus:ring-[#006398]/30 transition-all"
                />
                {tableQuery && (
                  <button
                    type="button"
                    onClick={() => setTableQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

              {/* Server-Side Controls */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  void loadPermitList(0);
                }}
                className="flex items-center gap-2 shrink-0 flex-wrap"
              >
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                  <span className="text-[11px] font-mono text-slate-400">Plant:</span>
                  <input
                    type="text"
                    value={plant}
                    maxLength={4}
                    onChange={e => setPlant(e.target.value.toUpperCase())}
                    placeholder="1002"
                    className="w-14 bg-transparent font-mono font-bold text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                  <span className="text-[11px] font-mono text-slate-400">SAP Query:</span>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Server query..."
                    className="w-32 bg-transparent text-xs text-slate-800 focus:outline-none placeholder:text-slate-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-2 bg-[#006398] hover:bg-[#004e78] text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[15px] ${loading ? 'animate-spin' : ''}`}>
                    {loading ? 'progress_activity' : 'sync'}
                  </span>
                  <span>Fetch SAP</span>
                </button>
              </form>
            </div>

            {/* Bottom Row: Category & Status Filter Pills */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-mono text-slate-400 mr-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">category</span>
                  <span>Type:</span>
                </span>
                {[
                  { id: 'ALL', label: 'All Types', count: categoryCounts.ALL },
                  { id: 'HOT', label: 'Hot 🔥', count: categoryCounts.HOT },
                  { id: 'COLD', label: 'Cold ❄️', count: categoryCounts.COLD },
                  { id: 'CONF', label: 'Confined 🚪', count: categoryCounts.CONF },
                  { id: 'HGHT', label: 'Height 🪜', count: categoryCounts.HGHT },
                  { id: 'ELEC', label: 'Electrical ⚡', count: categoryCounts.ELEC }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(cat.id);
                      void loadPermitList(0, cat.id, statusFilter);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all inline-flex items-center gap-1.5 ${
                      categoryFilter === cat.id
                        ? 'bg-[#006398] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className={`px-1 py-0.2 rounded text-[10px] ${
                      categoryFilter === cat.id ? 'bg-white/20 text-white font-bold' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {cat.count}
                    </span>
                  </button>
                ))}

                <div className="h-4 w-[1px] bg-slate-200 mx-1.5 hidden sm:block" />

                <span className="text-[11px] font-mono text-slate-400 mr-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">flag</span>
                  <span>Status:</span>
                </span>
                {[
                  { id: 'ALL', label: 'All', count: statusCounts.ALL },
                  { id: 'ISSU', label: 'Issued (Active)', count: statusCounts.ISSU },
                  { id: 'INTD', label: 'Intended', count: statusCounts.INTD },
                  { id: 'APPR', label: 'Approved', count: statusCounts.APPR },
                  { id: 'CRTD', label: 'Draft', count: statusCounts.CRTD },
                  { id: 'CLOS', label: 'Closed', count: statusCounts.CLOS }
                ].map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(st.id);
                      void loadPermitList(0, categoryFilter, st.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all inline-flex items-center gap-1.5 ${
                      statusFilter === st.id
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{st.label}</span>
                    <span className={`px-1 py-0.2 rounded text-[10px] ${
                      statusFilter === st.id ? 'bg-white/20 text-white font-bold' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {st.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Active Filter Clear & Result Counts */}
              <div className="flex items-center gap-2 ml-auto">
                {(categoryFilter !== 'ALL' || statusFilter !== 'ALL' || tableQuery || search) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter('ALL');
                      setStatusFilter('ALL');
                      setTableQuery('');
                      setSearch('');
                      void loadPermitList(0, 'ALL', 'ALL');
                    }}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 px-2 py-0.5 rounded hover:bg-rose-50"
                  >
                    <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
                    <span>Reset All Filters</span>
                  </button>
                )}

                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#006398]/10 text-[#006398] border border-[#006398]/20">
                  {displayedPermits.length} of {allPermits.length > 0 ? allPermits.length : permits.length} Records
                </span>
              </div>
            </div>
          </div>

          {/* Master Registry Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3">
                <span className="material-symbols-outlined animate-spin text-[32px] text-[#006398]">
                  progress_activity
                </span>
                <span className="font-semibold text-slate-700">Connecting to SAP OData V4 Service...</span>
                <span className="text-slate-400 font-mono text-[11px]">Executing site permit register query</span>
              </div>
            ) : displayedPermits.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-xs">
                <span className="material-symbols-outlined text-[40px] text-slate-300 block mb-2">
                  search_off
                </span>
                <p className="font-bold text-slate-700 text-sm">No Matching Permits Found</p>
                <p className="mt-1 text-slate-500 max-w-md mx-auto">
                  {hasSearched
                    ? 'No SAP permit records match your query or filter criteria. Try clearing filters or searching across another plant.'
                    : 'Search to load active permits from SAP.'}
                </p>
                {(categoryFilter !== 'ALL' || statusFilter !== 'ALL' || tableQuery || search) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter('ALL');
                      setStatusFilter('ALL');
                      setTableQuery('');
                      setSearch('');
                      void loadPermitList(0, 'ALL', 'ALL');
                    }}
                    className="mt-4 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                    <span>Reset All Filters</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-mono text-[11px] sticky top-0 z-10">
                      <th className="py-3 px-3.5 w-12 text-center">#</th>
                      <th className="py-3 px-3.5 w-40">Permit Number</th>
                      <th className="py-3 px-3.5 w-32">Type</th>
                      <th className="py-3 px-3.5 w-36">Status</th>
                      <th className="py-3 px-3.5">Job Scope & Technical Reference</th>
                      <th className="py-3 px-3.5 w-44">Location & Plant</th>
                      <th className="py-3 px-3.5 w-48">Validity Window (IST)</th>
                      <th className="py-3 px-3.5 w-32 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {displayedPermits.map(item => {
                      const catInfo = getCategoryInfo(item.PermitType);
                      const validity = calculateValidity(item.ValidFromD, item.ValidFromT, item.ValidToD, item.ValidToT);
                      const isExpanded = expandedPermitNo === item.Permit_No;

                      return (
                        <React.Fragment key={item.Permit_No}>
                          <tr className={`hover:bg-sky-50/40 transition-colors group ${isExpanded ? 'bg-sky-50/30' : ''}`}>
                            {/* Expand preview toggle */}
                            <td className="py-3 px-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => setExpandedPermitNo(isExpanded ? null : item.Permit_No)}
                                className="w-6 h-6 rounded-md hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 inline-flex items-center justify-center transition-all"
                                title={isExpanded ? 'Collapse preview' : 'Quick preview'}
                              >
                                <span className={`material-symbols-outlined text-[16px] transition-transform ${isExpanded ? 'rotate-90 text-[#006398]' : ''}`}>
                                  chevron_right
                                </span>
                              </button>
                            </td>

                            {/* Permit No & Copy Button */}
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void loadPermitDetail(item.Permit_No)}
                                  className="font-mono font-bold text-xs text-[#006398] hover:text-[#004e78] hover:underline"
                                >
                                  {item.Permit_No}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(item.Permit_No, 'Permit #')}
                                  className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-slate-400 hover:text-slate-600 transition-opacity p-0.5 rounded"
                                  title="Copy permit number"
                                >
                                  <span className="material-symbols-outlined text-[14px]">
                                    {copiedText === item.Permit_No ? 'check' : 'content_copy'}
                                  </span>
                                </button>
                              </div>
                              <span className="block font-mono text-[10px] text-slate-400 mt-0.5">
                                Rev: {item.FormRev || '0'} · ID: {item.Revision || '—'}
                              </span>
                            </td>

                            {/* Category with Icon */}
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[17px] text-slate-500 shrink-0">
                                  {catInfo.icon}
                                </span>
                                <div>
                                  <span className="font-semibold text-slate-800 block text-[11px] leading-tight">{catInfo.label}</span>
                                  <span className="font-mono text-[10px] text-slate-400">{catInfo.code}</span>
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              {renderStatusBadge(item.Status, true)}
                            </td>

                            {/* Job Description & Reference Badges */}
                            <td className="py-3 px-3.5 max-w-sm">
                              <p className="font-semibold text-slate-900 line-clamp-1 text-xs" title={item.JobDesc}>
                                {item.JobDesc || 'No job description provided'}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 text-[10px] font-mono text-slate-500 flex-wrap">
                                {item.Aufnr && (
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 font-bold text-slate-700 flex items-center gap-1">
                                    <span>MO:</span>
                                    <span>{item.Aufnr}</span>
                                  </span>
                                )}
                                {item.Qmnum && (
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 text-slate-600">
                                    Notif: {item.Qmnum}
                                  </span>
                                )}
                                {item.Equnr && (
                                  <span className="bg-slate-50 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200/60">
                                    Eq: {item.Equnr}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Location & Area */}
                            <td className="py-3 px-3.5">
                              <div className="text-xs">
                                <span className="font-mono font-bold text-slate-800">{item.Werks || '—'}</span>
                                <span className="text-slate-300 mx-1">·</span>
                                <span className="text-slate-700 font-medium">{item.AreaLoc || 'Area unspecified'}</span>
                              </div>
                              {item.Arbpl && (
                                <span className="block text-[10px] font-mono text-slate-400 mt-0.5">WC: {item.Arbpl}</span>
                              )}
                            </td>

                            {/* Validity Window */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="text-[11px] font-mono text-slate-700 flex items-center gap-1">
                                <span>{item.ValidFromD?.slice(5)} {item.ValidFromT?.slice(0, 5)}</span>
                                <span className="text-slate-300">→</span>
                                <span>{item.ValidToD?.slice(5)} {item.ValidToT?.slice(0, 5)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <div className="w-16 bg-slate-200 h-1 rounded-full overflow-hidden shrink-0">
                                  <div
                                    className={`h-full rounded-full ${validity.percent > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${validity.percent}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-mono font-bold ${validity.color}`}>
                                  {validity.text}
                                </span>
                              </div>
                            </td>

                            {/* Action Button */}
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => void loadPermitDetail(item.Permit_No)}
                                className="px-3 py-1.5 bg-[#006398] hover:bg-[#004e78] text-white rounded-lg text-xs font-semibold shadow-xs transition-all inline-flex items-center gap-1 ml-auto"
                              >
                                <span>Open Dossier</span>
                                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                              </button>
                            </td>
                          </tr>

                          {/* Inline Expanded Preview Drawer */}
                          {isExpanded && (
                            <tr className="bg-sky-50/20 border-b border-sky-100">
                              <td colSpan={8} className="p-4 pl-12">
                                <div className="bg-white rounded-xl border border-sky-200/80 p-3.5 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                                      Supervision & Agency
                                    </span>
                                    <p className="font-semibold text-slate-800">{item.SupvName || 'Supervisor not assigned'}</p>
                                    <p className="text-[11px] font-mono text-slate-500">{item.SupvPhone || 'No phone'}</p>
                                    <p className="text-[11px] text-slate-600 mt-0.5">
                                      {item.ExecAgency === 'CONT' ? 'Contractor' : 'Company (EMP)'} · Dept: {item.ExecDept || '—'}
                                    </p>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                                      Asset & Functional Loc
                                    </span>
                                    <p className="font-mono text-slate-800 font-semibold">{item.Tplnr || 'Func loc not recorded'}</p>
                                    <p className="font-mono text-[11px] text-slate-500">Equip: {item.Equnr || '—'}</p>
                                    <p className="text-[11px] text-slate-600 mt-0.5">Shift: {item.Shift || 'GENERAL'}</p>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                                      Gateways & Prerequisites
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                        (item.GasTestRequired === 'Y' || item.GasTestRequired === 'X')
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}>
                                        Gas Test: {(item.GasTestRequired === 'Y' || item.GasTestRequired === 'X') ? 'REQ' : 'NO'}
                                      </span>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                        (item.IsolationRequired === 'Y' || item.IsolationRequired === 'X')
                                          ? 'bg-purple-100 text-purple-800'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}>
                                        LOTO: {(item.IsolationRequired === 'Y' || item.IsolationRequired === 'X') ? 'REQ' : 'NO'}
                                      </span>
                                    </div>
                                    <p className="text-[10px] font-mono text-slate-400 mt-1.5">
                                      Created by: {item.Ernam || 'SAP'} on {item.Erdat}
                                    </p>
                                  </div>

                                  <div className="flex flex-col justify-between items-start sm:items-end">
                                    <span className="text-[10px] font-mono text-slate-400">
                                      Full Dossier Deep View
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => void loadPermitDetail(item.Permit_No)}
                                      className="px-3.5 py-1.5 bg-[#006398] hover:bg-[#004e78] text-white rounded-lg font-semibold text-xs transition-all shadow-xs flex items-center gap-1.5"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">description</span>
                                      <span>Display All 8 Dossier Tabs</span>
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {hasSearched && permits.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono">
                  Showing offset {offset} (Page {Math.floor(offset / 25) + 1}) · Total retrieved: {permits.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={offset === 0 || loading}
                    onClick={() => void loadPermitList(Math.max(0, offset - 25))}
                    className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 shadow-xs"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={permits.length < 25 || loading}
                    onClick={() => void loadPermitList(offset + 25)}
                    className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 shadow-xs"
                  >
                    Next Page
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODE: DETAILED PERMIT DISPLAY / DOSSIER VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'detail' && selectedPermit && (
        <div>
          <div className="no-print space-y-4">
            {/* Executive Dossier Header Card - Streamlined & Compact */}
          <div className="bg-gradient-to-br from-white via-[#fafcff] to-sky-50/25 rounded-2xl border border-slate-200/90 shadow-[0_2px_4px_rgba(15,23,42,0.03),0_8px_20px_-4px_rgba(0,99,152,0.07)] p-4 sm:p-5 relative overflow-hidden">
            {/* Top Row: Permit Title, Badges, and Action Buttons */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#006398] to-[#004266] text-white flex items-center justify-center shadow-md shrink-0">
                  <span className="material-symbols-outlined text-[24px]">
                    {getCategoryInfo(selectedPermit.PermitType).icon}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-bold font-mono text-slate-900 flex items-center gap-1.5">
                      <span>PTW #{selectedPermit.Permit_No}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedPermit.Permit_No, 'Permit #')}
                        className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
                        title="Copy Permit Number"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {copiedText === selectedPermit.Permit_No ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </h2>

                    {renderStatusBadge(selectedPermit.Status)}

                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#006398]/10 text-[#006398] border border-[#006398]/20 shadow-xs flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">{getCategoryInfo(selectedPermit.PermitType).icon}</span>
                      <span>{getCategoryInfo(selectedPermit.PermitType).label}</span>
                    </span>

                    {/* Additional Sub-categories */}
                    {selectedPermit._WorkType && selectedPermit._WorkType.length > 0 && (
                      selectedPermit._WorkType
                        .filter(wt => wt.WorkType && wt.WorkType !== selectedPermit.PermitType)
                        .map(wt => (
                          <span
                            key={wt.SeqNo || wt.WorkType}
                            className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-sky-50 text-[#006398] border border-sky-200 shadow-xs flex items-center gap-1"
                            title={`Additional Work Category: ${getCategoryInfo(wt.WorkType).label} (${wt.WorkType})`}
                          >
                            <span className="material-symbols-outlined text-[12px]">{getCategoryInfo(wt.WorkType).icon}</span>
                            <span>+{getCategoryInfo(wt.WorkType).label}</span>
                          </span>
                        ))
                    )}
                  </div>

                  <p className="mt-1 text-xs sm:text-sm font-medium text-slate-700 max-w-4xl line-clamp-2">
                    {selectedPermit.JobDesc}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="no-print flex items-center gap-2 shrink-0 self-start lg:self-center">
                {updatingPrereq && (
                  <span className="text-[11px] font-mono text-amber-700 bg-amber-50 px-2 py-1 rounded-xl border border-amber-200 flex items-center gap-1 animate-pulse shadow-xs">
                    <span className="material-symbols-outlined text-[13px]">sync</span>
                    <span>Syncing...</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[15px]">print</span>
                  <span>Print Dossier</span>
                </button>

                <button
                  type="button"
                  disabled={loadingDetail || updatingPrereq}
                  onClick={() => void loadPermitDetail(selectedPermit.Permit_No)}
                  className="px-3.5 py-1.5 border border-slate-300 hover:border-[#006398] hover:text-[#006398] bg-white text-slate-700 rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[15px] ${loadingDetail ? 'animate-spin' : ''}`}>
                    refresh
                  </span>
                  <span>Reload SAP</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
                  title="Return to Master Table"
                >
                  <span className="material-symbols-outlined text-[15px]">view_list</span>
                  <span className="hidden sm:inline">Register</span>
                </button>
              </div>
            </div>

            {/* At-a-Glance 4-Card Operational Summary Grid */}
            <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Location & Execution Agency */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    Location & Execution
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-slate-400">factory</span>
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold text-slate-800">
                    <span>Plant {selectedPermit.Werks}</span>
                    <span className="text-slate-300 mx-1">·</span>
                    <span className="text-[#006398]">{selectedPermit.AreaLoc || 'Area N/A'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Dept: <strong className="text-slate-700">{selectedPermit.ExecDept || '—'}</strong> · WC: <strong className="text-slate-700">{selectedPermit.Arbpl || '—'}</strong>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Agency: <span className="font-semibold text-slate-700">{selectedPermit.ExecAgency === 'CONT' ? 'Contractor' : 'Company (EMP)'}</span>
                  </div>
                </div>
              </div>

              {/* 2. SAP Orders & Technical Linkage */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    SAP Order Linkage
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-slate-400">link</span>
                </div>
                <div className="text-xs space-y-0.5 font-mono">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <span>MO: {selectedPermit.Aufnr || 'No Order Linked'}</span>
                    {selectedPermit.Aufnr && (
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedPermit.Aufnr, 'MO #')}
                        className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {copiedText === selectedPermit.Aufnr ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    )}
                    {selectedPermit.Auart && (
                      <span className="px-1 py-0.2 bg-indigo-50 text-indigo-700 rounded text-[10px] border border-indigo-200">
                        {selectedPermit.Auart}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Eq: <strong className="text-slate-700">{selectedPermit.Equnr || '—'}</strong>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate" title={selectedPermit.Tplnr || '—'}>
                    FL: <span className="text-slate-700">{selectedPermit.Tplnr || '—'}</span>
                  </div>
                </div>
              </div>

              {/* 3. Validity Window (IST) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    Validity Window (IST)
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
                </div>
                {(() => {
                  const val = calculateValidity(selectedPermit.ValidFromD, selectedPermit.ValidFromT, selectedPermit.ValidToD, selectedPermit.ValidToT);
                  return (
                    <div className="text-xs space-y-1">
                      <div className="font-mono text-[11px] text-slate-700 font-semibold">
                        <span>{selectedPermit.ValidFromD?.slice(5)} {selectedPermit.ValidFromT?.slice(0, 5)}</span>
                        <span className="text-slate-300 mx-1">→</span>
                        <span>{selectedPermit.ValidToD?.slice(5)} {selectedPermit.ValidToT?.slice(0, 5)}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            val.percent > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${val.percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className={`font-bold ${val.color}`}>{val.text}</span>
                        <span className="text-slate-400">{selectedPermit.Shift || 'GENERAL'}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 4. Safety Prerequisite Gateways */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    Safety Gateways
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-slate-400">shield</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border shadow-xs ${
                    (selectedPermit.GasTestRequired === 'Y' || selectedPermit.GasTestRequired === 'X')
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    Gas: {(selectedPermit.GasTestRequired === 'Y' || selectedPermit.GasTestRequired === 'X') ? `REQ (${selectedPermit.GasTestFreqHr || 2}h)` : 'NO'}
                  </span>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border shadow-xs ${
                    (selectedPermit.IsolationRequired === 'Y' || selectedPermit.IsolationRequired === 'X')
                      ? 'bg-purple-50 text-purple-800 border-purple-300'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    LOTO: {(selectedPermit.IsolationRequired === 'Y' || selectedPermit.IsolationRequired === 'X') ? 'POSITIVE' : 'NO'}
                  </span>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-50 text-slate-700 border border-slate-200">
                    Crew: {selectedPermit.PersonsQty || selectedPermit._Worker?.length || 0} Pax
                  </span>
                </div>
              </div>
            </div>

            {/* Embedded Prerequisite Actions Panel for eligible roles */}
            {user?.roles?.some(r => ['ZPTW_GAS_TESTER', 'ZPTW_SAFETY_OFFICER', 'ZPTW_ADMIN'].includes(r)) && (
              <div className="mt-3 pt-3 border-t border-slate-200/60">
                <PrerequisitePanel
                  key={`${selectedPermit.Permit_No}:${selectedPermit['@odata.etag'] || ''}`}
                  permit={selectedPermit}
                  module="permit-details"
                  user={user}
                  onBusyChange={setUpdatingPrereq}
                  onUpdated={updated => {
                    setSelectedPermit(current =>
                      current?.Permit_No === updated.Permit_No ? updated : current
                    );
                  }}
                />
              </div>
            )}
          </div>

          {/* Sticky Dossier Navigation Bar with Quick Section Jump */}
          <div className="no-print sticky top-2 z-20 bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            {/* Tabs List */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
              {[
                { id: 'overview', label: '1. Plant & General', icon: 'factory', badge: null },
                {
                  id: 'procedure',
                  label: '2. Checklists (C–F)',
                  icon: 'fact_check',
                  badge: (selectedPermit._Safety?.length || 0) + (selectedPermit._CHK?.length || 0),
                  hasWarning: selectedPermit._Safety?.some(s => s.Response === 'NO')
                },
                {
                  id: 'crew_hazards',
                  label: '3. Crew & Hazards (E)',
                  icon: 'group',
                  badge: `${selectedPermit._Worker?.length || 0} / ${selectedPermit._HazardControl?.length || 0}`
                },
                {
                  id: 'ppe',
                  label: '4. PPE Gear (G)',
                  icon: 'health_and_safety',
                  badge: selectedPermit._PPE?.length
                },
                {
                  id: 'isolation',
                  label: '5. Isolation (H)',
                  icon: 'lock',
                  badge: selectedPermit._Isolation?.reduce((acc, c) => acc + (c._Item?.length || 0), 0) || (selectedPermit.IsolationRequired === 'Y' || selectedPermit.IsolationRequired === 'X' ? 'REQ' : null)
                },
                {
                  id: 'gastest',
                  label: '6. Gas Tests (I)',
                  icon: 'science',
                  badge: selectedPermit._GasTest?.length || ((selectedPermit.GasTestRequired === 'Y' || selectedPermit.GasTestRequired === 'X') ? 'REQ' : null)
                },
                {
                  id: 'approvals',
                  label: '7. Signatures (J–M)',
                  icon: 'draw',
                  badge: selectedPermit._Approval?.length
                },
                {
                  id: 'renewals_audit',
                  label: '8. Renewals & Audit (N)',
                  icon: 'history',
                  badge: selectedPermit._AuditLog?.length
                },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-[#006398] text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.badge !== null && tab.badge !== undefined && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      activeTab === tab.id
                        ? 'bg-white/25 text-white'
                        : tab.hasWarning
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-slate-200/80 text-slate-700'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* In-Dossier Quick Search Filter */}
            <div className="relative shrink-0">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-[15px] text-slate-400">
                search
              </span>
              <input
                type="text"
                value={dossierSearch}
                onChange={e => setDossierSearch(e.target.value)}
                placeholder="Search active tab..."
                className="w-full sm:w-44 pl-7 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#006398]"
              />
              {dossierSearch && (
                <button
                  type="button"
                  onClick={() => setDossierSearch('')}
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW & PLANT CONTEXT */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Plant & Equipment Context */}
              <SectionCard
                theme="blue"
                sectionTag="SECTION 1.1"
                title="Plant, Equipment & Location Context"
                subtitle="Functional location hierarchy and master equipment tags."
                icon="factory"
              >
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">Plant (Werks)</dt>
                    <dd className="font-bold text-slate-800 mt-0.5">{selectedPermit.Werks || '—'}</dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">Work Area (AreaLoc)</dt>
                    <dd className="font-bold text-slate-800 mt-0.5">{selectedPermit.AreaLoc || '—'}</dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-400 font-mono text-[10px]">Equipment No (Equnr)</dt>
                      {selectedPermit.Equnr && (
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedPermit.Equnr, 'Equipment No')}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {copiedText === selectedPermit.Equnr ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      )}
                    </div>
                    <dd className="font-mono font-bold text-slate-800 mt-0.5">{selectedPermit.Equnr || 'Not linked'}</dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-400 font-mono text-[10px]">Functional Location (Tplnr)</dt>
                      {selectedPermit.Tplnr && (
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedPermit.Tplnr, 'Functional Location')}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {copiedText === selectedPermit.Tplnr ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      )}
                    </div>
                    <dd className="font-mono font-bold text-slate-800 mt-0.5 truncate" title={selectedPermit.Tplnr}>
                      {selectedPermit.Tplnr || '—'}
                    </dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">Work Center (Arbpl)</dt>
                    <dd className="font-mono text-slate-800 mt-0.5">{selectedPermit.Arbpl || '—'}</dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">Assembly Tag</dt>
                    <dd className="font-mono text-slate-800 mt-0.5">{selectedPermit.Assembly || '—'}</dd>
                  </div>
                </dl>
              </SectionCard>

              {/* Supervision, Department & Comments */}
              <SectionCard
                theme="slate"
                sectionTag="SECTION 1.2"
                title="Execution, Agency & Responsibility"
                subtitle="Field supervision, operating shift, and requester remarks."
                icon="badge"
              >
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">Execution Agency</dt>
                    <dd className="font-bold text-slate-800 mt-0.5">
                      {selectedPermit.ExecAgency === 'CONT' ? 'Contractor Firm' : 'Company Employees (EMP)'}
                    </dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">Execution Department</dt>
                    <dd className="font-bold text-slate-800 mt-0.5">{selectedPermit.ExecDept || '—'}</dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">Supervisor Name</dt>
                    <dd className="font-semibold text-slate-800 mt-0.5">{selectedPermit.SupvName || '—'}</dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">Supervisor Phone</dt>
                    <dd className="font-mono text-slate-800 mt-0.5">
                      {selectedPermit.SupvPhone ? (
                        <a href={`tel:${selectedPermit.SupvPhone}`} className="text-[#006398] hover:underline flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">call</span>
                          <span>{selectedPermit.SupvPhone}</span>
                        </a>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">Safety Officer</dt>
                    <dd className="font-semibold text-slate-800 mt-0.5">{selectedPermit.SafetyOfficer || '—'}</dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">Work Shift</dt>
                    <dd className="font-mono font-bold text-slate-800 mt-0.5">{selectedPermit.Shift || 'GENERAL'}</dd>
                  </div>
                </dl>

                {/* Requester Comments */}
                <div className="pt-2">
                  <dt className="text-slate-400 font-mono text-[10px]">Requester Scope & Remarks</dt>
                  <dd className="mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed font-sans">
                    {selectedPermit.CreatorComment || 'No additional remarks provided during creation.'}
                  </dd>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: PROCEDURE & JSA SAFETY PREPARATIONS (C-F) */}
          {/* ========================================================================= */}
          {activeTab === 'procedure' && (
            <div className="space-y-4">
              <SectionCard
                theme="emerald"
                sectionTag="SECTION C–F"
                title="Safety Preparations, JSA & Statutory Checks"
                subtitle={`Standard Operating Procedure ${PROCEDURE.id} · Entity: _Safety`}
                icon="fact_check"
                badge={
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {selectedPermit._Safety?.length || 0} Check Items
                  </span>
                }
              >
                {!selectedPermit._Safety || selectedPermit._Safety.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400">No safety check records recorded in this permit.</p>
                ) : (
                  <div>
                    {/* In-Table Response Filter Chips & Sub-Search */}
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-slate-400 mr-1">Filter Checks:</span>
                        {[
                          { id: 'ALL', label: `All (${selectedPermit._Safety.length})` },
                          { id: 'YES', label: `YES (${selectedPermit._Safety.filter(s => s.Response === 'YES').length})` },
                          { id: 'NO', label: `NO / Pending (${selectedPermit._Safety.filter(s => s.Response === 'NO').length})` },
                          { id: 'NA', label: `N/A (${selectedPermit._Safety.filter(s => s.Response === 'NA').length})` },
                        ].map(f => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setJsaFilter(f.id as any)}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-all ${
                              jsaFilter === f.id
                                ? f.id === 'NO'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'bg-[#006398] text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={jsaSearch}
                          onChange={e => setJsaSearch(e.target.value)}
                          placeholder="Search requirement..."
                          className="w-44 pl-2.5 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-mono text-[11px]">
                            <th className="p-2.5 w-12 text-center">#</th>
                            <th className="p-2.5 w-24">Item Code</th>
                            <th className="p-2.5">Safety Requirement / Description</th>
                            <th className="p-2.5 w-32">Response</th>
                            <th className="p-2.5">Details / Reference / Remarks</th>
                            <th className="p-2.5 w-32">Verified By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          {selectedPermit._Safety
                            .filter(row => {
                              if (jsaFilter !== 'ALL' && row.Response !== jsaFilter) return false;
                              if (jsaSearch.trim()) {
                                const q = jsaSearch.toLowerCase();
                                return (
                                  (row.ValueText && row.ValueText.toLowerCase().includes(q)) ||
                                  (row.ItemCode && row.ItemCode.toLowerCase().includes(q)) ||
                                  (row.Remarks && row.Remarks.toLowerCase().includes(q))
                                );
                              }
                              return true;
                            })
                            .map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                <td className="p-2.5 font-mono text-slate-400 text-center">{row.ItemNo || idx + 1}</td>
                                <td className="p-2.5 font-mono font-bold text-slate-700">{row.ItemCode}</td>
                                <td className="p-2.5 font-semibold text-slate-900">{row.ValueText || row.ItemCode}</td>
                                <td className="p-2.5 whitespace-nowrap">
                                  {row.Response === 'YES' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <span className="material-symbols-outlined text-[12px]">check</span>
                                      YES (Complete)
                                    </span>
                                  ) : row.Response === 'NO' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                      <span className="material-symbols-outlined text-[12px]">close</span>
                                      NO (Pending)
                                    </span>
                                  ) : row.Response === 'NA' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                      N/A
                                    </span>
                                  ) : (
                                    <span className="font-mono text-slate-400">{row.Response || '—'}</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-slate-700">
                                  {row.Remarks || row.ReferenceNo || '—'}
                                </td>
                                <td className="p-2.5 font-mono text-slate-500 text-[11px]">
                                  {row.VerifiedBy || '—'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </SectionCard>

              {/* Compliance Questionnaires (_CHK) */}
              {selectedPermit._CHK && selectedPermit._CHK.length > 0 && (
                <SectionCard
                  theme="blue"
                  sectionTag="CHECKLISTS"
                  title="Compliance Questionnaire Responses (_CHK)"
                  subtitle="Category specific statutory checklists recorded in SAP child table _CHK."
                  icon="checklist"
                  badge={
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-sky-50 text-sky-800 border border-sky-200">
                      {selectedPermit._CHK.length} Answers
                    </span>
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[11px]">
                          <th className="p-2.5 w-12 text-center">#</th>
                          <th className="p-2.5 w-28">Category</th>
                          <th className="p-2.5 w-36">Questionnaire ID</th>
                          <th className="p-2.5 w-32">Response</th>
                          <th className="p-2.5">Remarks / Verification Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {selectedPermit._CHK.map((chk, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-2.5 font-mono text-slate-400 text-center">{idx + 1}</td>
                            <td className="p-2.5 font-mono font-bold text-slate-700">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {chk.PermitType}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono font-bold text-[#006398]">{chk.QuestionnaireId}</td>
                            <td className="p-2.5 whitespace-nowrap">
                              {chk.Answer === 'YES' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <span className="material-symbols-outlined text-[12px]">check</span>
                                  YES (Compliant)
                                </span>
                              ) : chk.Answer === 'NO' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                  <span className="material-symbols-outlined text-[12px]">close</span>
                                  NO (Non-Compliant)
                                </span>
                              ) : chk.Answer === 'NA' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  N/A
                                </span>
                              ) : (
                                <span className="font-mono text-slate-500 font-bold">{chk.Answer || '—'}</span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-700">
                              {chk.Remarks || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: CREW & HAZARD CONTROLS (E & WORKERS) */}
          {/* ========================================================================= */}
          {activeTab === 'crew_hazards' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Crew Register */}
              <SectionCard
                theme="indigo"
                sectionTag="CREW"
                title="Authorized Crew Register (_Worker)"
                subtitle="Personnel roster authorized for work execution under this permit."
                icon="engineering"
                badge={
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selectedPermit._Worker?.length || 0} Crew Members
                  </span>
                }
              >
                {!selectedPermit._Worker || selectedPermit._Worker.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">No crew members registered.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[10px]">
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Emp ID</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Contractor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedPermit._Worker.map((w, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2.5 font-semibold text-slate-900">{w.WorkerName}</td>
                            <td className="p-2.5 font-mono text-slate-600">{w.EmpId || '—'}</td>
                            <td className="p-2.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                w.WorkerTypeCode === 'EMP' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {w.WorkerTypeCode === 'EMP' ? 'Company' : 'Contractor'}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-500">{w.ContractorName || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              {/* Hazard & Control Matrix */}
              <SectionCard
                theme="amber"
                sectionTag="HAZARDS"
                title="Hazard Controls & Precautions (_HazardControl)"
                subtitle="Identified task hazards and corresponding verified mitigations."
                icon="warning"
                badge={
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    {selectedPermit._HazardControl?.length || 0} Controls
                  </span>
                }
              >
                {!selectedPermit._HazardControl || selectedPermit._HazardControl.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">No hazards identified.</p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedPermit._HazardControl.map((h, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900">{h.HazardDesc}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            h.RiskLevel === 'HIGH' || h.RiskLevel === 'CRIT'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {h.RiskLevel || 'MED'} RISK
                          </span>
                        </div>
                        <p className="text-slate-600 font-sans leading-relaxed">
                          <strong className="text-slate-700">Mitigation Control:</strong> {h.ControlDesc}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: PPE MATRIX (G) */}
          {/* ========================================================================= */}
          {activeTab === 'ppe' && (
            <SectionCard
              theme="emerald"
              sectionTag="SECTION G"
              title="Personal Protective Equipment (PPE) Checklist"
              subtitle="Entity: _PPE · Safety gear and respiratory compliance."
              icon="health_and_safety"
              badge={
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {selectedPermit._PPE?.length || 0} PPE Items
                </span>
              }
            >
              {!selectedPermit._PPE || selectedPermit._PPE.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400">No PPE records registered.</p>
              ) : (
                <div className="space-y-3">
                  {/* Quick Toggle: All vs Required Only */}
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <button
                      type="button"
                      onClick={() => setPpeFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold ${
                        ppeFilter === 'ALL' ? 'bg-[#006398] text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      All PPE Items ({selectedPermit._PPE.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPpeFilter('REQ')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold ${
                        ppeFilter === 'REQ' ? 'bg-[#006398] text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Required Only ({selectedPermit._PPE.filter(p => p.IsRequired === 'Y' || p.IsRequired === 'X').length})
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {selectedPermit._PPE
                      .filter(ppe => ppeFilter === 'ALL' || ppe.IsRequired === 'Y' || ppe.IsRequired === 'X')
                      .map((ppe, i) => {
                        const isReq = ppe.IsRequired === 'Y' || ppe.IsRequired === 'X';
                        return (
                          <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start gap-2.5 shadow-xs">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isReq ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-500'
                            }`}>
                              <span className="material-symbols-outlined text-[17px]">
                                {isReq ? 'verified_user' : 'shield'}
                              </span>
                            </div>
                            <div className="flex-1 text-xs">
                              <h4 className="font-bold text-slate-800 leading-tight">{ppe.PpeDesc}</h4>
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-slate-500 flex-wrap">
                                <span className={`px-1.5 py-0.2 rounded font-bold ${isReq ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                  {isReq ? 'Required' : 'Optional'}
                                </span>
                                <span>·</span>
                                <span>Avail: {ppe.IsAvailable || 'Y'}</span>
                                <span>·</span>
                                <span>Issued: {ppe.IsIssued || 'Y'}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: POSITIVE ISOLATION & LOTO (H) */}
          {/* ========================================================================= */}
          {activeTab === 'isolation' && (
            <SectionCard
              theme="rose"
              sectionTag="SECTION H"
              title="Lockout / Tagout (LOTO) & Positive Isolation Evidence"
              subtitle={`Isolation Certificate: ${selectedPermit.IsolationNo || 'None Linked'} · Status: ${selectedPermit.IsolationStatus || 'INTD'}`}
              icon="lock"
              badge={
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-purple-50 text-purple-800 border border-purple-200">
                  {selectedPermit._Isolation?.reduce((count, certificate) => count + (certificate._Item?.length || 0), 0) || 0} Lock Points
                </span>
              }
            >
              {/* Summary Strip */}
              <div className="mb-3.5 p-3 rounded-xl bg-purple-50/60 border border-purple-200/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div>
                  <span className="text-purple-700 font-bold">Certificate: </span>
                  <span className="font-bold text-purple-950">{selectedPermit.IsolationNo || 'Direct PTW LOTO'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Req: <strong className="text-purple-900">{(selectedPermit.IsolationRequired === 'Y' || selectedPermit.IsolationRequired === 'X') ? 'YES' : 'NO'}</strong></span>
                  <span>·</span>
                  <span>Status: <strong className="text-purple-900">{selectedPermit.IsolationStatus || 'CRTD'}</strong></span>
                </div>
              </div>

              {!selectedPermit._Isolation || selectedPermit._Isolation.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400">
                  {(selectedPermit.IsolationRequired === 'Y' || selectedPermit.IsolationRequired === 'X')
                    ? 'Positive isolation required, but no isolation points recorded yet.'
                    : 'Isolation not required for this permit.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[10px]">
                        <th className="p-2.5">Item #</th>
                        <th className="p-2.5">Isolation Point / Tag</th>
                        <th className="p-2.5">Type / Method</th>
                        <th className="p-2.5">Lock / Tag #</th>
                        <th className="p-2.5">Isolated?</th>
                        <th className="p-2.5">Zero-Energy Confirmed?</th>
                        <th className="p-2.5">Normalized / Restored?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {selectedPermit._Isolation.flatMap(certificate => certificate._Item || []).map((iso, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-400">{iso.ItemNo || i + 1}</td>
                          <td className="p-2.5 font-semibold text-slate-900">{iso.IsolationPoint}</td>
                          <td className="p-2.5 font-mono text-slate-600">{iso.IsolType}</td>
                          <td className="p-2.5 font-mono font-bold text-slate-800">{iso.LockTagNo || '—'}</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              iso.IsIsolated === 'Y' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {iso.IsIsolated === 'Y' ? 'ISOLATED' : 'PENDING'}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              iso.ZeroEnergyConf === 'Y' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {iso.ZeroEnergyConf === 'Y' ? 'CONFIRMED' : 'NO'}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              iso.IsNormalized === 'Y' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {iso.IsNormalized === 'Y' ? 'RESTORED' : 'ACTIVE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: GAS TEST RECORDS (I) */}
          {/* ========================================================================= */}
          {activeTab === 'gastest' && (
            <SectionCard
              theme="amber"
              sectionTag="SECTION I"
              title="Atmospheric Gas Testing Register (Entity: GasTest)"
              subtitle={`Retest Interval: ${selectedPermit.GasTestFreqHr || 2} Hours · Gas Test Required: ${(selectedPermit.GasTestRequired === 'Y' || selectedPermit.GasTestRequired === 'X') ? 'YES (X)' : 'NO'}`}
              icon="science"
              badge={
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {selectedPermit._GasTest?.length || 0} Test Records
                </span>
              }
            >
              {!selectedPermit._GasTest || selectedPermit._GasTest.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400">No atmospheric gas tests recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {/* Latest Gas Readings Strip with Visual Threshold Meters */}
                  {(() => {
                    const latest = selectedPermit._GasTest[selectedPermit._GasTest.length - 1];
                    const o2Ok = latest.O2Pct >= 19.5 && latest.O2Pct <= 23.5;
                    const lelOk = latest.LelPct < 1.0;
                    const coOk = latest.CoVal < 25.0;
                    const h2sOk = latest.H2sVal < 10.0;
                    return (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] font-mono font-bold text-slate-600 uppercase">
                            Latest Atmospheric Reading (Seq #{latest.TestSeq} · Level {latest.SampleLevel || 'MID'})
                          </span>
                          <span className="font-mono text-slate-400 text-[11px]">
                            {latest.TestDate} at {latest.TestTime} (Tester: {latest.TestedBy || '—'})
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                          <div className={`p-3 rounded-xl border ${o2Ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                            <span className="text-[10px] font-mono block text-slate-500">O2 (Oxygen)</span>
                            <span className="text-xl font-bold font-mono">{latest.O2Pct}%</span>
                            <span className="block text-[10px] font-mono mt-0.5">{o2Ok ? 'NORMAL (19.5–23.5%)' : 'HAZARDOUS'}</span>
                          </div>

                          <div className={`p-3 rounded-xl border ${lelOk ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                            <span className="text-[10px] font-mono block text-slate-500">% LEL (Flammable)</span>
                            <span className="text-xl font-bold font-mono">{latest.LelPct}%</span>
                            <span className="block text-[10px] font-mono mt-0.5">{lelOk ? 'SAFE (< 1%)' : 'EXPLOSIVE RISK'}</span>
                          </div>

                          <div className={`p-3 rounded-xl border ${coOk ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                            <span className="text-[10px] font-mono block text-slate-500">CO (Carbon Monoxide)</span>
                            <span className="text-xl font-bold font-mono">{latest.CoVal} ppm</span>
                            <span className="block text-[10px] font-mono mt-0.5">{coOk ? 'SAFE (< 25 ppm)' : 'TOXIC DANGER'}</span>
                          </div>

                          <div className={`p-3 rounded-xl border ${h2sOk ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                            <span className="text-[10px] font-mono block text-slate-500">H2S (Hydrogen Sulfide)</span>
                            <span className="text-xl font-bold font-mono">{latest.H2sVal} ppm</span>
                            <span className="block text-[10px] font-mono mt-0.5">{h2sOk ? 'SAFE (< 10 ppm)' : 'DEADLY POISON'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Gas Log Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[10px]">
                          <th className="p-2.5">Seq #</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Date & Time</th>
                          <th className="p-2.5">Sample Level</th>
                          <th className="p-2.5">O2 %</th>
                          <th className="p-2.5">LEL %</th>
                          <th className="p-2.5">CO</th>
                          <th className="p-2.5">H2S</th>
                          <th className="p-2.5">Meter ID</th>
                          <th className="p-2.5">Tester</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {selectedPermit._GasTest.map((g, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-bold text-slate-800">{g.TestSeq}</td>
                            <td className="p-2.5 font-mono text-[11px]">{g.TestType || 'INIT'}</td>
                            <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">{g.TestDate} {g.TestTime}</td>
                            <td className="p-2.5 font-mono font-semibold">{g.SampleLevel || 'MID'}</td>
                            <td className="p-2.5 font-mono font-bold text-slate-800">{g.O2Pct}%</td>
                            <td className="p-2.5 font-mono font-bold text-slate-800">{g.LelPct}%</td>
                            <td className="p-2.5 font-mono font-bold text-slate-800">{g.CoVal} ppm</td>
                            <td className="p-2.5 font-mono font-bold text-slate-800">{g.H2sVal} ppm</td>
                            <td className="p-2.5 font-mono text-slate-500">{g.MeterId || '—'}</td>
                            <td className="p-2.5 font-semibold text-slate-700">{g.TestedBy || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: SIGNATURES & MULTI-TIER APPROVALS (J-M) */}
          {/* ========================================================================= */}
          {activeTab === 'approvals' && (
            <SectionCard
              theme="blue"
              sectionTag="SECTION J–M"
              title="Digital Approvals, Clearances & Signatures Chain"
              subtitle="Entity: _Approval · Multi-tier role authorization sequence."
              icon="draw"
              badge={
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-50 text-[#006398] border border-blue-200">
                  {selectedPermit._Approval?.length || 0} Signatures
                </span>
              }
            >
              {/* Visual Approval Stepper Pipeline */}
              <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-3">
                  Multi-Tier Authorization Sequence
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[
                    { step: 1, title: 'Permit Request', role: 'Requester', defaultName: selectedPermit.PersonResp || selectedPermit.Ernam },
                    { step: 2, title: 'Isolation Clearance', role: 'Area Owner', defaultName: selectedPermit.VerifiedBy || 'Pending' },
                    { step: 3, title: 'Safety & Gas Test', role: 'Safety Officer', defaultName: selectedPermit.SafetyOfficer || 'Pending' },
                    { step: 4, title: 'Issue Authorization', role: 'Shift In-Charge', defaultName: selectedPermit.ApprovedBy || 'Pending' }
                  ].map(s => {
                    const match = selectedPermit._Approval?.find(a => a.SeqNo === String(s.step) || (a.Stage && a.Stage.includes(String(s.step))));
                    const isSigned = !!match || (s.step === 1 && !!selectedPermit.PersonResp);
                    return (
                      <div
                        key={s.step}
                        className={`p-3 rounded-xl border transition-all ${
                          isSigned
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 shadow-xs'
                            : 'bg-white border-slate-200/80 text-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono font-bold uppercase">
                            Step {s.step} · {s.role}
                          </span>
                          <span className={`material-symbols-outlined text-[16px] ${isSigned ? 'text-emerald-600' : 'text-slate-300'}`}>
                            {isSigned ? 'verified' : 'radio_button_unchecked'}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900">{s.title}</h4>
                        <p className="mt-1 font-mono text-[11px] truncate text-slate-600">
                          {match ? match.SignedBy : s.defaultName || 'Awaiting'}
                        </p>
                        {match && (
                          <span className="block font-mono text-[10px] text-emerald-700 mt-0.5">
                            {match.ActionDate} {match.ActionTime}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {!selectedPermit._Approval || selectedPermit._Approval.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400">No authorization signatures logged yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[10px]">
                        <th className="p-2.5">Stage</th>
                        <th className="p-2.5">Seq #</th>
                        <th className="p-2.5">Role ID</th>
                        <th className="p-2.5">Action</th>
                        <th className="p-2.5">Signed By (SAP User)</th>
                        <th className="p-2.5">Timestamp</th>
                        <th className="p-2.5">Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {selectedPermit._Approval.map((app, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-800">{app.Stage || 'Stage ' + (i + 1)}</td>
                          <td className="p-2.5 font-mono text-slate-400">{app.SeqNo}</td>
                          <td className="p-2.5 font-mono font-semibold text-slate-700">{app.RoleId}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {app.Action || 'APPROVED'}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{app.SignedBy}</td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {app.ActionDate} {app.ActionTime}
                          </td>
                          <td className="p-2.5 text-slate-600 max-w-xs">{app.Comments || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* ========================================================================= */}
          {/* TAB 8: SHIFT RENEWALS & AUDIT LOG (N) */}
          {/* ========================================================================= */}
          {activeTab === 'renewals_audit' && (
            <div className="space-y-4">
              {/* Shift Renewals */}
              <SectionCard
                theme="indigo"
                sectionTag="SECTION N.1"
                title="Shift Revalidations & Renewals (_ShiftRenewal)"
                subtitle="Formal shift handover and validity extension records."
                icon="update"
                badge={
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selectedPermit._ShiftRenewal?.length || 0} Records
                  </span>
                }
              >
                {!selectedPermit._ShiftRenewal || selectedPermit._ShiftRenewal.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">No shift renewals recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[10px]">
                          <th className="p-2.5">Prev Shift</th>
                          <th className="p-2.5">New Shift</th>
                          <th className="p-2.5">Extended End (IST)</th>
                          <th className="p-2.5">Requested By</th>
                          <th className="p-2.5">Approved By</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedPermit._ShiftRenewal.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono">{r.PreviousShift}</td>
                            <td className="p-2.5 font-mono font-bold text-slate-800">{r.NewShift}</td>
                            <td className="p-2.5 font-mono text-slate-700">{r.NewValidToD} {r.NewValidToT}</td>
                            <td className="p-2.5 font-mono">{r.RequestedBy}</td>
                            <td className="p-2.5 font-mono">{r.ApprovedBy}</td>
                            <td className="p-2.5 font-bold text-emerald-700">{r.Status}</td>
                            <td className="p-2.5 text-slate-600">{r.Reason || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              {/* Full Audit Trail */}
              <SectionCard
                theme="slate"
                sectionTag="SECTION N.2"
                title="Lifecycle Event Audit Trail (_AuditLog)"
                subtitle="Complete chronological timeline of SAP state changes and transitions."
                icon="history"
                badge={
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {selectedPermit._AuditLog?.length || 0} Events
                  </span>
                }
              >
                {!selectedPermit._AuditLog || selectedPermit._AuditLog.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">No audit log records found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[10px]">
                          <th className="p-2.5">Action</th>
                          <th className="p-2.5">Transition</th>
                          <th className="p-2.5">Actor (SAP User)</th>
                          <th className="p-2.5">Event Timestamp</th>
                          <th className="p-2.5">Reason / Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedPermit._AuditLog.map((log, i) => (
                          <tr key={i} className="hover:bg-slate-50 font-mono">
                            <td className="p-2.5 font-bold text-slate-800">{log.Action}</td>
                            <td className="p-2.5 text-slate-600">
                              <span>{log.OldStatus || 'INIT'}</span>
                              <span className="mx-1 text-slate-400">→</span>
                              <span className="font-bold text-slate-900">{log.NewStatus}</span>
                            </td>
                            <td className="p-2.5 text-indigo-700 font-bold">{log.Actor}</td>
                            <td className="p-2.5 text-slate-500 whitespace-nowrap">{log.EventAt}</td>
                            <td className="p-2.5 font-sans text-slate-600">{log.Comments || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          </div>

          {/* ========================================================================= */}
          {/* 4. PRINTABLE OFFICIAL PTW CERTIFICATE & PREVIEW MODAL */}
          {/* ========================================================================= */}
          <PermitPrintModal
            isOpen={showPrintModal}
            onClose={() => setShowPrintModal(false)}
            permit={selectedPermit}
          />

          {!showPrintModal && (
            <div className="print-only">
              <PermitAnnexPrintView permit={selectedPermit} includeReverseSide={false} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
