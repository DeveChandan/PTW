import React, { useState } from 'react';
import type { PermitDeepInsertResponse, PermitInfoRecord } from '../../core/types/ptw.types';
import { PermitAnnexPrintView } from './PermitAnnexPrintView';

interface PermitPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  permit: PermitDeepInsertResponse | PermitInfoRecord | any;
}

export const PermitPrintModal: React.FC<PermitPrintModalProps> = ({
  isOpen,
  onClose,
  permit
}) => {
  const [includeReverse, setIncludeReverse] = useState<boolean>(false);

  if (!isOpen || !permit) return null;

  const permitNo = permit?.Permit_No || permit?.PermitNo || '—';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col overflow-hidden animate-in fade-in duration-200 print:bg-white print:static print:inset-auto print:z-auto print:overflow-visible print:block print:p-0 print:m-0 print:w-full print:h-auto print:min-h-0"
    >
      {/* 1. Modal Command Header Bar */}
      <div className="no-print bg-slate-900 text-white px-4 py-3 sm:px-6 flex items-center justify-between shrink-0 border-b border-slate-700/80 shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">print</span>
          </div>
          <div className="min-w-0">
            <h2 id="print-modal-title" className="font-bold text-sm sm:text-base text-white truncate">
              Official PTW Document Preview — Annexure-V
            </h2>
            <p className="text-[11px] text-slate-300 font-mono truncate">
              HSE/SAF/02 Rev-08 · Permit <span className="text-sky-300 font-bold">#{permitNo}</span> · Gujarat Fluorochemicals Limited Dahej
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <label className="hidden md:flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700/90 text-slate-200 px-3 py-1.5 rounded-xl cursor-pointer border border-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={includeReverse}
              onChange={(e) => setIncludeReverse(e.target.checked)}
              className="rounded text-[#006398] focus:ring-0"
            />
            <span>Include Reverse Side (Pages 3–4)</span>
          </label>

          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
            {includeReverse ? '4 Pages Total' : '2 Pages (Page 1 & 2)'}
          </span>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-[#006398] hover:bg-[#004f7a] active:bg-[#003d5e] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm hover:shadow"
            title="Open browser print / Save as PDF dialog"
          >
            <span className="material-symbols-outlined text-[17px]">print</span>
            <span>Print / Save PDF</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="Close Preview (Esc)"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </div>

      {/* 2. Scrollable Canvas with Authentic A4 Sheet Mockups */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-300/85 flex flex-col items-center print:bg-white print:p-0 print:m-0 print:block print:overflow-visible print:w-full">
        {/* Document Meta Banner */}
        <div className="no-print w-full max-w-[210mm] mb-3 flex items-center justify-between text-xs text-slate-700 font-medium px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Print Ready Preview: Standard A4 Portrait Format</span>
          </div>
          <span className="font-mono text-[11px] text-slate-600">
            {includeReverse ? 'Pages 1, 2, 3 & 4' : 'Page 1 (Front) & Page 2 (Continuation)'}
          </span>
        </div>

        {/* The Live Document Component */}
        <div className="w-full max-w-[210mm] flex flex-col items-center print:max-w-none print:w-full print:block print:p-0 print:m-0">
          <PermitAnnexPrintView permit={permit} includeReverseSide={includeReverse} />
        </div>

        {/* Bottom Floating Print Button */}
        <div className="no-print w-full max-w-[210mm] mt-4 mb-8 flex justify-center items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px] text-sky-400">print</span>
            <span>Print or Save Document (PDF)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 shadow-sm transition-all"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
