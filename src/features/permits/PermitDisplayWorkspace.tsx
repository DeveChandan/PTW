import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { SapUser } from '../../core/auth/sapAuthContext';
import type { PermitDeepInsertResponse, PermitInfoRecord } from '../../core/types/ptw.types';
import { sitePermitApi } from '../../core/api/modules/sitePermit.api';
import { PERMIT_CATEGORIES, PROCEDURE } from '../../core/ptw/siteProcedure';
import { PrerequisitePanel } from './PrerequisitePanel';

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

  // Search & Filtering State
  const [plant, setPlant] = useState<string>(user?.plant || '1000');
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [quickLookupNo, setQuickLookupNo] = useState<string>(initialPermitNo || '');

  // Data State
  const [permits, setPermits] = useState<PermitInfoRecord[]>([]);
  const [selectedPermit, setSelectedPermit] = useState<PermitDeepInsertResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [offset, setOffset] = useState<number>(0);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [updatingPrereq, setUpdatingPrereq] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load Permit List from SAP OData V4
  const loadPermitList = async (skip = 0) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError('');
    try {
      const data = await sitePermitApi.list(plant, search, skip, controller.signal, categoryFilter, statusFilter);
      if (!controller.signal.aborted) {
        setPermits(data);
        setOffset(skip);
        setHasSearched(true);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to retrieve permits from SAP Gateway.');
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
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : `Unable to load details for permit ${permitNo}.`);
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
    }
  };

  // Print PTW handler
  const handlePrint = () => {
    window.print();
  };

  // KPI Calculations
  const kpiStats = useMemo(() => {
    const total = permits.length;
    const active = permits.filter(p => p.Status === 'ISSU' || p.Status === 'ACTV').length;
    const pending = permits.filter(p => p.Status === 'INTD' || p.Status === 'CRTD' || p.Status === 'APPR').length;
    const closed = permits.filter(p => p.Status === 'CLOS' || p.Status === 'CANC').length;
    const hotOrConf = permits.filter(p => p.PermitType === 'HOT' || p.PermitType === 'CONF' || p.PermitType === 'CSE').length;
    return { total, active, pending, closed, hotOrConf };
  }, [permits]);

  // Helper: Status Badges
  const renderStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'ISSU':
      case 'ACTV':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            ISSUED & ACTIVE
          </span>
        );
      case 'APPR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-amber-100 text-amber-800 border border-amber-300">
            <span className="material-symbols-outlined text-[14px]">verified</span>
            APPROVED
          </span>
        );
      case 'INTD':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-indigo-100 text-indigo-800 border border-indigo-300">
            <span className="material-symbols-outlined text-[14px]">pending_actions</span>
            INTENDED (PREREQ)
          </span>
        );
      case 'CRTD':
      case 'DRAF':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-slate-100 text-slate-700 border border-slate-300">
            <span className="material-symbols-outlined text-[14px]">edit_document</span>
            DRAFT / CREATED
          </span>
        );
      case 'CLOS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-blue-100 text-blue-800 border border-blue-300">
            <span className="material-symbols-outlined text-[14px]">task_alt</span>
            CLOSED / RESTORED
          </span>
        );
      case 'SUSP':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-rose-100 text-rose-800 border border-rose-300">
            <span className="material-symbols-outlined text-[14px]">pause_circle</span>
            SUSPENDED
          </span>
        );
      case 'CANC':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-gray-100 text-gray-700 border border-gray-300">
            <span className="material-symbols-outlined text-[14px]">cancel</span>
            CANCELLED
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
    if (!validFromD || !validToD) return { status: 'UNKNOWN', text: 'No dates set', percent: 0, color: 'text-slate-500' };
    const now = Date.now();
    const start = new Date(`${validFromD}T${validFromT || '00:00:00'}+05:30`).getTime();
    const end = new Date(`${validToD}T${validToT || '23:59:59'}+05:30`).getTime();

    if (isNaN(start) || isNaN(end)) return { status: 'INVALID', text: 'Invalid time format', percent: 0, color: 'text-slate-500' };

    if (now < start) {
      const hrsUntil = Math.max(0, Math.round((start - now) / 3600000));
      return { status: 'UPCOMING', text: `Starts in ~${hrsUntil}h`, percent: 0, color: 'text-sky-600' };
    }
    if (now > end) {
      return { status: 'EXPIRED', text: 'Validity Ended', percent: 100, color: 'text-rose-600' };
    }
    const total = end - start;
    const elapsed = now - start;
    const percent = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    const remainingHrs = Math.max(0, ((end - now) / 3600000)).toFixed(1);
    return {
      status: 'ACTIVE',
      text: `${remainingHrs}h remaining (${percent}%)`,
      percent,
      color: percent > 85 ? 'text-amber-600' : 'text-emerald-600'
    };
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP APPLICATION BREADCRUMB & HEADER (Screen View Only) */}
      {/* ========================================================================= */}
      <header className="no-print mb-6 border-b border-slate-200 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2 text-xs">
              <button
                type="button"
                onClick={viewMode === 'detail' && !initialPermitNo ? () => setViewMode('list') : onBack}
                className="group inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-xs transition-all hover:border-[#006398] hover:bg-sky-50/50 hover:text-[#006398]"
              >
                <span className="material-symbols-outlined text-[16px] transition-transform group-hover:-translate-x-0.5">
                  arrow_back
                </span>
                <span>{viewMode === 'detail' && !initialPermitNo ? 'Back to Permit List' : 'Return to Launchpad'}</span>
              </button>
              <span className="text-slate-300">/</span>
              <span className="text-slate-500 font-mono">PTW Suite</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-[#006398] font-mono">Permit Display & Dossier</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[#006398]/10 text-[#006398]">
                <span className="material-symbols-outlined text-[24px]">description</span>
              </span>
              <span>Permit Display Screen</span>
            </h1>
            <p className="mt-1 text-xs text-slate-500 font-mono">
              Digital Dossier · SAP OData V4 Deep Inspection · Procedure {PROCEDURE.id} Rev {PROCEDURE.revision}
            </p>
          </div>

          {/* Quick Lookup Bar */}
          <form onSubmit={handleQuickLookup} className="flex items-center gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">
                search
              </span>
              <input
                type="text"
                value={quickLookupNo}
                onChange={e => setQuickLookupNo(e.target.value.toUpperCase())}
                placeholder="Enter Permit # (e.g. PTW0000013)"
                className="w-56 pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006398] shadow-xs"
              />
            </div>
            <button
              type="submit"
              disabled={loadingDetail || !quickLookupNo.trim()}
              className="px-3.5 py-2 bg-[#006398] hover:bg-[#004e78] text-white rounded-xl text-xs font-semibold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {loadingDetail ? (
                <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">visibility</span>
              )}
              <span>View</span>
            </button>
          </form>
        </div>
      </header>

      {/* Global Error Banner */}
      {error && (
        <div role="alert" className="no-print mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 shadow-xs">
          <span className="material-symbols-outlined text-[20px] text-rose-600 shrink-0">error</span>
          <div className="flex-1">
            <h4 className="font-bold text-xs uppercase tracking-wider mb-0.5">SAP Gateway Notice</h4>
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MODE: PERMIT DIRECTORY / LIST VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          {/* KPI Dashboard Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Total Permits
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-slate-900">{kpiStats.total}</span>
                <span className="material-symbols-outlined text-[20px] text-slate-400">inventory_2</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
              <span className="text-[11px] font-mono font-bold text-emerald-700 uppercase tracking-wider block mb-1">
                Active In-Field
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-emerald-800">{kpiStats.active}</span>
                <span className="material-symbols-outlined text-[20px] text-emerald-600 animate-pulse">radio_button_checked</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs">
              <span className="text-[11px] font-mono font-bold text-indigo-700 uppercase tracking-wider block mb-1">
                Intended / Prereq
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-indigo-800">{kpiStats.pending}</span>
                <span className="material-symbols-outlined text-[20px] text-indigo-600">hourglass_top</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
              <span className="text-[11px] font-mono font-bold text-amber-700 uppercase tracking-wider block mb-1">
                Hot / Confined
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-amber-800">{kpiStats.hotOrConf}</span>
                <span className="material-symbols-outlined text-[20px] text-amber-600">local_fire_department</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs">
              <span className="text-[11px] font-mono font-bold text-blue-700 uppercase tracking-wider block mb-1">
                Closed / Restored
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-blue-800">{kpiStats.closed}</span>
                <span className="material-symbols-outlined text-[20px] text-blue-600">check_circle</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <span className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#006398]">filter_list</span>
                Search & Live Filters
              </span>
              <button
                type="button"
                onClick={() => void loadPermitList(0)}
                disabled={loading}
                className="text-xs text-[#006398] hover:text-[#004e78] font-semibold flex items-center gap-1 disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
                <span>Refresh SAP List</span>
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                void loadPermitList(0);
              }}
              className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
            >
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Plant (Werks)</label>
                <input
                  type="text"
                  value={plant}
                  maxLength={4}
                  onChange={e => setPlant(e.target.value.toUpperCase())}
                  placeholder="e.g. 1000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:outline-none focus:border-[#006398]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-semibold mb-1">Permit Number or Scope / Description</label>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by permit #, job scope, equipment..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-sans text-xs focus:bg-white focus:outline-none focus:border-[#006398]"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-[#006398] hover:bg-[#004e78] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">search</span>
                  )}
                  <span>Search SAP</span>
                </button>
              </div>
            </form>

            {/* Category and Status Filter Chips */}
            <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-100">
              <span className="text-[11px] font-mono text-slate-400 mr-1">Category:</span>
              {['ALL', 'HOT', 'COLD', 'CONF', 'HGHT', 'ELEC'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(cat);
                    // trigger refresh
                    setTimeout(() => void loadPermitList(0), 10);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all ${
                    categoryFilter === cat
                      ? 'bg-[#006398] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}

              <div className="h-4 w-[1px] bg-slate-200 mx-2" />

              <span className="text-[11px] font-mono text-slate-400 mr-1">Status:</span>
              {['ALL', 'ISSU', 'INTD', 'APPR', 'CRTD', 'CLOS'].map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st);
                    setTimeout(() => void loadPermitList(0), 10);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all ${
                    statusFilter === st
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Permits Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-slate-700 uppercase tracking-wide">
                  SAP Permit Register
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#006398]/10 text-[#006398]">
                  {permits.length} Records
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Sorted: Erdat desc, Erzet desc
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin text-[28px] text-[#006398]">
                  progress_activity
                </span>
                <span>Fetching live PTW records from SAP Gateway...</span>
              </div>
            ) : permits.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <span className="material-symbols-outlined text-[36px] text-slate-300 block mb-2">
                  search_off
                </span>
                <p className="font-semibold text-slate-600">No permits found</p>
                <p className="mt-1">
                  {hasSearched
                    ? 'No matching SAP permits for the selected filters. Try broadening your search.'
                    : 'Search to load active permits from SAP.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-mono text-[11px]">
                      <th className="p-3.5">Permit #</th>
                      <th className="p-3.5">Type</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Job Description & Reference</th>
                      <th className="p-3.5">Location / Plant</th>
                      <th className="p-3.5">Validity Window (IST)</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {permits.map(item => {
                      const catInfo = getCategoryInfo(item.PermitType);
                      const validity = calculateValidity(item.ValidFromD, item.ValidFromT, item.ValidToD, item.ValidToT);
                      return (
                        <tr key={item.Permit_No} className="hover:bg-sky-50/40 transition-colors group">
                          {/* Permit No */}
                          <td className="p-3.5">
                            <button
                              type="button"
                              onClick={() => void loadPermitDetail(item.Permit_No)}
                              className="font-mono font-bold text-xs text-[#006398] hover:text-[#004e78] hover:underline flex items-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                              <span>{item.Permit_No}</span>
                            </button>
                            <span className="block font-mono text-[10px] text-slate-400 mt-0.5">
                              Rev: {item.FormRev || '0'} · RevID: {item.Revision || '—'}
                            </span>
                          </td>

                          {/* Category */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-slate-500">
                                {catInfo.icon}
                              </span>
                              <div>
                                <span className="font-bold text-slate-800 block">{catInfo.label}</span>
                                <span className="font-mono text-[10px] text-slate-400">{catInfo.code}</span>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="p-3.5 whitespace-nowrap">
                            {renderStatusBadge(item.Status)}
                          </td>

                          {/* Job & MO/Notification */}
                          <td className="p-3.5 max-w-xs">
                            <p className="font-semibold text-slate-900 line-clamp-1">{item.JobDesc || 'No description'}</p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-slate-500">
                              {item.Aufnr && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  MO: {item.Aufnr}
                                </span>
                              )}
                              {item.Qmnum && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  Notif: {item.Qmnum}
                                </span>
                              )}
                              {item.Equnr && (
                                <span className="text-slate-400">Equip: {item.Equnr}</span>
                              )}
                            </div>
                          </td>

                          {/* Location */}
                          <td className="p-3.5">
                            <span className="font-mono font-bold text-slate-800">
                              {item.Werks || '—'}
                            </span>
                            <span className="text-slate-400"> / </span>
                            <span className="text-slate-700">{item.AreaLoc || 'Area not recorded'}</span>
                            {item.Arbpl && (
                              <span className="block text-[10px] font-mono text-slate-400">WC: {item.Arbpl}</span>
                            )}
                          </td>

                          {/* Validity Window */}
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="text-[11px] font-mono text-slate-700">
                              <span>{item.ValidFromD} {item.ValidFromT?.slice(0, 5)}</span>
                              <span className="text-slate-400 mx-1">→</span>
                              <span>{item.ValidToD} {item.ValidToT?.slice(0, 5)}</span>
                            </div>
                            <span className={`block text-[10px] font-mono font-bold mt-0.5 ${validity.color}`}>
                              {validity.text}
                            </span>
                          </td>

                          {/* Action Button */}
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => void loadPermitDetail(item.Permit_No)}
                              className="px-3 py-1.5 bg-[#006398] hover:bg-[#004e78] text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-1 ml-auto"
                            >
                              <span>Display Dossier</span>
                              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {hasSearched && permits.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono">
                  Showing offset {offset} (Page {Math.floor(offset / 25) + 1})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={offset === 0 || loading}
                    onClick={() => void loadPermitList(Math.max(0, offset - 25))}
                    className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={permits.length < 25 || loading}
                    onClick={() => void loadPermitList(offset + 25)}
                    className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
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
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#006398] to-[#004266] text-white flex items-center justify-center shadow-md shrink-0">
                  <span className="material-symbols-outlined text-[32px]">
                    {getCategoryInfo(selectedPermit.PermitType).icon}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-bold font-mono text-slate-900">
                      Permit {selectedPermit.Permit_No}
                    </h2>
                    {renderStatusBadge(selectedPermit.Status)}
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#006398]/10 text-[#006398] border border-[#006398]/20">
                      {getCategoryInfo(selectedPermit.PermitType).label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-700 max-w-3xl leading-snug">
                    {selectedPermit.JobDesc}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs font-mono text-slate-500 flex-wrap">
                    <span>Plant: <strong className="text-slate-700">{selectedPermit.Werks}</strong></span>
                    <span>·</span>
                    <span>Area: <strong className="text-slate-700">{selectedPermit.AreaLoc || 'Not specified'}</strong></span>
                    <span>·</span>
                    <span>Dept: <strong className="text-slate-700">{selectedPermit.ExecDept || '—'}</strong></span>
                    <span>·</span>
                    <span>Agency: <strong className="text-slate-700">{selectedPermit.ExecAgency === 'CONT' ? 'Contractor' : 'Company (EMP)'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="no-print flex items-center gap-2.5 shrink-0 self-start lg:self-center">
                {updatingPrereq && (
                  <span className="text-[11px] font-mono text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5 animate-pulse">
                    <span className="material-symbols-outlined text-[14px]">sync</span>
                    <span>Syncing with SAP...</span>
                  </span>
                )}
                <button
                  type="button"
                  disabled={updatingPrereq}
                  onClick={handlePrint}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>Print Dossier / PTW</span>
                </button>

                <button
                  type="button"
                  disabled={loadingDetail || updatingPrereq}
                  onClick={() => void loadPermitDetail(selectedPermit.Permit_No)}
                  className="px-4 py-2 border border-slate-300 hover:border-[#006398] hover:text-[#006398] bg-white text-slate-700 rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[16px] ${loadingDetail ? 'animate-spin' : ''}`}>
                    refresh
                  </span>
                  <span>Reload SAP</span>
                </button>
              </div>
            </div>

            {/* Validity Gauge & Progress Bar */}
            <div className="mt-5 pt-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                  Validity Window (IST)
                </span>
                <div className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#006398]">schedule</span>
                  <span>{selectedPermit.ValidFromD} {selectedPermit.ValidFromT?.slice(0, 5)}</span>
                  <span className="text-slate-400">→</span>
                  <span>{selectedPermit.ValidToD} {selectedPermit.ValidToT?.slice(0, 5)}</span>
                </div>
                {(() => {
                  const val = calculateValidity(selectedPermit.ValidFromD, selectedPermit.ValidFromT, selectedPermit.ValidToD, selectedPermit.ValidToT);
                  return (
                    <div className="mt-2">
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            val.percent > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${val.percent}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-mono font-bold mt-1 block ${val.color}`}>
                        {val.text}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                  Maintenance Order / Reference
                </span>
                <div className="text-xs font-mono font-bold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-indigo-600">construction</span>
                  <span>{selectedPermit.Aufnr ? `MO #${selectedPermit.Aufnr}` : selectedPermit.Qmnum ? `Notif #${selectedPermit.Qmnum}` : 'Direct PTW Request'}</span>
                  {selectedPermit.Auart && (
                    <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded text-[10px]">
                      {selectedPermit.Auart}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 font-mono">
                  Equip: {selectedPermit.Equnr || '—'} · FuncLoc: {selectedPermit.Tplnr || '—'}
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                  Safety Prerequisite Indicators
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    selectedPermit.GasTestRequired === 'Y'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    Gas Test: {selectedPermit.GasTestRequired === 'Y' ? `REQ (${selectedPermit.GasTestFreqHr || 2}h)` : 'NOT REQ'}
                  </span>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    (selectedPermit.IsolationRequired === 'Y' || selectedPermit.IsolationRequired === 'X')
                      ? 'bg-purple-50 text-purple-800 border-purple-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    LOTO: {(selectedPermit.IsolationRequired === 'Y' || selectedPermit.IsolationRequired === 'X') ? 'REQ (POSITIVE)' : 'NOT REQ'}
                  </span>

                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    Crew: {selectedPermit.PersonsQty || selectedPermit._Worker?.length || 0} Pax
                  </span>
                </div>
              </div>
            </div>

            {/* Embedded Prerequisite Actions Panel (Direct signoff / verification) */}
            <div className="mt-5 pt-4 border-t border-slate-100">
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
          </div>

          {/* Dossier Tabs Navigation */}
          <div className="no-print flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2">
            {[
              { id: 'overview', label: '1. Plant & General', icon: 'info' },
              { id: 'procedure', label: '2. Procedure & JSA (C–F)', icon: 'fact_check', badge: selectedPermit._Safety?.length },
              { id: 'crew_hazards', label: '3. Crew & Hazards (E)', icon: 'group', badge: selectedPermit._Worker?.length },
              { id: 'ppe', label: '4. PPE & Safety Gear (G)', icon: 'health_and_safety', badge: selectedPermit._PPE?.length },
              { id: 'isolation', label: '5. Isolation & LOTO (H)', icon: 'lock', badge: selectedPermit._Isolation?.length },
              { id: 'gastest', label: '6. Gas Tests (I)', icon: 'science', badge: selectedPermit._GasTest?.length },
              { id: 'approvals', label: '7. Signatures (J–M)', icon: 'draw', badge: selectedPermit._Approval?.length },
              { id: 'renewals_audit', label: '8. Renewals & Audit (N)', icon: 'history', badge: selectedPermit._AuditLog?.length },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 shadow-xs ${
                  activeTab === tab.id
                    ? 'bg-[#006398] text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW & PLANT CONTEXT */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Plant & Equipment Context */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#006398]">factory</span>
                  <span>Plant, Equipment & Location Context</span>
                </h3>
                <dl className="grid grid-cols-2 gap-3.5 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">Plant (Werks)</dt>
                    <dd className="font-bold text-slate-800 mt-0.5">{selectedPermit.Werks || '—'}</dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">Work Area (AreaLoc)</dt>
                    <dd className="font-bold text-slate-800 mt-0.5">{selectedPermit.AreaLoc || '—'}</dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">Equipment No (Equnr)</dt>
                    <dd className="font-mono font-bold text-slate-800 mt-0.5">{selectedPermit.Equnr || 'Not linked'}</dd>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">Functional Location (Tplnr)</dt>
                    <dd className="font-mono font-bold text-slate-800 mt-0.5">{selectedPermit.Tplnr || '—'}</dd>
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
              </div>

              {/* Supervision, Department & Comments */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#006398]">badge</span>
                  <span>Execution, Agency & Responsibility</span>
                </h3>
                <dl className="grid grid-cols-2 gap-3.5 text-xs">
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
                    <dd className="font-mono text-slate-800 mt-0.5">{selectedPermit.SupvPhone || '—'}</dd>
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
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: PROCEDURE & JSA SAFETY PREPARATIONS (C-F) */}
          {/* ========================================================================= */}
          {activeTab === 'procedure' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">
                    Safety Preparations, JSA & Statutory Checks
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Procedure {PROCEDURE.id} · Forms & Items Record (Entity: _Safety)
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-sky-50 text-sky-800 border border-sky-200">
                  {selectedPermit._Safety?.length || 0} Check Items
                </span>
              </div>

              {!selectedPermit._Safety || selectedPermit._Safety.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400">No safety check records recorded in this permit.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[11px]">
                        <th className="p-3 w-16">Item #</th>
                        <th className="p-3 w-28">Code</th>
                        <th className="p-3">Safety Requirement / Description</th>
                        <th className="p-3 w-32">Response</th>
                        <th className="p-3">Details / Reference / Reason</th>
                        <th className="p-3 w-36">Verified By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {selectedPermit._Safety.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="p-3 font-mono text-slate-400">{row.ItemNo || idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-slate-700">{row.ItemCode}</td>
                          <td className="p-3 font-semibold text-slate-900">{row.ValueText || row.ItemCode}</td>
                          <td className="p-3 whitespace-nowrap">
                            {row.Response === 'YES' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <span className="material-symbols-outlined text-[12px]">check</span>
                                YES (Complete)
                              </span>
                            ) : row.Response === 'NO' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
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
                          <td className="p-3 text-slate-700">
                            {row.Remarks || row.ReferenceNo || '—'}
                          </td>
                          <td className="p-3 font-mono text-slate-500 text-[11px]">
                            {row.VerifiedBy || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: CREW & HAZARD CONTROLS (E & WORKERS) */}
          {/* ========================================================================= */}
          {activeTab === 'crew_hazards' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Crew Register */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#006398]">engineering</span>
                    <span>Authorized Crew Register (_Worker)</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                    {selectedPermit._Worker?.length || 0} Crew Members
                  </span>
                </div>

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
              </div>

              {/* Hazard & Control Matrix */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-amber-600">warning</span>
                    <span>Hazard Controls & Precautions (_HazardControl)</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    {selectedPermit._HazardControl?.length || 0} Controls
                  </span>
                </div>

                {!selectedPermit._HazardControl || selectedPermit._HazardControl.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">No hazards identified.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedPermit._HazardControl.map((h, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
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
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: PPE MATRIX (G) */}
          {/* ========================================================================= */}
          {activeTab === 'ppe' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-teal-600">health_and_safety</span>
                  <span>Personal Protective Equipment (PPE) Checklist</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">Entity: _PPE</span>
              </div>

              {!selectedPermit._PPE || selectedPermit._PPE.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400">No PPE records registered.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {selectedPermit._PPE.map((ppe, i) => (
                    <div key={i} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">verified_user</span>
                      </div>
                      <div className="flex-1 text-xs">
                        <h4 className="font-bold text-slate-800">{ppe.PpeDesc}</h4>
                        <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-slate-500">
                          <span>Req: <strong className="text-slate-700">{ppe.IsRequired || 'Y'}</strong></span>
                          <span>·</span>
                          <span>Avail: <strong className="text-slate-700">{ppe.IsAvailable || 'Y'}</strong></span>
                          <span>·</span>
                          <span>Issued: <strong className="text-slate-700">{ppe.IsIssued || 'Y'}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: POSITIVE ISOLATION & LOTO (H) */}
          {/* ========================================================================= */}
          {activeTab === 'isolation' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-purple-600">lock</span>
                    <span>Lockout / Tagout (LOTO) & Positive Isolation Evidence</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Isolation Certificate: <strong>{selectedPermit.IsolationNo || 'None Linked'}</strong> · Status: {selectedPermit.IsolationStatus || 'INTD'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-purple-50 text-purple-800 border border-purple-200">
                  {selectedPermit._Isolation?.length || 0} Lock Points
                </span>
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
                        <th className="p-3">Item #</th>
                        <th className="p-3">Isolation Point / Tag</th>
                        <th className="p-3">Type / Method</th>
                        <th className="p-3">Lock / Tag #</th>
                        <th className="p-3">Isolated?</th>
                        <th className="p-3">Zero-Energy Confirmed?</th>
                        <th className="p-3">Normalized / Restored?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {selectedPermit._Isolation.map((iso, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-slate-400">{iso.ItemNo || i + 1}</td>
                          <td className="p-3 font-semibold text-slate-900">{iso.IsolationPoint}</td>
                          <td className="p-3 font-mono text-slate-600">{iso.IsolType}</td>
                          <td className="p-3 font-mono font-bold text-slate-800">{iso.LockTagNo || '—'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              iso.IsIsolated === 'Y' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {iso.IsIsolated === 'Y' ? 'ISOLATED' : 'PENDING'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              iso.ZeroEnergyConf === 'Y' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {iso.ZeroEnergyConf === 'Y' ? 'CONFIRMED' : 'NO'}
                            </span>
                          </td>
                          <td className="p-3">
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
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: GAS TEST RECORDS (I) */}
          {/* ========================================================================= */}
          {activeTab === 'gastest' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-amber-600">science</span>
                    <span>Atmospheric Gas Testing Register (Entity: _GasTest)</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Retest Interval: <strong>{selectedPermit.GasTestFreqHr || 2} Hours</strong> · Gas Test Required: {selectedPermit.GasTestRequired || 'N'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {selectedPermit._GasTest?.length || 0} Test Records
                </span>
              </div>

              {!selectedPermit._GasTest || selectedPermit._GasTest.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400">No atmospheric gas tests recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {/* Latest Gas Readings Strip */}
                  {(() => {
                    const latest = selectedPermit._GasTest[selectedPermit._GasTest.length - 1];
                    const o2Ok = latest.O2Pct >= 19.5 && latest.O2Pct <= 23.5;
                    const lelOk = latest.LelPct < 1.0;
                    const coOk = latest.CoVal < 25.0;
                    const h2sOk = latest.H2sVal < 10.0;
                    return (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="text-[11px] font-mono font-bold text-slate-600 uppercase">
                          Latest Atmospheric Reading (Seq #{latest.TestSeq} · Level {latest.SampleLevel || 'MID'})
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                          <div className={`p-3 rounded-xl border ${o2Ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                            <span className="text-[10px] font-mono block text-slate-500">O2 (Oxygen)</span>
                            <span className="text-xl font-bold font-mono">{latest.O2Pct}%</span>
                            <span className="block text-[10px] font-mono mt-0.5">{o2Ok ? 'NORMAL (19.5-23.5%)' : 'HAZARDOUS'}</span>
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
                          <th className="p-3">Seq #</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Date & Time</th>
                          <th className="p-3">Sample Level</th>
                          <th className="p-3">O2 %</th>
                          <th className="p-3">LEL %</th>
                          <th className="p-3">CO</th>
                          <th className="p-3">H2S</th>
                          <th className="p-3">Meter ID</th>
                          <th className="p-3">Tester</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {selectedPermit._GasTest.map((g, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-3 font-mono font-bold text-slate-800">{g.TestSeq}</td>
                            <td className="p-3 font-mono text-[11px]">{g.TestType || 'INIT'}</td>
                            <td className="p-3 font-mono text-[11px] whitespace-nowrap">{g.TestDate} {g.TestTime}</td>
                            <td className="p-3 font-mono font-semibold">{g.SampleLevel || 'MID'}</td>
                            <td className="p-3 font-mono font-bold text-slate-800">{g.O2Pct}%</td>
                            <td className="p-3 font-mono font-bold text-slate-800">{g.LelPct}%</td>
                            <td className="p-3 font-mono font-bold text-slate-800">{g.CoVal} ppm</td>
                            <td className="p-3 font-mono font-bold text-slate-800">{g.H2sVal} ppm</td>
                            <td className="p-3 font-mono text-slate-500">{g.MeterId || '—'}</td>
                            <td className="p-3 font-semibold text-slate-700">{g.TestedBy || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: SIGNATURES & MULTI-TIER APPROVALS (J-M) */}
          {/* ========================================================================= */}
          {activeTab === 'approvals' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#006398]">draw</span>
                  <span>Digital Approvals, Clearances & Signatures Chain</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">Entity: _Approval</span>
              </div>

              {!selectedPermit._Approval || selectedPermit._Approval.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400">No authorization signatures logged yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[10px]">
                        <th className="p-3">Stage</th>
                        <th className="p-3">Seq #</th>
                        <th className="p-3">Role ID</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Signed By (SAP User)</th>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {selectedPermit._Approval.map((app, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-800">{app.Stage || 'Stage ' + (i + 1)}</td>
                          <td className="p-3 font-mono text-slate-400">{app.SeqNo}</td>
                          <td className="p-3 font-mono font-semibold text-slate-700">{app.RoleId}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {app.Action || 'APPROVED'}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">{app.SignedBy}</td>
                          <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {app.ActionDate} {app.ActionTime}
                          </td>
                          <td className="p-3 text-slate-600 max-w-xs">{app.Comments || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 8: SHIFT RENEWALS & AUDIT LOG (N) */}
          {/* ========================================================================= */}
          {activeTab === 'renewals_audit' && (
            <div className="space-y-6">
              {/* Shift Renewals */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#006398]">update</span>
                    <span>Shift Revalidations & Renewals (_ShiftRenewal)</span>
                  </h3>
                </div>

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
              </div>

              {/* Full Audit Trail */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-700">history</span>
                    <span>Lifecycle Event Audit Trail (_AuditLog)</span>
                  </h3>
                </div>

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
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. PRINTABLE OFFICIAL PTW CERTIFICATE (Rendered on Print) */}
          {/* ========================================================================= */}
          <div className="print-only p-8 text-black bg-white">
            <div className="border-2 border-black p-6 space-y-4">
              {/* Header Box */}
              <div className="text-center border-b-2 border-black pb-4">
                <h1 className="text-xl font-bold uppercase tracking-wider">
                  GUJARAT FLUOROCHEMICALS LIMITED — DAHEJ SITE
                </h1>
                <h2 className="text-base font-bold uppercase mt-1">
                  PERMIT TO WORK (PTW) CERTIFICATE
                </h2>
                <p className="text-xs font-mono mt-0.5">
                  Standard Operating Procedure: {PROCEDURE.id} · Revision: {PROCEDURE.revision} · Form: {PROCEDURE.form}
                </p>
              </div>

              {/* Permit Meta Header */}
              <div className="grid grid-cols-4 gap-2 text-xs border-b border-black pb-3">
                <div><strong>Permit Number:</strong> {selectedPermit.Permit_No}</div>
                <div><strong>Category:</strong> {selectedPermit.PermitType}</div>
                <div><strong>Status:</strong> {selectedPermit.Status}</div>
                <div><strong>Plant:</strong> {selectedPermit.Werks}</div>

                <div><strong>Area / Location:</strong> {selectedPermit.AreaLoc}</div>
                <div><strong>Execution Dept:</strong> {selectedPermit.ExecDept}</div>
                <div><strong>Agency:</strong> {selectedPermit.ExecAgency}</div>
                <div><strong>Shift:</strong> {selectedPermit.Shift || 'GENERAL'}</div>

                <div><strong>MO Number:</strong> {selectedPermit.Aufnr || '—'}</div>
                <div><strong>Notification:</strong> {selectedPermit.Qmnum || '—'}</div>
                <div><strong>Equipment:</strong> {selectedPermit.Equnr || '—'}</div>
                <div><strong>Func Location:</strong> {selectedPermit.Tplnr || '—'}</div>
              </div>

              {/* Work Scope */}
              <div className="border-b border-black pb-3 text-xs">
                <strong>Job Scope & Description:</strong>
                <p className="mt-1">{selectedPermit.JobDesc}</p>
              </div>

              {/* Validity Window */}
              <div className="grid grid-cols-2 gap-4 border-b border-black pb-3 text-xs">
                <div><strong>Valid From:</strong> {selectedPermit.ValidFromD} at {selectedPermit.ValidFromT} (IST)</div>
                <div><strong>Valid To:</strong> {selectedPermit.ValidToD} at {selectedPermit.ValidToT} (IST)</div>
              </div>

              {/* Signatures & Clearances */}
              <div className="pt-2 text-xs">
                <strong className="block mb-2 uppercase">Required Authorizations & Clearances:</strong>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="border border-black p-3 h-24 flex flex-col justify-between">
                    <span className="font-bold">Permit Requester / Acceptor</span>
                    <span className="font-mono text-[10px]">{selectedPermit.PersonResp || 'Name & Signature'}</span>
                  </div>
                  <div className="border border-black p-3 h-24 flex flex-col justify-between">
                    <span className="font-bold">Permit Issuer (Area Owner)</span>
                    <span className="font-mono text-[10px]">Name & Signature</span>
                  </div>
                  <div className="border border-black p-3 h-24 flex flex-col justify-between">
                    <span className="font-bold">Safety / Gas Tester</span>
                    <span className="font-mono text-[10px]">Cert & Signature</span>
                  </div>
                  <div className="border border-black p-3 h-24 flex flex-col justify-between">
                    <span className="font-bold">Plant / Shift Incharge</span>
                    <span className="font-mono text-[10px]">Signature & Date</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
