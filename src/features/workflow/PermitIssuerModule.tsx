import React, { useState } from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';

export const PermitIssuerModule: React.FC = () => {
  const { user } = useSapAuth();
  const [issued, setIssued] = useState(false);
  const [checks, setChecks] = useState({
    toolboxTalk: true,
    fireWatchReady: true,
    atmosphereVerified: true,
    lotoVerified: true,
    barricadesErected: true
  });

  const toggleCheck = (key: keyof typeof checks) => {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const allReady = Object.values(checks).every(Boolean);

  const handleIssuePermit = () => {
    setIssued(true);
    setTimeout(() => setIssued(false), 7000);
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-gray-500 uppercase tracking-wider font-semibold">Permit Issuer</span>
          <span className="text-gray-300 text-xs">/</span>
          <span className="font-mono text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
            SITE CLEARANCE & ISSUANCE
          </span>
        </div>
        <span className="bg-gray-50 border border-gray-200 px-3 py-1 rounded font-mono text-xs text-gray-700">
          Certified Issuer: <strong className="text-emerald-700">{user?.id}</strong> ({user?.fullName})
        </span>
      </div>

      {issued && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-emerald-600">verified</span>
          <span className="text-xs font-mono font-semibold">
            Permit PTW-2026-0941 has been officially ISSUED to Permit Holder! Field work authorized to commence.
          </span>
        </div>
      )}

      {/* Issuance Checklist & Verification */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-5">
        <div>
          <h2 className="font-display font-bold text-lg text-gray-900">
            Pre-Issuance Field Safety & Handover Verification
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            As the designated SAP Permit Issuer, verify that site isolation and contractor briefings are completed before issuing authorization.
          </p>
        </div>

        {/* Verification Checkboxes */}
        <div className="space-y-3">
          {[
            { key: 'toolboxTalk', title: 'Pre-Job Safety Briefing (Toolbox Talk) Conducted', desc: 'All 4 contractor personnel briefed on hazards, escape routes, and alarm sounds.' },
            { key: 'fireWatchReady', title: 'Continuous Fire Watch & Extinguishers Stationed', desc: 'Dedicated safety watch with 50lb dry chemical extinguisher stationed within 5 meters.' },
            { key: 'atmosphereVerified', title: 'Atmospheric Gas Test Validated Within 2 Hours', desc: 'Continuous sniffer reading: O2 at 20.8%, LEL at 0%, H2S at 0 ppm.' },
            { key: 'lotoVerified', title: 'LOTO Physical Padlocks & Zero Energy State Confirmed', desc: 'All 3 energy isolation points locked with tags verified in the LOTO Vault.' },
            { key: 'barricadesErected', title: 'Red Warning Tape & 25m SIMOPS Buffer Barricaded', desc: 'Physical perimeter cordoned off preventing unauthorized entry into active hot work zone.' }
          ].map((item) => {
            const checked = checks[item.key as keyof typeof checks];
            return (
              <div
                key={item.key}
                onClick={() => toggleCheck(item.key as keyof typeof checks)}
                className={`p-3.5 rounded-lg border cursor-pointer flex items-start gap-3 transition-all ${
                  checked
                    ? 'bg-emerald-50/50 border-emerald-300 shadow-sm'
                    : 'bg-gray-50 border-gray-200 opacity-70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {}}
                  className="mt-0.5 h-4 w-4 accent-emerald-600 rounded cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-xs font-bold text-gray-900 block">{item.title}</span>
                  <span className="text-[11px] text-gray-600 block mt-0.5">{item.desc}</span>
                </div>
                {checked && (
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-bold">
                    VERIFIED
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Issuer Action Button */}
        <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
          <div className="text-xs text-gray-500 font-mono">
            <span>Issuer ID: <strong>{user?.id}</strong></span> • <span>SAP Timestamp: {new Date().toLocaleTimeString()}</span>
          </div>

          <button
            disabled={!allReady}
            onClick={handleIssuePermit}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-display font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>Issue Permit to Field Holder</span>
          </button>
        </div>
      </div>
    </div>
  );
};
