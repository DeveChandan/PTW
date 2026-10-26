import React, { useState, useEffect, useMemo } from 'react';
import type { PermitDeepInsertResponse, PermitInfoRecord } from '../../core/types/ptw.types';
import { PermitAnnexPrintView } from './PermitAnnexPrintView';
import { PermitJhaPrintView } from './PermitJhaPrintView';
import {
  JHA_TEMPLATES,
  detectAllPermitJhaTemplates,
  getJhaTemplateById,
  type DetectedJha
} from '../../core/ptw/jhaTemplates';

interface PermitPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  permit: PermitDeepInsertResponse | PermitInfoRecord | any;
  defaultIncludeJha?: boolean;
  defaultJhaTemplateId?: string;
  defaultJhaTemplateIds?: string[];
}

export const PermitPrintModal: React.FC<PermitPrintModalProps> = ({
  isOpen,
  onClose,
  permit,
  defaultIncludeJha = false,
  defaultJhaTemplateId,
  defaultJhaTemplateIds
}) => {
  const [includeReverse, setIncludeReverse] = useState<boolean>(false);
  const [includeJha, setIncludeJha] = useState<boolean>(defaultIncludeJha);

  // Discover all applicable JHAs for this permit (Primary category + Additional WorkTypes from SAP _WorkType / additionalTypes)
  const applicableJhas: DetectedJha[] = useMemo(() => {
    if (!permit) return [];
    return detectAllPermitJhaTemplates(permit);
  }, [permit]);

  // Selected JHA template IDs to include in print output
  const [selectedJhaIds, setSelectedJhaIds] = useState<string[]>(() => {
    if (defaultJhaTemplateIds && defaultJhaTemplateIds.length > 0) return defaultJhaTemplateIds;
    if (defaultJhaTemplateId) return [defaultJhaTemplateId];
    return detectAllPermitJhaTemplates(permit).map((d) => d.template.id);
  });

  useEffect(() => {
    if (isOpen) {
      setIncludeJha(defaultIncludeJha);
      if (defaultJhaTemplateIds && defaultJhaTemplateIds.length > 0) {
        setSelectedJhaIds(defaultJhaTemplateIds);
      } else if (defaultJhaTemplateId) {
        setSelectedJhaIds([defaultJhaTemplateId]);
      } else if (permit) {
        const detected = detectAllPermitJhaTemplates(permit);
        setSelectedJhaIds(detected.map((d) => d.template.id));
      }
    }
  }, [isOpen, defaultIncludeJha, defaultJhaTemplateId, defaultJhaTemplateIds, permit]);

  // Keyboard shortcut: Escape to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !permit) return null;

  const permitNo = permit?.Permit_No || permit?.PermitNo || '—';

  const toggleJhaId = (id: string) => {
    setSelectedJhaIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((i) => i !== id);
        if (next.length === 0) setIncludeJha(false);
        return next;
      } else {
        setIncludeJha(true);
        return [...prev, id];
      }
    });
  };

  const selectAllApplicable = () => {
    setIncludeJha(true);
    setSelectedJhaIds(applicableJhas.map((d) => d.template.id));
  };

  const clearAllJhas = () => {
    setSelectedJhaIds([]);
    setIncludeJha(false);
  };

  const addCustomJha = (id: string) => {
    if (!selectedJhaIds.includes(id)) {
      setIncludeJha(true);
      setSelectedJhaIds((prev) => [...prev, id]);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const permitPages = includeReverse ? 4 : 2;
  const jhaPages = includeJha ? selectedJhaIds.length : 0;
  const totalPages = permitPages + jhaPages;
  const additionalJhasCount = applicableJhas.filter((j) => !j.isPrimary).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col overflow-hidden animate-in fade-in duration-200 print:bg-white print:static print:inset-auto print:z-auto print:overflow-visible print:block print:p-0 print:m-0 print:w-full print:h-auto print:min-h-0"
    >
      {/* 1. Modal Command Header Bar */}
      <div className="no-print bg-slate-900 text-white px-4 py-3 sm:px-6 flex flex-col gap-2.5 shrink-0 border-b border-slate-700/80 shadow-md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">print</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="print-modal-title" className="font-bold text-sm sm:text-base text-white truncate">
                  Official PTW Document Preview & Print
                </h2>
                {additionalJhasCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <span className="material-symbols-outlined text-[12px]">layers</span>
                    +{additionalJhasCount} Additional WorkType {additionalJhasCount === 1 ? 'JHA' : 'JHAs'} Attached
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 font-mono truncate">
                HSE/SAF/02 Rev-08 · Permit <span className="text-sky-300 font-bold">#{permitNo}</span> · Gujarat Fluorochemicals Limited Dahej
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
              {totalPages} {totalPages === 1 ? 'Page' : 'Pages'} ({permitPages} Permit + {jhaPages} JHA)
            </span>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-[#006398] hover:bg-[#004f7a] active:bg-[#003d5e] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm hover:shadow cursor-pointer"
              title="Open browser print / Save as PDF dialog"
            >
              <span className="material-symbols-outlined text-[17px]">print</span>
              <span>Print / Save PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close Preview (Esc)"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* 2. Options Toolbar */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Reverse Side Toggle */}
            <label className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700/90 text-slate-200 px-3 py-1.5 rounded-xl cursor-pointer border border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={includeReverse}
                onChange={(e) => setIncludeReverse(e.target.checked)}
                className="rounded text-[#006398] focus:ring-0 cursor-pointer"
              />
              <span>Include Reverse Side (Pages 3–4)</span>
            </label>

            {/* JHA Master Toggle */}
            <label className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700/90 text-slate-200 px-3 py-1.5 rounded-xl cursor-pointer border border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={includeJha}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIncludeJha(checked);
                  if (checked && selectedJhaIds.length === 0) {
                    setSelectedJhaIds(applicableJhas.map((d) => d.template.id));
                  }
                }}
                className="rounded text-[#006398] focus:ring-0 cursor-pointer"
              />
              <span className="flex items-center gap-1 font-semibold text-white">
                <span className="material-symbols-outlined text-[15px] text-amber-400">security</span>
                <span>Include JHA / JSA Sheets</span>
              </span>
            </label>
          </div>

          {/* JHA Template Multi-Selector Buttons */}
          {includeJha && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono text-slate-400 hidden lg:inline">
                Select JHAs to Print:
              </span>

              {/* Detected Applicable JHAs (Primary + Additional _WorkType) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {applicableJhas.map((item) => {
                  const isChecked = selectedJhaIds.includes(item.template.id);
                  return (
                    <button
                      key={item.template.id}
                      type="button"
                      onClick={() => toggleJhaId(item.template.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border cursor-pointer ${
                        isChecked
                          ? 'bg-sky-600 text-white border-sky-400 shadow-xs'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                      }`}
                      title={`${item.sourceLabel}: Click to ${isChecked ? 'remove from' : 'include in'} print`}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {isChecked ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span>{item.categoryLabel}</span>
                      {item.isPrimary ? (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/30 text-sky-200">
                          Primary
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-400/25 text-amber-200 border border-amber-400/30">
                          _WorkType ({item.workTypeCode})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quick Select All / None */}
              {applicableJhas.length > 1 && (
                <div className="flex items-center gap-1 pl-1">
                  <button
                    type="button"
                    onClick={selectAllApplicable}
                    className="text-[11px] text-sky-300 hover:text-sky-200 hover:underline font-medium cursor-pointer"
                  >
                    All ({applicableJhas.length})
                  </button>
                  <span className="text-slate-600">·</span>
                  <button
                    type="button"
                    onClick={clearAllJhas}
                    className="text-[11px] text-slate-400 hover:text-slate-200 hover:underline font-medium cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Add Other Standard Catalog Dropdown */}
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addCustomJha(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-slate-800 text-slate-300 border border-slate-700 rounded-xl px-2 py-1 text-xs focus:outline-none focus:border-sky-500 cursor-pointer"
                defaultValue=""
                title="Add any additional standard JHA template from catalog"
              >
                <option value="" disabled>+ Add Another JHA...</option>
                {JHA_TEMPLATES.filter((t) => !selectedJhaIds.includes(t.id)).map((t) => (
                  <option key={t.id} value={t.id}>
                    + {t.title.replace('Job Hazard Analysis (JHA) for ', '')}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 2. Scrollable Canvas with Authentic A4 Sheet Mockups */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-300/85 flex flex-col items-center print:bg-white print:p-0 print:m-0 print:block print:overflow-visible print:w-full">
        {/* Document Meta Banner */}
        <div className="no-print w-full max-w-[210mm] mb-3 flex items-center justify-between text-xs text-slate-700 font-medium px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Print Ready Preview: Standard A4 Portrait Format (HSE/SAF/02 & HSE/SAF/F/05)</span>
          </div>
          <span className="font-mono text-[11px] text-slate-600">
            {includeReverse ? 'Pages 1–4 (Permit)' : 'Pages 1–2 (Permit)'}
            {includeJha && selectedJhaIds.length > 0
              ? ` + ${selectedJhaIds.length} JHA ${selectedJhaIds.length === 1 ? 'Sheet' : 'Sheets'}`
              : ''}
          </span>
        </div>

        {/* The Live Document Component */}
        <div className="w-full max-w-[210mm] flex flex-col items-center print:max-w-none print:w-full print:block print:p-0 print:m-0 space-y-6 print:space-y-0">
          {/* 1. Annexure-V PTW Pages */}
          <PermitAnnexPrintView permit={permit} includeReverseSide={includeReverse} />

          {/* 2. Selected JHA / JSA Sheets (Primary + All Attached Additional WorkTypes) */}
          {includeJha &&
            selectedJhaIds.map((jhaId, idx) => {
              const template = getJhaTemplateById(jhaId);
              const detected = applicableJhas.find((j) => j.template.id === jhaId);
              const workTypeBadge = detected
                ? detected.isPrimary
                  ? `Primary: ${detected.categoryLabel}`
                  : `Additional WorkType (${detected.workTypeCode}): ${detected.categoryLabel}`
                : template.categoryCode;

              return (
                <div
                  key={`${jhaId}-${idx}`}
                  className="w-full max-w-[210mm] print:max-w-none print:w-full print:block print:break-before-page"
                  style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
                >
                  {/* On-Screen Preview Bar for this JHA Sheet */}
                  <div className="no-print my-3 flex items-center justify-between text-xs bg-slate-800 text-slate-200 px-3.5 py-2 rounded-xl border border-slate-700 shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[17px] text-teal-400">security</span>
                      <span className="font-bold text-white truncate">
                        JHA Sheet {idx + 1} of {selectedJhaIds.length}: {template.title.replace('Job Hazard Analysis (JHA) for ', '')}
                      </span>
                      {detected ? (
                        detected.isPrimary ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            Primary Permit JHA
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Additional WorkType ({detected.workTypeCode})
                          </span>
                        )
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300 border border-slate-600">
                          Custom Catalog JHA
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleJhaId(jhaId)}
                      className="text-xs text-rose-300 hover:text-rose-200 hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                      title="Exclude this JHA sheet from print"
                    >
                      <span className="material-symbols-outlined text-[15px]">close</span>
                      <span>Exclude</span>
                    </button>
                  </div>

                  <PermitJhaPrintView
                    permit={permit}
                    template={template}
                    workTypeBadge={workTypeBadge}
                    sourceLabel={detected?.sourceLabel}
                  />
                </div>
              );
            })}
        </div>

        {/* Bottom Floating Print Button */}
        <div className="no-print w-full max-w-[210mm] mt-4 mb-8 flex justify-center items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-sky-400">print</span>
            <span>Print or Save Document ({totalPages} Pages PDF)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 shadow-sm transition-all cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
