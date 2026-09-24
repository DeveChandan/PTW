import React, { useState, useEffect } from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Server, 
  Globe, 
  AlertTriangle, 
  CheckCircle2, 
  PhoneCall, 
  UserCheck 
} from 'lucide-react';

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
    }
  }, [getRememberedUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login({
      userId,
      password,
      client,
      language,
      rememberUser,
    });
  };

  return (
    <div className="min-h-screen w-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col justify-between font-sans select-none relative overflow-x-hidden">
      {/* Subtle modern background grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(148, 163, 184, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(148, 163, 184, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px'
        }}
      />

      {/* Top Clean Corporate Header */}
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-8 flex items-center justify-between shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] z-20 shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="https://gfl.co.in/assets/images/New_GFL-Logo29.webp"
            alt="Gujarat Fluorochemicals Limited"
            className="h-8 w-auto object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = './assets/GFL-Logo.webp';
            }}
          />
          <div className="h-6 w-px bg-slate-200 mx-0.5"></div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-slate-900 tracking-tight">
                GFL ChemSafe
              </span>
              {/* <span className="text-[10px] font-mono font-bold bg-[#006398]/10 text-[#006398] px-2 py-0.5 rounded-full border border-[#006398]/20">
                DAHEJ COMPLEX
              </span> */}
            </div>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              Gujarat Fluorochemicals Limited • Operations Console
            </span>
          </div>
        </div>

        {/* Header Right Badges */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-full text-xs font-mono text-slate-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-slate-700">SAP Gateway Online</span>
          </div>
          <span className="bg-sky-50 text-[#006398] border border-sky-200 px-2.5 py-1 rounded-lg text-xs font-mono font-bold">
            Client: {client}
          </span>
        </div>
      </header>

      {/* Main Centered Minimalist Login Workspace */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 my-4">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl shadow-[0_12px_36px_-10px_rgba(15,23,42,0.08)] overflow-hidden transition-all">
          
          {/* Card Header with GFL Logo */}
          <div className="px-6 sm:px-8 pt-7 pb-6 text-center border-b border-slate-100">
            <div className="inline-flex p-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl mb-3 shadow-sm items-center justify-center">
              <img
                src="https://gfl.co.in/assets/images/New_GFL-Logo29.webp"
                alt="GFL Logo"
                className="h-9 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = './assets/GFL-Logo.webp';
                }}
              />
            </div>
            <h1 className="font-display font-bold text-xl text-slate-900 tracking-tight">
              Permit To Work Portal
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Sign in with your corporate SAP credentials
            </p>
          </div>

          {/* Error Alert Banner */}
          {error && (
            <div className="mx-6 sm:mx-8 mt-5 p-3 bg-red-50 border border-red-200 text-red-900 rounded-xl flex items-start gap-2.5 shadow-sm animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex flex-col text-left">
                <span className="text-xs font-mono font-bold tracking-tight text-red-700 uppercase leading-snug">
                  {error}
                </span>
                <span className="text-[11px] text-red-600/80 mt-0.5">
                  Verify assigned SAP roles with Plant Safety or EHS Administrator.
                </span>
              </div>
            </div>
          )}

          {/* Clean Authentication Form */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4 text-left">
            {/* SAP User ID Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 tracking-wide">
                  SAP User ID / Staff Badge ID <span className="text-red-500">*</span>
                </label>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-600 font-medium">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>SSO Ready</span>
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value.toUpperCase())}
                  placeholder="Enter SAP User ID (e.g. VERTIF-V)"
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006398]/15 focus:border-[#006398] focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            {/* Password Field with Peek Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 tracking-wide">
                  Password <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  SAP S/4HANA PIN
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter secure password"
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-11 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006398]/15 focus:border-[#006398] focus:bg-white transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none p-0.5 rounded transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Client & Language Side-by-Side Selectors */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <Server className="w-3 h-3 text-slate-400" />
                  <span>SAP Client</span>
                </label>
                <select
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#006398] focus:bg-white transition-all"
                >
                  <option value="200">Client 200</option>
                  <option value="210">Client 210</option>
                  <option value="100">Client 100</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-slate-400" />
                  <span>Language</span>
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-sans font-medium text-slate-900 focus:outline-none focus:border-[#006398] focus:bg-white transition-all"
                >
                  <option value="EN">EN (English)</option>
                  <option value="GU">GU (ગુજરાતી)</option>
                  <option value="HI">HI (हिन्दी)</option>
                  <option value="DE">DE (German)</option>
                </select>
              </div>
            </div>

            {/* Remember Me & Security Tag */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberUser}
                  onChange={(e) => setRememberUser(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#006398] focus:ring-[#006398]/20 transition-all cursor-pointer"
                />
                <span className="text-xs text-slate-600 font-medium">
                  Remember User ID
                </span>
              </label>
              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>FIPS 140-3 TLS 1.3</span>
              </span>
            </div>

            {/* Primary Sign-In Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#006398] hover:bg-[#004f7a] text-white font-display font-semibold text-sm rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Verifying SAP Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to PTW Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Discreet Help Strip */}
          <div className="px-6 sm:px-8 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <PhoneCall className="w-3 h-3 text-[#006398]" />
              <span>EHS Hotline: <strong className="text-slate-700 font-mono">Ext. 4499</strong></span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              OData V4 • S/4HANA
            </span>
          </div>
        </div>
      </main>

      {/* Corporate Minimalist Footer */}
      <footer className="h-11 bg-white/90 backdrop-blur-sm border-t border-slate-200/80 px-4 sm:px-8 flex items-center justify-between text-xs text-slate-500 shrink-0 z-20">
        <div className="text-[11px] font-medium text-slate-500">
          © Gujarat Fluorochemicals Limited (GFL) 
        </div>
        <div className="text-[10px] font-mono text-slate-400 hidden sm:flex items-center gap-2">
          <span>OSHA 1910.119 PSM</span>
          <span>•</span>
          <span>ISO 45001:2018 EHS</span>
        </div>
      </footer>
    </div>
  );
};

export default SapLoginPage;


