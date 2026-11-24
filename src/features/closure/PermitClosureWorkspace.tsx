import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { SapUser } from '../../core/auth/sapAuthContext';
import type { PermitDeepInsertResponse, PermitInfoRecord } from '../../core/types/ptw.types';
import { sitePermitApi, type PlantPermitSummary } from '../../core/api/modules/sitePermit.api';
import { permitClosureApi } from '../../core/api/modules/permitClosure.api';
import { PermitClosureModal } from './PermitClosureModal';
import { PERMIT_CATEGORIES } from '../../core/ptw/siteProcedure';
import { toast } from '../../shared/context/ToastContext';

export interface PermitClosureWorkspaceProps {
  user: SapUser | null;
  onBack: () => void;
  onOpenPermit?: (permitNo: string) => void;
  initialPermitNo?: string;
}

type ClosureTab = 'ACCEPTOR' | 'AREA_OPERATOR' | 'ISSUER' | 'CLOSED';

export function getCategoryInfo(code: string) {
  const clean = (code || '').trim().toUpperCase();
  const found = PERMIT_CATEGORIES.find(
    (c) =>
      c.code.toUpperCase() === clean ||
      c.sapCode.toUpperCase() === clean ||
      (c.code === 'HGHT' && (clean === 'W@H' || clean === 'HEIGHT')) ||
      (c.code === 'CONF' && clean === 'CSE')
  );
  return {
    code: clean,
    label: found?.label || clean,
    icon: found?.icon || 'description'
  };
}

