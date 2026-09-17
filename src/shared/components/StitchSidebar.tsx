import React, { useState } from 'react';
import { useSapAuth, MODULE_REGISTRY } from '../../core/auth/sapAuthContext';

export const StitchSidebar: React.FC = () => {
  const { activeModule, setActiveModule, isModuleUnlocked, user } = useSapAuth();
  const [showRestricted, setShowRestricted] = useState<boolean>(true);

  const unlockedMods = MODULE_REGISTRY.filter((mod) => isModuleUnlocked(mod.id));
  const lockedMods = MODULE_REGISTRY.filter((mod) => !isModuleUnlocked(mod.id));

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-72 bg-white border-r border-gray-200 z-40 flex flex-col justify-between py-4 select-none overflow-y-auto">
      <div className="flex flex-col gap-3 px-3">
        {/* Terminal Header */}
        <div className="px-2 py-1 flex items-center justify-between border-b border-gray-100 pb-2">
          <span className="font-mono text-[10px] text-gray-400 tracking-widest uppercase font-bold">
            Authorized Modules
          </span>
          <span className="text-[10px] font-mono text-[#006398] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
            {unlockedMods.length} Open
          </span>
        </div>

        {/* 1. Unlocked Modules Section */}
        <nav className="flex flex-col gap-1.5">
          {unlockedMods.map((mod) => {
            const isActive = activeModule === mod.id;

            return (
              <button
                key={mod.id}
                onClick={() => setActiveModule(mod.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  isActive
                    ? 'bg-[#006398] text-white font-semibold shadow-sm'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    isActive ? 'text-white' : 'text-[#006398]'
                  }`}
                >
                  {mod.icon}
                </span>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-xs font-semibold truncate leading-tight">
                      {mod.title}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-[#006398]'
                      }`}
                    >
                      {mod.badge}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] truncate leading-normal mt-0.5 ${
                      isActive ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {mod.subtitle}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* 2. Restricted Modules Section */}
        {lockedMods.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={() => setShowRestricted(!showRestricted)}
              className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-mono text-gray-400 uppercase font-bold hover:text-gray-600"
            >
              <span>Restricted ({lockedMods.length})</span>
              <span className="material-symbols-outlined text-[14px]">
                {showRestricted ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {showRestricted && (
              <div className="flex flex-col gap-1 mt-1">
                {lockedMods.map((mod) => (
                  <div
                    key={mod.id}
                    title={`Requires SAP Role: ${mod.requiredRoles.join(' or ')}`}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left bg-gray-50 border border-gray-100 opacity-60 cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-gray-400 text-[18px]">
                      lock
                    </span>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-medium text-gray-500 truncate leading-tight">
                        {mod.title}
                      </span>
                      <span className="text-[9px] font-mono text-gray-400 truncate">
                        Role: {mod.requiredRoles[0]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Telemetry Footer */}
      <div className="px-3 pt-3">
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex flex-col gap-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-500 uppercase font-bold">Telemetry Link</span>
            <span className="font-mono text-[10px] text-emerald-700 font-bold">99.98% SYNC</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span className="font-mono text-[11px] text-gray-800 font-medium">PLC Node #402 Normal</span>
          </div>
          <div className="border-t border-gray-200 pt-1.5 mt-1 flex justify-between text-[10px] text-gray-500 font-mono">
            <span>SAP User: {user?.id}</span>
            <span>Client: 200</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
