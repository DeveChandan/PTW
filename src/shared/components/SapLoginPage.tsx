import React, { useState, useEffect } from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';

export const SapLoginPage: React.FC = () => {
  const { login, loading, error, getRememberedUserId } = useSapAuth();

  const [userId, setUserId] = useState<string>('');
  const [password, setPassword] = useState<string>('••••••••');
  const [client, setClient] = useState<string>('200');
  const [language, setLanguage] = useState<string>('EN');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberUser, setRememberUser] = useState<boolean>(true);

  // Auto-fill remembered SAP User ID on initial load
  useEffect(() => {
    const remembered = getRememberedUserId();
    if (remembered) {
      setUserId(remembered);
    } else {
      setUserId('VERTIF-V');
    }
  }, [getRememberedUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login({ userId, password, client, language, rememberUser });
  };

  const handleQuickLogin = (targetId: string, roles: string[]) => {
    setUserId(targetId);
    login({ userId: targetId, password: 'password', client, language, rememberUser, mockRoles: roles });
  };

  return (
    <div className="min-h-screen w-screen bg-[#f4f6fb] flex flex-col justify-between overflow-x-hidden select-none relative font-sans">
      {/* Subtle modern ambient background glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(0,99,152,0.06)_0%,transparent_50%),radial-gradient(circle_at_80%_80%,rgba(11,28,48,0.05)_0%,transparent_50%)]"></div>

      {/* Top Corporate Brand Header Bar */}
      <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 sm:px-8 flex items-center justify-between shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] z-10 shrink-0">
        <div className="flex items-center gap-3.5">
          <img
            src="https://gfl.co.in/assets/images/New_GFL-Logo29.webp"
            alt="Gujarat Fluorochemicals Limited"
            className="h-9 w-auto object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = './assets/GFL-Logo.webp';
            }}
          />
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-slate-900 tracking-tight">
                GFL ChemSafe OS
              </span>
              <span className="text-[10px] font-mono font-bold bg-[#006398]/10 text-[#006398] px-2 py-0.5 rounded-full border border-[#006398]/20">
                PTW Suite • Stitch MCP UI
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Permit To Work (PTW) Enterprise System
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-full text-xs font-mono text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Gateway Online</span>
          </div>
          <span className="bg-sky-50 text-[#006398] border border-sky-200 px-2.5 py-1 rounded-lg text-xs font-mono font-bold shadow-sm">
            Client: 200
          </span>
        </div>
      </header>

      {/* Main Container: 2-Column Stitch MCP UI Layout */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 my-4">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 bg-white border border-slate-200/90 rounded-3xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] overflow-hidden transition-all">
          
          {/* Left Column (7 cols): Authentic SAP Logon Form */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-[#006398] shadow-inner">
                    <span className="material-symbols-outlined text-[24px]">lock</span>
                  </div>
                  <div>
                    <h1 className="font-display font-bold text-lg text-slate-900 leading-tight">
                      SAP User Authentication
                    </h1>
                    <p className="text-[11px] text-slate-500">
                      Credentials validated via live SAP OData V4 service
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold bg-sky-50 text-[#006398] border border-sky-200 px-2.5 py-0.5 rounded-full">
                  Client 200
                </span>
              </div>

              {/* Error Alert: YOUR NOT AUTHORIGE USE PERMIT TO WORK GFL APP */}
              {error && (
                <div className="mb-4 p-3.5 bg-red-50/90 border border-red-200 text-red-900 rounded-xl flex items-start gap-2.5 shadow-sm animate-in fade-in duration-200">
                  <span className="material-symbols-outlined text-red-600 text-[20px] shrink-0 mt-0.5">
                    gpp_bad
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-mono font-bold tracking-tight text-red-700 uppercase">
                      {error}
                    </span>
                    <span className="text-[11px] text-red-600/80 mt-0.5">
                      Verify your SAP role assignment with Plant Safety or Admin.
                    </span>
                  </div>
                </div>
              )}

              {/* Form Controls */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 tracking-wide">
                    SAP User ID
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 material-symbols-outlined text-slate-400 text-[18px]">
                      person
                    </span>
                    <input
                      type="text"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value.toUpperCase())}
                      placeholder="e.g. VERTIF-V or Z_MOBILE_PI_SHEET"
                      className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006398]/15 focus:border-[#006398] focus:bg-white transition-all shadow-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 tracking-wide">
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 material-symbols-outlined text-slate-400 text-[18px]">
                      key
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter SAP password"
                      className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-11 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006398]/15 focus:border-[#006398] focus:bg-white transition-all shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-0.5 rounded"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-0.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      SAP Client
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1.5 text-[11px] font-mono text-slate-400 font-bold">
                        #
                      </span>
                      <input
                        type="text"
                        value={client}
                        onChange={(e) => setClient(e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-7 pr-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#006398] focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-sans font-medium text-slate-900 focus:outline-none focus:border-[#006398] focus:bg-white transition-all shadow-sm"
                    >
                      <option value="EN">EN (English)</option>
                      <option value="DE">DE (German)</option>
                      <option value="GU">GU (Gujarati)</option>
                      <option value="HI">HI (Hindi)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberUser}
                      onChange={(e) => setRememberUser(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-[#006398] focus:ring-[#006398]/20 transition-all cursor-pointer"
                    />
                    <span className="text-xs text-slate-600 font-medium">
                      Remember User ID (Session Storage)
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 bg-gradient-to-r from-[#006398] to-[#005080] hover:from-[#005585] hover:to-[#004068] text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Verifying SAP Roles via OData V4...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In & Verify Roles</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Service: zptw_mamagement_srv</span>
              <span>Client: {client}</span>
            </div>
          </div>

          {/* Right Column (5 cols): Stitch MCP Quick Test Roles Matrix */}
          <div className="lg:col-span-5 bg-slate-50/90 border-t lg:border-t-0 lg:border-l border-slate-200/80 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#006398] text-[18px]">science</span>
                  <span>Test Role Access Matrix</span>
                </span>
                <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                  Quick Simulation
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                Click any profile below to instantly test role-based workspace authorization.
              </p>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {/* 🌟 Special Requested Test Role: Z_MOBILE_PI_SHEET (All 8 Modules) */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('Z_MOBILE_PI_SHEET', ['Z_MOBILE_PI_SHEET'])}
                  className="w-full text-left p-2.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-[#006398] hover:shadow-md transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-[#006398] truncate">Z_MOBILE_PI_SHEET</span>
                      <span className="text-[9px] bg-[#006398] text-white px-1.5 py-0.2 rounded font-mono font-bold shrink-0">
                        ALL MODULES ★
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5 font-medium">
                      Test Bypass Role • Unlocks all 8 PTW Modules
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[#006398] text-[18px] group-hover:translate-x-1 transition-transform shrink-0">
                    arrow_forward
                  </span>
                </button>

                {/* 1. Requester / Creator: VERTIF-V */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('VERTIF-V', ['ZPTW_REQUESTER'])}
                  className="w-full text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#006398] hover:shadow-sm transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-slate-900 truncate">VERTIF-V</span>
                      <span className="text-[9px] bg-blue-100 text-[#006398] px-1.5 py-0.2 rounded font-mono font-bold shrink-0">
                        Requester
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Permit Create + Permit Details</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 group-hover:text-[#006398] text-[18px] group-hover:translate-x-1 transition-transform shrink-0">
                    arrow_forward
                  </span>
                </button>

                {/* 2. Permit Approver */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('APPROVER_01', ['ZPTW_APPROVER'])}
                  className="w-full text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#006398] hover:shadow-sm transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-slate-900 truncate">APPROVER_01</span>
                      <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-mono font-bold shrink-0">
                        Approver
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Permit Approver + Permit Details</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 group-hover:text-[#006398] text-[18px] group-hover:translate-x-1 transition-transform shrink-0">
                    arrow_forward
                  </span>
                </button>

                {/* 3. Permit Issuer */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('ISSUER_01', ['ZPTW_ISSUER'])}
                  className="w-full text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#006398] hover:shadow-sm transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-slate-900 truncate">ISSUER_01</span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono font-bold shrink-0">
                        Issuer
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Permit Issuer + Permit Details</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 group-hover:text-[#006398] text-[18px] group-hover:translate-x-1 transition-transform shrink-0">
                    arrow_forward
                  </span>
                </button>

                {/* 4. Permit Holder */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('HOLDER_01', ['ZPTW_HOLDER'])}
                  className="w-full text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#006398] hover:shadow-sm transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-slate-900 truncate">HOLDER_01</span>
                      <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-mono font-bold shrink-0">
                        Holder
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Permit Holder + Permit Details</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 group-hover:text-[#006398] text-[18px] group-hover:translate-x-1 transition-transform shrink-0">
                    arrow_forward
                  </span>
                </button>

                {/* 5. Gas Tester */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('GAS_TECH_01', ['ZPTW_GAS_TESTER'])}
                  className="w-full text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#006398] hover:shadow-sm transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-slate-900 truncate">GAS_TECH_01</span>
                      <span className="text-[9px] bg-cyan-100 text-cyan-800 px-1.5 py-0.2 rounded font-mono font-bold shrink-0">
                        Gas Tester
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Gas Tester + Permit Details</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 group-hover:text-[#006398] text-[18px] group-hover:translate-x-1 transition-transform shrink-0">
                    arrow_forward
                  </span>
                </button>

                {/* 6. LOTO Isolation */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('ISOLATOR_01', ['ZPTW_ISOLATOR'])}
                  className="w-full text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#006398] hover:shadow-sm transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-slate-900 truncate">ISOLATOR_01</span>
                      <span className="text-[9px] bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded font-mono font-bold shrink-0">
                        Isolation
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">LOTO Isolation + Permit Details</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 group-hover:text-[#006398] text-[18px] group-hover:translate-x-1 transition-transform shrink-0">
                    arrow_forward
                  </span>
                </button>

                {/* 7. Super Admin */}
                <button
                  type="button"
                  onClick={() => handleQuickLogin('ADMIN_01', ['ZPTW_ADMIN'])}
                  className="w-full text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#006398] hover:shadow-sm transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-slate-900 truncate">ADMIN_01</span>
                      <span className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.2 rounded font-mono font-bold shrink-0">
                        Super Admin
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">All 8 Modules Unlocked</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 group-hover:text-[#006398] text-[18px] group-hover:translate-x-1 transition-transform shrink-0">
                    arrow_forward
                  </span>
                </button>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200/80 mt-4 text-[11px] text-slate-600 font-sans shadow-sm">
              <strong className="text-slate-900 block font-mono text-xs">Role Enforcement:</strong>
              User roles are matched against the SAP OData <code className="text-[#006398] font-mono">userinfo</code> service. Role <code className="text-[#006398] font-mono font-bold">Z_MOBILE_PI_SHEET</code> unlocks all 8 modules for test.
            </div>
          </div>
        </div>
      </main>

      {/* Corporate Modern Footer */}
      <footer className="h-10 bg-white/80 backdrop-blur-sm border-t border-slate-200/80 px-6 sm:px-8 flex items-center justify-between text-xs text-slate-500 font-sans shrink-0 z-10">
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="material-symbols-outlined text-[14px] text-emerald-600">lock</span>
          <span>SAP NetWeaver / S/4HANA • Client: 200 • OData V4</span>
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          © Gujarat Fluorochemicals Limited (GFL)
        </div>
      </footer>
    </div>
  );
};