export const PermitClosureWorkspace: React.FC<PermitClosureWorkspaceProps> = ({
  user,
  onBack,
  onOpenPermit,
  initialPermitNo
}) => {
  const userRoles = useMemo(() => (user?.roles || []).map((r) => r.toUpperCase()), [user]);

  // Determine initial tab based on role
  const defaultTab = useMemo<ClosureTab>(() => {
    const isAreaOp = userRoles.some((r) =>
      ['PTW_AREA_OWNER', 'ZPTW_AREA_OWNER', 'PTW_AREA_OPP', 'PTW_AOPR'].includes(r)
    );
    const isIssuer = userRoles.some((r) =>
      ['PTW_ISSUER', 'ZPTW_ISSUER', 'PTW_ISSU', 'ZPTW_ISSU', 'PTW_APPROVER', 'ZPTW_APPROVER'].includes(r)
    );
    const isAcceptor = userRoles.some((r) =>
      ['PTW_ACCEPTOR', 'ZPTW_ACCEPTOR', 'PTW_ACCP'].includes(r)
    );

    if (isAreaOp && !isAcceptor) return 'AREA_OPERATOR';
    if (isIssuer && !isAcceptor && !isAreaOp) return 'ISSUER';
    return 'ACCEPTOR';
  }, [userRoles]);

  const [activeTab, setActiveTab] = useState<ClosureTab>(defaultTab);
  const [plant, setPlant] = useState<string>(user?.plant || '1002');
  const [searchQuery, setSearchQuery] = useState<string>(initialPermitNo || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [permits, setPermits] = useState<PermitInfoRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [plantSummary, setPlantSummary] = useState<PlantPermitSummary | null>(null);

  // Selected permit for detail inspection
  const [selectedPermitNo, setSelectedPermitNo] = useState<string>(initialPermitNo || '');
  const [selectedPermit, setSelectedPermit] = useState<PermitDeepInsertResponse | null>(null);

  // Modal State for Action Execution
  const [modalPermit, setModalPermit] = useState<PermitInfoRecord | PermitDeepInsertResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const handleOpenActionModal = (p: PermitInfoRecord | PermitDeepInsertResponse) => {
    setSelectedPermitNo(p.Permit_No);
    setModalPermit(p);
    setIsModalOpen(true);
    void loadPermitDetail(p.Permit_No, true);
  };

  // Pagination
  const [page, setPage] = useState<number>(0);
  const pageSize = 15;

  const abortControllerRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);

  // Load plant KPIs
  const loadPlantSummary = async (forceRefresh = false) => {
    try {
      const summary = await sitePermitApi.getPlantSummary(plant, undefined, forceRefresh);
      setPlantSummary(summary);
    } catch (e) {
      console.warn('[PermitClosureWorkspace] Could not load plant summary:', e);
    }
  };

  // Map activeTab to SAP query status filter
  const getSapStatusForTab = (tab: ClosureTab): string => {
    switch (tab) {
      case 'ACCEPTOR':
        return 'ACTV';
      case 'AREA_OPERATOR':
        return 'ACCL';
      case 'ISSUER':
        return 'AROP';
      case 'CLOSED':
        return 'CLSD';
      default:
        return 'ACTV';
    }
  };

  const loadPermits = async (resetPage = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    const currentOffset = resetPage ? 0 : page * pageSize;
    if (resetPage) setPage(0);

    const sapStatus = getSapStatusForTab(activeTab);

    try {
      const result = await sitePermitApi.list(
        plant,
        searchQuery,
        currentOffset,
        controller.signal,
        'ALL',
        sapStatus,
        pageSize
      );
      if (controller.signal.aborted) return;
      setPermits(result || []);
      setTotalCount(result.totalCount ?? result.length);
    } catch (err: any) {
      const isCanceled =
        err?.name === 'CanceledError' ||
        err?.name === 'AbortError' ||
        err?.code === 'ERR_CANCELED' ||
        controller.signal.aborted;
      if (!isCanceled) {
        console.error('[PermitClosureWorkspace] Failed to fetch permits:', err);
        toast.error('Failed to load permits for closure workflow.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const loadPermitDetail = async (permitNo: string, forceRefresh = false) => {
    if (!permitNo) return;
    if (detailAbortRef.current) {
      detailAbortRef.current.abort();
    }
    const controller = new AbortController();
    detailAbortRef.current = controller;

    try {
      const detail = await sitePermitApi.read(permitNo, controller.signal, forceRefresh);
      if (controller.signal.aborted) return;
      setSelectedPermit(detail);
      setSelectedPermitNo(permitNo);
    } catch (err: any) {
      const isCanceled =
        err?.name === 'CanceledError' ||
        err?.name === 'AbortError' ||
        err?.code === 'ERR_CANCELED' ||
        controller.signal.aborted;
      if (!isCanceled) {
        console.error('[PermitClosureWorkspace] Failed to load detail:', err);
        toast.error(`Failed to load details for permit ${permitNo}.`);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (detailAbortRef.current) {
        detailAbortRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    loadPlantSummary();
  }, [plant]);

  useEffect(() => {
    loadPermits(true);
  }, [activeTab, plant]);

  useEffect(() => {
    if (initialPermitNo) {
      loadPermitDetail(initialPermitNo);
    }
  }, [initialPermitNo]);

  const handleActionSuccess = (_newStatus?: string, updatedRecord?: any) => {
    if (updatedRecord && (updatedRecord.Permit_No || updatedRecord.PermitNo)) {
      const pNo = updatedRecord.Permit_No || updatedRecord.PermitNo;
      setPermits((prev) =>
        prev.map((p) => (p.Permit_No === pNo ? { ...p, ...updatedRecord } : p))
      );
      setSelectedPermit((prev) =>
        prev?.Permit_No === pNo ? { ...prev, ...updatedRecord } : prev
      );
      setModalPermit((prev) =>
        prev?.Permit_No === pNo ? { ...prev, ...updatedRecord } : null
      );
    }
    loadPermits(false);
    loadPlantSummary(true);
    if (selectedPermitNo) {
      loadPermitDetail(selectedPermitNo, true);
    }
  };

  // Compute merged modal permit so deep fields (approvals, gas tests, etags) are preserved
  // while ensuring the latest closure flags from modalPermit or selectedPermit take precedence
  const activeModalPermit = useMemo(() => {
    if (!modalPermit) return null;
    if (!selectedPermit || selectedPermit.Permit_No !== modalPermit.Permit_No) {
      return modalPermit;
    }
    return {
      ...selectedPermit,
      ...modalPermit,
      WorkCompleted:
        modalPermit.WorkCompleted === 'X' || selectedPermit.WorkCompleted === 'X'
          ? 'X'
          : modalPermit.WorkCompleted || selectedPermit.WorkCompleted || '',
      ClosedByAcceptor:
        modalPermit.ClosedByAcceptor === 'X' || selectedPermit.ClosedByAcceptor === 'X'
          ? 'X'
          : modalPermit.ClosedByAcceptor || selectedPermit.ClosedByAcceptor || '',
      ClosedByAreaOpp:
        modalPermit.ClosedByAreaOpp === 'X' || selectedPermit.ClosedByAreaOpp === 'X'
          ? 'X'
          : modalPermit.ClosedByAreaOpp || selectedPermit.ClosedByAreaOpp || '',
      Status:
        modalPermit.Status && modalPermit.Status !== 'ACTV'
          ? modalPermit.Status
          : selectedPermit.Status || modalPermit.Status,
      '@odata.etag': selectedPermit['@odata.etag'] || (modalPermit as any)['@odata.etag']
    };
  }, [modalPermit, selectedPermit]);

  // Status Badge Helper
  const renderStatusBadge = (status?: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'ACTV':
      case 'ISSU':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>ACTIVE (ACTV)</span>
          </span>
        );
      case 'ACCL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-teal-100 text-teal-800 border border-teal-300">
            <span className="material-symbols-outlined text-[13px]">handshake</span>
            <span>ACCEPTOR CLOSED (ACCL)</span>
          </span>
        );
      case 'AROP':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-100 text-cyan-800 border border-cyan-300">
            <span className="material-symbols-outlined text-[13px]">verified_user</span>
            <span>AREA CLEARED (AROP)</span>
          </span>
        );
      case 'CLSD':
      case 'CLOS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-200 text-slate-800 border border-slate-300">
            <span className="material-symbols-outlined text-[13px]">task_alt</span>
            <span>CLOSED (CLSD)</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-600">
            {s || 'UNKNOWN'}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header & Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-all shrink-0 cursor-pointer"
            title="Return to Launchpad"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Permit Closure & Handover
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-teal-100 text-teal-800 border border-teal-200">
                CLSD Workflow
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              4-tier clearance pipeline: Acceptor Work Completion → Acceptor Handover (ACCL) → Area Operator Clearance (AROP) → Final Issuer Closure (CLSD).
            </p>
          </div>
        </div>

        {/* Plant & Action Controls */}
        <div className="flex items-center gap-2.5 self-start md:self-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs">
            <span className="text-slate-400 font-mono">Plant:</span>
            <select
              value={plant}
              onChange={(e) => setPlant(e.target.value)}
              className="font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
            >
              <option value="1002">1002 - Dahej</option>
              <option value="1001">1001 - Corporate</option>
              <option value="1003">1003 - Plant 3</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              loadPlantSummary(true);
              loadPermits();
              if (selectedPermitNo) {
                loadPermitDetail(selectedPermitNo, true);
              }
            }}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-teal-500 bg-white hover:bg-teal-50/50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Dashboard Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* 1. Active Work */}
        <button
          type="button"
          onClick={() => setActiveTab('ACCEPTOR')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'ACCEPTOR'
              ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-400 ring-2 ring-emerald-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Active Work</span>
            <span className="material-symbols-outlined text-[16px] text-emerald-600">engineering</span>
          </div>
          <p className="text-xl font-bold font-mono text-slate-900">
            {plantSummary?.statusCounts?.ISSU || 0}
          </p>
          <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Stage 1 · ACTV</p>
        </button>

        {/* 2. Acceptor Handover */}
        <button
          type="button"
          onClick={() => setActiveTab('ACCEPTOR')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'ACCEPTOR'
              ? 'bg-gradient-to-br from-teal-50 to-white border-teal-400 ring-2 ring-teal-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Acceptor Handover</span>
            <span className="material-symbols-outlined text-[16px] text-teal-600">handshake</span>
          </div>
          <p className="text-xl font-bold font-mono text-slate-900">
            {plantSummary?.statusCounts?.ISSU || 0}
          </p>
          <p className="text-[10px] text-teal-700 font-medium mt-0.5">Stage 2 · To ACCL</p>
        </button>

        {/* 3. Area Operator Clearance */}
        <button
          type="button"
          onClick={() => setActiveTab('AREA_OPERATOR')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'AREA_OPERATOR'
              ? 'bg-gradient-to-br from-cyan-50 to-white border-cyan-400 ring-2 ring-cyan-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Area Clearance</span>
            <span className="material-symbols-outlined text-[16px] text-cyan-600">verified_user</span>
          </div>
          <p className="text-xl font-bold font-mono text-slate-900">
            {plantSummary?.statusCounts?.ACCL || 0}
          </p>
          <p className="text-[10px] text-cyan-700 font-medium mt-0.5">Stage 3 · ACCL → AROP</p>
        </button>

        {/* 4. Final Issuer Closure */}
        <button
          type="button"
          onClick={() => setActiveTab('ISSUER')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'ISSUER'
              ? 'bg-gradient-to-br from-indigo-50 to-white border-indigo-400 ring-2 ring-indigo-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Issuer Final Closure</span>
            <span className="material-symbols-outlined text-[16px] text-indigo-600">draw</span>
          </div>
          <p className="text-xl font-bold font-mono text-slate-900">
            {plantSummary?.statusCounts?.AROP || 0}
          </p>
          <p className="text-[10px] text-indigo-700 font-medium mt-0.5">Stage 4 · AROP → CLSD</p>
        </button>

        {/* 5. Closed Permits Archive */}
        <button
          type="button"
          onClick={() => setActiveTab('CLOSED')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'CLOSED'
              ? 'bg-gradient-to-br from-slate-100 to-white border-slate-400 ring-2 ring-slate-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Closed Archive</span>
            <span className="material-symbols-outlined text-[16px] text-slate-600">task_alt</span>
          </div>
          <p className="text-xl font-bold font-mono text-slate-900">
            {plantSummary?.statusCounts?.CLSD || plantSummary?.statusCounts?.CLOS || 0}
          </p>
          <p className="text-[10px] text-slate-600 font-medium mt-0.5">Archived · CLSD</p>
        </button>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Sub-module Navigation Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('ACCEPTOR')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ACCEPTOR'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">engineering</span>
              <span>1. Acceptor Handover (ACTV)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('AREA_OPERATOR')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'AREA_OPERATOR'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              <span>2. Area Operator Clearance (ACCL)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ISSUER')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ISSUER'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">draw</span>
              <span>3. Issuer Final Closure (AROP)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('CLOSED')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'CLOSED'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">task_alt</span>
              <span>4. Closed Archive (CLSD)</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadPermits(true);
              }}
              placeholder="Search Permit #, Order, Job..."
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  loadPermits(true);
                }}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Permits Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                <th className="py-2.5 px-3">Permit # & Category</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Job Scope / Description</th>
                <th className="py-2.5 px-3">Location & Center</th>
                <th className="py-2.5 px-3">Order / Notif</th>
                <th className="py-2.5 px-3">Next Action</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <span className="material-symbols-outlined text-[28px] animate-spin text-teal-600 block mb-1">
                      progress_activity
                    </span>
                    <span>Loading permits for {activeTab.replace('_', ' ')}...</span>
                  </td>
                </tr>
              ) : permits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-[32px] block mb-1 text-slate-300">
                      inbox
                    </span>
                    <span>No permits found in queue for this stage.</span>
                  </td>
                </tr>
              ) : (
                permits.map((p) => {
                  const cat = getCategoryInfo(p.PermitType);
                  const step = permitClosureApi.getClosureStep(p);
                  const isSelected = selectedPermitNo === p.Permit_No;

                  return (
                    <tr
                      key={p.Permit_No}
                      onClick={() => handleOpenActionModal(p)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isSelected && isModalOpen ? 'bg-teal-50/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{p.Permit_No}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 border ${
                              p.PermitType === 'CONF' || p.PermitType === 'CSE'
                                ? 'bg-rose-50 border-rose-300 text-rose-700'
                                : p.PermitType === 'HOT'
                                ? 'bg-amber-50 border-amber-300 text-amber-800'
                                : 'bg-slate-100 border-slate-200 text-slate-700'
                            }`}
                            title={cat.label}
                          >
                            <span className="material-symbols-outlined text-[12px]">{cat.icon}</span>
                            <span>{p.PermitType}</span>
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3">{renderStatusBadge(p.Status)}</td>

                      <td className="py-2.5 px-3 max-w-xs truncate" title={p.JobDesc}>
                        {p.JobDesc || 'N/A'}
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="font-mono text-slate-700">
                          {p.Arbpl || p.AreaLoc || p.Werks || 'N/A'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {p.Aufnr || p.Qmnum || 'N/A'}
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-700">
                          {step.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenActionModal(p);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-xs transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1.5 ${
                            p.Status === 'CLSD'
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/90'
                              : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white'
                          }`}
                          title={p.Status === 'CLSD' ? 'View Closed Dossier' : 'Open SAP Closure Action Modal'}
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {p.Status === 'CLSD' ? 'visibility' : 'task_alt'}
                          </span>
                          <span>{p.Status === 'CLSD' ? 'View Dossier' : 'Inspect & Act'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
          <span>
            Showing {permits.length} of {totalCount} permits
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page === 0 || loading}
              onClick={() => {
                setPage((p) => Math.max(0, p - 1));
                loadPermits();
              }}
              className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 font-mono">Page {page + 1}</span>
            <button
              type="button"
              disabled={(page + 1) * pageSize >= totalCount || loading}
              onClick={() => {
                setPage((p) => p + 1);
                loadPermits();
              }}
              className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Direct Modal Opened from Table Rows */}
      <PermitClosureModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalPermit(null);
        }}
        permit={activeModalPermit}
        user={user}
        onSuccess={handleActionSuccess}
        onOpenPermit={onOpenPermit}
      />
    </div>
  );
};

export default PermitClosureWorkspace;
