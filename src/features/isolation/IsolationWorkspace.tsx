import { CertificateActions } from './CertificateActions';
import { WorkflowUnconfirmedError } from '../../core/api/modules/backendWorkflow.api';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ModuleId, SapUser } from '../../core/auth/sapAuthContext';
import type { SapIsolationHeader, SapIsolationItem } from '../../core/types/isolation.types';
import { isolationApi } from '../../core/api/modules/isolation.api';
import { configApi } from '../../core/api/modules/config.api';
import type { SapConfigRecord } from '../../core/types/config.types';

interface IsolationWorkspaceProps {
  module: ModuleId;
  user: SapUser | null;
  onBack: () => void;
}

type ViewMode = 'list' | 'detail' | 'create';

export const IsolationWorkspace: React.FC<IsolationWorkspaceProps> = ({ module, user, onBack }) => {
  const [viewMode, setViewMode] = useState<ViewMode>(
    module === 'create-isolation' ? 'create' : 'list'
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [isolations, setIsolations] = useState<SapIsolationHeader[]>([]);
  const [selectedIso, setSelectedIso] = useState<SapIsolationHeader | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Dropdown Configs from SAP OData
  const [isolationTypes, setIsolationTypes] = useState<SapConfigRecord[]>([]);
  const [isolatedStates, setIsolatedStates] = useState<SapConfigRecord[]>([]);
  const [isolMethods, setIsolMethods] = useState<SapConfigRecord[]>([]);
  const [deisolatedStates, setDeisolatedStates] = useState<SapConfigRecord[]>([]);

  // New Isolation Creation Form State
  const [createPermitNo, setCreatePermitNo] = useState<string>('');
  const [createRemarks, setCreateRemarks] = useState<string>('');
  const [createPoints, setCreatePoints] = useState<Array<Omit<SapIsolationItem, 'IsolationNo' | 'ItemNo'>>>([
    {
      ReferenceType: 'EQUI',
      ReferenceId: '',
      IsolationPoint: '',
      IsolType: 'MECH',
      IsolMethod: 'VALVE_CC',
      IsolatedState: 'CLOSED',
      DeIsolatedState: 'NORMAL',
      LockTagNo: '',
      IsIsolated: '',
      IsolatedBy: '',
      IsolatedAt: null,
      ZeroEnergyConf: '',
      ZeroEnergyBy: '',
      ZeroEnergyAt: null,
      IsNormalized: '',
      NormalizedBy: '',
      NormalizedAt: null,
      Remarks: ''
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // Edit Certificate Modal State
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingIso, setEditingIso] = useState<SapIsolationHeader | null>(null);
  const [editRemarks, setEditRemarks] = useState<string>('');
  const [saveUncertain, setSaveUncertain] = useState(false);
  const submissionLock = useRef(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleOpenEdit = async (iso: SapIsolationHeader) => {
    try {
      const current = await isolationApi.read(iso.IsolationNo);
      if (!current) throw new Error('SAP did not return this certificate.');
      setEditingIso(current);
      setEditRemarks(current.Remarks || '');
      setShowEditModal(true);
    } catch (reason) {
      setNotification({ type: 'error', text: reason instanceof Error ? reason.message : 'Unable to load the current certificate.' });
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIso || submissionLock.current || saveUncertain) return;
    submissionLock.current = true;

    setIsSavingEdit(true);
    setNotification(null);

    try {
      const updated = await isolationApi.update(editingIso.IsolationNo, {
        Remarks: editRemarks.trim()
      }, editingIso['@odata.etag']);

      // Update in state
      setIsolations((prev) =>
        prev.map((i) => (i.IsolationNo === updated.IsolationNo ? { ...i, ...updated } : i))
      );
      if (selectedIso && selectedIso.IsolationNo === updated.IsolationNo) {
        setSelectedIso((prev) => (prev ? { ...prev, ...updated } : null));
      }

      setNotification({
        type: 'success',
        text: `Isolation Certificate ${updated.IsolationNo} successfully updated. Linked Permit: ${
          updated.PermitNo ? updated.PermitNo : 'Unassigned'
        }.`
      });
      setShowEditModal(false);
    } catch (err) {
      if (err instanceof WorkflowUnconfirmedError) setSaveUncertain(true);
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update isolation certificate.'
      });
    } finally {
      submissionLock.current = false; setIsSavingEdit(false);
    }
  };

  const loadIsolations = async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    try {
      const data = await isolationApi.list(undefined, controller.signal);
      if (!controller.signal.aborted) {
        setIsolations(data);
      }
    } catch (err) {
      if (err instanceof WorkflowUnconfirmedError) setSaveUncertain(true);
      if (!controller.signal.aborted) {
        setNotification({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to fetch isolation records from SAP.'
        });
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadIsolations();
    configApi.fetchIsolationTypeConfig().then(setIsolationTypes);
    configApi.fetchIsolatedStateConfig().then(setIsolatedStates);
    configApi.fetchIsolMethodConfig().then(setIsolMethods);
    configApi.fetchDeisolatedStateConfig().then(setDeisolatedStates);
    return () => abortControllerRef.current?.abort();
  }, []);

  // Helper label resolvers
  const getIsolTypeLabel = (code: string) => {
    const found = isolationTypes.find((t) => t.Config_Code === code);
    return found ? `${found.Config_Desc} (${found.Config_Code})` : code;
  };

  const getIsolMethodLabel = (code: string) => {
    const found = isolMethods.find((m) => m.Config_Code === code);
    return found ? `${found.Config_Desc} (${found.Config_Code})` : code;
  };

  const getIsolatedStateLabel = (code: string) => {
    const found = isolatedStates.find((s) => s.Config_Code === code);
    return found ? found.Config_Desc : code;
  };

  const getDeisolatedStateLabel = (code: string) => {
    const found = deisolatedStates.find((s) => s.Config_Code === code);
    return found ? found.Config_Desc : code;
  };

  // Filtered List
  const filteredIsolations = useMemo(() => {
    return isolations.filter((iso) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        iso.IsolationNo.toLowerCase().includes(q) ||
        iso.PermitNo.toLowerCase().includes(q) ||
        iso.RequestedBy.toLowerCase().includes(q) ||
        (iso.Remarks && iso.Remarks.toLowerCase().includes(q)) ||
        iso._Item?.some(
          (item) =>
            item.IsolationPoint.toLowerCase().includes(q) ||
            item.ReferenceId.toLowerCase().includes(q) ||
            item.LockTagNo.toLowerCase().includes(q)
        );

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'CRTD' && iso.Status === 'CRTD') ||
        (statusFilter === 'ISOL' && iso.Status === 'ISOL') ||
        (statusFilter === 'NORM' && iso.Status === 'NORM');

      return matchesSearch && matchesStatus;
    });
  }, [isolations, searchQuery, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = isolations.length;
    const crtd = isolations.filter((i) => i.Status === 'CRTD').length;
    const isol = isolations.filter((i) => i.Status === 'ISOL').length;
    const norm = isolations.filter((i) => i.Status === 'NORM').length;
    const totalPoints = isolations.reduce((acc, curr) => acc + (curr._Item?.length || 0), 0);
    return { total, crtd, isol, norm, totalPoints };
  }, [isolations]);

  // Add Point Handler
  const handleAddPointRow = () => {
    setCreatePoints((prev) => [
      ...prev,
      {
        ReferenceType: 'EQUI',
        ReferenceId: '',
        IsolationPoint: '',
        IsolType: 'MECH',
        IsolMethod: 'VALVE_CC',
        IsolatedState: 'CLOSED',
        DeIsolatedState: 'NORMAL',
        LockTagNo: '',
        IsIsolated: '',
        IsolatedBy: '',
        IsolatedAt: null,
        ZeroEnergyConf: '',
        ZeroEnergyBy: '',
        ZeroEnergyAt: null,
        IsNormalized: '',
        NormalizedBy: '',
        NormalizedAt: null,
        Remarks: ''
      }
    ]);
  };

  const handleRemovePointRow = (index: number) => {
    if (createPoints.length <= 1) return;
    setCreatePoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePointChange = (
    index: number,
    field: keyof Omit<SapIsolationItem, 'IsolationNo' | 'ItemNo'>,
    value: string
  ) => {
    setCreatePoints((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionLock.current || saveUncertain) return;
    if (createPoints.some((p) => !p.IsolationPoint.trim())) {
      setNotification({
        type: 'error',
        text: 'Please specify the physical isolation point name for all points.'
      });
      return;
    }

    submissionLock.current = true;
    setIsSubmitting(true);
    setNotification(null);

    try {
      const payload: Partial<SapIsolationHeader> = {
        PermitNo: createPermitNo.trim(),
        Remarks: createRemarks.trim(),
        _Item: createPoints.map((p) => ({
          ReferenceType: p.ReferenceType || 'EQUI',
          ReferenceId: p.ReferenceId.trim(),
          IsolationPoint: p.IsolationPoint.trim().toUpperCase(),
          IsolType: p.IsolType,
          IsolMethod: p.IsolMethod,
          IsolatedState: p.IsolatedState,
          DeIsolatedState: p.DeIsolatedState ? p.DeIsolatedState.trim() : '',
          LockTagNo: p.LockTagNo.trim().toUpperCase(),
          Remarks: p.Remarks ? p.Remarks.trim() : ''
        }))
      };

      const result = await isolationApi.create(payload);
      setNotification({
        type: 'success',
        text: `Isolation Certificate ${result.IsolationNo} successfully created and registered in SAP database.`
      });
      await loadIsolations();
      setSelectedIso(result);
      setViewMode('detail');
      // Reset form
      setCreatePermitNo('');
      setCreateRemarks('');
      setCreatePoints([
        {
          ReferenceType: 'EQUI',
          ReferenceId: '',
          IsolationPoint: '',
          IsolType: 'MECH',
          IsolMethod: 'VALVE_CC',
          IsolatedState: 'CLOSED',
          DeIsolatedState: 'NORMAL',
          LockTagNo: '',
          IsIsolated: '',
          IsolatedBy: '',
          IsolatedAt: null,
          ZeroEnergyConf: '',
          ZeroEnergyBy: '',
          ZeroEnergyAt: null,
          IsNormalized: '',
          NormalizedBy: '',
          NormalizedAt: null,
          Remarks: ''
        }
      ]);
    } catch (err) {
      if (err instanceof WorkflowUnconfirmedError) setSaveUncertain(true);
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error submitting isolation certificate.'
      });
    } finally {
      submissionLock.current = false; setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      {/* Top Banner / Breadcrumb */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              className="group inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all duration-200 hover:border-[#006398] hover:bg-slate-50 hover:text-[#006398] hover:shadow-sm active:scale-[0.98]"
              title="Return to Launchpad"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors duration-200 group-hover:bg-[#006398]/10 group-hover:text-[#006398]">
                <span className="material-symbols-outlined text-[15px] transition-transform duration-200 group-hover:-translate-x-0.5">
                  arrow_back
                </span>
              </span>
              <span>Return to Launchpad</span>
            </button>
            <span className="text-slate-300 font-light">/</span>
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-slate-400">
              <span>PTW Suite</span>
              <span>/</span>
              <span className="font-semibold text-slate-600">Isolation Registry</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <span className="material-symbols-outlined text-[24px]">lock_reset</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Isolation Registry
              </h1>
              <p className="text-xs text-slate-500 font-mono">
                Zero-Energy Breaker, Valve Lock & Blind Flange Registry (SAP OData V4)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {viewMode !== 'list' && (
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
              Certificates List
            </button>
          )}

          {viewMode !== 'create' && (
            <button
              type="button"
              onClick={() => {
                setSelectedIso(null);
                setViewMode('create');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#006398] px-4 py-2 text-xs font-bold text-white hover:bg-[#004f7a] shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              New Isolation Certificate
            </button>
          )}

          <button
            type="button"
            onClick={loadIsolations}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-50"
            title="Refresh from SAP"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            Refresh
          </button>
        </div>
      </header>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`flex items-start justify-between rounded-xl border p-4 text-xs font-medium ${
            notification.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : notification.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-900'
              : 'border-sky-200 bg-sky-50 text-sky-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {notification.type === 'success'
                ? 'check_circle'
                : notification.type === 'error'
                ? 'error'
                : 'info'}
            </span>
            <span>{notification.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-500 hover:text-slate-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Overview Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Total Certificates
          </span>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Draft / Created (CRTD)
          </span>
          <p className="mt-1 font-mono text-2xl font-bold text-amber-900">{stats.crtd}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
            Isolated (ISOL)
          </span>
          <p className="mt-1 font-mono text-2xl font-bold text-blue-900">{stats.isol}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Normalized (NORM)
          </span>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-900">{stats.norm}</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
            Total Points Locked
          </span>
          <p className="mt-1 font-mono text-2xl font-bold text-orange-900">{stats.totalPoints}</p>
        </div>
      </div>

      {/* MODE 1: LIST / BROWSE CERTIFICATES */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-1 items-center gap-2 min-w-[260px]">
              <span className="material-symbols-outlined text-slate-400">search</span>
              <input
                type="text"
                placeholder="Search certificate #, permit #, point name, lock/tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs outline-none bg-transparent placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <div className="flex gap-1">
                {(['ALL', 'CRTD', 'ISOL', 'NORM'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition-all ${
                      statusFilter === st
                        ? 'bg-[#006398] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Certificates Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50/80 font-mono text-[11px] uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="p-3">Isolation Certificate</th>
                  <th className="p-3">Linked Permit</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Requested By & Date</th>
                  <th className="p-3">Points Registered</th>
                  <th className="p-3">Remarks / Scope</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIsolations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-[36px] text-slate-300">
                          folder_off
                        </span>
                        <span>No isolation certificates found matching current criteria.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredIsolations.map((iso) => (
                    <tr key={iso.IsolationNo} className="hover:bg-sky-50/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-[#006398]">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedIso(iso);
                            setViewMode('detail');
                          }}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px] text-orange-600">
                            lock
                          </span>
                          {iso.IsolationNo}
                        </button>
                      </td>
                      <td className="p-3 font-mono">
                        {iso.PermitNo ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-[#006398] font-bold border border-sky-100">
                              {iso.PermitNo}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(iso);
                              }}
                              className="text-slate-400 hover:text-[#006398] p-0.5 rounded transition"
                              title="Edit Permit No"
                            >
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(iso);
                            }}
                            className="inline-flex items-center gap-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold transition"
                            title="Add or link a Permit No to this certificate"
                          >
                            <span className="material-symbols-outlined text-[13px]">add_link</span>
                            <span>+ Link Permit</span>
                          </button>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase ${
                            iso.Status === 'CRTD'
                              ? 'bg-amber-100 text-amber-800'
                              : iso.Status === 'ISOL'
                              ? 'bg-blue-100 text-blue-800'
                              : iso.Status === 'NORM'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {iso.Status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{iso.RequestedBy}</div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {iso.RequestedDate} {iso.RequestedTime}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                          {iso._Item?.length || 0} point(s)
                        </span>
                      </td>
                      <td className="p-3 max-w-[200px] truncate text-slate-600" title={iso.Remarks}>
                        {iso.Remarks || '—'}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(iso)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#006398] transition"
                            title="Edit Certificate / Link Permit"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIso(iso);
                              setViewMode('detail');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#006398]"
                          >
                            <span>View Details</span>
                            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODE 2: CERTIFICATE DETAIL / POINTS DOSSIER */}
      {viewMode === 'detail' && selectedIso && (
        <div className="space-y-6">
          {/* Certificate Header Dossier */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[28px] text-orange-600">
                  lock_open_right
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold font-mono text-slate-900">
                      {selectedIso.IsolationNo}
                    </h2>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider uppercase ${
                        selectedIso.Status === 'CRTD'
                          ? 'bg-amber-100 text-amber-800'
                          : selectedIso.Status === 'ISOL'
                          ? 'bg-blue-100 text-blue-800'
                          : selectedIso.Status === 'NORM'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {selectedIso.Status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    SAP S/4HANA Isolation Certificate Master Record
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(selectedIso)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#006398] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#004f7a] shadow-sm transition active:scale-[0.98]"
                  title="Update certificate details or add/change Permit No"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Edit Certificate / Permit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ← Back to List
                </button>
              </div>
            </div>

            {/* Header Meta Attributes Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 font-mono text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 relative group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-sans font-bold">
                    Linked Permit
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(selectedIso)}
                    className="text-[11px] font-semibold text-[#006398] hover:underline flex items-center gap-0.5"
                    title="Edit certificate remarks"
                  >
                    <span className="material-symbols-outlined text-[13px]">edit</span>
                    Edit remarks
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {selectedIso.PermitNo ? (
                    <span className="bg-sky-100/70 text-[#006398] px-2 py-0.5 rounded font-mono font-bold border border-sky-200">
                      {selectedIso.PermitNo}
                    </span>
                  ) : (
                    <span className="text-amber-700 italic font-sans font-normal text-xs flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">link_off</span>
                      None (Unassigned)
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-[10px] text-slate-500 uppercase font-sans font-bold">
                  Requested By
                </span>
                <p className="mt-1 font-bold text-slate-800">{selectedIso.RequestedBy}</p>
                <span className="text-[10px] text-slate-400">
                  {selectedIso.RequestedDate} {selectedIso.RequestedTime}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-[10px] text-slate-500 uppercase font-sans font-bold">
                  Verified / Approved
                </span>
                <p className="mt-1 font-bold text-slate-800">
                  {selectedIso.VerifiedBy || 'Pending Verification'}
                </p>
                <span className="text-[10px] text-slate-400">
                  {selectedIso.ApprovedBy ? `Approved by ${selectedIso.ApprovedBy}` : 'Unapproved'}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-[10px] text-slate-500 uppercase font-sans font-bold">
                  De-Isolation / Normalized
                </span>
                <p className="mt-1 font-bold text-slate-800">
                  {selectedIso.NormalizedBy || 'Active In Field'}
                </p>
                <span className="text-[10px] text-slate-400">
                  {selectedIso.NormalizedDate ? selectedIso.NormalizedDate : 'Not normalized'}
                </span>
              </div>
            </div>

            {selectedIso.Remarks && (
              <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-xs text-sky-900">
                <span className="font-bold">Remarks: </span>
                {selectedIso.Remarks}
              </div>
            )}
          </div>

          {/* Child Items (_Item) Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-slate-600">
                  checklist
                </span>
                <h3 className="font-bold text-slate-900 text-sm">
                  Physical Isolation Points Registry (_Item)
                </h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600">
                  {selectedIso._Item?.length || 0}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 font-mono text-[11px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Reference (EQUI / FLOC)</th>
                    <th className="p-3">Physical Point</th>
                    <th className="p-3">Discipline & Method</th>
                    <th className="p-3">Isolated State</th>
                    <th className="p-3">De-Isolated State</th>
                    <th className="p-3">Lock / Tag #</th>
                    <th className="p-3 text-center">Physical Isolation</th>
                    <th className="p-3 text-center">Zero Energy</th>
                    <th className="p-3 text-center">Normalized</th>
                    <th className="p-3">Point Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!selectedIso._Item || selectedIso._Item.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400 italic">
                        No isolation points recorded for this certificate.
                      </td>
                    </tr>
                  ) : (
                    selectedIso._Item.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-slate-500">
                          {item.ItemNo || idx + 1}
                        </td>
                        <td className="p-3 font-mono">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                            {item.ReferenceType}
                          </span>{' '}
                          <span className="font-semibold text-slate-800">{item.ReferenceId}</span>
                        </td>
                        <td className="p-3 font-semibold text-slate-900 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-orange-500">
                            lock
                          </span>
                          {item.IsolationPoint}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          <span className="font-bold text-slate-800">{getIsolTypeLabel(item.IsolType)}</span>
                          <span className="block text-slate-500 font-normal">{getIsolMethodLabel(item.IsolMethod)}</span>
                        </td>
                        <td className="p-3 font-mono font-bold text-amber-700">
                          {getIsolatedStateLabel(item.IsolatedState) || '—'}
                        </td>
                        <td className="p-3 font-mono text-slate-600">
                          {getDeisolatedStateLabel(item.DeIsolatedState || '') || '—'}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800">
                          {item.LockTagNo ? (
                            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-900">
                              🏷️ {item.LockTagNo}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-3 text-center font-mono">
                          {item.IsIsolated === 'Y' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <span className="material-symbols-outlined text-[16px]">check_circle</span>
                              YES
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400">
                              <span className="material-symbols-outlined text-[16px]">pending</span>
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono">
                          {item.ZeroEnergyConf === 'Y' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <span className="material-symbols-outlined text-[16px]">verified</span>
                              CONFIRMED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400">
                              <span className="material-symbols-outlined text-[16px]">schedule</span>
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono">
                          {item.IsNormalized === 'Y' ? (
                            <span className="inline-flex items-center gap-1 text-blue-700 font-bold">
                              <span className="material-symbols-outlined text-[16px]">restore</span>
                              RESTORED
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Active</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 max-w-[150px] truncate" title={item.Remarks}>
                          {item.Remarks || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: CREATE ISOLATION CERTIFICATE */}
      {viewMode === 'create' && (
        <form onSubmit={handleCreateSubmit} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Register New Isolation Certificate (POST Isolation)
              </h2>
              <p className="text-xs text-slate-500">
                Define engineered zero-energy boundary, physical breaker/valve lock points and danger tags.
              </p>
            </div>

            {/* Header Level Form */}
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-xs font-semibold text-slate-700">
                Linked Permit Number (Optional)
                <input
                  type="text"
                  placeholder="e.g. PTW0000002"
                  value={createPermitNo}
                  onChange={(e) => setCreatePermitNo(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2 font-mono text-xs outline-none focus:border-[#006398]"
                />
              </label>

              <label className="text-xs font-semibold text-slate-700">
                Requested By
                <input
                  type="text"
                  disabled
                  value={user?.id || 'VERTIF-V'}
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-500 cursor-not-allowed"
                />
              </label>

              <label className="text-xs font-semibold text-slate-700">
                Isolation Scope / Remarks
                <input
                  type="text"
                  placeholder="e.g. Pump P-101 motor overhaul isolation"
                  value={createRemarks}
                  onChange={(e) => setCreateRemarks(e.target.value)}
                  maxLength={255}
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-[#006398]"
                />
              </label>
            </div>

            {/* Points Builder */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Isolation Points Registry (_Item)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    At least one engineered isolation point is required.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPointRow}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[#006398] bg-sky-50/50 px-3 py-1.5 text-xs font-bold text-[#006398] hover:bg-sky-50"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Add Point
                </button>
              </div>

              <div className="space-y-3">
                {createPoints.map((point, idx) => (
                  <div
                    key={idx}
                    className="relative rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition-all hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between mb-3 border-b border-slate-200/80 pb-2">
                      <span className="font-mono text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-orange-600">
                          pin_drop
                        </span>
                        Isolation Point #{idx + 1}
                      </span>
                      {createPoints.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePointRow(idx)}
                          className="text-xs text-rose-600 hover:underline flex items-center gap-0.5"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4 text-xs">
                      <label>
                        <span className="text-[11px] font-medium text-slate-600">Ref Type *</span>
                        <select
                          value={point.ReferenceType}
                          onChange={(e) => handlePointChange(idx, 'ReferenceType', e.target.value)}
                          className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 font-mono"
                        >
                          <option value="EQUI">EQUI — Equipment</option>
                          <option value="FLOC">FLOC — Functional Location</option>
                        </select>
                      </label>

                      <label>
                        <span className="text-[11px] font-medium text-slate-600">Reference ID *</span>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 10000001"
                          value={point.ReferenceId}
                          onChange={(e) => handlePointChange(idx, 'ReferenceId', e.target.value)}
                          maxLength={30}
                          className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 font-mono"
                        />
                      </label>

                      <label className="sm:col-span-2">
                        <span className="text-[11px] font-medium text-slate-600">Physical Point Name *</span>
                        <input
                          type="text"
                          required
                          placeholder="e.g. P-101 SUCTION VALVE / MAIN BREAKER MCC-01"
                          value={point.IsolationPoint}
                          onChange={(e) =>
                            handlePointChange(idx, 'IsolationPoint', e.target.value.toUpperCase())
                          }
                          maxLength={60}
                          className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 font-mono font-bold"
                        />
                      </label>

                      <label>
                        <span className="text-[11px] font-medium text-slate-600">Discipline / Type *</span>
                        <select
                          value={point.IsolType}
                          onChange={(e) => handlePointChange(idx, 'IsolType', e.target.value)}
                          className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 font-mono text-xs"
                        >
                          {(isolationTypes.length > 0 ? isolationTypes : [
                            { Config_Code: 'ELEC', Config_Desc: 'ELECTRICAL' },
                            { Config_Code: 'INHOVR', Config_Desc: 'INHIBITS AND OVERRIDES' },
                            { Config_Code: 'MECH', Config_Desc: 'PROCESS/MECHANICAL' }
                          ]).map((t) => (
                            <option key={t.Config_Code} value={t.Config_Code}>
                              {t.Config_Desc} ({t.Config_Code})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span className="text-[11px] font-medium text-slate-600">Isolation Method *</span>
                        <select
                          value={point.IsolMethod}
                          onChange={(e) => handlePointChange(idx, 'IsolMethod', e.target.value)}
                          className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 font-mono text-xs"
                        >
                          {(isolMethods.length > 0 ? isolMethods : [
                            { Config_Code: 'VALVE_CC', Config_Desc: 'VALVE (C/C)' },
                            { Config_Code: 'VALVE_CO', Config_Desc: 'VALVE (C/O)' },
                            { Config_Code: 'CB_RIRO', Config_Desc: 'CIRCUIT BREAKER (RI/RO)' },
                            { Config_Code: 'FUSE', Config_Desc: 'FUSE' },
                            { Config_Code: 'SPADE_INS', Config_Desc: 'SPADE INSERTED' },
                            { Config_Code: 'LOCKBOX_LR', Config_Desc: 'LOCKBOX/HASP (L/R)' }
                          ]).map((m) => (
                            <option key={m.Config_Code} value={m.Config_Code}>
                              {m.Config_Desc} ({m.Config_Code})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span className="text-[11px] font-medium text-slate-600">Isolated State *</span>
                        <select
                          value={point.IsolatedState}
                          onChange={(e) => handlePointChange(idx, 'IsolatedState', e.target.value)}
                          className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 font-mono text-xs"
                        >
                          {(isolatedStates.length > 0 ? isolatedStates : [
                            { Config_Code: 'CLOSED', Config_Desc: 'CLOSED' },
                            { Config_Code: 'OPEN', Config_Desc: 'OPEN' },
                            { Config_Code: 'LOCKED', Config_Desc: 'LOCKED' },
                            { Config_Code: 'RACKED_OUT', Config_Desc: 'RACKED OUT' },
                            { Config_Code: 'APPLIED', Config_Desc: 'APPLIED' }
                          ]).map((s) => (
                            <option key={s.Config_Code} value={s.Config_Code}>
                              {s.Config_Desc} ({s.Config_Code})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span className="text-[11px] font-medium text-slate-600">De-Isolated State *</span>
                        <select
                          value={point.DeIsolatedState || 'NORMAL'}
                          onChange={(e) => handlePointChange(idx, 'DeIsolatedState', e.target.value)}
                          className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 font-mono text-xs"
                        >
                          {(deisolatedStates.length > 0 ? deisolatedStates : [
                            { Config_Code: 'NORMAL', Config_Desc: 'NORMAL' },
                            { Config_Code: 'RESTORED', Config_Desc: 'RESTORED' },
                            { Config_Code: 'OPEN', Config_Desc: 'OPEN' },
                            { Config_Code: 'CLOSED', Config_Desc: 'CLOSED' },
                            { Config_Code: 'CONNECTED', Config_Desc: 'CONNECTED' },
                            { Config_Code: 'UNLOCKED', Config_Desc: 'UNLOCKED' }
                          ]).map((d) => (
                            <option key={d.Config_Code} value={d.Config_Code}>
                              {d.Config_Desc} ({d.Config_Code})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span className="text-[11px] font-medium text-slate-600">Lock / Tag # *</span>
                        <input
                          type="text"
                          required
                          placeholder="e.g. LT-0001"
                          value={point.LockTagNo}
                          onChange={(e) =>
                            handlePointChange(idx, 'LockTagNo', e.target.value.toUpperCase())
                          }
                          maxLength={30}
                          className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 font-mono font-bold"
                        />
                      </label>

                      <label className="sm:col-span-4">
                        <span className="text-[11px] font-medium text-slate-600">Point Remarks</span>
                        <input
                          type="text"
                          placeholder="e.g. Double block and bleed confirmed with field operator"
                          value={point.Remarks}
                          onChange={(e) => handlePointChange(idx, 'Remarks', e.target.value)}
                          maxLength={255}
                          className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 text-xs"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submission Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || saveUncertain}
                className="inline-flex items-center gap-2 rounded-lg bg-[#006398] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#004f7a] shadow-sm disabled:opacity-50 transition-colors"
              >
                {isSubmitting && (
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                )}
                <span>Save Isolation Certificate to SAP</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {selectedIso && viewMode === 'detail' && <CertificateActions key={selectedIso.IsolationNo} certificate={selectedIso} user={user} onUpdated={updated => { setSelectedIso(updated); setIsolations(rows => rows.map(row => row.IsolationNo === updated.IsolationNo ? updated : row)); }} />}
      {saveUncertain && <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">SAP save outcome is unconfirmed. Check existing certificates and audit in SAP before another save.</p>}
      {/* MODE / MODAL: EDIT CERTIFICATE & LINK PERMIT */}
      {showEditModal && editingIso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-[#006398]">
                  <span className="material-symbols-outlined text-[20px]">edit_document</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    Edit Isolation Certificate
                    <span className="font-mono text-xs text-[#006398] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {editingIso.IsolationNo}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Edit certificate remarks in SAP
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 transition"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Permit Number Field */}
              <p className="text-sm">Linked permit: {editingIso.PermitNo || 'Unassigned'} · Status: {editingIso.Status}. SAP controls status and permit linkage is immutable.</p>
              {/* Remarks Field */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">Certificate Remarks / Scope</label>
                <textarea
                  rows={3}
                  maxLength={255}
                  placeholder="Enter isolation notes, equipment details, or permit reference..."
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398]"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingEdit || saveUncertain}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#006398] hover:bg-[#004f7a] text-white font-bold shadow-xs disabled:opacity-50 transition active:scale-[0.98]"
                >
                  {isSavingEdit ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving to SAP...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IsolationWorkspace;
