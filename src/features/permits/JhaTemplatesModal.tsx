import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  JHA_TEMPLATES,
  detectBestJhaTemplate,
  getJhaTemplateById,
  GENERAL_SAFETY_GUIDELINES,
} from '../../core/ptw/jhaTemplates';
import { PermitJhaPrintView } from './PermitJhaPrintView';

export interface JhaTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  permitType?: string;
  additionalTypes?: string[];
  jobDesc?: string;
  permitNo?: string;
  onImportHazard?: (hazard: {
    hazardCode: string;
    hazardDesc: string;
    controlCode: string;
    controlDesc: string;
    score: number;
    initialLevel: string;
    activity: string;
  }) => void;
  onImportAllHazards?: (hazards: Array<{
    hazardCode: string;
    hazardDesc: string;
    controlCode: string;
    controlDesc: string;
    score: number;
    initialLevel: string;
    activity: string;
  }>) => void;
  existingHazardsCount?: number;
}

export const JhaTemplatesModal: React.FC<JhaTemplatesModalProps> = ({
  isOpen,
  onClose,
  permitType = 'COLD',
  additionalTypes = [],
  jobDesc = '',
  permitNo = 'DRAFT',
  onImportHazard,
  onImportAllHazards,
  existingHazardsCount = 0,
}) => {
  // Auto-detect recommended template based on permit context
  const recommendedTemplate = useMemo(() => {
    return detectBestJhaTemplate({
      PermitType: permitType,
      _WorkType: additionalTypes.map((code) => ({ WorkTypeCode: code })),
      additionalTypes,
      JobDesc: jobDesc,
    });
  }, [permitType, additionalTypes, jobDesc]);

  // Selected template state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(recommendedTemplate.id);
  const [activeTab, setActiveTab] = useState<'matrix' | 'guidelines' | 'print'>('matrix');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Sync with recommended when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTemplateId(recommendedTemplate.id);
      setSearchQuery('');
    }
  }, [isOpen, recommendedTemplate.id]);

  // Lock body scroll and handle Escape key while modal is active
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const currentTemplate = useMemo(() => {
    return getJhaTemplateById(selectedTemplateId);
  }, [selectedTemplateId]);

  // Categories for filter tabs
  const categories = useMemo(() => {
    const list = [
      { id: 'ALL', label: 'All Standards (11)' },
      { id: 'HOT', label: 'Hot Work' },
      { id: 'CONF', label: 'Confined Space' },
      { id: 'HGHT', label: 'Work at Height' },
      { id: 'LINE', label: 'Line Break' },
      { id: 'ELEC', label: 'Electrical' },
      { id: 'EXCA', label: 'Excavation' },
      { id: 'LIFT', label: 'Rigging & Lifting' },
      { id: 'RAD', label: 'Radiography' },
      { id: 'COLD', label: 'General / Cold' },
    ];
    return list;
  }, []);

  // Filter templates list based on category
  const filteredTemplates = useMemo(() => {
    if (categoryFilter === 'ALL') return JHA_TEMPLATES;
    return JHA_TEMPLATES.filter((t) => {
      const code = t.categoryCode.toUpperCase();
      if (categoryFilter === 'HOT') return code.includes('HOT');
      if (categoryFilter === 'CONF') return code.includes('CONF') || code.includes('CSE');
      if (categoryFilter === 'HGHT') return code.includes('HGHT') || code.includes('HEIGHT') || t.id.includes('HEIGHT');
      if (categoryFilter === 'LINE') return code.includes('LINE') || code.includes('LBRK');
      if (categoryFilter === 'ELEC') return code.includes('ELEC');
      if (categoryFilter === 'EXCA') return code.includes('EXCA');
      if (categoryFilter === 'LIFT') return code.includes('LIFT') || t.id.includes('RIGGING');
      if (categoryFilter === 'RAD') return code.includes('RAD');
      if (categoryFilter === 'COLD') return code.includes('COLD') || code.includes('GEN');
      return true;
    });
  }, [categoryFilter]);

  // Filter rows within active template based on search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return currentTemplate.rows;
    const q = searchQuery.toLowerCase().trim();
    return currentTemplate.rows.filter(
      (r) =>
        r.activity.toLowerCase().includes(q) ||
        r.hazard.toLowerCase().includes(q) ||
        r.consequence.toLowerCase().includes(q) ||
        r.mitigationMeasures.some((m) => m.toLowerCase().includes(q))
    );
  }, [currentTemplate, searchQuery]);

  // Max Initial Risk Score
  const maxInitialRisk = useMemo(() => {
    if (!currentTemplate.rows || currentTemplate.rows.length === 0) return { score: 0, level: 'Low' };
    return currentTemplate.rows.reduce(
      (max, r) => (r.initialRisk.score > max.score ? r.initialRisk : max),
      currentTemplate.rows[0].initialRisk
    );
  }, [currentTemplate]);

  // Max Residual Risk Score
  const maxResidualRisk = useMemo(() => {
    if (!currentTemplate.rows || currentTemplate.rows.length === 0) return { score: 0, level: 'Low' };
    return currentTemplate.rows.reduce(
      (max, r) => (r.residualRisk.score > max.score ? r.residualRisk : max),
      currentTemplate.rows[0].residualRisk
    );
  }, [currentTemplate]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[120] flex items-center justify-center p-2 sm:p-4 md:p-5 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl rounded-2xl border border-slate-700/40 bg-white shadow-2xl flex flex-col h-[94vh] max-h-[94vh] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* 1. MODAL HEADER BANNER */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 px-5 py-4 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-[24px] text-teal-300">security</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-extrabold text-base sm:text-lg tracking-tight">
                  Corporate Standard Job Hazard Analysis (JHA / JSA) Templates
                </h2>
                <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-teal-400/20 text-teal-200 border border-teal-400/30">
                  Format: HSE/SAF/F/05
                </span>
                <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-white/10 text-slate-300">
                  GFL/COR/EHSS 2004.00 Rev 01
                </span>
              </div>
              <p className="text-xs text-teal-100/80 mt-0.5">
                Pre-approved sequential job step hazard identification, risk ratings, and mandatory mitigation barrier controls.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-teal-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
              title="Close Dialog"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. TEMPLATE SELECTION TOOLBAR & TABS */}
        {/* ========================================================================= */}
        <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-3 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Template Dropdown & Recommendation Badge */}
          <div className="flex items-center gap-3 flex-wrap flex-1">
            <div className="flex flex-col">
              <label htmlFor="modal-jha-select" className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                Active JHA Standard Template:
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  id="modal-jha-select"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="font-sans font-bold text-xs bg-white text-slate-900 px-3 py-1.5 rounded-xl border border-slate-300 shadow-xs focus:ring-2 focus:ring-teal-600 focus:outline-none cursor-pointer max-w-sm truncate"
                >
                  {filteredTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.rows.length} Steps)
                    </option>
                  ))}
                </select>

                {selectedTemplateId === recommendedTemplate.id ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                    <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                    Auto-Matched for {permitType} Work
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedTemplateId(recommendedTemplate.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition cursor-pointer"
                    title="Reset selection to auto-recommended template for this permit type"
                  >
                    <span className="material-symbols-outlined text-[13px]">restart_alt</span>
                    Reset to Recommended ({recommendedTemplate.id})
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-2 self-start md:self-end">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('matrix')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'matrix' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">table_chart</span>
                <span>Job Steps Matrix ({filteredRows.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('guidelines')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'guidelines' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">rule</span>
                <span>General Guidelines (10)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('print')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'print' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">description</span>
                <span>Official Form Print View</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. QUICK STATS STRIP & BULK ADOPT BANNER */}
        {/* ========================================================================= */}
        <div className="bg-slate-100/70 border-b border-slate-200 px-5 py-2.5 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Quick Metrics */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 font-sans font-medium text-slate-700">
              <span className="material-symbols-outlined text-[16px] text-teal-700">format_list_numbered</span>
              <span><strong>{currentTemplate.rows.length}</strong> Sequential Job Steps</span>
            </div>
            <div className="flex items-center gap-1.5 font-sans font-medium text-slate-700">
              <span className="material-symbols-outlined text-[16px] text-rose-600">report</span>
              <span>Initial Max Risk: <strong className="text-rose-700 font-mono">Score {maxInitialRisk.score} ({maxInitialRisk.level})</strong></span>
            </div>
            <div className="flex items-center gap-1.5 font-sans font-medium text-slate-700">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
              <span>Post-Barrier ALARP: <strong className="text-emerald-700 font-mono">Score {maxResidualRisk.score} ({maxResidualRisk.level})</strong></span>
            </div>
          </div>

          {/* Bulk Import Action */}
          {onImportAllHazards && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const toImport = currentTemplate.rows.map((row, idx) => ({
                    hazardCode: `${currentTemplate.categoryCode}0${idx + 1}`,
                    hazardDesc: row.hazard,
                    controlCode: `CTRL0${idx + 1}`,
                    controlDesc: row.mitigationMeasures.join('; '),
                    score: row.initialRisk.score,
                    initialLevel: row.initialRisk.level,
                    activity: row.activity,
                  }));
                  onImportAllHazards(toImport);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer border border-emerald-500"
                title={`Import all ${currentTemplate.rows.length} hazards and controls from this template into Permit Step 6`}
              >
                <span className="material-symbols-outlined text-[16px]">playlist_add</span>
                <span>Adopt All {currentTemplate.rows.length} Controls into Permit</span>
              </button>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 4. MODAL BODY (CONTENT BY TAB) */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: JOB STEPS MATRIX */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              {/* Category Filter Pills & Search Input */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-mono text-slate-500 font-bold uppercase mr-1">Standards:</span>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCategoryFilter(c.id);
                        if (c.id !== 'ALL') {
                          const match = JHA_TEMPLATES.find((t) => {
                            const code = t.categoryCode.toUpperCase();
                            if (c.id === 'HOT') return code.includes('HOT');
                            if (c.id === 'CONF') return code.includes('CONF') || code.includes('CSE');
                            if (c.id === 'HGHT') return code.includes('HGHT') || code.includes('HEIGHT') || t.id.includes('HEIGHT');
                            if (c.id === 'LINE') return code.includes('LINE') || code.includes('LBRK');
                            if (c.id === 'ELEC') return code.includes('ELEC');
                            if (c.id === 'EXCA') return code.includes('EXCA');
                            if (c.id === 'LIFT') return code.includes('LIFT') || t.id.includes('RIGGING');
                            if (c.id === 'RAD') return code.includes('RAD');
                            if (c.id === 'COLD') return code.includes('COLD') || code.includes('GEN');
                            return true;
                          });
                          if (match) setSelectedTemplateId(match.id);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        categoryFilter === c.id
                          ? 'bg-teal-700 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  {/* Search Box */}
                  <div className="relative flex-1 max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
                      search
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search hazards, job steps, or controls..."
                      className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-teal-600 focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Subtitle / Header details */}
                  <div className="text-right">
                    <span className="font-mono text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                      {currentTemplate.subtitle}
                    </span>
                  </div>
                </div>
              </div>

              {/* JHA Matrix Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-mono text-[11px] border-b border-slate-200 uppercase tracking-wider">
                      <th className="p-3 w-10 text-center font-bold">#</th>
                      <th className="p-3 w-44 font-bold">Sequence of Basic Job Steps</th>
                      <th className="p-3 w-48 font-bold">Potential Hazards</th>
                      <th className="p-3 w-48 font-bold">Consequences / Harm</th>
                      <th className="p-3 w-28 text-center font-bold">Initial Risk</th>
                      <th className="p-3 min-w-[280px] font-bold">Recommended Mitigation Measures / Controls</th>
                      <th className="p-3 w-28 text-center font-bold">Residual Risk</th>
                      {onImportHazard && <th className="p-3 w-28 text-right font-bold">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans bg-white">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={onImportHazard ? 8 : 7} className="p-8 text-center text-xs text-slate-400 italic">
                          No job steps found matching "{searchQuery}".
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, idx) => {
                        const isHigh = row.initialRisk.level === 'High';
                        const isMed = row.initialRisk.level === 'Medium';
                        return (
                          <tr key={idx} className="hover:bg-teal-50/30 transition-colors">
                            {/* 1. Step # */}
                            <td className="p-3 font-mono font-bold text-slate-500 text-center align-top">
                              {idx + 1}
                            </td>

                            {/* 2. Sequence of Basic Job Steps */}
                            <td className="p-3 font-semibold text-slate-900 align-top">
                              <span className="text-slate-800 leading-snug block">
                                {row.activity}
                              </span>
                            </td>

                            {/* 3. Potential Hazards */}
                            <td className="p-3 font-medium text-slate-800 align-top">
                              <div className="flex items-start gap-1.5">
                                <span className="material-symbols-outlined text-[15px] text-amber-600 shrink-0 mt-0.5">
                                  warning
                                </span>
                                <span>{row.hazard}</span>
                              </div>
                            </td>

                            {/* 4. Consequences / Harm */}
                            <td className="p-3 text-slate-600 align-top">
                              <span className="leading-snug block">{row.consequence}</span>
                            </td>

                            {/* 5. Initial Risk Rating */}
                            <td className="p-3 text-center align-top">
                              <div className={`p-1.5 rounded-lg border font-mono text-[10px] leading-tight ${
                                isHigh
                                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                                  : isMed
                                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                              }`}>
                                <div className="font-extrabold text-xs">
                                  Score {row.initialRisk.score}
                                </div>
                                <div className="text-[9px] font-bold uppercase mt-0.5">
                                  {row.initialRisk.level}
                                </div>
                                <div className="text-[8.5px] text-slate-500 font-sans mt-0.5">
                                  {row.initialRisk.severity} × {row.initialRisk.likelihood}
                                </div>
                              </div>
                            </td>

                            {/* 6. Mitigation Measures / Controls */}
                            <td className="p-3 text-slate-700 align-top">
                              <ul className="space-y-1 list-disc list-outside pl-4 text-xs leading-relaxed text-slate-700">
                                {row.mitigationMeasures.map((measure, mIdx) => (
                                  <li key={mIdx}>
                                    {measure}
                                  </li>
                                ))}
                              </ul>
                            </td>

                            {/* 7. Residual Risk (ALARP) */}
                            <td className="p-3 text-center align-top">
                              <div className="p-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 font-mono text-[10px] leading-tight">
                                <div className="font-extrabold text-xs">
                                  Score {row.residualRisk.score}
                                </div>
                                <div className="text-[9px] font-bold uppercase mt-0.5">
                                  {row.residualRisk.level} (ALARP)
                                </div>
                                <div className="text-[8.5px] text-emerald-700 font-sans mt-0.5">
                                  {row.residualRisk.severity} × {row.residualRisk.likelihood}
                                </div>
                              </div>
                            </td>

                            {/* 8. Action: Add to Permit */}
                            {onImportHazard && (
                              <td className="p-3 text-right align-top whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onImportHazard({
                                      hazardCode: `${currentTemplate.categoryCode}0${idx + 1}`,
                                      hazardDesc: row.hazard,
                                      controlCode: `CTRL0${idx + 1}`,
                                      controlDesc: row.mitigationMeasures.join('; '),
                                      score: row.initialRisk.score,
                                      initialLevel: row.initialRisk.level,
                                      activity: row.activity,
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-600 text-teal-800 hover:text-white border border-teal-300 text-[11px] font-bold transition shadow-2xs cursor-pointer"
                                  title="Add this hazard and mitigation controls into Permit Step 6"
                                >
                                  <span className="material-symbols-outlined text-[14px]">add_circle</span>
                                  <span>+ Use in Permit</span>
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: GENERAL SAFETY GUIDELINES */}
          {activeTab === 'guidelines' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-700 text-[20px]">verified</span>
                  <h3 className="font-bold text-sm text-teal-950">
                    GFL Dahej Mandatory General Safety Guidelines for PTW Execution
                  </h3>
                </div>
                <p className="text-xs text-teal-900/80 leading-relaxed">
                  These 10 safety mandates apply to all operational areas, maintenance work centers, and contractor activities across the complex under standard GFL/COR/EHSS.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {GENERAL_SAFETY_GUIDELINES.map((guideline, gIdx) => (
                  <div
                    key={gIdx}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-start gap-3"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-mono text-xs font-black shrink-0">
                      {gIdx + 1}
                    </span>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                      {guideline}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: OFFICIAL FORM PRINT VIEW */}
          {activeTab === 'print' && (
            <div className="space-y-4 bg-slate-100 p-4 rounded-xl">
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <span className="font-bold text-xs text-slate-800">
                    Official JHA Document Layout (HSE/SAF/F/05)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Exact formatting matching GFL Corporate standard printouts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">print</span>
                  <span>Print Document</span>
                </button>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm max-w-4xl mx-auto">
                <PermitJhaPrintView
                  permit={{
                    Permit_No: permitNo,
                    PermitType: permitType,
                    Werks: '1002',
                    AreaLoc: 'Dahej Industrial Complex',
                    JobDesc: jobDesc || currentTemplate.title,
                  }}
                  template={currentTemplate}
                />
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 5. MODAL FOOTER */}
        {/* ========================================================================= */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 shrink-0 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
            <span>Active Permit: <strong>{permitNo}</strong></span>
            <span>•</span>
            <span>Current Permit Hazards: <strong>{existingHazardsCount}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-100 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
