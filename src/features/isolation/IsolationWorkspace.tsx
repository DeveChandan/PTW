import { CertificateActions } from './CertificateActions';
import { WorkflowUnconfirmedError } from '../../core/api/modules/backendWorkflow.api';
import { createPortal } from 'react-dom';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ModuleId, SapUser } from '../../core/auth/sapAuthContext';
import {
  type SapIsolationHeader,
  type SapIsolationItem,
  isPointNormalized,
  isPointIsolated,
  isPointZeroEnergy
} from '../../core/types/isolation.types';
import { isolationApi } from '../../core/api/modules/isolation.api';
import { sitePermitApi } from '../../core/api/modules/sitePermit.api';
import {
  auditLogApi,
  isPermitAuditLog,
  isIsolationItemAuditLog,
  isIsolationCertAuditLog
} from '../../core/api/modules/auditLog.api';
import type { AuditLogRecord } from '../../core/types/ptw.types';
import { configApi } from '../../core/api/modules/config.api';
import type { SapConfigRecord } from '../../core/types/config.types';
import { SectionCard } from '../../shared/components/SectionCard';
import { AttachmentManager } from '../../shared/components/AttachmentManager';
import { attachmentApi } from '../../core/api/modules/attachment.api';
import { toast } from '../../shared/context/ToastContext';
import {
  IsolationTemplatesModal,
  type ApplyIsolationTemplatePayload
} from './IsolationTemplatesModal';

interface IsolationWorkspaceProps {
  module: ModuleId;
  user: SapUser | null;
  onBack: () => void;
}

type ViewMode = 'list' | 'detail' | 'create';

