import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SapIsolationHeader } from '../../core/types/isolation.types';
import type {
  StandardIsolationTemplate,
  StandardIsolationPoint
} from '../../core/ptw/isolationTemplates';
import { isolationApi } from '../../core/api/modules/isolation.api';

export interface ApplyIsolationTemplatePayload {
  description: string;
  remarks: string;
  points: Array<{
    ReferenceType: 'EQUI' | 'FLOC' | string;
    ReferenceId: string;
    IsolationPoint: string;
    IsolType: string;
    IsolMethod: string;
    IsolatedState: string;
    DeIsolatedState?: string;
    LockTagNo: string;
    Remarks: string;
  }>;
  sourceTitle?: string;
}

export interface IsolationTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (payload: ApplyIsolationTemplatePayload) => void;
  defaultEqui?: string;
  defaultFloc?: string;
  backendTemplates?: SapIsolationHeader[];
  zIndexClass?: string;
}

export const IsolationTemplatesModal: React.FC<IsolationTemplatesModalProps> = ({
  isOpen,
  onClose,
  onApply,
  defaultEqui = '',
  defaultFloc = '',
  backendTemplates: propBackendTemplates,
  zIndexClass = 'z-[120]'
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [backendTemplates, setBackendTemplates] = useState<SapIsolationHeader[]>(propBackendTemplates || []);
  const [isLoadingBackend, setIsLoadingBackend] = useState<boolean>(false);

  // Fetch backend templates on open if not provided or empty
  useEffect(() => {
    if (!isOpen) return;
    if (propBackendTemplates && propBackendTemplates.length > 0) {
      setBackendTemplates(propBackendTemplates);
      return;
    }
    let isCancelled = false;
    setIsLoadingBackend(true);
    isolationApi
      .fetchTemplates()
      .then((res) => {
        if (!isCancelled) {
          setBackendTemplates(res);
        }
      })
      .catch((err) => {
        console.warn('[IsolationTemplatesModal] Failed to fetch backend templates:', err);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingBackend(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [isOpen, propBackendTemplates]);

  // Convert live backend templates into standard view models
  const convertedBackendTemplates = useMemo<StandardIsolationTemplate[]>(() => {
    return (backendTemplates || []).map((b) => {
      const items: StandardIsolationPoint[] = (b._Item || []).map((it) => ({
        ReferenceType: it.ReferenceType || 'EQUI',
        ReferenceId: it.ReferenceId || '',
        IsolationPoint: it.IsolationPoint || '',
        IsolType: it.IsolType || 'MECH',
        IsolMethod: it.IsolMethod || 'VALVE',
        IsolatedState: it.IsolatedState || 'CLOSED',
        DeIsolatedState: it.DeIsolatedState || '',
        LockTagNo: it.LockTagNo || '',
        Remarks: it.Remarks || ''
      }));

      return {
        id: `SAP-${b.IsolationNo}`,
        isolationNo: b.IsolationNo,
        title: b.description || `Isolation Template ${b.IsolationNo}`,
        description: b.description || `Master Isolation Certificate ${b.IsolationNo}`,
        remarks: b.Remarks || '',
        category: 'SAP_MASTER',
        source: 'SAP_BACKEND',
        points: items
      };
    });
  }, [backendTemplates]);

  // Real SAP templates filtered by search query
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return convertedBackendTemplates;

    const q = searchQuery.toLowerCase().trim();
    return convertedBackendTemplates.filter((t) => {
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.remarks.toLowerCase().includes(q) ||
        (t.isolationNo && t.isolationNo.toLowerCase().includes(q)) ||
        t.points.some(
          (p) =>
            p.IsolationPoint.toLowerCase().includes(q) ||
            p.LockTagNo.toLowerCase().includes(q) ||
            p.IsolType.toLowerCase().includes(q) ||
            p.IsolMethod.toLowerCase().includes(q)
        )
      );
    });
  }, [convertedBackendTemplates, searchQuery]);

  // Auto-select first template when list changes
  useEffect(() => {
    if (!isOpen) return;
    if (filteredTemplates.length > 0) {
      if (!selectedId || !filteredTemplates.some((t) => t.id === selectedId)) {
        setSelectedId(filteredTemplates[0].id);
      }
    } else {
      setSelectedId('');
    }
  }, [filteredTemplates, selectedId, isOpen]);

  // Lock body scroll and listen for Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const activeTemplate = useMemo(() => {
    return convertedBackendTemplates.find((t) => t.id === selectedId) || filteredTemplates[0] || null;
  }, [convertedBackendTemplates, filteredTemplates, selectedId]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (!activeTemplate) return;

    const mappedPoints = activeTemplate.points.map((pt) => {
      let refId = pt.ReferenceId || '';
      if (!refId) {
        if (pt.ReferenceType === 'EQUI' && defaultEqui) {
          refId = defaultEqui;
        } else if (pt.ReferenceType === 'FLOC' && defaultFloc) {
          refId = defaultFloc;
        } else {
          refId = defaultEqui || defaultFloc || '1000';
        }
      }

      return {
        ReferenceType: pt.ReferenceType || 'EQUI',
        ReferenceId: refId,
        IsolationPoint: pt.IsolationPoint,
        IsolType: pt.IsolType || 'MECH',
        IsolMethod: pt.IsolMethod || 'VALVE',
        IsolatedState: pt.IsolatedState || 'CLOSED',
        DeIsolatedState: pt.DeIsolatedState || '',
        LockTagNo: pt.LockTagNo || '',
        Remarks: pt.Remarks || ''
      };
    });

    onApply({
      description: activeTemplate.description || activeTemplate.title,
      remarks: activeTemplate.remarks || '',
      points: mappedPoints.length > 0 ? mappedPoints : [
        {
          ReferenceType: defaultEqui ? 'EQUI' : 'FLOC',
          ReferenceId: defaultEqui || defaultFloc || '1000',
          IsolationPoint: 'MAIN-ISOLATION-VALVE',
          IsolType: 'MECH',
          IsolMethod: 'VALVE',
          IsolatedState: 'CLOSED',
          DeIsolatedState: 'OPEN',
          LockTagNo: 'LT-001',
          Remarks: 'Positive zero-energy barrier'
        }
      ],
      sourceTitle: activeTemplate.title
    });

    onClose();
  };

  return createPortal(
    <div
      className={`fixed inset-0 top-0 left-0 right-0 bottom-0 ${zIndexClass} flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-fadeIn overflow-y-auto`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="iso-template-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-[#004f7a] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-[24px] text-amber-300">bookmark</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="iso-template-title" className="text-base sm:text-lg font-bold tracking-tight">
                  Standard Isolation & LOTO Templates
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-300/30">
                  SAP S/4HANA Master
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Adopt pre-configured corporate isolation templates from SAP S/4HANA for new certificate creation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition"
            title="Close template browser"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Search & Status Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-indigo-900 border border-slate-200 shadow-2xs flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-indigo-600">verified</span>
              <span>Master Templates ({convertedBackendTemplates.length})</span>
            </span>
          </div>

          <div className="flex-1 max-w-md relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">
              search
            </span>
            <input
              type="text"
              placeholder="Search template title, certificate #, valve, breaker, tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-300 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content Body: Two Columns (Left: Templates list; Right: Template Preview & Points) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          {/* Left List Pane (5 cols) */}
          <div className="md:col-span-5 border-r border-slate-200 overflow-y-auto p-4 space-y-2.5 bg-slate-50/50">
            {isLoadingBackend && (
              <div className="p-4 text-center text-xs text-slate-500 animate-pulse font-mono">
                Loading SAP master templates...
              </div>
            )}
            {!isLoadingBackend && filteredTemplates.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                <span className="material-symbols-outlined text-[36px] text-slate-300 mb-2 block">
                  bookmark_border
                </span>
                <p className="font-bold text-slate-600 mb-1">No Isolation Templates Found</p>
                <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                  {searchQuery
                    ? `No templates matched "${searchQuery}".`
                    : 'To save a certificate as a reusable template, toggle "Save as Reusable Isolation Template" when creating an isolation certificate in SAP.'}
                </p>
              </div>
            )}
            {filteredTemplates.map((t) => {
              const isSelected = t.id === (activeTemplate?.id || '');
              const pointsCount = t.points.length;
              const hasElec = t.points.some((p) => p.IsolType === 'ELEC');
              const hasMech = t.points.some((p) => p.IsolType === 'MECH' || p.IsolMethod === 'VALVE' || p.IsolMethod === 'BLND');
              const hasInst = t.points.some((p) => p.IsolType === 'INST');

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all text-left ${
                    isSelected
                      ? 'border-indigo-600 bg-white shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-bold text-slate-900 text-xs leading-snug">
                      {t.title}
                    </span>
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                      SAP Master
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-2 mb-2 leading-relaxed">
                    {t.description}
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      {pointsCount} Point{pointsCount !== 1 ? 's' : ''}
                    </span>
                    {hasElec && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                        ⚡ Electrical
                      </span>
                    )}
                    {hasMech && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
                        🔒 Mechanical
                      </span>
                    )}
                    {hasInst && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                        📊 Instrument
                      </span>
                    )}
                    {t.isolationNo && (
                      <span className="text-slate-400 ml-auto font-mono text-[10px]">
                        #{t.isolationNo}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Detail & Points Preview Pane (7 cols) */}
          <div className="md:col-span-7 flex flex-col h-full overflow-hidden bg-white">
            {activeTemplate ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Header Summary */}
                <div className="p-5 border-b border-slate-200 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/40">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                          SAP Master Certificate {activeTemplate.isolationNo || ''}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {activeTemplate.points.length} Physical Isolation Points
                        </span>
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                        {activeTemplate.title}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleApply}
                      className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[17px]">done_all</span>
                      <span>Apply Template</span>
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-2">
                    {activeTemplate.description}
                  </p>
                  {activeTemplate.remarks && (
                    <div className="text-[11px] text-slate-500 bg-white/80 p-2 rounded-lg border border-slate-200 font-sans">
                      <span className="font-bold text-slate-700">Remarks / Scope: </span>
                      {activeTemplate.remarks}
                    </div>
                  )}
                </div>

                {/* Points Table - Scrollable */}
                <div className="flex-1 overflow-y-auto p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-indigo-600">
                        pin_drop
                      </span>
                      <span>Engineered Zero-Energy Points Breakdown (_Item)</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      SAP Master Points List
                    </span>
                  </div>

                  {activeTemplate.points.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-mono text-[11px] uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="p-2.5 w-12 text-center">#</th>
                            <th className="p-2.5">Point & Tag</th>
                            <th className="p-2.5">Method / Type</th>
                            <th className="p-2.5">Isolated State</th>
                            <th className="p-2.5">Precaution / Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeTemplate.points.map((pt, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/70 transition">
                              <td className="p-2.5 font-mono font-bold text-center text-slate-400 text-[11px]">
                                {String(idx + 1).padStart(2, '0')}
                              </td>
                              <td className="p-2.5">
                                <div className="font-bold font-mono text-slate-900 text-xs">
                                  {pt.IsolationPoint}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {pt.LockTagNo && (
                                    <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1 rounded border border-indigo-200">
                                      {pt.LockTagNo}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    ({pt.ReferenceType})
                                  </span>
                                </div>
                              </td>
                              <td className="p-2.5 font-mono">
                                <span className="inline-flex items-center gap-1 font-bold text-slate-800 text-[11px]">
                                  {pt.IsolMethod}
                                </span>
                                <div className="text-[10px] text-slate-500 font-sans">
                                  {pt.IsolType}
                                </div>
                              </td>
                              <td className="p-2.5 font-mono">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                  {pt.IsolatedState}
                                </span>
                              </td>
                              <td className="p-2.5 text-[11px] text-slate-600 max-w-[200px] leading-relaxed">
                                {pt.Remarks || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                      No points recorded on this master template.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs">
                Select an isolation template on the left to review its zero-energy points.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-t border-slate-200 text-xs">
          <div className="text-slate-500 flex items-center gap-1.5 text-[11px]">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
            <span>Live SAP S/4HANA Master Isolation Templates. Applying template pre-fills description and lock points.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!activeTemplate}
              onClick={handleApply}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">bookmark_added</span>
              <span>Use This Template</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
