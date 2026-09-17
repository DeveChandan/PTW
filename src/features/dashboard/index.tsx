import React from 'react';
import { LayoutDashboard, Lock, Wind, Printer, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export const DashboardModule: React.FC = () => {
  const kpis = [
    { label: 'Active Permits in Field', value: 14, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { label: 'Pending Approvals', value: 5, icon: Clock, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { label: 'Expiring Within 2 Hours', value: 2, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { label: 'LOTO Points Isolated', value: 38, icon: Lock, color: 'text-purple-600 bg-purple-50 border-purple-200' }
  ];

  const lotoRecords = [
    { tag: 'TAG-ELEC-401', point: 'Motor Control Center (MCC-3) Breaker #12', type: 'Electrical', status: 'LOCKED', isolatedBy: 'ELEC_TECH_01', verifiedBy: 'AREA_SUP_02' },
    { tag: 'TAG-VALV-109', point: 'Inlet Feed Valve V-102 (Suction Line)', type: 'Mechanical Valve', status: 'LOCKED & TAGGED', isolatedBy: 'MECH_TECH_04', verifiedBy: 'AREA_SUP_02' },
    { tag: 'TAG-BLND-005', point: 'Flange Spool Piece Blind #5', type: 'Blind Flange', status: 'LOCKED', isolatedBy: 'MECH_TECH_04', verifiedBy: 'AREA_SUP_02' }
  ];

  const gasTests = [
    { time: '08:45 UTC', o2: '20.9%', lel: '0%', h2s: '0 ppm', co: '2 ppm', tester: 'M_SHARMA', passed: true },
    { time: '12:00 UTC', o2: '20.8%', lel: '0%', h2s: '0 ppm', co: '1 ppm', tester: 'M_SHARMA', passed: true }
  ];

  return (
    <div className="space-y-6">
      {/* Developer Banner */}
      <div className="bg-emerald-50 border-l-4 border-emerald-600 p-4 rounded-r-md flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-emerald-900 flex items-center space-x-2">
            <LayoutDashboard className="w-5 h-5 text-emerald-600" />
            <span>Developer 3 Module: Operations Dashboard, LOTO & Reporting</span>
          </h2>
          <p className="text-xs text-emerald-700 mt-0.5">
            Owns: Operational KPIs, Lockout/Tagout (LOTO) Isolation Management, Atmospheric Gas Testing Log, and Printable PTW Forms.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 text-xs rounded font-medium flex items-center space-x-1 shadow-sm hover:bg-emerald-100"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Official PTW</span>
          </button>
          <span className="text-xs bg-emerald-200 text-emerald-800 px-2.5 py-1 rounded font-mono font-medium">
            src/features/dashboard/
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className={`p-4 rounded-lg border bg-white shadow-sm flex items-center justify-between`}>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
              </div>
              <div className={`p-3 rounded-lg border ${kpi.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* LOTO Isolation Manager */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center space-x-2">
            <Lock className="w-4 h-4 text-purple-600" />
            <span>Lockout / Tagout (LOTO) Energy Isolation Points</span>
          </h3>
          <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-medium">
            3 Required Points • All Verified
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 text-gray-600 uppercase border-b">
              <tr>
                <th className="py-2.5 px-3">Lock Tag ID</th>
                <th className="py-2.5 px-3">Isolation Point & Location</th>
                <th className="py-2.5 px-3">Energy Type</th>
                <th className="py-2.5 px-3">Current Status</th>
                <th className="py-2.5 px-3">Isolated By</th>
                <th className="py-2.5 px-3">Verified By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {lotoRecords.map((rec, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-purple-800">{rec.tag}</td>
                  <td className="py-2.5 px-3 font-medium">{rec.point}</td>
                  <td className="py-2.5 px-3">{rec.type}</td>
                  <td className="py-2.5 px-3">
                    <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded border border-emerald-200">
                      {rec.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono">{rec.isolatedBy}</td>
                  <td className="py-2.5 px-3 font-mono">{rec.verifiedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Atmospheric Gas Testing Log */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center space-x-2">
            <Wind className="w-4 h-4 text-blue-600" />
            <span>Atmospheric Gas Testing Records (Mandatory for Hot Work & Confined Space)</span>
          </h3>
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-medium">
            Thresholds: O2 (19.5-23.5%) • LEL (&lt;10%) • H2S (&lt;10ppm) • CO (&lt;25ppm)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 text-gray-600 uppercase border-b">
              <tr>
                <th className="py-2.5 px-3">Test Timestamp</th>
                <th className="py-2.5 px-3">Oxygen (O2 %)</th>
                <th className="py-2.5 px-3">Flammability (LEL %)</th>
                <th className="py-2.5 px-3">Hydrogen Sulfide (H2S)</th>
                <th className="py-2.5 px-3">Carbon Monoxide (CO)</th>
                <th className="py-2.5 px-3">Certified Tester</th>
                <th className="py-2.5 px-3">Safety Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {gasTests.map((test, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="py-2.5 px-3 font-mono">{test.time}</td>
                  <td className="py-2.5 px-3 font-semibold text-blue-700">{test.o2}</td>
                  <td className="py-2.5 px-3 font-semibold text-emerald-700">{test.lel}</td>
                  <td className="py-2.5 px-3">{test.h2s}</td>
                  <td className="py-2.5 px-3">{test.co}</td>
                  <td className="py-2.5 px-3 font-mono">{test.tester}</td>
                  <td className="py-2.5 px-3">
                    <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded border border-emerald-200">
                      SAFE TO PROCEED
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
