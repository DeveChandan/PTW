import React, { useState } from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';

export const SapLoginPage: React.FC = () => {
  const { login, loading, error } = useSapAuth();

  const [userId, setUserId] = useState<string>('VERTIF-V');
  const [password, setPassword] = useState<string>('••••••••');
  const [client, setClient] = useState<string>('100');
  const [language, setLanguage] = useState<string>('EN');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login({ userId, password, client, language });
  };

  const handleQuickLogin = (targetId: string, roles: string[]) => {
    setUserId(targetId);
    login({ userId: targetId, password: 'password', client, language, mockRoles: roles });
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex flex-col justify-between select-none">
      {/* Top Corporate Brand Bar */}
      <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#006398] flex items-center justify-center text-white font-bold shadow-sm">
            <span className="material-symbols-outlined text-[22px]">shield</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base text-[#0b1c30] tracking-tight uppercase">
                ChemSafe OS
              </span>
              <span className="text-[10px] bg-blue-50 text-[#006398] font-mono font-semibold px-2 py-0.5 rounded border border-blue-200">
                SAP NetWeaver • OData V4
              </span>
            </div>
            <span className="font-mono text-[10px] text-gray-500 tracking-wider uppercase">
              Permit To Work (PTW) Enterprise System v4.2
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
          <span className="hidden sm:inline">Target: <strong className="text-gray-800">vhgfldevci.sap.gfl.co.in:44300</strong></span>
          <span className="bg-gray-100 px-2.5 py-1 rounded text-gray-700 font-bold">Client: 100</span>
        </div>
      </header>

      {/* Main Login Card Container */}
      <main className="flex-1 flex items-center justify-center p-4 my-8">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
          {/* Left Column: Authentic SAP Logon Form */}
          <div className="md:col-span-7 p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[#006398]">lock</span>
                <h1 className="font-display font-bold text-xl text-gray-900">SAP User Authentication</h1>
              </div>
              <p className="text-xs text-gray-500 mb-6">
                Enter your SAP NetWeaver / S/4HANA credentials to check role authorizations via OData V4.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-700 mb-1 uppercase tracking-wider">
                    SAP User ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value.toUpperCase())}
                      placeholder="e.g. VERTIF-V"
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:border-[#006398] focus:bg-white transition-colors"
                      required
                    />
                    <span className="absolute right-3 top-2.5 material-symbols-outlined text-gray-400 text-[18px]">
                      person
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-700 mb-1 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter SAP password"
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:border-[#006398] focus:bg-white transition-colors"
                      required
                    />
                    <span className="absolute right-3 top-2.5 material-symbols-outlined text-gray-400 text-[18px]">
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
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-gray-900 focus:outline-none focus:border-[#006398]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-gray-600 mb-1 uppercase">
                      Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-gray-900 focus:outline-none focus:border-[#006398]"
                    >
                      <option value="EN">EN (English)</option>
                      <option value="DE">DE (German)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#006398] hover:bg-[#004f7a] text-white font-display font-bold text-sm uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
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
            </div>

            <div className="border-t border-gray-100 pt-4 mt-6 flex justify-between text-[11px] text-gray-500 font-mono">
              <span>Service: zptw_mamagement_srv</span>
              <span>ICF: /sap/bc/bsp/sap/</span>
            </div>
          </div>

          {/* Right Column: Role-Wise Presets for Developer Testing */}
          <div className="md:col-span-5 bg-[#f1f5f9] border-t md:border-t-0 md:border-l border-gray-200 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1 text-[#006398]">
                <span className="material-symbols-outlined text-[18px]">badge</span>
                <h2 className="font-display font-bold text-xs uppercase tracking-wider">
                  Test Role Matrix (1-Click Logins)
                </h2>
              </div>
              <p className="text-[11px] text-gray-500 mb-3">
                Click any role preset below to test role-wise module visibility:
              </p>

              <div className="space-y-2">
                {/* 1. Requester / Creator */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('VERTIF-V', ['ZPTW_REQUESTER'])}
                  className="w-full text-left p-2.5 rounded-lg bg-white border border-gray-200 hover:border-[#006398] hover:shadow-sm transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-gray-900">VERTIF-V</span>
                      <span className="text-[9px] bg-blue-100 text-[#006398] px-1.5 py-0.2 rounded font-mono font-bold">
                        Requester
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">Permit Create + Permit Details</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-[18px]">arrow_forward</span>
                </button>

                {/* 2. Permit Approver */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('APPROVER_01', ['ZPTW_APPROVER'])}
                  className="w-full text-left p-2.5 rounded-lg bg-white border border-gray-200 hover:border-[#006398] hover:shadow-sm transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-gray-900">APPROVER_01</span>
                      <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-mono font-bold">
                        Approver
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">Permit Approver + Permit Details</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-[18px]">arrow_forward</span>
                </button>

                {/* 3. Permit Issuer */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('ISSUER_01', ['ZPTW_ISSUER'])}
                  className="w-full text-left p-2.5 rounded-lg bg-white border border-gray-200 hover:border-[#006398] hover:shadow-sm transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-gray-900">ISSUER_01</span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono font-bold">
                        Issuer
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">Permit Issuer + Permit Details</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-[18px]">arrow_forward</span>
                </button>

                {/* 4. Permit Holder */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('HOLDER_01', ['ZPTW_HOLDER'])}
                  className="w-full text-left p-2.5 rounded-lg bg-white border border-gray-200 hover:border-[#006398] hover:shadow-sm transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-gray-900">HOLDER_01</span>
                      <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-mono font-bold">
                        Holder
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">Permit Holder + Permit Details</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-[18px]">arrow_forward</span>
                </button>

                {/* 5. Gas Tester */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('GAS_TECH_01', ['ZPTW_GAS_TESTER'])}
                  className="w-full text-left p-2.5 rounded-lg bg-white border border-gray-200 hover:border-[#006398] hover:shadow-sm transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-gray-900">GAS_TECH_01</span>
                      <span className="text-[9px] bg-cyan-100 text-cyan-800 px-1.5 py-0.2 rounded font-mono font-bold">
                        Gas Tester
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">Gas Tester + Permit Details</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-[18px]">arrow_forward</span>
                </button>

                {/* 6. LOTO Isolation */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('ISOLATOR_01', ['ZPTW_ISOLATOR'])}
                  className="w-full text-left p-2.5 rounded-lg bg-white border border-gray-200 hover:border-[#006398] hover:shadow-sm transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-gray-900">ISOLATOR_01</span>
                      <span className="text-[9px] bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded font-mono font-bold">
                        Isolation
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">LOTO Isolation + Permit Details</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-[18px]">arrow_forward</span>
                </button>

                {/* 7. PTW Admin (All Modules) */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('ADMIN_01', ['ZPTW_ADMIN'])}
                  className="w-full text-left p-2.5 rounded-lg bg-white border border-gray-200 hover:border-[#006398] hover:shadow-sm transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-gray-900">ADMIN_01</span>
                      <span className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.2 rounded font-mono font-bold">
                        Super Admin
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">All 8 Modules Unlocked</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg border border-gray-200 mt-4 text-[11px] text-gray-600 font-sans">
              <strong className="text-gray-900 block font-mono text-xs">Role Enforcement:</strong>
              After logging on, the app verifies the user's role against the OData <code className="text-[#006398] font-mono">userinfo</code> service. Only authorized modules render in navigation.
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-3 text-center text-xs text-gray-500 font-mono">
        SAP NetWeaver / S/4HANA • Permit To Work (PTW) • Client: 100 • OData V4
      </footer>
    </div>
  );
};
