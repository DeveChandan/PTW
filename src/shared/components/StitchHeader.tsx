import React from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';

export const StitchHeader: React.FC = () => {
  const { user, loading, logout } = useSapAuth();

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 shadow-sm">
      <div className="h-16 w-full px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Brand & Facility Info */}
        <div className="flex items-center gap-3 min-w-max">
          <div className="w-9 h-9 rounded bg-[#006398] flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-white text-[22px] font-bold">shield</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base text-[#0b1c30] tracking-tight uppercase">ChemSafe OS</span>
              <span className="text-[10px] bg-blue-50 text-[#006398] font-mono font-semibold px-2 py-0.5 rounded border border-blue-200">
                PTW v4.2 • OData V4
              </span>
            </div>
            <span className="font-mono text-[10px] text-gray-500 tracking-wider uppercase">
              SAP NetWeaver BSP / S/4HANA
            </span>
          </div>

          <div className="h-6 w-px bg-gray-200 mx-2 hidden lg:block"></div>

          {/* Plant Facility Selector */}
          <div className="hidden lg:flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded border border-gray-200">
            <span className="material-symbols-outlined text-[#006398] text-[18px]">factory</span>
            <span className="font-sans text-xs text-gray-800 font-semibold truncate max-w-[280px]">
              Refinery Complex 04 - Olefins & Aromatics Plant
            </span>
            <span className="material-symbols-outlined text-gray-400 text-[16px]">arrow_drop_down</span>
          </div>
        </div>

        {/* Center Live Telemetry Strip */}
        <div className="hidden 2xl:flex items-center gap-3 text-xs font-mono text-gray-600">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded border border-gray-200">
            <span className="material-symbols-outlined text-[#006398] text-[16px]">schedule</span>
            <span>SHIFT B - 07:00 to 19:00 CST</span>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span className="font-semibold">CONDITION GREEN: ZERO LOSS OF CONTAINMENT</span>
          </div>
        </div>

        {/* Right Section: SAP User Context & Logout */}
        <div className="flex items-center gap-3">
          {/* User Profile Card & Role Indicator */}
          <div className="flex items-center gap-2.5 bg-gray-50 p-1.5 pr-3 rounded-lg border border-gray-200">
            <div className="w-8 h-8 rounded-full bg-[#006398] text-white flex items-center justify-center font-mono font-bold text-xs shadow-sm">
              {user?.id ? user.id.slice(0, 2) : '??'}
            </div>

            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-sans text-xs font-semibold text-gray-900 leading-tight">
                  {loading ? 'Authenticating...' : user?.fullName || 'SAP User'}
                </span>
                <span className="text-[10px] font-mono bg-blue-100 text-[#006398] px-1.5 py-0.2 rounded font-bold">
                  {user?.id}
                </span>
              </div>

              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-gray-500 font-mono">
                  {user?.roles.join(', ') || 'No Roles'} • Client 110
                </span>
              </div>
            </div>
          </div>

          {/* Log Out Button */}
          <button
            onClick={logout}
            title="Log off from SAP Session"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-gray-700 hover:text-red-700 hover:bg-red-50 rounded-lg border border-gray-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span className="hidden sm:inline font-semibold">Log Off</span>
          </button>
        </div>
      </div>
    </header>
  );
};

