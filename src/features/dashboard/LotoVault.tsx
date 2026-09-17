import React, { useState } from 'react';

export const LotoVault: React.FC = () => {
  const [isolationRecords, setIsolationRecords] = useState([
    { tag: 'TAG-ELEC-401', point: 'Motor Control Center (MCC-3) Feed Breaker #12', type: 'Electrical >440V', status: 'LOCKED & TAGGED', isolatedBy: 'ELEC_TECH_01', verifiedBy: 'AREA_SUP_02', energy: '0.0 Volts (Verified)' },
    { tag: 'TAG-VALV-109', point: 'Inlet Feed Valve V-102 (Suction Line)', type: 'Gate Valve', status: 'CHAIN LOCKED', isolatedBy: 'MECH_TECH_04', verifiedBy: 'AREA_SUP_02', energy: '0 PSI (Bleed open)' },
    { tag: 'TAG-BLND-005', point: 'Flange Spool Piece Blind #5 (Spectacle Flange)', type: 'Blind Flange', status: 'BOLTED & TAGGED', isolatedBy: 'MECH_TECH_04', verifiedBy: 'AREA_SUP_02', energy: 'Zero Flow' }
  ]);

  const [newTag, setNewTag] = useState('');
  const [newPoint, setNewPoint] = useState('');

  const handleAddIsolation = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag && newPoint) {
      setIsolationRecords(prev => [
        ...prev,
        {
          tag: newTag,
          point: newPoint,
          type: 'Mechanical / Electrical',
          status: 'LOCKED & TAGGED',
          isolatedBy: 'VERTIF-V',
          verifiedBy: 'AREA_SUP_02',
          energy: 'Zero Energy Verified'
        }
      ]);
      setNewTag('');
      setNewPoint('');
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* 1. Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-mono text-[10px] uppercase font-bold border border-amber-200">
              ZERO-ENERGY VERIFIED
            </span>
            <span className="font-mono text-xs text-gray-500 font-semibold">OSHA 1910.147 COMPLIANT</span>
          </div>
          <h1 className="font-display font-bold text-xl text-gray-900 tracking-tight">
            LOTO Energy Isolation Vault & Key Box Registry
          </h1>
          <p className="text-xs text-gray-500">
            Physical Lockout/Tagout control ledger for hazardous electrical, mechanical, pneumatic, and chemical feeds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-200 text-center">
            <span className="block font-mono text-[10px] text-emerald-800 uppercase font-semibold">Zero Energy Integrity</span>
            <span className="block font-display font-bold text-base text-emerald-700">100% SECURE</span>
          </div>
        </div>
      </div>

      {/* 2. Add Isolation Point Form */}
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="font-display font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#006398]">add_circle</span>
          <span>Register New Energy Isolation Point to Permit</span>
        </h3>
        <form onSubmit={handleAddIsolation} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Lock Tag ID (e.g. TAG-ELEC-409)"
            className="bg-white border border-gray-300 rounded px-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:border-[#006398]"
            required
          />
          <input
            type="text"
            value={newPoint}
            onChange={(e) => setNewPoint(e.target.value)}
            placeholder="Isolation Location / Valve / Breaker Name"
            className="bg-white border border-gray-300 rounded px-3 py-2 text-xs text-gray-900 font-sans focus:outline-none focus:border-[#006398]"
            required
          />
          <button
            type="submit"
            className="py-2 px-4 bg-[#006398] text-white rounded font-display font-bold text-xs uppercase tracking-wider hover:bg-[#004f7a] transition-colors shadow-sm"
          >
            Attach Lockout & Tag
          </button>
        </form>
      </div>

      {/* 3. Isolation Table */}
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="font-display font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#006398]">lock</span>
          <span>Active Field Isolation Points for Unit CCU-2</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-gray-50 text-gray-600 uppercase border-b border-gray-200">
              <tr>
                <th className="py-2.5 px-3">Lock Tag ID</th>
                <th className="py-2.5 px-3">Isolation Point Description</th>
                <th className="py-2.5 px-3">Energy Category</th>
                <th className="py-2.5 px-3">Residual State</th>
                <th className="py-2.5 px-3">Lockout Status</th>
                <th className="py-2.5 px-3">Isolated By</th>
                <th className="py-2.5 px-3">Verified By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {isolationRecords.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3 font-bold text-[#006398]">{r.tag}</td>
                  <td className="py-3 px-3 font-sans font-medium text-gray-900">{r.point}</td>
                  <td className="py-3 px-3 text-gray-600">{r.type}</td>
                  <td className="py-3 px-3 text-emerald-700 font-bold">{r.energy}</td>
                  <td className="py-3 px-3">
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-600">{r.isolatedBy}</td>
                  <td className="py-3 px-3 text-gray-600">{r.verifiedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
