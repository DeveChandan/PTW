import React, { useState } from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';

export const StitchHeader: React.FC = () => {
  const { user, loading, switchUser, logout } = useSapAuth();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [customUserId, setCustomUserId] = useState('');

  const handleRolePreset = (presetName: string) => {
    switch (presetName) {
      case 'single-requester':
        // 1 Role -> 1 Module (Issue New PTW Studio)
        switchUser('VERTIF-V', ['ZPTW_REQUESTER']);
        break;
      case 'dual-role':
        // 2 Roles -> 2 Modules (Issue New PTW Studio + Approvals & Signatures)
        switchUser('VERTIF-V', ['ZPTW_REQUESTER', 'ZPTW_APPROVER']);
        break;
      case 'approver-only':
        // 1 Role -> 1 Module (Approvals & Signatures)
        switchUser('VERTIF-APPROVER', ['ZPTW_APPROVER']);
        break;
      case 'all-roles':
        // Admin / All Modules
        switchUser('PLANT_CHIEF_01', ['ZPTW_ADMIN']);
        break;
    }
    setShowRoleSwitcher(false);
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUserId.trim()) {
      switchUser(customUserId.trim());
      setShowRoleSwitcher(false);
    }
  };

  const unlockedCount = user?.unlockedModules.length || 0;

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

        {/* Right Section: SAP User Context & Role Simulator Button */}
        <div className="flex items-center gap-3 relative">
          {/* E-Stop Emergency Button */}
          <button
            onClick={() => alert('🚨 EMERGENCY SAFETY STOP TRIGGERED: Work clearance halted across active units.')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#dc2626] text-white rounded text-xs font-mono tracking-wider uppercase transition-all hover:bg-red-700 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">warning</span>
            <span className="hidden sm:inline">E-STOP ISOLATE</span>
          </button>

          {/* User Profile Card & Role Indicator */}
          <div
            onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
            className="flex items-center gap-2.5 bg-gray-50 hover:bg-gray-100 p-1.5 pr-3 rounded-lg border border-gray-200 cursor-pointer transition-colors"
          >
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
                  {unlockedCount === 1 ? '1 Role • 1 Module Open' : `${unlockedCount} Roles • ${unlockedCount} Modules Open`}
                </span>
                <span className="material-symbols-outlined text-gray-400 text-[14px]">tune</span>
              </div>
            </div>
          </div>

          {/* Log Out Button */}
          <button
            onClick={logout}
            title="Log off from SAP Session"
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>

          {/* Interactive SAP User & Role Switcher Dropdown Modal */}
          {showRoleSwitcher && (
            <div className="absolute right-0 top-16 mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006398]">admin_panel_settings</span>
                  <span className="text-sm font-display font-bold text-gray-900">SAP User & Role Access Controller</span>
                </div>
                <button onClick={() => setShowRoleSwitcher(false)} className="text-gray-400 hover:text-gray-700 text-xs">
                  ✕
                </button>
              </div>

              <p className="text-xs text-gray-600 mb-3">
                Verify role-based access control as returned by SAP OData <code className="text-[#006398] bg-blue-50 px-1 py-0.5 rounded font-mono">userinfo</code>:
              </p>

              {/* Preset Buttons */}
              <div className="space-y-2 mb-4">
                <button
                  onClick={() => handleRolePreset('single-requester')}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-200 bg-white hover:border-[#006398] hover:bg-blue-50/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 font-mono">VERTIF-V (1 Role: ZPTW_REQUESTER)</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono font-bold">1 Module Open</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Your real SAP query response. Opens only: <strong>Issue New PTW Studio</strong>.
                  </p>
                </button>

                <button
                  onClick={() => handleRolePreset('dual-role')}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-200 bg-white hover:border-[#006398] hover:bg-blue-50/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 font-mono">Dual-Role: REQUESTER + APPROVER</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">2 Modules Open</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    User has 2 roles in SAP. Exactly 2 modules unlocked: <strong>Issue PTW</strong> & <strong>Approvals</strong>.
                  </p>
                </button>

                <button
                  onClick={() => handleRolePreset('approver-only')}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 font-mono">VERTIF-APPROVER (ZPTW_APPROVER)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">1 Module Open</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Opens only: <strong>Approvals & Signatures</strong>.
                  </p>
                </button>

                <button
                  onClick={() => handleRolePreset('all-roles')}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-200 bg-white hover:border-purple-500 hover:bg-purple-50/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 font-mono">PLANT_CHIEF_01 (ZPTW_ADMIN)</span>
                    <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono font-bold">All 4 Modules</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Plant Administrator access unlocking all operational workspaces.
                  </p>
                </button>
              </div>

              {/* Live SAP Gateway Query Form */}
              <form onSubmit={handleCustomSearch} className="border-t border-gray-100 pt-3">
                <label className="block text-[11px] font-mono text-gray-600 mb-1 font-semibold">
                  Query Any SAP User ID via Live OData V4:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customUserId}
                    onChange={(e) => setCustomUserId(e.target.value)}
                    placeholder="e.g. VERTIF-V"
                    className="flex-1 bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 font-mono focus:outline-none focus:border-[#006398] focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#006398] text-white rounded text-xs font-bold font-mono hover:bg-[#004f7a]"
                  >
                    Fetch
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
