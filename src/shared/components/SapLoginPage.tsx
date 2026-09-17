import React, { useState } from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';

export const SapLoginPage: React.FC = () => {
  const { login, loading, error } = useSapAuth();

  const [userId, setUserId] = useState<string>('VERTIF-V');
  const [password, setPassword] = useState<string>('');
  const [client, setClient] = useState<string>('200');
  const [language, setLanguage] = useState<string>('EN');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login({ userId, password, client, language });
  };

  return (
    <div className="h-screen w-screen bg-[#f8f9ff] flex flex-col justify-between overflow-hidden select-none">
      {/* Top Corporate Brand Bar */}
      <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <img
              src="https://gfl.co.in/assets/images/New_GFL-Logo29.webp"
              alt="Gujarat Fluorochemicals Limited"
              className="h-8 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = './assets/GFL-Logo.webp';
              }}
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-[#0b1c30] tracking-tight uppercase">
                GFL ChemSafe OS
              </span>
              <span className="text-[10px] bg-blue-50 text-[#006398] font-mono font-semibold px-2 py-0.5 rounded border border-blue-200">
                SAP System
              </span>
            </div>
            <span className="font-mono text-[9px] text-gray-500 tracking-wider uppercase">
              Permit To Work (PTW) Enterprise System
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
          <span className="hidden sm:inline">Target: <strong className="text-gray-800">vhgfldevci.sap.gfl.co.in:44300</strong></span>
          <span className="bg-blue-50 text-[#006398] border border-blue-200 px-2.5 py-0.5 rounded font-bold font-mono">
            Client: 200
          </span>
        </div>
      </header>

      {/* Main Centered Login Card Container (No Overflow) */}
      <main className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <img
                src="https://gfl.co.in/assets/images/New_GFL-Logo29.webp"
                alt="GFL"
                className="h-9 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = './assets/GFL-Logo.webp';
                }}
              />
              <div className="h-6 w-px bg-gray-200"></div>
              <div>
                <h1 className="font-display font-bold text-base text-gray-900 leading-tight">
                  SAP NetWeaver Logon
                </h1>
                <p className="text-[10px] text-gray-500">
                  Permit To Work (PTW) Access
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold bg-blue-50 text-[#006398] border border-blue-200 px-2 py-0.5 rounded">
              Client 200
            </span>
          </div>

          {/* Role Authorization Error Banner */}
          {error && (
            <div className="my-4 p-3.5 bg-red-50 border border-red-300 text-red-800 rounded-xl flex items-start gap-2.5 shadow-sm animate-in fade-in">
              <span className="material-symbols-outlined text-red-600 text-[20px] shrink-0 mt-0.5">
                gpp_bad
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-bold font-mono tracking-tight text-red-700 uppercase">
                  {error}
                </span>
                <span className="text-[10px] text-red-600 mt-0.5">
                  Contact Plant Safety Officer / SAP Administrator for role assignment.
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 mt-4">
            <div>
              <label className="block text-[11px] font-mono font-semibold text-gray-700 mb-1 uppercase tracking-wider">
                SAP User ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value.toUpperCase())}
                  placeholder="e.g. VERTIF-V"
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3.5 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:border-[#006398] focus:bg-white transition-colors"
                  required
                />
                <span className="absolute right-3 top-2 material-symbols-outlined text-gray-400 text-[18px]">
                  person
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-semibold text-gray-700 mb-1 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter SAP password"
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3.5 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:border-[#006398] focus:bg-white transition-colors"
                />
                <span className="absolute right-3 top-2 material-symbols-outlined text-gray-400 text-[18px]">
                  key
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono font-semibold text-gray-600 mb-1 uppercase">
                  Client
                </label>
                <input
                  type="text"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-900 focus:outline-none focus:border-[#006398]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono font-semibold text-gray-600 mb-1 uppercase">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-900 focus:outline-none focus:border-[#006398]"
                >
                  <option value="EN">EN (English)</option>
                  <option value="DE">DE (German)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#006398] hover:bg-[#004f7a] text-white font-display font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Verifying SAP Roles via OData V4...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  <span>Log On & Verify Roles</span>
                </>
              )}
            </button>
          </form>

          <div className="border-t border-gray-100 pt-3 mt-4 flex items-center justify-between text-[10px] text-gray-400 font-mono">
            <span>Service: zptw_mamagement_srv</span>
            <span>Client: {client}</span>
          </div>
        </div>
      </main>

      {/* Corporate Compact Footer */}
      <footer className="h-9 bg-white border-t border-gray-200 px-6 flex items-center justify-between text-[11px] text-gray-500 font-mono shrink-0">
        <span>SAP NetWeaver / S/4HANA • Gujarat Fluorochemicals Limited (GFL)</span>
        <span>Client: 200 </span>
      </footer>
    </div>
  );
};

