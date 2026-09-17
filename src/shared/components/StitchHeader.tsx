import React from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';

interface StitchHeaderProps {
  onGoHome?: () => void;
  isHome?: boolean;
}

export const StitchHeader: React.FC<StitchHeaderProps> = ({ onGoHome, isHome = true }) => {
  const { user, loading, logout } = useSapAuth();

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 shadow-sm">
      <div className="h-16 w-full px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Brand & Facility Info */}
        <div className="flex items-center gap-3 min-w-max">
          <div
            onClick={onGoHome}
            className="flex items-center pr-1 cursor-pointer hover:opacity-90 transition-opacity"
            title="Return to Launchpad"
          >
            <img
              src="https://gfl.co.in/assets/images/New_GFL-Logo29.webp"
              alt="Gujarat Fluorochemicals Limited"
              className="h-9 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = './assets/GFL-Logo.webp';
              }}
            />
          </div>
          <div
            onClick={onGoHome}
            className="flex flex-col cursor-pointer"
            title="Return to Launchpad"
          >
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base text-[#0b1c30] tracking-tight uppercase">
                GFL ChemSafe OS
              </span>
              <span className="text-[10px] bg-blue-50 text-[#006398] font-mono font-semibold px-2 py-0.5 rounded border border-blue-200">
                PTW • OData V4
              </span>
            </div>
            <span className="font-mono text-[10px] text-gray-500 tracking-wider uppercase">
              Permit To Work Enterprise System
            </span>
          </div>

          {!isHome && onGoHome && (
            <button
              onClick={onGoHome}
              className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#006398] border border-blue-200 rounded-lg text-xs font-mono font-semibold transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              <span>All Modules</span>
            </button>
          )}

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