export const formatItemNo = (raw: string | number | undefined | null, fallbackIndex?: number): string => {
  const s = String(raw ?? (fallbackIndex !== undefined ? fallbackIndex : '')).trim();
  return /^\d+$/.test(s) ? s.padStart(4, '0') : (s || '0001');
};

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

  // Creation Date Filter State (SAP OData V4 RequestedDate ge ... and RequestedDate le ...)
  const [datePreset, setDatePreset] = useState<'ALL' | 'LAST_WEEK' | 'TODAY' | 'THIS_MONTH' | 'LAST_30_DAYS' | 'CUSTOM'>('LAST_WEEK');
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  // De-Isolation & Point Normalization Modal State (normalizeItem)
  const [normalizingItem, setNormalizingItem] = useState<SapIsolationItem | null>(null);
  const [normalizeDeisolatedState, setNormalizeDeisolatedState] = useState<string>('NORMAL');
  const [normalizeReason, setNormalizeReason] = useState<string>('Restored state confirmed after de-isolation.');
  const [isNormalizing, setIsNormalizing] = useState<boolean>(false);

  // Sorting & Pagination State for Certificates List
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageJumpInput, setPageJumpInput] = useState<string>('1');
  const [sortField, setSortField] = useState<'IsolationNo' | 'PermitNo' | 'Status' | 'RequestedDate' | 'PointsCount'>('RequestedDate');
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('DESC');

  // Pagination for points within selected certificate detail
  const [pointsPage, setPointsPage] = useState<number>(1);
  const [pointsPageSize, setPointsPageSize] = useState<number>(10);

  // Isolation Audit Log State
  const [isoAuditLogs, setIsoAuditLogs] = useState<AuditLogRecord[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState<boolean>(false);
  const [auditSortDirection, setAuditSortDirection] = useState<'DESC' | 'ASC'>('DESC');
  const [isoAuditFilterTab, setIsoAuditFilterTab] = useState<'ALL' | 'CERT' | 'ITEMS' | 'PERMIT' | 'SEPARATE'>('ALL');
  const [isoAuditObjectIdSearch, setIsoAuditObjectIdSearch] = useState<string>('');

  const loadIsoAuditLogs = async (isolationNo?: string, permitNo?: string, forceRefresh = false) => {
    if (!isolationNo?.trim()) {
      setIsoAuditLogs([]);
      return;
    }
    setLoadingAuditLogs(true);
    try {
      const logs = await auditLogApi.getAuditLogsForIsolation(isolationNo, permitNo, undefined, forceRefresh);
      setIsoAuditLogs(logs);
    } catch {
      setIsoAuditLogs([]);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const sortedAuditLogs = useMemo(() => {
    return [...isoAuditLogs].sort((a, b) => {
      const dtA = a.EventAt ? Date.parse(a.EventAt) : 0;
      const dtB = b.EventAt ? Date.parse(b.EventAt) : 0;
      if (dtA !== dtB) {
        return auditSortDirection === 'DESC' ? dtB - dtA : dtA - dtB;
      }
      return auditSortDirection === 'DESC'
        ? (b.AuditId || '').localeCompare(a.AuditId || '')
        : (a.AuditId || '').localeCompare(b.AuditId || '');
    });
  }, [isoAuditLogs, auditSortDirection]);

  // Guarantee view changes (list, create, detail) open from the top
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [viewMode, selectedIso]);

  // Automatically fetch audit logs when viewing certificate details
  useEffect(() => {
    if (viewMode === 'detail' && selectedIso?.IsolationNo) {
      loadIsoAuditLogs(selectedIso.IsolationNo, selectedIso.PermitNo);
    } else if (viewMode !== 'detail') {
      setIsoAuditLogs([]);
    }
  }, [viewMode, selectedIso?.IsolationNo]);

  const showNotification = (type: 'success' | 'error' | 'info' | 'warning', text: string) => {
    setNotification({ type: type === 'warning' ? 'error' : type, text });
    if (type === 'error') {
      toast.error(text, { title: 'Isolation Error' });
    } else if (type === 'warning') {
      toast.warning(text, { title: 'Mandatory Field Missing' });
    } else if (type === 'success') {
      toast.success(text, { title: 'Isolation Updated' });
    } else {
      toast.info(text);
    }
  };

  // Dropdown Configs from SAP OData
  const [isolationTypes, setIsolationTypes] = useState<SapConfigRecord[]>([]);
  const [isolatedStates, setIsolatedStates] = useState<SapConfigRecord[]>([]);
  const [isolMethods, setIsolMethods] = useState<SapConfigRecord[]>([]);
  const [deisolatedStates, setDeisolatedStates] = useState<SapConfigRecord[]>([]);

  // New Isolation Creation Form State
  const [createPermitNo, setCreatePermitNo] = useState<string>('');
  const [createDescription, setCreateDescription] = useState<string>('');
  const [createRemarks, setCreateRemarks] = useState<string>('');
  const [createPoints, setCreatePoints] = useState<Array<Omit<SapIsolationItem, 'IsolationNo' | 'ItemNo'>>>([
    {
      ReferenceType: 'EQUI',
      ReferenceId: '',
      IsolationPoint: '',
      IsolType: 'MECH',
      IsolMethod: 'VALVE',
      IsolatedState: 'CLOSED',
      DeIsolatedState: '',
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
  const [createIsTemplate, setCreateIsTemplate] = useState<boolean>(false);
  const [createAttachments, setCreateAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [availablePermits, setAvailablePermits] = useState<string[]>([]);
  // Isolation Template Modal State
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);

  const handleApplyTemplate = (payload: ApplyIsolationTemplatePayload) => {
    setCreateDescription(payload.description || '');
    setCreateRemarks(payload.remarks || '');
    if (payload.points && payload.points.length > 0) {
      setCreatePoints(
        payload.points.map((p) => ({
          ReferenceType: p.ReferenceType || 'EQUI',
          ReferenceId: p.ReferenceId || '',
          IsolationPoint: p.IsolationPoint || '',
          IsolType: p.IsolType || 'MECH',
          IsolMethod: p.IsolMethod || 'VALVE',
          IsolatedState: p.IsolatedState || 'CLOSED',
          DeIsolatedState: p.DeIsolatedState || '',
          LockTagNo: p.LockTagNo || '',
          IsIsolated: '',
          IsolatedBy: '',
          IsolatedAt: null,
          ZeroEnergyConf: '',
          ZeroEnergyBy: '',
          ZeroEnergyAt: null,
          IsNormalized: '',
          NormalizedBy: '',
          NormalizedAt: null,
          Remarks: p.Remarks || ''
        }))
      );
    }
    setViewMode('create');
    setShowTemplateModal(false);
    toast.success(
      `Applied template "${payload.sourceTitle || payload.description}" (${payload.points.length} points loaded).`,
      { title: 'Isolation Template Applied' }
    );
  };

  const handleUseCertificateAsTemplate = (iso: SapIsolationHeader) => {
    setCreateDescription(iso.description ? `${iso.description} (Copy)` : `Isolation based on ${iso.IsolationNo}`);
    setCreateRemarks(iso.Remarks || '');
    if (iso._Item && iso._Item.length > 0) {
      setCreatePoints(
        iso._Item.map((p) => ({
          ReferenceType: p.ReferenceType || 'EQUI',
          ReferenceId: p.ReferenceId || '',
          IsolationPoint: p.IsolationPoint || '',
          IsolType: p.IsolType || 'MECH',
          IsolMethod: p.IsolMethod || 'VALVE',
          IsolatedState: p.IsolatedState || 'CLOSED',
          DeIsolatedState: p.DeIsolatedState || '',
          LockTagNo: p.LockTagNo || '',
          IsIsolated: '',
          IsolatedBy: '',
          IsolatedAt: null,
          ZeroEnergyConf: '',
          ZeroEnergyBy: '',
          ZeroEnergyAt: null,
          IsNormalized: '',
          NormalizedBy: '',
          NormalizedAt: null,
          Remarks: p.Remarks || ''
        }))
      );
    }
    setCreateIsTemplate(false);
    setViewMode('create');
    toast.success(
      `Loaded ${iso._Item?.length || 0} points from certificate ${iso.IsolationNo} into create form.`,
      { title: 'Template Loaded' }
    );
  };
  // Edit Certificate Modal State
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingIso, setEditingIso] = useState<SapIsolationHeader | null>(null);
  const [editPermitNo, setEditPermitNo] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editRemarks, setEditRemarks] = useState<string>('');
  const [saveUncertain, setSaveUncertain] = useState(false);
  const submissionLock = useRef(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleOpenEdit = async (iso: SapIsolationHeader) => {
    loadAvailablePermits();
    try {
      const current = await isolationApi.read(iso.IsolationNo);
      if (!current) throw new Error('SAP did not return this certificate.');
      setEditingIso(current);
      setEditPermitNo(current.PermitNo || '');
      setEditDescription(current.description || '');
      setEditRemarks(current.Remarks || '');
      setShowEditModal(true);
    } catch (reason) {
      showNotification('error', reason instanceof Error ? reason.message : 'Unable to load the current certificate.');
    }
  };

  const handleOpenDetail = async (iso: SapIsolationHeader) => {
    setSelectedIso(iso);
    setViewMode('detail');
    loadIsoAuditLogs(iso.IsolationNo, iso.PermitNo);
    try {
      const current = await isolationApi.read(iso.IsolationNo);
      if (current) {
        setSelectedIso(current);
        setIsolations((rows) =>
          rows.map((row) => (row.IsolationNo === current.IsolationNo ? current : row))
        );
        loadIsoAuditLogs(current.IsolationNo, current.PermitNo);
      }
    } catch {
      // Detail view keeps list snapshot and CertificateActions reload lets the user retry
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIso || submissionLock.current || saveUncertain) return;
    submissionLock.current = true;

    setIsSavingEdit(true);
    setNotification(null);

    try {
      const trimmedPermit = editPermitNo.trim().toUpperCase();
      const normalizedPermit = /^\d+$/.test(trimmedPermit) && trimmedPermit.length < 10
        ? trimmedPermit.padStart(10, '0')
        : trimmedPermit;

      const updated = await isolationApi.update(editingIso.IsolationNo, {
        PermitNo: normalizedPermit,
        description: editDescription.trim(),
        Remarks: editRemarks.trim()
      }, editingIso['@odata.etag']);

      // Also sync link to PermitInfo in SAP if permit specified or unassigned
      if (normalizedPermit) {
        await sitePermitApi.updateIsolationLink(normalizedPermit, editingIso.IsolationNo);
      } else if (editingIso.PermitNo) {
        await sitePermitApi.updateIsolationLink(editingIso.PermitNo, '');
      }

      const effectivePermitNo = updated.PermitNo !== undefined && updated.PermitNo !== '' 
        ? updated.PermitNo 
        : normalizedPermit;

      const finalUpdated: SapIsolationHeader = {
        ...updated,
        PermitNo: effectivePermitNo
      };

      // Update in state
      setIsolations((prev) =>
        prev.map((i) => (i.IsolationNo === finalUpdated.IsolationNo ? { ...i, ...finalUpdated, _Item: finalUpdated._Item || i._Item } : i))
      );
      if (selectedIso && selectedIso.IsolationNo === finalUpdated.IsolationNo) {
        setSelectedIso((prev) => (prev ? { ...prev, ...finalUpdated, _Item: finalUpdated._Item || prev._Item } : null));
        loadIsoAuditLogs(finalUpdated.IsolationNo, finalUpdated.PermitNo, true);
      }

      showNotification(
        'success',
        `Isolation Certificate ${finalUpdated.IsolationNo} successfully updated. Linked Permit: ${
          effectivePermitNo ? effectivePermitNo : 'Unassigned'
        }.`
      );
      setShowEditModal(false);
    } catch (err) {
      if (err instanceof WorkflowUnconfirmedError) setSaveUncertain(true);
      showNotification(
        'error',
        err instanceof Error ? err.message : 'Failed to update isolation certificate.'
      );
    } finally {
      submissionLock.current = false; setIsSavingEdit(false);
    }
  };

  // LOTO Safety Protocol: Points must be de-isolated in exact reverse order of isolation creation
  const isItemEligibleForDeisolation = (item: SapIsolationItem): {
    eligible: boolean;
    reason?: string;
    nextItemNo?: string;
    stepIndex?: number;
    totalSteps?: number;
  } => {
    if (selectedIso?.Status === 'NORM') {
      return {
        eligible: false,
        reason: 'Certificate is already completely de-isolated and normalized.',
      };
    }
    if (selectedIso?.Status !== 'ISOL' && selectedIso?.Status !== 'APPR') {
      return {
        eligible: false,
        reason: 'Certificate must be approved (ISOL) in SAP before points can be de-isolated.',
      };
    }
    if (isPointNormalized(item)) {
      return {
        eligible: false,
        reason: 'This point has already been de-isolated and restored.',
      };
    }

    const allItems = selectedIso._Item || [];
    if (!allItems.length) {
      return { eligible: true };
    }

    // Sort by ItemNo numerically to establish original creation order (0001, 0002, 0003...)
    const creationOrder = [...allItems].sort((a, b) => {
      const numA = parseInt(String(a.ItemNo || '').replace(/\D/g, ''), 10);
      const numB = parseInt(String(b.ItemNo || '').replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return allItems.indexOf(a) - allItems.indexOf(b);
    });

    const unnormalized = creationOrder.filter((p) => !isPointNormalized(p));
    if (unnormalized.length === 0) {
      return { eligible: false, reason: 'All points are already normalized.' };
    }

    // Reverse sequence: the highest/last unnormalized point in creation sequence must be de-isolated first
    const target = unnormalized[unnormalized.length - 1];
    const currentKey = formatItemNo(item.ItemNo);
    const targetKey = formatItemNo(target.ItemNo);

    if (currentKey === targetKey) {
      const stepIndex = allItems.length - unnormalized.length + 1;
      return {
        eligible: true,
        stepIndex,
        totalSteps: allItems.length,
      };
    }

    return {
      eligible: false,
      reason: `LOTO Safety Rule: Points must be de-isolated in reverse order of creation. Item #${targetKey} must be de-isolated before Item #${currentKey}.`,
      nextItemNo: targetKey,
    };
  };

  const nextDeisolationTarget = useMemo(() => {
    if (!selectedIso?._Item || (selectedIso.Status !== 'ISOL' && selectedIso.Status !== 'APPR')) {
      return null;
    }
    const creationOrder = [...selectedIso._Item].sort((a, b) => {
      const numA = parseInt(String(a.ItemNo || '').replace(/\D/g, ''), 10);
      const numB = parseInt(String(b.ItemNo || '').replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return selectedIso._Item.indexOf(a) - selectedIso._Item.indexOf(b);
    });
    const unnormalized = creationOrder.filter((p) => !isPointNormalized(p));
    return unnormalized.length ? unnormalized[unnormalized.length - 1] : null;
  }, [selectedIso]);

  const handleOpenNormalizeModal = (item: SapIsolationItem, fallbackIndex?: number) => {
    const eligibility = isItemEligibleForDeisolation(item);
    if (!eligibility.eligible) {
      const msg = eligibility.reason || 'Points must be de-isolated in reverse order of creation.';
      showNotification('warning', msg);
      toast.warning(msg, { title: 'LOTO Sequence Violation' });
      return;
    }
    const paddedNo = formatItemNo(item.ItemNo, fallbackIndex);
    setNormalizingItem({ ...item, ItemNo: paddedNo });
    setNormalizeDeisolatedState(item.DeIsolatedState?.trim() || 'NORMAL');
    setNormalizeReason('Restored state confirmed after de-isolation.');
  };

  const handleExecuteNormalizeItem = async () => {
    if (!selectedIso?.IsolationNo || !normalizingItem?.ItemNo) return;
    const eligibility = isItemEligibleForDeisolation(normalizingItem);
    if (!eligibility.eligible) {
      const msg = eligibility.reason || 'Points must be de-isolated in reverse order of creation.';
      showNotification('warning', msg);
      toast.warning(msg, { title: 'LOTO Sequence Violation' });
      return;
    }
    const cleanItemNo = formatItemNo(normalizingItem.ItemNo);
    const targetState = normalizeDeisolatedState.trim() || 'NORMAL';
    const targetReason = normalizeReason.trim() || 'Restored state confirmed after de-isolation.';
    setIsNormalizing(true);
    try {
      await isolationApi.normalizeItem(
        selectedIso.IsolationNo,
        cleanItemNo,
        targetReason,
        targetState
      );
      showNotification(
        'success',
        `SAP confirmed de-isolation for Item #${cleanItemNo} (${normalizingItem.IsolationPoint}) to state ${targetState}.`
      );
      toast.success(
        `Point #${cleanItemNo} (${normalizingItem.IsolationPoint}) restored to ${targetState} in SAP.`,
        { title: 'Point Normalized' }
      );
      setNormalizingItem(null);
      // Reload updated certificate from SAP
      const refreshed = await isolationApi.read(selectedIso.IsolationNo);
      if (refreshed) {
        setSelectedIso(refreshed);
        setIsolations((prev) =>
          prev.map((i) => (i.IsolationNo === refreshed.IsolationNo ? refreshed : i))
        );
        loadIsoAuditLogs(refreshed.IsolationNo, refreshed.PermitNo, true);
      } else {
        loadIsoAuditLogs(selectedIso.IsolationNo, selectedIso.PermitNo, true);
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to normalize item in SAP.';
      // If SAP informs us that the item has already been normalized, reload the certificate to sync state
      if ((msg.includes('already been normalized') || msg.includes('already normalized')) && selectedIso?.IsolationNo) {
        try {
          const refreshed = await isolationApi.read(selectedIso.IsolationNo);
          if (refreshed) {
            setSelectedIso(refreshed);
            setIsolations((prev) =>
              prev.map((i) => (i.IsolationNo === refreshed.IsolationNo ? refreshed : i))
            );
          }
        } catch {
          // ignore read error
        }
        setNormalizingItem(null);
        toast.info(`Point #${cleanItemNo} is already normalized in SAP. Certificate state refreshed.`, {
          title: 'Already Normalized'
        });
        return;
      }
      showNotification('error', msg);
      toast.error(msg, { title: 'Normalization Failed' });
    } finally {
      setIsNormalizing(false);
    }
  };

  // Helper to apply quick creation date presets matching SAP OData V4 RequestedDate filter
  const applyDatePreset = (preset: 'ALL' | 'LAST_WEEK' | 'TODAY' | 'THIS_MONTH' | 'LAST_30_DAYS') => {
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
    }

    setDateFrom(from);
    setDateTo(to);
    setCurrentPage(1);
    void loadIsolations(from, to, false);
  };

  const loadIsolations = async (
    overrideDateFrom?: string,
    overrideDateTo?: string,
    forceRefresh = false
  ) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    const effDateFrom = overrideDateFrom !== undefined ? overrideDateFrom : dateFrom;
    const effDateTo = overrideDateTo !== undefined ? overrideDateTo : dateTo;
    try {
      const data = await isolationApi.list({
        dateFrom: effDateFrom || undefined,
        dateTo: effDateTo || undefined,
        signal: controller.signal,
        forceRefresh
      });
      if (!controller.signal.aborted) {
        setIsolations(data);
      }
    } catch (err) {
      if (err instanceof WorkflowUnconfirmedError) setSaveUncertain(true);
      if (!controller.signal.aborted) {
        showNotification(
          'error',
          err instanceof Error ? err.message : 'Failed to fetch isolation records from SAP.'
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  // Lazy load permits list ONLY when creating/linking an isolation certificate (reduces API calls in display view)
  const loadAvailablePermits = () => {
    if (availablePermits.length > 0) return;
    sitePermitApi.list({ top: 50, type: 'ALL', status: 'ALL' }).then((res) => {
      setAvailablePermits(res.map((p) => p.Permit_No).filter(Boolean));
    }).catch(() => {
      try {
        if (import.meta.env.DEV && typeof window !== 'undefined' && window.localStorage) {
          const stored = JSON.parse(window.localStorage.getItem('ptw_recent_created_permits') || '[]');
          setAvailablePermits(stored.map((p: any) => p?.Permit_No).filter(Boolean));
        }
      } catch {}
    });
  };

  useEffect(() => {
    if (viewMode === 'create' || module === 'create-isolation') {
      loadAvailablePermits();
    }
  }, [viewMode, module]);

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
        (iso.description && iso.description.toLowerCase().includes(q)) ||
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
        (statusFilter === 'NORM' && iso.Status === 'NORM') ||
        (statusFilter === 'TEMPLATE' && iso.IsTemplate === 'X');

      return matchesSearch && matchesStatus;
    });
  }, [isolations, searchQuery, statusFilter]);

  // Sorted Isolations
  const sortedIsolations = useMemo(() => {
    const list = [...filteredIsolations];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'IsolationNo') {
        cmp = a.IsolationNo.localeCompare(b.IsolationNo);
      } else if (sortField === 'PermitNo') {
        cmp = (a.PermitNo || '').localeCompare(b.PermitNo || '');
      } else if (sortField === 'Status') {
        cmp = (a.Status || '').localeCompare(b.Status || '');
      } else if (sortField === 'RequestedDate') {
        const dateA = `${a.RequestedDate || ''} ${a.RequestedTime || ''}`;
        const dateB = `${b.RequestedDate || ''} ${b.RequestedTime || ''}`;
        cmp = dateA.localeCompare(dateB);
      } else if (sortField === 'PointsCount') {
        cmp = (a._Item?.length || 0) - (b._Item?.length || 0);
      }
      return sortDirection === 'ASC' ? cmp : -cmp;
    });
    return list;
  }, [filteredIsolations, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedIsolations.length / pageSize));

  // Reset page when search or status filter or pageSize changes
  useEffect(() => {
    setCurrentPage(1);
    setPageJumpInput('1');
  }, [searchQuery, statusFilter, pageSize]);

  // Sync jump input when page changes
  useEffect(() => {
    setPageJumpInput(String(currentPage));
  }, [currentPage]);

  // Reset points page when selected certificate changes
  useEffect(() => {
    setPointsPage(1);
  }, [selectedIso?.IsolationNo]);

  const paginatedIsolations = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedIsolations.slice(startIndex, startIndex + pageSize);
  }, [sortedIsolations, currentPage, pageSize]);

  const paginatedPoints = useMemo(() => {
    if (!selectedIso?._Item) return [];
    const startIndex = (pointsPage - 1) * pointsPageSize;
    return selectedIso._Item.slice(startIndex, startIndex + pointsPageSize);
  }, [selectedIso?._Item, pointsPage, pointsPageSize]);

  const totalPointsPages = Math.max(1, Math.ceil((selectedIso?._Item?.length || 0) / pointsPageSize));

  const handleSort = (field: 'IsolationNo' | 'PermitNo' | 'Status' | 'RequestedDate' | 'PointsCount') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortField(field);
      setSortDirection('ASC');
    }
  };

  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(pageJumpInput, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      setCurrentPage(target);
    } else {
      setPageJumpInput(String(currentPage));
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const total = isolations.length;
    const crtd = isolations.filter((i) => i.Status === 'CRTD').length;
    const isol = isolations.filter((i) => i.Status === 'ISOL').length;
    const norm = isolations.filter((i) => i.Status === 'NORM').length;
    const templates = isolations.filter((i) => i.IsTemplate === 'X').length;
    const totalPoints = isolations.reduce((acc, curr) => acc + (curr._Item?.length || 0), 0);
    return { total, crtd, isol, norm, templates, totalPoints };
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
        IsolMethod: 'VALVE',
        IsolatedState: 'CLOSED',
        DeIsolatedState: '',
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
    if (!createPoints.length) {
      showNotification('warning', 'Please add at least one isolation point.');
      return;
    }
    if (createPoints.some((p) => !p.IsolationPoint.trim() || !p.ReferenceId.trim())) {
      showNotification('warning', 'Please specify the Reference ID and physical isolation point name for all points.');
      return;
    }

    submissionLock.current = true;
    setIsSubmitting(true);
    setNotification(null);

    try {
      const trimmedPermit = createPermitNo.trim().toUpperCase();
      const normalizedPermit = /^\d+$/.test(trimmedPermit) && trimmedPermit.length < 10
        ? trimmedPermit.padStart(10, '0')
        : trimmedPermit;

      const payload: Partial<SapIsolationHeader> = {
        PermitNo: normalizedPermit,
        description: createDescription.trim(),
        Remarks: createRemarks.trim(),
        IsTemplate: createIsTemplate ? 'X' : ' ',
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

      // If user staged attachments during creation, upload & link to new isolation in SAP DMS
      if (createAttachments.length > 0 && result.IsolationNo) {
        try {
          showNotification('info', `Uploading ${createAttachments.length} document(s) to SAP DMS...`);
          const uploadRes = await attachmentApi.uploadAndLinkMultipleFiles(
            createAttachments,
            'ISOLATION',
            result.IsolationNo
          );
          if (uploadRes.successful.length > 0) {
            toast.success(
              `Uploaded and linked ${uploadRes.successful.length} attachment(s) to ${result.IsolationNo} in DMS.`,
              { title: 'Isolation Attachments Saved' }
            );
          }
          if (uploadRes.failed.length > 0) {
            toast.warning(
              `Uploaded ${uploadRes.successful.length} file(s), but ${uploadRes.failed.length} failed. Check the attachments panel.`,
              { title: 'Partial Attachment Upload' }
            );
          }
        } catch (attErr) {
          console.error('[IsolationWorkspace] Attachment upload failure:', attErr);
          toast.warning(
            'Isolation certificate created in SAP, but automatic attachment upload failed. You can re-upload attachments from the certificate details.',
            { title: 'Attachment Notice' }
          );
        }
      }

      // If created with a target permit number, sync the link on PermitInfo in SAP
      if (normalizedPermit && result.IsolationNo) {
        try {
          await sitePermitApi.updateIsolationLink(normalizedPermit, result.IsolationNo);
        } catch (linkErr) {
          console.warn('[IsolationWorkspace] Could not link permit to new isolation certificate:', linkErr);
        }
      }

      showNotification(
        'success',
        `Isolation Certificate ${result.IsolationNo} successfully created and registered in SAP database.`
      );
      await loadIsolations();
      setSelectedIso(result);
      setViewMode('detail');
      // Reset form
      setCreatePermitNo('');
      setCreateDescription('');
      setCreateRemarks('');
      setCreateIsTemplate(false);
      setCreateAttachments([]);
      setCreatePoints([
        {
          ReferenceType: 'EQUI',
          ReferenceId: '',
          IsolationPoint: '',
          IsolType: 'MECH',
          IsolMethod: 'VALVE',
          IsolatedState: 'CLOSED',
          DeIsolatedState: '',
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
      showNotification(
        'error',
        err instanceof Error ? err.message : 'Error submitting isolation certificate.'
      );
    } finally {
      submissionLock.current = false; setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-7">
      {/* Top Banner / Breadcrumb & Global Toolbar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="group inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-mono font-bold text-slate-700 shadow-2xs transition-all duration-200 hover:border-[#006398] hover:bg-slate-50 hover:text-[#006398] active:scale-[0.98] cursor-pointer"
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
              <span className="font-semibold text-slate-700">Isolation & LOTO Registry</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
              <span>Zero-Energy (LOTO)</span>
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20 shrink-0">
              <span className="material-symbols-outlined text-[24px]">lock_reset</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-display font-extrabold tracking-tight text-slate-900">
                Positive Isolation & LOTO Registry
              </h1>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Zero-Energy Breaker, Valve Lock & Blind Flange Registry (SAP OData V4)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#006398] px-4 py-2 text-xs font-bold text-white hover:bg-[#004f7a] shadow-sm transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              New Isolation Certificate
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowTemplateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/90 hover:bg-indigo-100 text-indigo-700 px-3.5 py-2 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            title="Browse and use reusable isolation templates"
          >
            <span className="material-symbols-outlined text-[17px]">bookmark</span>
            <span>Use Isolation Template</span>
          </button>

          <button
            type="button"
            onClick={() => void loadIsolations(dateFrom, dateTo, true)}
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

      {/* MODE 1: LIST / BROWSE CERTIFICATES */}
      {viewMode === 'list' && (
        <>
          {/* KPI Overview Metrics Strip with Interactive Filtering & Layered Depth */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-5">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`text-left rounded-2xl border p-4 shadow-[0_1px_3px_0_rgba(15,23,42,0.04),0_6px_16px_-4px_rgba(15,23,42,0.06),inset_0_1px_0_0_rgba(255,255,255,1)] hover:-translate-y-0.5 transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'border-[#006398] bg-sky-50/60 ring-2 ring-[#006398]/20 shadow-sm'
              : 'border-slate-200/90 bg-gradient-to-br from-white via-slate-50/70 to-slate-100/50'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Certificates
            </span>
            <span className="material-symbols-outlined text-[18px] text-slate-400">verified</span>
          </div>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-800">{stats.total}</p>
          <span className="text-[10px] text-slate-500 font-mono">All Records</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('CRTD')}
          className={`text-left rounded-2xl border p-4 shadow-[0_1px_3px_0_rgba(15,23,42,0.03),0_6px_18px_-4px_rgba(217,119,6,0.12),inset_0_1px_0_0_rgba(255,255,255,1)] hover:-translate-y-0.5 transition-all cursor-pointer ${
            statusFilter === 'CRTD'
              ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20 shadow-sm'
              : 'border-amber-200/90 bg-gradient-to-br from-white via-[#fffef7] to-amber-50/70'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700">
              Draft (CRTD)
            </span>
            <span className="material-symbols-outlined text-[18px] text-amber-600">edit_document</span>
          </div>
          <p className="mt-1 font-mono text-2xl font-bold text-amber-900">{stats.crtd}</p>
          <span className="text-[10px] text-amber-700 font-mono">Pending Lockout</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('ISOL')}
          className={`text-left rounded-2xl border p-4 shadow-[0_1px_3px_0_rgba(15,23,42,0.03),0_6px_18px_-4px_rgba(0,99,152,0.12),inset_0_1px_0_0_rgba(255,255,255,1)] hover:-translate-y-0.5 transition-all cursor-pointer ${
            statusFilter === 'ISOL'
              ? 'border-[#006398] bg-sky-50 ring-2 ring-[#006398]/20 shadow-sm'
              : 'border-sky-200/90 bg-gradient-to-br from-white via-[#f5f9fe] to-sky-50/70'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-700">
              Isolated (ISOL)
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#006398]">lock</span>
          </div>
          <p className="mt-1 font-mono text-2xl font-bold text-blue-900">{stats.isol}</p>
          <span className="text-[10px] text-blue-700 font-mono">Active Lockouts</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('NORM')}
          className={`text-left rounded-2xl border p-4 shadow-[0_1px_3px_0_rgba(15,23,42,0.03),0_6px_18px_-4px_rgba(5,150,105,0.12),inset_0_1px_0_0_rgba(255,255,255,1)] hover:-translate-y-0.5 transition-all cursor-pointer ${
            statusFilter === 'NORM'
              ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20 shadow-sm'
              : 'border-emerald-200/90 bg-gradient-to-br from-white via-[#f4fbf7] to-emerald-50/70'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">
              Normalized (NORM)
            </span>
            <span className="material-symbols-outlined text-[18px] text-emerald-600">lock_open</span>
          </div>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-900">{stats.norm}</p>
          <span className="text-[10px] text-emerald-700 font-mono">Restored Energy</span>
        </button>

        <div className="rounded-2xl border border-orange-200/90 bg-gradient-to-br from-white via-[#fffdf8] to-orange-50/70 p-4 shadow-[0_1px_3px_0_rgba(15,23,42,0.03),0_6px_18px_-4px_rgba(234,88,12,0.12),inset_0_1px_0_0_rgba(255,255,255,1)] hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-orange-700">
              Points Locked
            </span>
            <span className="material-symbols-outlined text-[18px] text-orange-600">key</span>
          </div>
          <p className="mt-1 font-mono text-2xl font-bold text-orange-900">{stats.totalPoints}</p>
          <span className="text-[10px] text-orange-700 font-mono">Total Physical Points</span>
        </div>
      </div>

        <SectionCard
          theme="amber"
          sectionTag="LOTO REGISTRY"
          title="Isolation Certificate Registry"
          subtitle="Positive zero-energy lockouts, breaker tags, and physical isolation certificates."
          icon="lock"
          badge={
            <span className="px-2.5 py-0.5 rounded-full font-mono text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {sortedIsolations.length} Certificates
            </span>
          }
        >
          <div className="space-y-4">
            {/* Search & Filter Toolbar with Proper Spacing */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 shadow-2xs">
              <div className="flex flex-1 items-center gap-2.5 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs focus-within:ring-2 focus-within:ring-[#006398]/20 focus-within:border-[#006398] transition-all">
                <span className="material-symbols-outlined text-slate-400 text-[19px]">search</span>
                <input
                  type="text"
                  placeholder="Search certificate #, linked permit #, requested by, point name, lock/tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs outline-none bg-transparent placeholder-slate-400 font-sans text-slate-800"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                  </button>
                )}
                <span className="text-[10px] font-mono font-bold text-slate-400 border-l border-slate-200 pl-2 shrink-0">
                  {sortedIsolations.length} found
                </span>
              </div>

              <div className="flex items-center gap-3 flex-wrap justify-between lg:justify-end">
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-xs text-slate-500 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">filter_alt</span>
                    <span>Status:</span>
                  </span>
                  <div className="inline-flex rounded-xl bg-slate-200/60 p-1 gap-1">
                    {[
                      { id: 'ALL', label: 'All', count: stats.total },
                      { id: 'CRTD', label: 'CRTD', count: stats.crtd },
                      { id: 'ISOL', label: 'ISOL', count: stats.isol },
                      { id: 'NORM', label: 'NORM', count: stats.norm },
                      { id: 'TEMPLATE', label: 'Templates', count: stats.templates }
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setStatusFilter(st.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          statusFilter === st.id
                            ? 'bg-[#006398] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                        }`}
                      >
                        <span>{st.label}</span>
                        <span className={`text-[10px] px-1 py-0.2 rounded-full font-bold ${
                          statusFilter === st.id ? 'bg-white/20 text-white' : 'bg-slate-300/60 text-slate-600'
                        }`}>
                          {st.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Page Size Dropdown */}
                <div className="flex items-center gap-1.5 font-mono text-xs text-slate-500">
                  <span>Show:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-slate-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#006398] cursor-pointer"
                  >
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Creation Date Filter Bar (SAP OData V4 RequestedDate ge ... and RequestedDate le ...) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 shadow-2xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
                  <span className="material-symbols-outlined text-[16px] text-amber-700">calendar_month</span>
                  <span>Requested:</span>
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
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-600/15'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
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
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">From:</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDatePreset('CUSTOM');
                      setDateFrom(val);
                      setCurrentPage(1);
                      void loadIsolations(val, dateTo);
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
                      setCurrentPage(1);
                      void loadIsolations(dateFrom, val);
                    }}
                    className="text-slate-700 bg-transparent font-mono outline-hidden cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Row: Active Filter Summary, Reset, & Result Counts */}
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {(statusFilter !== 'ALL' || dateFrom || dateTo || searchQuery) ? (
                  <>
                    <span className="text-[11px] font-medium text-slate-500">Active Filters:</span>
                    {statusFilter !== 'ALL' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-300">
                        <span>Status: {statusFilter}</span>
                        <button
                          type="button"
                          onClick={() => setStatusFilter('ALL')}
                          className="hover:text-rose-600 font-bold ml-0.5 cursor-pointer"
                          title="Remove status filter"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {(dateFrom || dateTo) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <span>Requested: {datePreset === 'LAST_WEEK' ? `Last 1 Week (${dateFrom} → ${dateTo})` : `${dateFrom || 'Start'} → ${dateTo || 'Now'}`}</span>
                        <button
                          type="button"
                          onClick={() => applyDatePreset('ALL')}
                          className="hover:text-rose-600 font-bold ml-0.5 cursor-pointer"
                          title="Remove date filter"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {searchQuery && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-300">
                        <span>Search: &ldquo;{searchQuery}&rdquo;</span>
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="hover:text-rose-600 font-bold ml-0.5 cursor-pointer"
                          title="Clear search query"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('ALL');
                        setSearchQuery('');
                        setDateFrom('');
                        setDateTo('');
                        setDatePreset('ALL');
                        void loadIsolations('', '', true);
                      }}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-rose-50 transition cursor-pointer ml-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
                      <span>Reset All Filters</span>
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400 font-mono">
                    Showing all records within date range.
                  </span>
                )}
              </div>

              <div className="text-[11px] font-mono text-slate-500 font-semibold ml-auto">
                {sortedIsolations.length === 0 ? (
                  <span>0 Certificates found</span>
                ) : (
                  <span>
                    Showing {Math.min((currentPage - 1) * pageSize + 1, sortedIsolations.length)}-{Math.min(currentPage * pageSize, sortedIsolations.length)} of {sortedIsolations.length} Certificates
                  </span>
                )}
              </div>
            </div>

            {/* Certificates Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50/90 font-mono text-[11px] uppercase tracking-wider text-slate-600 select-none">
                  <tr>
                    <th
                      onClick={() => handleSort('IsolationNo')}
                      className="p-3.5 cursor-pointer hover:bg-slate-100/80 transition-colors"
                      title="Sort by Certificate No"
                    >
                      <div className="flex items-center gap-1">
                        <span>Isolation Certificate</span>
                        {sortField === 'IsolationNo' ? (
                          <span className="material-symbols-outlined text-[14px] text-[#006398]">
                            {sortDirection === 'ASC' ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-[14px] text-slate-300">unfold_more</span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('PermitNo')}
                      className="p-3.5 cursor-pointer hover:bg-slate-100/80 transition-colors"
                      title="Sort by Linked Permit"
                    >
                      <div className="flex items-center gap-1">
                        <span>Linked Permit</span>
                        {sortField === 'PermitNo' ? (
                          <span className="material-symbols-outlined text-[14px] text-[#006398]">
                            {sortDirection === 'ASC' ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-[14px] text-slate-300">unfold_more</span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('Status')}
                      className="p-3.5 cursor-pointer hover:bg-slate-100/80 transition-colors"
                      title="Sort by Status"
                    >
                      <div className="flex items-center gap-1">
                        <span>Status</span>
                        {sortField === 'Status' ? (
                          <span className="material-symbols-outlined text-[14px] text-[#006398]">
                            {sortDirection === 'ASC' ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-[14px] text-slate-300">unfold_more</span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('RequestedDate')}
                      className="p-3.5 cursor-pointer hover:bg-slate-100/80 transition-colors"
                      title="Sort by Requested Date"
                    >
                      <div className="flex items-center gap-1">
                        <span>Requested By & Date</span>
                        {sortField === 'RequestedDate' ? (
                          <span className="material-symbols-outlined text-[14px] text-[#006398]">
                            {sortDirection === 'ASC' ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-[14px] text-slate-300">unfold_more</span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('PointsCount')}
                      className="p-3.5 cursor-pointer hover:bg-slate-100/80 transition-colors"
                      title="Sort by Points Count"
                    >
                      <div className="flex items-center gap-1">
                        <span>Points Registered</span>
                        {sortField === 'PointsCount' ? (
                          <span className="material-symbols-outlined text-[14px] text-[#006398]">
                            {sortDirection === 'ASC' ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-[14px] text-slate-300">unfold_more</span>
                        )}
                      </div>
                    </th>
                    <th className="p-3.5">Description / Remarks</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {paginatedIsolations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-2.5">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                            <span className="material-symbols-outlined text-[28px]">folder_off</span>
                          </div>
                          <span className="font-semibold text-slate-700">No isolation certificates found</span>
                          <span className="text-xs text-slate-400 max-w-sm">
                            {searchQuery || statusFilter !== 'ALL'
                              ? 'Try adjusting your search keywords or resetting the status filter.'
                              : 'No isolation certificates exist yet in the SAP S/4HANA registry.'}
                          </span>
                          {(searchQuery || statusFilter !== 'ALL') && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery('');
                                setStatusFilter('ALL');
                              }}
                              className="mt-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-mono font-bold text-slate-700 transition-colors"
                            >
                              Reset Filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedIsolations.map((iso) => (
                      <tr key={iso.IsolationNo} className="hover:bg-sky-50/50 transition-colors group">
                        <td className="p-3.5 font-mono font-bold text-[#006398]">
                          <button
                            type="button"
                            onClick={() => void handleOpenDetail(iso)}
                            className="hover:underline flex items-center gap-2 group-hover:text-[#004e78]"
                          >
                            <span className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[16px]">lock</span>
                            </span>
                            <span>{iso.IsolationNo}</span>
                            {iso.IsTemplate === 'X' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider">
                                <span className="material-symbols-outlined text-[11px]">bookmark</span>
                                Template
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="p-3.5 font-mono">
                          {iso.PermitNo ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1 text-[#006398] font-bold border border-sky-200 shadow-2xs">
                                <span className="material-symbols-outlined text-[13px]">description</span>
                                <span>{iso.PermitNo}</span>
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(iso);
                                }}
                                className="text-slate-400 hover:text-[#006398] p-1 rounded-md hover:bg-sky-50 transition"
                                title="Edit Permit Linkage"
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
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 text-[11px] font-mono font-bold transition shadow-2xs cursor-pointer"
                              title="Add or link a Permit No to this certificate"
                            >
                              <span className="material-symbols-outlined text-[14px]">add_link</span>
                              <span>+ Link Permit</span>
                            </button>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-extrabold tracking-wider uppercase border shadow-2xs ${
                              iso.Status === 'CRTD'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : iso.Status === 'ISOL'
                                ? 'bg-sky-50 text-[#006398] border-sky-300 ring-2 ring-sky-500/20'
                                : iso.Status === 'NORM'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              iso.Status === 'ISOL' ? 'bg-[#006398] animate-pulse' : iso.Status === 'NORM' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}></span>
                            <span>{iso.Status}</span>
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-800">{iso.RequestedBy || 'SYSTEM'}</div>
                          <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                            {iso.RequestedDate} {iso.RequestedTime}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 border border-slate-200/80 px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                            <span className="material-symbols-outlined text-[13px] text-orange-600">key</span>
                            <span>{iso._Item?.length || 0} point(s)</span>
                          </span>
                        </td>
                        <td className="p-3.5 max-w-[220px] text-slate-600" title={iso.description || iso.Remarks || ''}>
                          {iso.description && (
                            <div className="font-semibold text-slate-800 truncate">{iso.description}</div>
                          )}
                          <div className={`truncate ${iso.description ? 'text-[11px] text-slate-500' : ''}`}>
                            {iso.Remarks || (!iso.description ? '—' : '')}
                          </div>
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {iso.IsTemplate === 'X' && (
                              <button
                                type="button"
                                onClick={() => handleUseCertificateAsTemplate(iso)}
                                className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-mono font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs cursor-pointer"
                                title="Create new isolation certificate using this template"
                              >
                                <span className="material-symbols-outlined text-[14px]">bookmark_add</span>
                                <span>Use</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(iso)}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-700 hover:bg-slate-100 hover:text-[#006398] transition shadow-2xs cursor-pointer"
                              title="Edit Certificate / Link Permit"
                            >
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                              <span>Edit / Link</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleOpenDetail(iso)}
                              className="inline-flex items-center gap-1 rounded-xl bg-[#006398] hover:bg-[#004e78] text-white px-3 py-1.5 text-xs font-mono font-bold shadow-2xs transition-colors cursor-pointer"
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

            {/* Table Bottom Pagination Bar */}
            <div className="px-5 py-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
              <div className="text-slate-500 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Connected to SAP Gateway:</span>
                </span>
                <code className="text-slate-800 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  /Isolation
                </code>
                <span>&middot;</span>
                <span>
                  Showing{' '}
                  <strong className="text-slate-800">
                    {sortedIsolations.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-slate-800">
                    {Math.min(currentPage * pageSize, sortedIsolations.length)}
                  </strong>{' '}
                  of{' '}
                  <strong className="text-slate-800">{sortedIsolations.length}</strong> certificates
                  {isolations.length !== sortedIsolations.length && (
                    <span className="text-slate-400"> (filtered from {isolations.length} total)</span>
                  )}
                </span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition shadow-2xs cursor-pointer"
                    title="First Page"
                  >
                    <span className="material-symbols-outlined text-[16px]">first_page</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                    title="Previous Page"
                  >
                    <span className="material-symbols-outlined text-[15px]">chevron_left</span>
                    <span className="hidden sm:inline">Prev</span>
                  </button>

                  <form onSubmit={handlePageJump} className="flex items-center gap-1">
                    <span className="text-slate-500">Page</span>
                    <input
                      type="text"
                      value={pageJumpInput}
                      onChange={(e) => setPageJumpInput(e.target.value)}
                      onBlur={() => setPageJumpInput(String(currentPage))}
                      className="w-10 text-center py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#006398]"
                      title="Type page number and press Enter"
                    />
                    <span className="text-slate-500">of {totalPages}</span>
                  </form>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                    title="Next Page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <span className="material-symbols-outlined text-[15px]">chevron_right</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition shadow-2xs cursor-pointer"
                    title="Last Page"
                  >
                    <span className="material-symbols-outlined text-[16px]">last_page</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </>
    )}

      {/* MODE 2: CERTIFICATE DETAIL / POINTS DOSSIER */}
      {viewMode === 'detail' && selectedIso && (
        <div className="space-y-6">
          {/* Certificate Header Dossier */}
          <SectionCard
            theme="rose"
            sectionTag="CERTIFICATE"
            title={`Isolation Certificate ${selectedIso.IsolationNo}`}
            subtitle="SAP S/4HANA Isolation Certificate Master Record"
            icon="lock_open_right"
            badge={
              <div className="flex items-center gap-2">
                {selectedIso.IsTemplate === 'X' && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider uppercase bg-indigo-100 text-indigo-800 border border-indigo-300">
                    <span className="material-symbols-outlined text-[13px]">bookmark</span>
                    Template
                  </span>
                )}
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider uppercase ${
                    selectedIso.Status === 'CRTD'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : selectedIso.Status === 'ISOL'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : selectedIso.Status === 'NORM'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {selectedIso.Status}
                </span>
                <button
                  type="button"
                  onClick={() => handleUseCertificateAsTemplate(selectedIso)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 shadow-xs transition active:scale-[0.98] cursor-pointer"
                  title="Create a new isolation certificate using this certificate configuration as template"
                >
                  <span className="material-symbols-outlined text-[15px]">bookmark_add</span>
                  <span>Use as Template</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(selectedIso)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#006398] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#004f7a] shadow-xs transition active:scale-[0.98]"
                  title="Update certificate details or link Permit No"
                >
                  <span className="material-symbols-outlined text-[16px]">link</span>
                  <span>Link Permit / Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  ← Back to List
                </button>
              </div>
            }
          >
            <div className="space-y-4">
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
                      title="Link or change Permit No"
                    >
                      <span className="material-symbols-outlined text-[13px]">edit</span>
                      {selectedIso.PermitNo ? 'Change' : 'Link permit'}
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
                    {selectedIso.ApprovedBy || selectedIso.VerifiedBy || (selectedIso.Status === 'ISOL' || selectedIso.Status === 'NORM' ? 'Approved in SAP' : 'Pending Verification')}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {selectedIso.ApprovedDate
                      ? `${selectedIso.ApprovedDate} ${selectedIso.ApprovedTime || ''}`
                      : selectedIso.VerifiedDate
                      ? `${selectedIso.VerifiedDate} ${selectedIso.VerifiedTime || ''}`
                      : selectedIso.Status === 'ISOL' || selectedIso.Status === 'NORM'
                      ? (selectedIso.ApprovedBy ? `Approved by ${selectedIso.ApprovedBy}` : 'Approved in SAP')
                      : 'Unapproved'}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <span className="text-[10px] text-slate-500 uppercase font-sans font-bold">
                    De-Isolation / Normalized
                  </span>
                  <p className="mt-1 font-bold text-slate-800">
                    {selectedIso.NormalizedBy || (selectedIso.Status === 'NORM' ? 'Normalized in SAP' : 'Active In Field')}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {selectedIso.NormalizedDate
                      ? `${selectedIso.NormalizedDate} ${selectedIso.NormalizedTime || ''}`
                      : selectedIso.Status === 'NORM'
                      ? 'De-Isolated & Restored'
                      : 'Not normalized'}
                  </span>
                </div>
              </div>

              {selectedIso.description && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-950">
                  <span className="font-bold text-[#006398]">Description: </span>
                  {selectedIso.description}
                </div>
              )}

              {selectedIso.Remarks && (
                <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-xs text-sky-900">
                  <span className="font-bold">Remarks: </span>
                  {selectedIso.Remarks}
                </div>
              )}
            </div>
          </SectionCard>

          {/* SAP Certificate Actions (Complete / Approve / Restore Isolation) */}
          <CertificateActions
            key={selectedIso.IsolationNo}
            certificate={selectedIso}
            user={user}
            onUpdated={(updated) => {
              setSelectedIso(updated);
              setIsolations((rows) =>
                rows.map((row) => (row.IsolationNo === updated.IsolationNo ? updated : row))
              );
              loadIsoAuditLogs(updated.IsolationNo, updated.PermitNo, true);
            }}
          />

          {/* Child Items (_Item) Table */}
          <div id="points-ledger">
            <SectionCard
              theme="amber"
              sectionTag="POINTS LEDGER"
              title="Physical Isolation Points Registry (_Item)"
              subtitle="Engineered zero-energy boundary, lock tags, zero-energy confirmations, and de-isolation."
              icon="checklist"
              badge={
                <span className="rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 font-mono text-[11px] font-bold">
                  {selectedIso._Item?.length || 0} Lock Points
                </span>
              }
            >
              {/* LOTO Reverse-Order Sequence Banner */}
              {(selectedIso.Status === 'ISOL' || selectedIso.Status === 'APPR') && selectedIso._Item && selectedIso._Item.length > 0 && (
                <div className="mb-4 rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50/90 via-sky-50/40 to-teal-50/80 p-3.5 text-xs text-teal-950 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white shadow-2xs shrink-0">
                      <span className="material-symbols-outlined text-[18px]">swap_vert</span>
                    </span>
                    <div className="min-w-0">
                      <h5 className="font-bold text-teal-950 flex items-center gap-2">
                        <span>LOTO Reverse-Order De-Isolation Sequence</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-extrabold border border-teal-200 shrink-0">
                          {selectedIso._Item.filter((i) => isPointNormalized(i)).length} / {selectedIso._Item.length} Restored
                        </span>
                      </h5>
                      <p className="text-[11px] text-teal-800 mt-0.5">
                        {nextDeisolationTarget ? (
                          <>
                            Points must be de-isolated in exact reverse order of creation. Next point to de-isolate:{' '}
                            <strong className="text-teal-950 font-mono">Item #{formatItemNo(nextDeisolationTarget.ItemNo)}</strong> ({nextDeisolationTarget.IsolationPoint}).
                          </>
                        ) : (
                          'All isolation points have been restored to normalized condition.'
                        )}
                      </p>
                    </div>
                  </div>
                  {nextDeisolationTarget && (
                    <button
                      type="button"
                      onClick={() => handleOpenNormalizeModal(nextDeisolationTarget)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <span className="material-symbols-outlined text-[15px]">restore</span>
                      <span>De-Isolate Item #{formatItemNo(nextDeisolationTarget.ItemNo)}</span>
                    </button>
                  )}
                </div>
              )}

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
                      <th className="p-3 text-right">De-Isolation Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!selectedIso._Item || selectedIso._Item.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-slate-400 italic font-mono">
                          No isolation points recorded for this certificate.
                        </td>
                      </tr>
                    ) : (
                      paginatedPoints.map((item, idx) => {
                        const itemIndex = (pointsPage - 1) * pointsPageSize + idx + 1;
                        const eligibility = isItemEligibleForDeisolation(item);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-mono font-bold text-slate-500">
                              {formatItemNo(item.ItemNo, itemIndex)}
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
                              {isPointIsolated(item) || selectedIso.Status === 'ISOL' || selectedIso.Status === 'NORM' ? (
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
                              {isPointZeroEnergy(item) || selectedIso.Status === 'ISOL' || selectedIso.Status === 'NORM' ? (
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
                              {isPointNormalized(item) || selectedIso.Status === 'NORM' ? (
                                <span className="inline-flex items-center gap-1 text-teal-700 font-bold bg-teal-50 border border-teal-200 px-2 py-0.5 rounded text-[10px]">
                                  <span className="material-symbols-outlined text-[14px]">restore</span>
                                  RESTORED
                                </span>
                              ) : eligibility.eligible ? (
                                <span className="inline-flex items-center gap-1 text-teal-800 font-bold text-[10px] bg-teal-100 border border-teal-300 px-2 py-0.5 rounded shadow-2xs animate-pulse">
                                  <span className="material-symbols-outlined text-[13px]">play_arrow</span>
                                  NEXT IN SEQ
                                </span>
                              ) : (
                                <span className="text-amber-700 font-semibold text-[10px] bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                  ACTIVE ISOL
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-600 max-w-[150px] truncate" title={item.Remarks}>
                              {item.Remarks || '—'}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              {isPointNormalized(item) || selectedIso.Status === 'NORM' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-[11px]">
                                  <span className="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
                                  <span>Normalized</span>
                                </span>
                              ) : eligibility.eligible ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenNormalizeModal(item, itemIndex)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] shadow-sm active:scale-95 transition-all cursor-pointer ring-2 ring-teal-500/30"
                                  title={`De-Isolate & Normalize Point #${formatItemNo(item.ItemNo, itemIndex)} (Authorized: Next in reverse sequence)`}
                                >
                                  <span className="material-symbols-outlined text-[13px]">restore</span>
                                  <span>Normalize Point</span>
                                </button>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 font-medium text-[11px] border border-slate-200 cursor-not-allowed"
                                  title={eligibility.reason || 'Points must be de-isolated in reverse order of creation'}
                                >
                                  <span className="material-symbols-outlined text-[13px] text-slate-400">lock</span>
                                  <span>{eligibility.nextItemNo ? `Wait for #${eligibility.nextItemNo}` : 'Locked'}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
              </table>
            </div>

            {/* Points Table Pagination Bar (if > 5) */}
            {selectedIso._Item && selectedIso._Item.length > 5 && (
              <div className="px-4 py-2.5 bg-slate-50/90 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-500 mt-2">
                <div className="flex items-center gap-3">
                  <span>
                    Showing {(pointsPage - 1) * pointsPageSize + 1} to{' '}
                    {Math.min(pointsPage * pointsPageSize, selectedIso._Item.length)} of{' '}
                    {selectedIso._Item.length} physical lock points
                  </span>
                  <div className="flex items-center gap-1.5 font-sans">
                    <span className="text-slate-400">Rows:</span>
                    <select
                      value={pointsPageSize}
                      onChange={(e) => {
                        setPointsPageSize(Number(e.target.value));
                        setPointsPage(1);
                      }}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-sans text-xs text-slate-700 outline-none focus:border-[#006398] cursor-pointer"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPointsPage((p) => Math.max(1, p - 1))}
                    disabled={pointsPage === 1}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 disabled:opacity-40 font-bold hover:bg-slate-100 shadow-2xs cursor-pointer"
                  >
                    Prev
                  </button>
                  <span className="font-bold text-slate-800 px-1">
                    {pointsPage} / {totalPointsPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPointsPage((p) => Math.min(totalPointsPages, p + 1))}
                    disabled={pointsPage === totalPointsPages}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 disabled:opacity-40 font-bold hover:bg-slate-100 shadow-2xs cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </SectionCard>
          </div>

          {/* Isolation Lifecycle History */}
          <SectionCard
            theme="slate"
            sectionTag="LIFECYCLE"
            title="Isolation Lifecycle Milestones"
            subtitle="Chronological milestone transitions and authorization actors recorded in SAP S/4HANA."
            icon="timeline"
            badge={
              <span className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-bold border ${
                selectedIso.Status === 'NORM'
                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                  : selectedIso.Status === 'ISOL'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                STATUS: {selectedIso.Status}
              </span>
            }
          >
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5 font-mono">
                <span className="material-symbols-outlined text-[16px] text-[#006398]">timeline</span>
                <span>Lifecycle Milestone Verification</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Stage 1: Requested / Created */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      STAGE 1 · CRTD
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      Created
                    </span>
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-slate-900">Boundary Registered</p>
                    <p className="text-[11px] text-slate-600">
                      Requested by: <strong className="text-slate-800 font-mono">{selectedIso.RequestedBy || 'SAP User'}</strong>
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                      {selectedIso.RequestedDate} {selectedIso.RequestedTime || ''}
                    </p>
                    <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      {selectedIso._Item?.length || 0} physical isolation points defined in boundary.
                    </p>
                  </div>
                </div>

                {/* Stage 2: Verified / Approved */}
                {(() => {
                  const isApprovedStage = selectedIso.Status === 'ISOL' || selectedIso.Status === 'NORM' || Boolean(selectedIso.ApprovedBy);
                  return (
                    <div className={`rounded-xl border p-3.5 shadow-2xs relative ${
                      isApprovedStage ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          isApprovedStage
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          STAGE 2 · ISOL
                        </span>
                        {isApprovedStage ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <span className="material-symbols-outlined text-[15px]">check_circle</span>
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                            <span className="material-symbols-outlined text-[15px]">pending</span>
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-slate-900">Zero-Energy Isolation Approved</p>
                        <p className="text-[11px] text-slate-600">
                          Approved by:{' '}
                          <strong className="text-slate-800 font-mono">
                            {selectedIso.ApprovedBy || selectedIso.VerifiedBy || (isApprovedStage ? 'Approved in SAP' : 'Pending Verification')}
                          </strong>
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">
                          {selectedIso.ApprovedDate
                            ? `${selectedIso.ApprovedDate} ${selectedIso.ApprovedTime || ''}`
                            : selectedIso.VerifiedDate
                            ? `${selectedIso.VerifiedDate} ${selectedIso.VerifiedTime || ''}`
                            : isApprovedStage
                            ? 'Approved in SAP'
                            : 'Awaiting field approval'}
                        </p>
                        <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          {isApprovedStage
                            ? 'Zero-energy boundaries confirmed. Permit work authorized.'
                            : 'Pending isolator inspection and approval.'}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Stage 3: Normalized / Restored */}
                {(() => {
                  const isNormStage = selectedIso.Status === 'NORM' || Boolean(selectedIso.NormalizedBy);
                  return (
                    <div className={`rounded-xl border p-3.5 shadow-2xs relative ${
                      isNormStage ? 'border-teal-200 bg-teal-50/40' : 'border-slate-200 bg-slate-50/50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          isNormStage
                            ? 'bg-teal-50 text-teal-800 border-teal-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          STAGE 3 · NORM
                        </span>
                        {isNormStage ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700">
                            <span className="material-symbols-outlined text-[15px]">task_alt</span>
                            Normalized
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                            <span className="material-symbols-outlined text-[15px]">lock_clock</span>
                            In Field
                          </span>
                        )}
                      </div>
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-slate-900">De-Isolation & Normalization</p>
                        <p className="text-[11px] text-slate-600">
                          Normalized by:{' '}
                          <strong className="text-slate-800 font-mono">
                            {selectedIso.NormalizedBy || (isNormStage ? 'Normalized in SAP' : 'Pending De-Isolation')}
                          </strong>
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">
                          {selectedIso.NormalizedDate
                            ? `${selectedIso.NormalizedDate} ${selectedIso.NormalizedTime || ''}`
                            : isNormStage
                            ? 'De-Isolated & Restored'
                            : 'Active in field'}
                        </p>
                        <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          {isNormStage
                            ? 'All lock points de-isolated in reverse order. Normal operating state restored.'
                            : 'Equipment energized only after work completion.'}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </SectionCard>

          {/* SAP DMS Attachments for Isolation Certificate */}
          <AttachmentManager
            objectType="ISOLATION"
            objectId={selectedIso.IsolationNo}
            title={`Isolation Attachments & Lockout Tags (${selectedIso.IsolationNo})`}
            description="LOTO diagrams, energy control procedures, blind lists, and field sign-off records stored in SAP DMS (INF / Z_DMS)."
          />

          {/* Isolation Audit Trail / Event Log */}
          {(() => {
            const certLogs = sortedAuditLogs.filter(isIsolationCertAuditLog);
            const itemLogs = sortedAuditLogs.filter(isIsolationItemAuditLog);
            const permitLogs = sortedAuditLogs.filter((log) => isPermitAuditLog(log, selectedIso.PermitNo));

            const filterBySearch = (list: typeof sortedAuditLogs) => {
              if (!isoAuditObjectIdSearch.trim()) return list;
              const q = isoAuditObjectIdSearch.trim().toUpperCase();
              return list.filter((log) => {
                const objId = (log.ObjectId || '').toUpperCase();
                const objType = (log.ObjectType || '').toUpperCase();
                const action = (log.Action || '').toUpperCase();
                const actor = (log.Actor || '').toUpperCase();
                const comments = (log.Comments || '').toUpperCase();
                return objId.includes(q) || objType.includes(q) || action.includes(q) || actor.includes(q) || comments.includes(q);
              });
            };

            const renderIsoAuditTable = (logs: typeof sortedAuditLogs, emptyMsg: string) => {
              if (!logs || logs.length === 0) {
                return (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    {emptyMsg}
                  </div>
                );
              }
              return (
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[10px] uppercase">
                        <th className="p-2.5">Object</th>
                        <th className="p-2.5">Action</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Actor (SAP User)</th>
                        <th className="p-2.5">Event Timestamp</th>
                        <th className="p-2.5">Reason / Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {logs.map((log, i) => {
                        const rawType = (log.ObjectType || (log.ObjectId?.includes('/') ? 'ISOL_ITEM' : log.ObjectId?.startsWith('ISO') ? 'ISOLATION' : 'PERMIT')).toUpperCase();
                        const objType = rawType === 'ISOL_ITEM' ? 'ISOL_ITEM' : rawType === 'ISOLATION' ? 'ISOLATION' : 'PERMIT';
                        const objId = log.ObjectId || selectedIso.IsolationNo;
                        const newStat = (log.NewStatus || '').trim();

                        return (
                          <tr key={log.AuditId || `${log.ObjectId}_${i}`} className="hover:bg-slate-50/80 font-mono transition-colors">
                            {/* 1. Object (ObjectType & ObjectId) */}
                            <td className="p-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                    objType === 'ISOL_ITEM'
                                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                                      : objType === 'ISOLATION'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-sky-50 text-sky-800 border-sky-200'
                                  }`}
                                >
                                  {objType}
                                </span>
                                <span className="font-semibold text-slate-800 text-[11px]">{objId}</span>
                              </div>
                            </td>

                            {/* 2. Action */}
                            <td className="p-2.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                                  log.Action === 'CREATE'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : log.Action === 'APPROVE'
                                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                                    : log.Action === 'NORMALIZE'
                                    ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                    : log.Action === 'NORMALIZE_ITEM'
                                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                    : log.Action === 'WORK_COMPLETE'
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : log.Action === 'ACCEPTOR_CLOSE'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : log.Action === 'AREA_OPERATOR_CLOSE'
                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                    : log.Action === 'ISSUER_CLOSE'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-slate-100 text-slate-800 border-slate-300'
                                }`}
                              >
                                {log.Action}
                              </span>
                            </td>

                            {/* 3. Status (NewStatus; ignore OldStatus per instruction) */}
                            <td className="p-2.5 whitespace-nowrap">
                              {newStat && newStat !== '(blank)' ? (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    newStat === 'CRTD'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : newStat === 'ISOL' || newStat === 'APPR'
                                      ? 'bg-orange-50 text-orange-700 border-orange-200'
                                      : newStat === 'NORM'
                                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                                      : newStat === 'CLSD'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : newStat === 'ACTV'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {newStat}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono text-[11px]">—</span>
                              )}
                            </td>

                            {/* 4. Actor (SAP User) */}
                            <td className="p-2.5 text-indigo-700 font-bold whitespace-nowrap">
                              {log.Actor || '—'}
                            </td>

                            {/* 5. Event Timestamp */}
                            <td className="p-2.5 text-slate-500 whitespace-nowrap" title={log.EventAt || undefined}>
                              {(() => {
                                if (!log.EventAt) return '—';
                                try {
                                  const d = new Date(log.EventAt);
                                  if (isNaN(d.getTime())) return log.EventAt;
                                  return d.toLocaleString('en-IN', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: true
                                  });
                                } catch {
                                  return log.EventAt;
                                }
                              })()}
                            </td>

                            {/* 6. Reason / Comments */}
                            <td className="p-2.5 font-sans text-slate-700">
                              {log.Comments || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            };

            return (
              <SectionCard
                theme="slate"
                sectionTag="AUDIT TRAIL"
                title="Isolation Audit Trail"
                subtitle="Chronological lifecycle actions, zero-energy approvals, and point normalizations recorded directly in SAP S/4HANA."
                icon="history"
                badge={
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {sortedAuditLogs.length} Total
                      </span>
                      <span className="px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {certLogs.length} Cert
                      </span>
                      <span className="px-2 py-0.5 rounded-full font-bold bg-purple-50 text-purple-800 border border-purple-200">
                        {itemLogs.length} Points
                      </span>
                    </div>

                    {sortedAuditLogs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setAuditSortDirection((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'))}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                        title={`Sort: ${auditSortDirection === 'DESC' ? 'Newest First' : 'Oldest First'}`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {auditSortDirection === 'DESC' ? 'arrow_downward' : 'arrow_upward'}
                        </span>
                        <span>{auditSortDirection === 'DESC' ? 'Newest' : 'Oldest'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => loadIsoAuditLogs(selectedIso.IsolationNo, selectedIso.PermitNo, true)}
                      disabled={loadingAuditLogs}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50 cursor-pointer"
                      title="Refresh audit trail directly from SAP"
                    >
                      <span className={`material-symbols-outlined text-[14px] ${loadingAuditLogs ? 'animate-spin' : ''}`}>
                        sync
                      </span>
                      <span>{loadingAuditLogs ? 'Syncing...' : 'Sync SAP'}</span>
                    </button>
                  </div>
                }
              >
                {loadingAuditLogs && sortedAuditLogs.length === 0 ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-3xl text-[#006398] animate-spin mb-2">
                      progress_activity
                    </span>
                    <p className="text-xs font-semibold text-slate-700">Loading audit trail from SAP /AuditLog...</p>
                    <p className="text-[11px] text-slate-400">Querying certificate and point normalization events</p>
                  </div>
                ) : sortedAuditLogs.length === 0 ? (
                  <div className="py-8 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <span className="material-symbols-outlined text-3xl text-slate-400 mb-2">history_edu</span>
                    <p className="text-xs font-bold text-slate-700">No audit log records recorded yet</p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto mt-1">
                      Creation, isolation approval, and physical point normalization actions will automatically log here directly from SAP S/4HANA.
                    </p>
                    <button
                      type="button"
                      onClick={() => loadIsoAuditLogs(selectedIso.IsolationNo, selectedIso.PermitNo, true)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">refresh</span>
                      <span>Check SAP for Events</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Object ID Filter Bar & Separation Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
                      {/* Segmented Filter Buttons */}
                      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200 text-xs">
                        <button
                          type="button"
                          onClick={() => setIsoAuditFilterTab('ALL')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition ${
                            isoAuditFilterTab === 'ALL'
                              ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">list_alt</span>
                          <span>All Events ({sortedAuditLogs.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsoAuditFilterTab('CERT')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition ${
                            isoAuditFilterTab === 'CERT'
                              ? 'bg-white text-amber-900 shadow-2xs border border-amber-200'
                              : 'text-slate-600 hover:text-amber-900 hover:bg-white/50'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px] text-amber-600">verified</span>
                          <span>Certificate ({certLogs.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsoAuditFilterTab('ITEMS')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition ${
                            isoAuditFilterTab === 'ITEMS'
                              ? 'bg-white text-purple-900 shadow-2xs border border-purple-200'
                              : 'text-slate-600 hover:text-purple-900 hover:bg-white/50'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px] text-purple-600">checklist</span>
                          <span>Point Items ({itemLogs.length})</span>
                        </button>

                        {permitLogs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setIsoAuditFilterTab('PERMIT')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition ${
                              isoAuditFilterTab === 'PERMIT'
                                ? 'bg-white text-blue-900 shadow-2xs border border-blue-200'
                                : 'text-slate-600 hover:text-blue-900 hover:bg-white/50'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px] text-blue-600">description</span>
                            <span>Permit Log ({permitLogs.length})</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setIsoAuditFilterTab('SEPARATE')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition ${
                            isoAuditFilterTab === 'SEPARATE'
                              ? 'bg-[#006398] text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">splitscreen</span>
                          <span>Show Separately</span>
                        </button>
                      </div>

                      {/* Instant Object ID Filter Input */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Filter by Object ID (e.g. ISO..., ISO.../1)..."
                          value={isoAuditObjectIdSearch}
                          onChange={(e) => setIsoAuditObjectIdSearch(e.target.value)}
                          className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-2.5 py-1 pl-7 font-mono text-[11px] text-slate-800 placeholder-slate-400 outline-none focus:border-[#006398]"
                        />
                        <span className="material-symbols-outlined absolute left-2 top-1.5 text-[13px] text-slate-400">
                          filter_alt
                        </span>
                        {isoAuditObjectIdSearch && (
                          <button
                            type="button"
                            onClick={() => setIsoAuditObjectIdSearch('')}
                            className="absolute right-2 top-1 text-slate-400 hover:text-slate-600 text-xs font-bold"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>

                    {/* MODE A: SHOW SEPARATELY (Certificate vs Points vs Permit) */}
                    {isoAuditFilterTab === 'SEPARATE' && (
                      <div className="space-y-6">
                        {/* Table 1: Certificate Ledger */}
                        <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-600 text-white shadow-2xs">
                                <span className="material-symbols-outlined text-[15px]">verified</span>
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                  Isolation Certificate Events · Object ID: {selectedIso.IsolationNo}
                                </h4>
                                <p className="text-[10px] text-slate-500">
                                  Actions where Object ID stores Isolation Certificate Number (Creation, Verification, Approvals, Full Normalization).
                                </p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              {certLogs.length} Records
                            </span>
                          </div>
                          {renderIsoAuditTable(filterBySearch(certLogs), 'No certificate lifecycle records found.')}
                        </div>

                        {/* Table 2: Point Items Normalization Ledger */}
                        <div className="rounded-xl border border-purple-200 bg-purple-50/20 p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-600 text-white shadow-2xs">
                                <span className="material-symbols-outlined text-[15px]">checklist</span>
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                  Physical Point Normalization Events · Object ID: {selectedIso.IsolationNo}/#
                                </h4>
                                <p className="text-[10px] text-slate-500">
                                  Actions where Object ID stores Isolation Point Item Number (Zero-Energy de-isolation in reverse sequence).
                                </p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              {itemLogs.length} Points
                            </span>
                          </div>
                          {renderIsoAuditTable(filterBySearch(itemLogs), 'No point normalization events recorded.')}
                        </div>

                        {/* Table 3: Linked Permit Audit Log (if correlated) */}
                        {permitLogs.length > 0 && (
                          <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                                  <span className="material-symbols-outlined text-[15px]">description</span>
                                </span>
                                <div>
                                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                    Linked Permit Lifecycle Events · Object ID: {selectedIso.PermitNo}
                                  </h4>
                                  <p className="text-[10px] text-slate-500">
                                    Permit lifecycle records correlated with this isolation certificate.
                                  </p>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                {permitLogs.length} Records
                              </span>
                            </div>
                            {renderIsoAuditTable(filterBySearch(permitLogs), 'No linked permit events found.')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* MODE B: CERTIFICATE ONLY */}
                    {isoAuditFilterTab === 'CERT' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                          <span>Showing events where Object ID stores Isolation Certificate Number: <strong className="font-mono text-slate-800">{selectedIso.IsolationNo}</strong></span>
                          <span className="font-mono text-[10px]">{filterBySearch(certLogs).length} of {certLogs.length} rows</span>
                        </div>
                        {renderIsoAuditTable(filterBySearch(certLogs), 'No certificate lifecycle records match filter.')}
                      </div>
                    )}

                    {/* MODE C: POINT ITEMS ONLY */}
                    {isoAuditFilterTab === 'ITEMS' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                          <span>Showing events where Object ID stores Point Item Number: <strong className="font-mono text-slate-800">{selectedIso.IsolationNo}/#</strong></span>
                          <span className="font-mono text-[10px]">{filterBySearch(itemLogs).length} of {itemLogs.length} rows</span>
                        </div>
                        {renderIsoAuditTable(filterBySearch(itemLogs), 'No point normalization records match filter.')}
                      </div>
                    )}

                    {/* MODE D: PERMIT ONLY */}
                    {isoAuditFilterTab === 'PERMIT' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                          <span>Showing events where Object ID stores Permit Number: <strong className="font-mono text-slate-800">{selectedIso.PermitNo || '—'}</strong></span>
                          <span className="font-mono text-[10px]">{filterBySearch(permitLogs).length} of {permitLogs.length} rows</span>
                        </div>
                        {renderIsoAuditTable(filterBySearch(permitLogs), 'No permit lifecycle records match filter.')}
                      </div>
                    )}

                    {/* MODE E: ALL EVENTS */}
                    {isoAuditFilterTab === 'ALL' && (
                      <div className="space-y-2">
                        {isoAuditObjectIdSearch && (
                          <div className="text-xs text-slate-500 px-1 font-mono text-[11px]">
                            Filtered by Object ID / text: <strong>"{isoAuditObjectIdSearch}"</strong> ({filterBySearch(sortedAuditLogs).length} results)
                          </div>
                        )}
                        {renderIsoAuditTable(filterBySearch(sortedAuditLogs), 'No audit logs found matching criteria.')}
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            );
          })()}
        </div>
      )}

      {/* MODE 3: CREATE ISOLATION CERTIFICATE */}
      {viewMode === 'create' && (
        <form onSubmit={handleCreateSubmit} className="space-y-6">
          <SectionCard
            theme="rose"
            sectionTag="PREPARATION"
            title="Register New Isolation Certificate (POST Isolation)"
            subtitle="Define engineered zero-energy boundary, physical breaker/valve lock points and danger tags."
            icon="lock_clock"
            badge={
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                ← Back to List
              </button>
            }
          >
            <div className="space-y-6">

            {/* Template Quick-Use Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-r from-indigo-50/90 via-sky-50/70 to-slate-50 border border-indigo-200/90 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[22px] text-indigo-700">bookmark_star</span>
                <div>
                  <span className="text-xs font-bold text-indigo-950">
                    Need standard zero-energy isolation points?
                  </span>
                  <p className="text-[11px] text-indigo-800/80">
                    Adopt pre-engineered corporate master templates (Pump, Vessel Blinding, MCC LOTO, DBB Piping) to prefill points and tags.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(true)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">bookmark</span>
                <span>Use Isolation Template</span>
              </button>
            </div>

            {/* Header Level Form */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">
                Linked Permit Number (Optional)
                <input
                  type="text"
                  list="available-permits-list"
                  placeholder="e.g. 0000000014"
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
                  value={user?.id || ''}
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-500 cursor-not-allowed"
                />
              </label>

              <label className="text-xs font-semibold text-slate-700">
                <span className="flex items-center justify-between">
                  <span>Description of the Isolation</span>
                  <span className="font-mono text-[10px] text-slate-400 font-normal">description</span>
                </span>
                <input
                  type="text"
                  placeholder="e.g. Primary pump electrical & mechanical isolation"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  maxLength={255}
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-[#006398]"
                />
              </label>

              <label className="text-xs font-semibold text-slate-700">
                <span className="flex items-center justify-between">
                  <span>Isolation Scope / Remarks</span>
                  <span className="font-mono text-[10px] text-slate-400 font-normal">Remarks</span>
                </span>
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
                {createPoints.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center bg-slate-50">
                    <span className="material-symbols-outlined text-[28px] text-slate-400 mb-1">
                      format_list_bulleted
                    </span>
                    <p className="text-xs font-semibold text-slate-700">No isolation points added</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      You can save this certificate as Header-Only (_Item: []), or click "Add Point" to configure isolation points.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddPointRow}
                      className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[#006398] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#004f7a]"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      Add First Point
                    </button>
                  </div>
                ) : (
                  createPoints.map((point, idx) => (
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
                            { Config_Code: 'VALVE', Config_Desc: 'VALVE' },
                            { Config_Code: 'VALVE_CC', Config_Desc: 'VALVE (C/C)' },
                            { Config_Code: 'VALVE_CO', Config_Desc: 'VALVE (C/O)' },
                            { Config_Code: 'CB_RIRO', Config_Desc: 'CIRCUIT BREAKER (RI/RO)' },
                            { Config_Code: 'BREAKER', Config_Desc: 'CIRCUIT BREAKER' },
                            { Config_Code: 'BLIND', Config_Desc: 'BLIND / SPADE' },
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
                ))
              )}
              </div>
            </div>

            {/* Reusable Isolation Template Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-indigo-700">bookmark</span>
                  Save as Reusable Isolation Template (IsTemplate = &apos;X&apos;)
                </span>
                <p className="text-[11px] text-indigo-800/80">
                  Serializes <code className="font-mono text-indigo-700 font-bold">IsTemplate = &apos;X&apos;</code> to SAP OData backend &amp; saves this certificate as a reusable template for future permits.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                <input
                  type="checkbox"
                  checked={createIsTemplate}
                  onChange={(e) => setCreateIsTemplate(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Staged DMS Attachments for New Certificate */}
            <div className="pt-2">
              <AttachmentManager
                objectType="ISOLATION"
                stagedFiles={createAttachments}
                onStagedFilesChange={setCreateAttachments}
                title="Isolation Attachments & Lockout Diagrams (SAP DMS)"
                description="Attach P&IDs, electrical single-line diagrams (SLD), blind lists, or LOTO procedures (max 10 MiB per file). Staged files will be automatically uploaded and linked to this isolation certificate in SAP DMS upon creation."
              />
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
          </SectionCard>
        </form>
      )}

      {saveUncertain && <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">SAP save outcome is unconfirmed. Check existing certificates and audit in SAP before another save.</p>}
      {/* MODE / MODAL: EDIT CERTIFICATE & LINK PERMIT */}
      {showEditModal && editingIso && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200/90 bg-gradient-to-r from-slate-50 via-sky-50/20 to-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#006398] text-white flex items-center justify-center shadow-xs shrink-0">
                  <span className="material-symbols-outlined text-[20px]">edit_document</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-base text-slate-900 tracking-tight">
                      Edit Isolation Certificate
                    </h3>
                    <span className="font-mono text-xs font-bold text-[#006398] bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200">
                      {editingIso.IsolationNo}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span className={`w-2 h-2 rounded-full ${
                        editingIso.Status === 'APPR'
                          ? 'bg-emerald-500'
                          : editingIso.Status === 'CRTD'
                          ? 'bg-amber-500'
                          : 'bg-[#006398]'
                      }`} />
                      <span>{editingIso.Status === 'CRTD' ? 'CRTD · Created' :
                             editingIso.Status === 'APPR' ? 'APPR · Approved' :
                             editingIso.Status || 'CRTD'}</span>
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="truncate">Permit Link & Scope</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                aria-label="Close modal"
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all shadow-2xs shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 min-h-0 m-0">
              <div className="p-6 space-y-4 bg-white overflow-y-auto flex-1">
                {/* Linked Work Permit Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="iso-permit-no" className="font-bold text-xs text-slate-800 font-sans flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[#006398]">link</span>
                      <span>Linked Work Permit Number</span>
                      <span className="text-[10px] font-mono text-slate-400 font-normal">(PermitNo)</span>
                    </label>
                    {editPermitNo && (
                      <button
                        type="button"
                        onClick={() => setEditPermitNo('')}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-0.5 transition"
                      >
                        <span className="material-symbols-outlined text-[13px]">link_off</span>
                        Unlink Permit
                      </button>
                    )}
                  </div>
                  <div className="flex rounded-xl border border-slate-300 bg-white overflow-hidden shadow-2xs focus-within:ring-3 focus-within:ring-[#006398]/15 focus-within:border-[#006398] transition">
                    <div className="flex items-center px-3 bg-slate-50 border-r border-slate-200 text-slate-500 font-mono text-xs select-none">
                      <span className="text-slate-400 font-bold">PTW#</span>
                    </div>
                    <input
                      id="iso-permit-no"
                      type="text"
                      list="available-permits-list"
                      maxLength={10}
                      placeholder="e.g. 0000000014"
                      value={editPermitNo}
                      onChange={(e) => setEditPermitNo(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-2 text-xs sm:text-sm font-mono tracking-wider outline-none uppercase font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                    />
                    <datalist id="available-permits-list">
                      {availablePermits.map((no) => (
                        <option key={no} value={no} />
                      ))}
                    </datalist>
                    {editPermitNo && (
                      <button
                        type="button"
                        onClick={() => setEditPermitNo('')}
                        className="px-3 text-slate-400 hover:text-rose-600 transition flex items-center"
                        title="Clear permit"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Select or enter the 10-character SAP Work Permit number, or clear to save without a linked permit.
                  </p>
                </div>

                {/* Description Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="iso-description" className="font-bold text-xs text-slate-800 font-sans flex items-center gap-1.5">
                      <span>Isolation Description</span>
                      <span className="text-[10px] font-mono text-slate-400 font-normal">(description)</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-mono font-semibold ${
                        editDescription.length > 240 ? 'text-rose-600' : 'text-slate-500'
                      }`}>
                        {editDescription.length}
                      </span>
                      <span className="text-[11px] text-slate-300">/</span>
                      <span className="text-[11px] font-mono text-slate-400">255</span>
                    </div>
                  </div>
                  <input
                    id="iso-description"
                    type="text"
                    maxLength={255}
                    placeholder="Enter short description of the isolation..."
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:ring-3 focus:ring-[#006398]/15 focus:border-[#006398] focus:outline-none transition-all font-sans"
                  />
                </div>

                {/* Remarks Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="iso-remarks" className="font-bold text-xs text-slate-800 font-sans flex items-center gap-1.5">
                      <span>Certificate Remarks / Scope</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-mono font-semibold ${
                        editRemarks.length > 240 ? 'text-rose-600' : 'text-slate-500'
                      }`}>
                        {editRemarks.length}
                      </span>
                      <span className="text-[11px] text-slate-300">/</span>
                      <span className="text-[11px] font-mono text-slate-400">255</span>
                    </div>
                  </div>
                  <textarea
                    id="iso-remarks"
                    rows={3}
                    maxLength={255}
                    placeholder="Enter isolation notes, equipment details, or permit reference..."
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:ring-3 focus:ring-[#006398]/15 focus:border-[#006398] focus:outline-none transition-all resize-none font-sans leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-400 font-sans">
                    Provide equipment tagging, boundary details, and isolation methods for SAP auditing.
                  </p>
                </div>
              </div>

              {/* Dedicated Solid Footer */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-sans">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-medium text-slate-600">OData V4 Online</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs hover:shadow-xs transition active:scale-[0.98]"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingEdit || saveUncertain}
                    className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-xl bg-[#006398] hover:bg-[#004f7a] text-white text-xs font-bold shadow-xs hover:shadow-sm disabled:opacity-50 transition active:scale-[0.98]"
                  >
                    {isSavingEdit ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* De-Isolation & Point Normalization Modal (Bound Action: Item(IsolationNo=...,ItemNo=...)/normalizeItem) */}
      {normalizingItem && selectedIso && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-teal-200/90 bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center shadow-xs shrink-0">
                  <span className="material-symbols-outlined text-[22px]">restore</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base text-white truncate">
                    De-Isolation / Normalization
                  </h3>
                  <p className="text-xs font-mono text-teal-100 truncate">
                    Item #{formatItemNo(normalizingItem.ItemNo)} · Certificate {selectedIso.IsolationNo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNormalizingItem(null)}
                disabled={isNormalizing}
                className="text-white/70 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                title="Close modal"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Point Summary Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-mono text-[10px]">POINT NAME / LOCATION</span>
                    <span className="font-bold text-slate-800 text-xs">
                      {normalizingItem.IsolationPoint || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-mono text-[10px]">REFERENCE (EQUI / FLOC)</span>
                    <span className="font-mono font-bold text-slate-800">
                      {normalizingItem.ReferenceType}: {normalizingItem.ReferenceId || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-mono text-[10px]">DISCIPLINE & METHOD</span>
                    <span className="font-medium text-slate-700">
                      {getIsolTypeLabel(normalizingItem.IsolType)} · {getIsolMethodLabel(normalizingItem.IsolMethod)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-mono text-[10px]">LOCK / TAG #</span>
                    <span className="font-mono font-bold text-amber-800">
                      {normalizingItem.LockTagNo ? `🏷️ ${normalizingItem.LockTagNo}` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-mono text-[10px]">ISOLATED STATE</span>
                    <span className="font-mono text-slate-600">
                      {getIsolatedStateLabel(normalizingItem.IsolatedState) || 'CLOSED'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-mono text-[10px]">RESTORED DE-ISOLATED STATE</span>
                    <span className="font-mono font-bold text-teal-800">
                      {getDeisolatedStateLabel(normalizingItem.DeIsolatedState || '') || 'NORMALIZED'}
                    </span>
                  </div>
                </div>
              </div>

              {/* LOTO Reverse Order Sequence Notice */}
              <div className="p-2.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 text-[11px] flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-teal-700">swap_vert</span>
                <span className="font-semibold">
                  LOTO Safety Protocol: Point #{formatItemNo(normalizingItem.ItemNo)} verified as the authorized next point in reverse creation sequence.
                </span>
              </div>

              {/* De-Isolated Restored State Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Target De-Isolated Restored State *</span>
                  <span className="text-[10px] font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    State: {normalizeDeisolatedState}
                  </span>
                </label>
                <select
                  value={normalizeDeisolatedState}
                  onChange={(e) => setNormalizeDeisolatedState(e.target.value)}
                  className="w-full text-xs font-mono font-bold rounded-xl border border-slate-300 p-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none bg-white transition-all text-slate-800 cursor-pointer"
                >
                  {(deisolatedStates.length > 0 ? deisolatedStates : [
                    { Config_Code: 'NORMAL', Config_Desc: 'NORMAL' },
                    { Config_Code: 'RESTORED', Config_Desc: 'RESTORED' },
                    { Config_Code: 'OPEN', Config_Desc: 'OPEN' },
                    { Config_Code: 'CLOSED', Config_Desc: 'CLOSED' },
                    { Config_Code: 'CONNECTED', Config_Desc: 'CONNECTED' },
                    { Config_Code: 'FITTED', Config_Desc: 'FITTED' },
                    { Config_Code: 'FREE', Config_Desc: 'FREE' },
                    { Config_Code: 'IN_PLACE', Config_Desc: 'IN PLACE' },
                    { Config_Code: 'INSTALLED', Config_Desc: 'INSTALLED' },
                    { Config_Code: 'LBL_REMOVED', Config_Desc: 'LABEL REMOVED' },
                    { Config_Code: 'RACKED_IN', Config_Desc: 'RACKED IN' },
                    { Config_Code: 'RACKED_OUT', Config_Desc: 'RACKED OUT' },
                    { Config_Code: 'REMOVED', Config_Desc: 'REMOVED' },
                    { Config_Code: 'REPLACED', Config_Desc: 'REPLACED' },
                    { Config_Code: 'UN_LOCKED', Config_Desc: 'UN-LOCKED' },
                    { Config_Code: 'UNLOCKED', Config_Desc: 'UNLOCKED' },
                  ]).map((state) => (
                    <option key={state.Config_Code} value={state.Config_Code}>
                      {state.Config_Desc} ({state.Config_Code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Normalization Reason */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 flex items-center justify-between">
                  <span>De-Isolation / Normalization Reason *</span>
                  <span className="text-[10px] font-mono text-slate-400">{normalizeReason.length} chars</span>
                </label>
                <textarea
                  rows={3}
                  value={normalizeReason}
                  onChange={(e) => setNormalizeReason(e.target.value)}
                  placeholder="Enter reason for de-isolation and zero-energy restoration..."
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none leading-relaxed transition-all"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setNormalizingItem(null)}
                disabled={isNormalizing}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteNormalizeItem}
                disabled={isNormalizing || !normalizeReason.trim()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-95 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {isNormalizing ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span>Normalizing in SAP...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">restore</span>
                    <span>Confirm De-Isolation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reusable Isolation Templates Picker Modal */}
      <IsolationTemplatesModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onApply={handleApplyTemplate}
        backendTemplates={isolations.filter((i) => i.IsTemplate === 'X')}
      />
    </div>
  );
};

export default IsolationWorkspace;
