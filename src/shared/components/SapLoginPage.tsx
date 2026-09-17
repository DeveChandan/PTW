import React, { useState, useEffect } from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';

export const SapLoginPage: React.FC = () => {
  const { login, loading, error, getRememberedUserId } = useSapAuth();

  const [userId, setUserId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
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

  return (
    <div className="min-h-screen w-screen bg-[#f4f6fb] flex flex-col justify-between overflow-hidden select-none relative font-sans">
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
                GFL ChemSafe
              </span>
              <span className="text-[10px] font-mono font-bold bg-[#006398]/10 text-[#006398] px-2 py-0.5 rounded-full border border-[#006398]/20">
                PTW Suite
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Permit To Work • Enterprise Sign In
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

      {/* Main Centered Modern React Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 overflow-y-auto">
        <div className="w-full max-w-[440px] bg-white/95 backdrop-blur-2xl rounded-3xl border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] p-7 sm:p-9 relative overflow-hidden transition-all">
          {/* Subtle Top Accent Gradient Line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#006398] via-sky-500 to-[#006398]"></div>

          {/* Card Header */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 mb-3 shadow-inner text-[#006398]">
              <span className="material-symbols-outlined text-[30px]">lock</span>
            </div>
            <h1 className="font-display font-bold text-2xl text-slate-900 tracking-tight">
              Sign In to PTW
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Enter your SAP user credentials to access authorized permits
            </p>
          </div>

          {/* Error Banner: YOUR NOT AUTHORIGE USE PERMIT TO WORK GFL APP */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50/90 border border-red-200 text-red-900 rounded-2xl flex items-start gap-3 shadow-sm animate-in fade-in duration-200">
              <span className="material-symbols-outlined text-red-600 text-[20px] shrink-0 mt-0.5">
                gpp_bad
              </span>
              <div className="flex flex-col text-left">
                <span className="text-xs font-mono font-bold tracking-tight text-red-700 uppercase leading-snug">
                  {error}
                </span>
                <span className="text-[11px] text-red-600/80 mt-0.5">
                  Verify your SAP role assignment with Plant Safety or Admin.
                </span>
              </div>
            </div>
          )}

          {/* Modern Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* SAP User ID Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 tracking-wide">
                SAP User ID
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 material-symbols-outlined text-slate-400 text-[19px]">
                  person
                </span>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value.toUpperCase())}
                  placeholder="e.g. VERTIF-V"
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006398]/15 focus:border-[#006398] focus:bg-white transition-all shadow-sm"
                  required
                />
              </div>
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 tracking-wide">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 material-symbols-outlined text-slate-400 text-[19px]">
                  key
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter SAP password"
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-11 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006398]/15 focus:border-[#006398] focus:bg-white transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-0.5 rounded"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined text-[19px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Client & Language Row */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  SAP Client
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-[11px] font-mono text-slate-400 font-bold">
                    #
                  </span>
                  <input
                    type="text"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#006398] focus:bg-white transition-all shadow-sm"
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
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-sans font-medium text-slate-900 focus:outline-none focus:border-[#006398] focus:bg-white transition-all shadow-sm"
                >
                  <option value="EN">EN (English)</option>
                  <option value="DE">DE (German)</option>
                  <option value="GU">GU (Gujarati)</option>
                  <option value="HI">HI (Hindi)</option>
                </select>
              </div>
            </div>

            {/* Remember Me / Session Persistence Checkbox */}
            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberUser}
                  onChange={(e) => setRememberUser(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#006398] focus:ring-[#006398]/20 transition-all cursor-pointer"
                />
                <span className="text-xs text-slate-600 font-medium">
                  Remember User ID on this device
                </span>
              </label>
            </div>

            {/* Modern Primary Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-gradient-to-r from-[#006398] to-[#005080] hover:from-[#005585] hover:to-[#004068] text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
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

          {/* Telemetry Footnote */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] text-slate-400">verified_user</span>
              <span>OData V4 Session</span>
            </span>
            <span>Client: {client}</span>
          </div>
        </div>
      </main>

      {/* Corporate Modern Footer */}
      <footer className="h-10 bg-white/80 backdrop-blur-sm border-t border-slate-200/80 px-6 sm:px-8 flex items-center justify-between text-xs text-slate-500 font-sans shrink-0 z-10">
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="material-symbols-outlined text-[14px] text-emerald-600">lock</span>
          <span>256-Bit SSL Encrypted SAP Gateway</span>
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          © Gujarat Fluorochemicals Limited • SAP S/4HANA
        </div>
      </footer>
    </div>
  );
};

