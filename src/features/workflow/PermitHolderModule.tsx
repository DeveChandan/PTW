import React, { useState } from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';

export const PermitHolderModule: React.FC = () => {
  const { user } = useSapAuth();
  const [isSuspended, setIsSuspended] = useState(false);
  const [closedSuccess, setClosedSuccess] = useState(false);

  const [workers] = useState([
    { name: 'David Miller', badge: 'EMP-4011', role: 'Certified Welder (6G)', status: 'ON-SITE' },
    { name: 'K. Patel', badge: 'EMP-4019', role: 'Welder Helper', status: 'ON-SITE' },
    { name: 'R. Simmons', badge: 'EMP-3891', role: 'Rigger / Fitter', status: 'ON-SITE' },
    { name: 'T. Vance', badge: 'EMP-2910', role: 'Dedicated Fire Watch', status: 'ON-SITE' }
  ]);

  const [closureChecks, setClosureChecks] = useState({
    toolsRemoved: true,
    scaffoldCleared: true,
    housekeepingDone: true,
    guardsRestored: true
  });

  const toggleClosureCheck = (key: keyof typeof closureChecks) => {
    setClosureChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePermitHandback = () => {
    setClosedSuccess(true);
    setTimeout(() => setClosedSuccess(false), 7000);
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-gray-500 uppercase tracking-wider font-semibold">Permit Holder</span>
          <span className="text-gray-300 text-xs">/</span>
          <span className="font-mono text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-bold">
            FIELD EXECUTION & SITE SUPERVISION
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSuspended(!isSuspended)}
            className={`px-3.5 py-1.5 rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
              isSuspended
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">pause_circle</span>
            <span>{isSuspended ? 'Resume Field Work' : 'Suspend Work (Break/Alarm)'}</span>
          </button>
        </div>
      </div>

      {closedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-emerald-600">task_alt</span>
          <span className="text-xs font-mono font-semibold">
            Permit PTW-2026-0941 closed and handed back to SAP Operations! Site restoration confirmed.
          </span>
        </div>
      )}

      {/* Holder Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: On-site Worker Register */}
        <div className="lg:col-span-7 bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-sm text-gray-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-purple-700">group</span>
                <span>Active Field Worker Muster Ledger</span>
              </h3>
              <p className="text-xs text-gray-500">Contractor personnel authorized on site under Holder: <strong>{user?.id}</strong></p>
            </div>
            <span className="font-mono text-xs text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-bold">
              4 Workers Checked-In
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-gray-50 text-gray-600 uppercase border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Personnel Name</th>
                  <th className="py-2.5 px-3">Badge ID</th>
                  <th className="py-2.5 px-3">Assigned Craft / Role</th>
                  <th className="py-2.5 px-3">Field Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {workers.map((w, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-3 px-3 font-sans font-bold text-gray-900">{w.name}</td>
                    <td className="py-3 px-3 font-mono text-gray-500">{w.badge}</td>
                    <td className="py-3 px-3 text-gray-600">{w.role}</td>
                    <td className="py-3 px-3">
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                        {w.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 5 Cols: Work Completion & Handback Checklist */}
        <div className="lg:col-span-5 bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-display font-bold text-sm text-gray-900 mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#006398]">assignment_turned_in</span>
              <span>Site Restoration & Permit Handback</span>
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Confirm before closing permit in SAP:
            </p>

            <div className="space-y-2.5">
              {[
                { key: 'toolsRemoved', label: 'All welding equipment, hoses & tools removed' },
                { key: 'scaffoldCleared', label: 'Scaffolding inspected & warning tags updated' },
                { key: 'housekeepingDone', label: 'Sparks, slag, and industrial debris cleaned' },
                { key: 'guardsRestored', label: 'Mechanical safety guards and covers re-installed' }
              ].map((item) => {
                const checked = closureChecks[item.key as keyof typeof closureChecks];
                return (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 p-2 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleClosureCheck(item.key as keyof typeof closureChecks)}
                      className="h-4 w-4 accent-purple-600 rounded"
                    />
                    <span className="text-gray-800 font-medium">{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            onClick={handlePermitHandback}
            className="w-full mt-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-display font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>Sign & Handback Permit (Close in SAP)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
