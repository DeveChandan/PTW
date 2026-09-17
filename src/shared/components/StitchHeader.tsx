import React from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';

interface StitchHeaderProps {
  onGoHome?: () => void;
  isHome?: boolean;
}

export const StitchHeader: React.FC<StitchHeaderProps> = ({ onGoHome, isHome = true }) => {
  const { user, loading, logout } = useSapAuth();

  const userInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : user?.id?.slice(0, 2) || 'US';

  const primaryRole = user?.roles && user.roles.length > 0 ? user.roles[0] : 'ZPTW_USER';

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 z-50 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] select-none">
      <div className="h-16 w-full px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Left Section: Brand & Product Identity */}
        <div className="flex items-center gap-3.5 min-w-max">
          {/* Official GFL Corporate Logo */}
          <div
            onClick={onGoHome}
            className="flex items-center cursor-pointer hover:opacity-90 transition-opacity"
            title="Gujarat Fluorochemicals Limited - Return to Launchpad"
          >
            <img
              src="https://gfl.co.in/assets/images/New_GFL-Logo29.webp"
              alt="GFL Logo"
              className="h-9 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = './assets/GFL-Logo.webp';
              }}
            />
          </div>

          <div className="h-7 w-px bg-slate-200 mx-0.5"></div>

          {/* Product Title & Badge */}
          <div
            onClick={onGoHome}
            className="flex flex-col cursor-pointer group"
            title="Return to Launchpad"
          >
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base text-slate-900 group-hover:text-[#006398] transition-colors tracking-tight">
                GFL ChemSafe
              </span>
              <span className="text-[10px] font-mono font-bold bg-[#006398]/10 text-[#006398] px-2 py-0.5 rounded-md border border-[#006398]/20">
                PTW Suite
              </span>
            </div>
            <span className="text-[11px] font-sans text-slate-500 font-medium tracking-normal">
              Permit To Work System • S/4HANA
            </span>
          </div>

          {/* Return to Launchpad Button (shown when inside any module) */}
          {!isHome && onGoHome && (
            <button
              onClick={onGoHome}
              className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-[#006398] text-slate-700 hover:text-white rounded-lg text-xs font-mono font-semibold transition-all shadow-sm group"
            >
              <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-0.5 transition-transform">
                arrow_back
              </span>
              <span>All Workspaces</span>
            </button>
          )}
        </div>

        {/* Center Section: Plant Facility Context & Real-Time Safety Status */}
        <div className="hidden md:flex items-center gap-3">
          {/* Plant Facility Selector */}
          <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 px-3.5 py-1.5 rounded-full transition-all text-xs text-slate-700 font-sans shadow-sm cursor-pointer">
            <span className="material-symbols-outlined text-[#006398] text-[18px]">factory</span>
            <span className="font-medium truncate max-w-[260px]">
              Plant 1000 • Dahej Chemical Complex
            </span>
            <span className="material-symbols-outlined text-slate-400 text-[16px]">expand_more</span>
          </div>

          {/* Safety Status Pill */}
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 px-3 py-1 rounded-full text-xs font-sans text-emerald-800 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-[11px]">CONDITION GREEN</span>
            <span className="text-emerald-600/70 text-[10px] font-mono hidden lg:inline">| Shift B</span>
          </div>
        </div>

        {/* Right Section: SAP Client Context, User Profile & Logout */}
        <div className="flex items-center gap-3">
          {/* SAP Client Pill */}
          <div className="hidden sm:flex items-center gap-1.5 bg-sky-50 border border-sky-200/80 text-[#006398] px-2.5 py-1 rounded-lg text-xs font-mono font-bold shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#006398]"></span>
            <span>Client: 200</span>
          </div>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/90 pl-1.5 pr-3 py-1 rounded-xl shadow-sm">
            {/* User Avatar */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#006398] to-sky-600 text-white flex items-center justify-center font-mono font-bold text-xs shadow-sm shrink-0">
              {userInitials}
            </div>

            {/* Name & Role */}
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-900 leading-tight">
                  {loading ? 'Authenticating...' : user?.fullName || user?.id || 'SAP User'}
                </span>
                <span className="text-[10px] font-mono bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                  {user?.id}
                </span>
              </div>

              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-[#006398] font-mono font-bold truncate max-w-[130px]" title={user?.roles.join(', ')}>
                  {primaryRole}
                </span>
                {user?.roles && user.roles.length > 1 && (
                  <span className="text-[9px] font-mono bg-blue-100 text-[#006398] px-1 rounded font-bold">
                    +{user.roles.length - 1}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Log Off Button */}
          <button
            onClick={logout}
            title="Log off from SAP NetWeaver Session"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 bg-white rounded-lg border border-slate-200 hover:border-red-200 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[17px] text-slate-400 group-hover:text-red-600">
              logout
            </span>
            <span className="hidden sm:inline">Log Off</span>
          </button>
        </div>
      </div>
    </header>
  );
};


