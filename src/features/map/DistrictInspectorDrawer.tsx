import React, { useState } from 'react';
import { SafetyDistrict } from '../../core/ptw/safetyDistricts';
import { ActivePermitPin } from './types';

interface DistrictInspectorDrawerProps {
  district: SafetyDistrict | null;
  onClose: () => void;
  activePermits: ActivePermitPin[];
  onSelectPermit: (permit: ActivePermitPin) => void;
}

export const DistrictInspectorDrawer: React.FC<DistrictInspectorDrawerProps> = ({
  district,
  onClose,
  activePermits,
  onSelectPermit
}) => {
  const [copied, setCopied] = useState(false);

  if (!district) return null;

  const districtPermits = activePermits.filter((p) => p.targetId === district.id);

  const handleCopy = () => {
    const text = `Safety District ${district.id} - ${district.name} (Owner: ${district.owner})`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside
      className="w-96 sm:w-[420px] bg-white/95 backdrop-blur-xl border-l border-slate-200 shadow-2xl flex flex-col h-full z-30 animate-in slide-in-from-right duration-300 overflow-hidden font-sans select-none"
      aria-label="District Details Inspector"
    >
      {/* Header with District Badge & Close */}
      <div className="p-5 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-sky-50/30 flex items-start justify-between gap-3 shrink-0">
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-mono font-bold text-lg shadow-md shrink-0 bg-red-600"
          >
            {district.code}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                DISTRICT {district.id}
              </span>
              <span
                className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                  district.riskProfile === 'HIGH'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : district.riskProfile === 'MEDIUM'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {district.riskProfile || 'STANDARD'} RISK ZONE
              </span>
            </div>
            <h2 className="font-bold text-base text-slate-900 mt-1 leading-snug">
              {district.shortLabel}
            </h2>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
          title="Close Inspector"
        >
          ✕
        </button>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
        {/* Full Official Description */}
        <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/80">
          <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block mb-1">
            Official Drawing Scope (Drg. GFL-PP-DWG-SD-04-15-D0127)
          </span>
          <p className="text-slate-700 font-medium leading-relaxed">{district.name}</p>
          {district.description && (
            <p className="text-slate-500 text-[11px] mt-2 leading-relaxed italic border-t border-slate-200/60 pt-2">
              {district.description}
            </p>
          )}
        </div>

        {/* District Authority & Owner Card */}
        <div className="bg-gradient-to-br from-white to-sky-50/40 rounded-2xl p-4 border border-sky-200/80 shadow-xs">
          <span className="text-[10px] font-mono font-bold uppercase text-[#006398] block mb-2">
            Designated Safety District Owner
          </span>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#006398] to-sky-400 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
              {district.owner
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-900 text-sm truncate">{district.owner}</h3>
              <p className="text-slate-500 text-[11px] truncate">HOD / Area Authority</p>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 font-bold mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Authorized Issuer & Approver
              </span>
            </div>
          </div>
        </div>

        {/* Road Grid Connectivity: Streets & Avenues */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">
            Road Grid Demarcation (East-West & North-South)
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
              <div className="text-slate-600 font-bold mb-1.5">Avenues (N-S)</div>
              <div className="flex flex-wrap gap-1">
                {district.avenues.length > 0 ? (
                  district.avenues.map((ave) => (
                    <span
                      key={ave}
                      className="px-2 py-0.5 bg-white text-[#006398] font-mono font-bold text-[10px] rounded-md border border-slate-200"
                    >
                      Ave-{ave}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 text-[11px]">Enclosed unit</span>
                )}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
              <div className="text-slate-600 font-bold mb-1.5">Streets (E-W)</div>
              <div className="flex flex-wrap gap-1">
                {district.streets.length > 0 ? (
                  district.streets.map((st) => (
                    <span
                      key={st}
                      className="px-2 py-0.5 bg-white text-emerald-700 font-mono font-bold text-[10px] rounded-md border border-slate-200"
                    >
                      St-{st}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 text-[11px]">Internal corridor</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Active Permits inside this District */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
              Live Work Permits ({districtPermits.length})
            </span>
          </div>

          {districtPermits.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
              No active permits in District {district.code}
            </div>
          ) : (
            districtPermits.map((p) => (
              <div
                key={p.ptwNo}
                onClick={() => onSelectPermit(p)}
                className="p-3 bg-white rounded-xl border border-slate-200 hover:border-amber-400 transition-all cursor-pointer shadow-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900 text-xs">{p.ptwNo}</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-semibold text-slate-700">
                    {p.type}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2">{p.desc}</p>
                <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-100">
                  <span>👷 {p.contractor}</span>
                  <span>
                    X:{p.x}, Y:{p.y}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer Copy / Reference */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
        <button
          onClick={handleCopy}
          className="text-xs text-sky-600 font-semibold hover:underline flex items-center gap-1"
        >
          {copied ? '✓ Copied Details!' : 'Copy District Scope'}
        </button>
        <span className="text-[10px] font-mono text-slate-400">FLOC: GFL-DHJ-SD{district.code}</span>
      </div>
    </aside>
  );
};
