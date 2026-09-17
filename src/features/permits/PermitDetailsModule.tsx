import React from 'react';

export const PermitDetailsModule: React.FC = () => {
  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-gray-500 uppercase tracking-wider font-semibold">Permit Details</span>
          <span className="text-gray-300 text-xs">/</span>
          <span className="font-mono text-xs text-[#006398] font-bold">PTW-2026-0941</span>
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded font-mono text-[10px] font-bold uppercase">
            ACTIVE IN FIELD
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-mono font-semibold rounded flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            <span>Print Official Form</span>
          </button>
        </div>
      </div>

      {/* Main Permit Sheet */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-6">
        {/* Title and Identification */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-5">
          <div>
            <span className="text-[10px] font-mono text-[#006398] font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              SAP Work Order: WO-2026-8841 • Equipment: V-4012-A
            </span>
            <h1 className="font-display font-bold text-xl text-gray-900 mt-2">
              Valve Repacking & Flange Gasket Replacement on Deethanizer Column
            </h1>
            <p className="text-xs text-gray-600 mt-1">
              Sector 04 - Olefins & Aromatics Plant • Refinery Complex 04 • High Pressure Flange Circuit
            </p>
          </div>

          <div className="text-right">
            <span className="block text-[11px] font-mono text-gray-500">Validity Period:</span>
            <span className="block font-mono text-xs font-bold text-gray-900 mt-0.5">
              Today 08:00 – 18:00 CST (Shift B)
            </span>
            <span className="inline-block mt-1 bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
              Time Remaining: 04h 22m
            </span>
          </div>
        </div>

        {/* Operational Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <span className="text-[10px] font-mono text-gray-500 uppercase block font-semibold">Permit Category</span>
            <span className="font-display font-bold text-sm text-red-700 mt-1 block flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
              HOT WORK (CLASS-A)
            </span>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <span className="text-[10px] font-mono text-gray-500 uppercase block font-semibold">Contractor Team</span>
            <span className="font-display font-bold text-sm text-gray-900 mt-1 block">
              Apex Industrial Ltd (4 Workers)
            </span>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <span className="text-[10px] font-mono text-gray-500 uppercase block font-semibold">Risk Score</span>
            <span className="font-display font-bold text-sm text-amber-700 mt-1 block">
              12 / 25 (MEDIUM-HIGH)
            </span>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <span className="text-[10px] font-mono text-gray-500 uppercase block font-semibold">Zero-Energy State</span>
            <span className="font-display font-bold text-sm text-emerald-700 mt-1 block flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              100% ISOLATED (3 LOCKS)
            </span>
          </div>
        </div>

        {/* P&ID Schematic & Location Context */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-display font-bold text-xs text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#006398] text-[18px]">account_tree</span>
              <span>Piping & Instrumentation Diagram (P&ID) Schematic Reference</span>
            </h3>
            <div className="bg-white border border-gray-300 rounded p-4 text-center">
              <div className="h-32 flex flex-col items-center justify-center text-[#006398]">
                <span className="material-symbols-outlined text-[48px]">schema</span>
                <span className="font-mono text-xs font-bold mt-1">CIRCUIT DIAGRAM: P&ID-HC-4012-REV7</span>
                <span className="text-[11px] text-gray-500 mt-0.5">Hydrocracker Overhead Deethanizer Circuit Line #402</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between text-[11px] font-mono text-gray-500">
                <span>Verified: Lead Process Engineer</span>
                <span>Interlock: LOTO Tag #TAG-VALV-109</span>
              </div>
            </div>
          </div>

          {/* Assigned Personnel */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col justify-between">
            <h3 className="font-display font-bold text-xs text-gray-900 uppercase tracking-wider mb-2">
              Responsible Stakeholders
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="border-b border-gray-200 pb-1.5">
                <span className="text-gray-500 block text-[10px]">Permit Requester:</span>
                <span className="text-gray-900 font-bold">VERTIF-V (Apex Services)</span>
              </div>
              <div className="border-b border-gray-200 pb-1.5">
                <span className="text-gray-500 block text-[10px]">Permit Approver:</span>
                <span className="text-[#006398] font-bold">APPROVER_01 (Area Manager)</span>
              </div>
              <div className="border-b border-gray-200 pb-1.5">
                <span className="text-gray-500 block text-[10px]">Permit Issuer:</span>
                <span className="text-emerald-700 font-bold">ISSUER_01 (Shift Supervisor)</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Permit Holder (On-site Lead):</span>
                <span className="text-purple-700 font-bold">HOLDER_01 (Site Tech Lead)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
