import React, { useState } from 'react';

export const SimopsOverview: React.FC = () => {
  const [filterType, setFilterType] = useState<'ALL' | 'HOT' | 'CONF' | 'LOTO'>('ALL');

  const activePermits = [
    { id: 'PTW-2026-0941', type: 'HOT WORK', title: 'CCU-2 Flange Welding & Repair', area: 'Sector 04 (V-4012-A)', contractor: 'Apex Services', status: 'STAGE 3 PENDING', buffer: '25m Clear', expires: '4h 15m' },
    { id: 'PTW-2026-0938', type: 'CONFINED SPACE', title: 'Tank T-104 Internal Hydroblast', area: 'Sector 02 (Tank Farm)', contractor: 'CleanAir Tech', status: 'ACTIVE IN FIELD', buffer: 'Isolated', expires: '6h 30m' },
    { id: 'PTW-2026-0935', type: 'ELECTRICAL', title: 'Substation Transformer Feeder #3', area: 'Sector 01 (Power Grid)', contractor: 'Siemens Energy', status: 'LOTO LOCKED', buffer: 'De-energized', expires: '2h 00m' },
    { id: 'PTW-2026-0929', type: 'COLD WORK', title: 'Condenser Bundle Pulling & Retubing', area: 'Sector 06 (Utilities)', contractor: 'Fluor Heavy', status: 'ACTIVE IN FIELD', buffer: 'Clear', expires: '8h 45m' }
  ];

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* 1. Top Level Command Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-[#006398] font-mono text-[10px] uppercase tracking-wider font-bold border border-blue-200">
              SIMOPS MATRIX ACTIVE
            </span>
            <span className="font-mono text-xs text-gray-500">
              GEO-BUFFER ALGORITHM: 25M ISOLATION PROTOCOL
            </span>
          </div>
          <h1 className="font-display font-bold text-xl text-gray-900 tracking-tight">
            Industrial SIMOPS & Operational Overview
          </h1>
          <p className="text-xs text-gray-500">
            Real-time simultaneous operations conflict detector, LOTO isolation ledger, and live telemetry for Refinery Complex 04.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-50 px-3.5 py-2 rounded-lg border border-gray-200">
            <span className="material-symbols-outlined text-[#006398] text-[20px]">layers</span>
            <div className="flex flex-col">
              <span className="font-mono text-[9px] text-gray-500 uppercase font-bold">Spatial Engine</span>
              <span className="font-mono text-xs text-gray-900 font-bold">Mesh 3D v4.8</span>
            </div>
          </div>

          <button
            onClick={() => alert('Recalculating 25-meter spatial proximity buffers across active permits...')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-mono text-xs uppercase rounded transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Filter SIMOPS</span>
          </button>
        </div>
      </div>

      {/* 2. Executive KPI Strip (5 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Active Permits Roster */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#006398]"></div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider font-bold">Active PTW Roster</span>
            <span className="material-symbols-outlined text-[#006398] text-[18px]">assignment</span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl text-gray-900 font-bold">24</span>
              <span className="font-mono text-[10px] text-[#006398] uppercase font-bold">Active</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-gray-500 font-mono text-[10px]">
              <span>8 Hot</span>
              <span>•</span>
              <span>5 Confined</span>
              <span>•</span>
              <span>7 Line</span>
              <span>•</span>
              <span>4 Cold</span>
            </div>
          </div>
          <div className="mt-2 pt-1 border-t border-gray-100 flex items-center justify-between font-mono text-[10px]">
            <span className="text-gray-400">Shift Velocity</span>
            <span className="text-[#006398] font-bold">+3 issued / hr</span>
          </div>
        </div>

        {/* SIMOPS Conflict Engine */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600"></div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider font-bold">SIMOPS Overlap</span>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>0 CONFLICT
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl text-gray-900 font-bold">0</span>
              <span className="font-mono text-[10px] text-emerald-700 uppercase font-bold">Safe Buffer</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 font-sans">Strict 25m spatial radius verified.</p>
          </div>
          <div className="mt-2 pt-1 border-t border-gray-100 flex items-center justify-between font-mono text-[10px]">
            <span className="text-gray-400">Buffer Breaches</span>
            <span className="text-emerald-700 font-bold">0 Today</span>
          </div>
        </div>

        {/* LOTO Zero Energy */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider font-bold">LOTO Vault</span>
            <span className="material-symbols-outlined text-amber-600 text-[18px]">lock</span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl text-gray-900 font-bold">142</span>
              <span className="font-mono text-[10px] text-gray-500">/ 142 LOCKED</span>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
          <div className="mt-2 pt-1 border-t border-gray-100 flex items-center justify-between font-mono text-[10px]">
            <span className="text-amber-800 font-bold">100% Zero-Energy</span>
            <span className="text-gray-400">Dual-Sign Verified</span>
          </div>
        </div>

        {/* Atmospheric Sniffers */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#006398]"></div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider font-bold">Gas Sniffers</span>
            <span className="material-symbols-outlined text-[#006398] text-[18px]">air</span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl text-gray-900 font-bold">38</span>
              <span className="font-mono text-[10px] text-[#006398] uppercase font-bold">Online</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 font-sans">0 LEL Exceedance • 0.02 ppm avg</p>
          </div>
          <div className="mt-2 pt-1 border-t border-gray-100 flex items-center justify-between font-mono text-[10px]">
            <span className="text-gray-400">Telemetry Sync</span>
            <span className="text-[#006398] font-bold">12ms Latency</span>
          </div>
        </div>

        {/* Safety Milestone */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600"></div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider font-bold">Safety Milestone</span>
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">verified_user</span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl text-gray-900 font-bold">1,429</span>
              <span className="font-mono text-[10px] text-emerald-700 uppercase font-bold">Days Zero LTI</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 font-sans">OSHA Tier-1 Star Plant Status</p>
          </div>
          <div className="mt-2 pt-1 border-t border-gray-100 flex items-center justify-between font-mono text-[10px]">
            <span className="text-gray-400">Next Audit</span>
            <span className="text-emerald-700 font-bold">In 42 Days</span>
          </div>
        </div>
      </div>

      {/* 3. Live Active Permits Ledger */}
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <div>
            <h3 className="font-display font-bold text-sm text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006398]">view_timeline</span>
              <span>Live Operations & Field Permit Clearance Ledger</span>
            </h3>
            <p className="text-xs text-gray-500">Continuous SAP synchronization with Plant Maintenance (SAP PM)</p>
          </div>

          <div className="flex gap-2">
            {['ALL', 'HOT', 'CONF', 'LOTO'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterType(tab as any)}
                className={`px-3 py-1 rounded text-xs font-mono font-semibold uppercase ${
                  filterType === tab
                    ? 'bg-[#006398] text-white shadow-sm'
                    : 'bg-gray-50 text-gray-600 hover:text-gray-900 border border-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-gray-50 text-gray-600 uppercase border-b border-gray-200">
              <tr>
                <th className="py-2.5 px-3">Permit Identifier</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Description & Scope</th>
                <th className="py-2.5 px-3">Plant Facility Location</th>
                <th className="py-2.5 px-3">Clearance Status</th>
                <th className="py-2.5 px-3">25m Buffer</th>
                <th className="py-2.5 px-3">Time Left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {activePermits.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3 font-bold text-[#006398]">{p.id}</td>
                  <td className="py-3 px-3">
                    <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-[10px] font-semibold">
                      {p.type}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-sans font-medium text-gray-900">{p.title}</td>
                  <td className="py-3 px-3 text-gray-600">{p.area}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.status === 'STAGE 3 PENDING'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : p.status === 'ACTIVE IN FIELD'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-blue-50 text-[#006398] border border-blue-200'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-emerald-700 font-bold">{p.buffer}</td>
                  <td className="py-3 px-3 text-amber-700 font-bold">{p.expires}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
