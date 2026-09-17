import React, { useState } from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';

export const GasTesterModule: React.FC = () => {
  const { user } = useSapAuth();

  const [o2, setO2] = useState<number>(20.8);
  const [lel, setLel] = useState<number>(0.0);
  const [h2s, setH2s] = useState<number>(0.0);
  const [co, setCo] = useState<number>(1.5);
  const [logSuccess, setLogSuccess] = useState(false);

  const isSafe = o2 >= 19.5 && o2 <= 23.5 && lel < 10 && h2s < 10 && co < 25;

  const [logs, setLogs] = useState([
    { timestamp: '2026-09-17 08:30 CST', o2: '20.9%', lel: '0%', h2s: '0 ppm', co: '1.2 ppm', snifferId: 'SNIF-IND-902', tester: 'GAS_TECH_01', result: 'SAFE' },
    { timestamp: '2026-09-17 10:30 CST', o2: '20.8%', lel: '0%', h2s: '0 ppm', co: '1.5 ppm', snifferId: 'SNIF-IND-902', tester: 'GAS_TECH_01', result: 'SAFE' }
  ]);

  const handleRecordTest = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry = {
      timestamp: `${new Date().toLocaleTimeString()} CST`,
      o2: `${o2}%`,
      lel: `${lel}%`,
      h2s: `${h2s} ppm`,
      co: `${co} ppm`,
      snifferId: 'SNIF-IND-902',
      tester: user?.id || 'GAS_TECH_01',
      result: isSafe ? 'SAFE' : 'DANGER'
    };

    setLogs(prev => [newEntry, ...prev]);
    setLogSuccess(true);
    setTimeout(() => setLogSuccess(false), 6000);
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-gray-500 uppercase tracking-wider font-semibold">Gas Tester</span>
          <span className="text-gray-300 text-xs">/</span>
          <span className="font-mono text-xs text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 font-bold">
            ATMOSPHERIC SURVEILLANCE
          </span>
        </div>
        <span className="bg-gray-50 border border-gray-200 px-3 py-1 rounded font-mono text-xs text-gray-700">
          Certified Atmospheric Tester: <strong className="text-cyan-800">{user?.id}</strong> ({user?.fullName})
        </span>
      </div>

      {logSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-emerald-600">check_circle</span>
          <span className="text-xs font-mono font-semibold">
            Atmospheric gas test results recorded in SAP OData V4 ledger! Next mandatory re-test in 2 hours.
          </span>
        </div>
      )}

      {/* Gas Testing Form & Thresholds */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: Gas Measurement Entry */}
        <div className="lg:col-span-7 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-3">
            <div>
              <h2 className="font-display font-bold text-base text-gray-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006398]">air</span>
                <span>Atmospheric Gas Test Entry (Calibrated Multi-Gas Sniffer)</span>
              </h2>
              <p className="text-xs text-gray-500">Record direct sensor readouts before allowing hot work or confined entry.</p>
            </div>
            <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
              Bump Test Valid
            </span>
          </div>

          <form onSubmit={handleRecordTest} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-gray-700 font-semibold mb-1">
                  Oxygen Level (O2 %) <span className="text-gray-400 font-normal">[Safe: 19.5% - 23.5%]</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={o2}
                  onChange={(e) => setO2(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:border-[#006398]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-700 font-semibold mb-1">
                  Flammability (LEL %) <span className="text-gray-400 font-normal">[Max Safe: &lt; 10%]</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={lel}
                  onChange={(e) => setLel(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:border-[#006398]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-700 font-semibold mb-1">
                  Toxic Gas H2S (PPM) <span className="text-gray-400 font-normal">[Max Safe: &lt; 10 PPM]</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={h2s}
                  onChange={(e) => setH2s(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:border-[#006398]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-700 font-semibold mb-1">
                  Toxic Gas CO (PPM) <span className="text-gray-400 font-normal">[Max Safe: &lt; 25 PPM]</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={co}
                  onChange={(e) => setCo(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:border-[#006398]"
                  required
                />
              </div>
            </div>

            {/* Calculated Atmosphere Status Banner */}
            <div className={`p-4 rounded-lg border text-center ${
              isSafe ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              <div className="flex items-center justify-center gap-2 font-display font-bold text-sm">
                <span className="material-symbols-outlined">{isSafe ? 'verified' : 'dangerous'}</span>
                <span>{isSafe ? 'ATMOSPHERE NORMAL & SAFE TO ENTER' : 'HAZARD EXCURSION DETECTED: EVACUATE'}</span>
              </div>
              <p className="text-[11px] mt-1 font-mono">
                {isSafe ? 'All gases within permissible OSHA PSM limits.' : 'Gas levels exceed threshold. Evacuate sector immediately.'}
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#006398] hover:bg-[#004f7a] text-white font-display font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors"
            >
              Commit Gas Test to SAP Permit Ledger
            </button>
          </form>
        </div>

        {/* Right 5 Cols: Calibration & Instrument Metadata */}
        <div className="lg:col-span-5 bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-display font-bold text-sm text-gray-900 mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#006398]">tune</span>
              <span>Detector Hardware & Calibration</span>
            </h3>

            <div className="space-y-3 text-xs font-mono">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Instrument Serial</span>
                <span className="text-gray-900 font-bold text-sm mt-0.5 block">SNIF-IND-902 (Industrial Scientific Ventis Pro)</span>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Last Bump Test Calibration</span>
                <span className="text-emerald-700 font-bold block mt-0.5">Today 06:45 CST (Certified Pass)</span>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Next Calibration Due</span>
                <span className="text-gray-800 font-bold block mt-0.5">In 28 Days (Oct 15, 2026)</span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3 mt-4 text-[11px] text-gray-500 font-mono">
            <span>Mandatory Re-Test Rule: </span>
            <strong className="text-gray-700">Every 2 hours for Hot Work & Confined Space.</strong>
          </div>
        </div>
      </div>

      {/* Gas Testing Historical Logs */}
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="font-display font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#006398]">history</span>
          <span>Atmospheric Gas Test History for Unit CCU-2</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-gray-50 text-gray-600 uppercase border-b border-gray-200">
              <tr>
                <th className="py-2.5 px-3">Test Timestamp</th>
                <th className="py-2.5 px-3">Oxygen (O2)</th>
                <th className="py-2.5 px-3">Flammable (LEL)</th>
                <th className="py-2.5 px-3">Toxic H2S</th>
                <th className="py-2.5 px-3">Toxic CO</th>
                <th className="py-2.5 px-3">Tester ID</th>
                <th className="py-2.5 px-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {logs.map((l, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="py-3 px-3 text-gray-600">{l.timestamp}</td>
                  <td className="py-3 px-3 font-bold text-[#006398]">{l.o2}</td>
                  <td className="py-3 px-3 font-bold text-emerald-700">{l.lel}</td>
                  <td className="py-3 px-3">{l.h2s}</td>
                  <td className="py-3 px-3">{l.co}</td>
                  <td className="py-3 px-3 font-mono">{l.tester}</td>
                  <td className="py-3 px-3">
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                      {l.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
