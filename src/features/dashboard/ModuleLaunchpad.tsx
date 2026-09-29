import React from 'react';
import { ModuleDefinition, ModuleId, MODULE_REGISTRY, SapUser } from '../../core/auth/sapAuthContext';

interface ModuleLaunchpadProps {
  user: SapUser | null;
  onSelectModule: (moduleId: ModuleId) => void;
}

// Visual theme configurations for each KPI card
const MODULE_THEMES: Record<ModuleId, { bg: string; text: string; border: string; kpiValue: string; kpiLabel: string }> = {
  isolation: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', kpiValue: 'Isolation', kpiLabel: 'Prerequisite evidence' },
  'permit-create': {
    bg: 'bg-blue-50 hover:bg-blue-100/60',
    text: 'text-[#006398]',
    border: 'border-blue-200 hover:border-[#006398]',
    kpiValue: 'JSA & PPE',
    kpiLabel: 'Risk Matrix Formulation'
  },
  'permit-details': {
    bg: 'bg-indigo-50 hover:bg-indigo-100/60',
    text: 'text-indigo-700',
    border: 'border-indigo-200 hover:border-indigo-600',
    kpiValue: 'Live Dossier',
    kpiLabel: 'P&ID & Real-Time Countdown'
  },
   'create-isolation': {
    bg: 'bg-orange-50 hover:bg-orange-100/60',
    text: 'text-orange-800',
    border: 'border-orange-200 hover:border-orange-600',
    kpiValue: 'LOTO Vault',
    kpiLabel: '100% Zero-Energy Lockout'
  },
   'display-isolation': {
    bg: 'bg-orange-50 hover:bg-orange-100/60',
    text: 'text-orange-800',
    border: 'border-orange-200 hover:border-orange-600',
    kpiValue: 'LOTO Vault',
    kpiLabel: '100% Zero-Energy Lockout'
  },
  'permit-approver': {
    bg: 'bg-amber-50 hover:bg-amber-100/60',
    text: 'text-amber-800',
    border: 'border-amber-200 hover:border-amber-600',
    kpiValue: '3-Tier Chain',
    kpiLabel: 'Canvas Digital Signatures'
  },
  'permit-issuer': {
    bg: 'bg-emerald-50 hover:bg-emerald-100/60',
    text: 'text-emerald-800',
    border: 'border-emerald-200 hover:border-emerald-600',
    kpiValue: 'Toolbox Talk',
    kpiLabel: 'Physical Handover Verification'
  },
  'permit-area-owner': {
    bg: 'bg-purple-50 hover:bg-purple-100/60',
    text: 'text-purple-800',
    border: 'border-purple-200 hover:border-purple-600',
    kpiValue: 'Worker Muster',
    kpiLabel: 'Site Suspension & Handback'
  },
  'permit-holder': {
    bg: 'bg-purple-50 hover:bg-purple-100/60',
    text: 'text-purple-800',
    border: 'border-purple-200 hover:border-purple-600',
    kpiValue: 'Worker Muster',
    kpiLabel: 'Site Suspension & Handback'
  },
  'gas-tester': {
    bg: 'bg-cyan-50 hover:bg-cyan-100/60',
    text: 'text-cyan-800',
    border: 'border-cyan-200 hover:border-cyan-600',
    kpiValue: 'O₂ • LEL • H₂S',
    kpiLabel: '2-Hr Retest Interval Log'
  },
  'report': {
    bg: 'bg-teal-50 hover:bg-teal-100/60',
    text: 'text-teal-800',
    border: 'border-teal-200 hover:border-teal-600',
    kpiValue: 'OSHA & KPI',
    kpiLabel: 'Permit & Audit Records'
  },
  'admin': {
    bg: 'bg-rose-50 hover:bg-rose-100/60',
    text: 'text-rose-800',
    border: 'border-rose-200 hover:border-rose-600',
    kpiValue: 'SAP Roles',
    kpiLabel: 'Master Data & Audit Trail'
  }
};

export const ModuleLaunchpad: React.FC<ModuleLaunchpadProps> = ({ user, onSelectModule }) => {
  const unlockedIds = user?.unlockedModules || [];
  
  const authorizedModules = MODULE_REGISTRY.filter((mod) => unlockedIds.includes(mod.id));
  const restrictedModules = MODULE_REGISTRY.filter((mod) => !unlockedIds.includes(mod.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-in fade-in duration-300">
      {/* Top Welcome & KPI Summary Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center p-2 shrink-0">
            <img
              src="https://gfl.co.in/assets/images/New_GFL-Logo29.webp"
              alt="GFL"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = './assets/GFL-Logo.webp';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-2xl text-gray-900 tracking-tight">
                PTW Module Command Center
              </h1>
              <span className="text-[11px] font-mono font-bold bg-blue-50 text-[#006398] border border-blue-200 px-2.5 py-0.5 rounded-full">
                Client 200
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-sans">
              Welcome back, <strong className="text-gray-800 font-semibold">{user?.fullName || user?.id}</strong>. Select an authorized operational workspace below.
            </p>
          </div>
        </div>

        {/* 4 Summary Stat Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2">
            <span className="block text-[10px] uppercase text-gray-400 font-bold">Authorized</span>
            <span className="text-base font-bold text-[#006398]">{authorizedModules.length} Modules</span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2">
            <span className="block text-[10px] uppercase text-gray-400 font-bold">Role Match</span>
            <span className="text-xs font-bold text-emerald-700 truncate block">{user?.roles.join(', ') || 'NONE'}</span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2">
            <span className="block text-[10px] uppercase text-gray-400 font-bold">Plant Facility</span>
            <span className="text-xs font-bold text-gray-800">1000 Complex</span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2">
            <span className="block text-[10px] uppercase text-gray-400 font-bold">Safety Link</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              NORMAL
            </span>
          </div>
        </div>
      </div>

      {/* 1. Authorized Modules KPI Cards Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006398] text-[20px]">apps</span>
            <h2 className="font-display font-bold text-lg text-gray-900 tracking-tight">
              Authorized Operational Workspaces
            </h2>
            <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
              {authorizedModules.length} Available
            </span>
          </div>
          <span className="text-xs text-gray-400 font-mono hidden sm:inline">
            Click any KPI card to open workspace
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {authorizedModules.map((mod: ModuleDefinition) => {
            const theme = MODULE_THEMES[mod.id] || {
              bg: 'bg-blue-50',
              text: 'text-[#006398]',
              border: 'border-blue-200',
              kpiValue: 'Active',
              kpiLabel: 'Operational'
            };

            return (
              <div
                key={mod.id}
                onClick={() => onSelectModule(mod.id)}
                className={`group bg-white rounded-2xl border ${theme.border} p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden`}
              >
                {/* Decorative Top Gradient Highlight */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#006398] opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div>
                  {/* Top Row: Icon + Role Badge */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-12 h-12 rounded-xl ${theme.bg} border ${theme.border} flex items-center justify-center ${theme.text} shadow-sm group-hover:scale-105 transition-transform`}>
                      <span className="material-symbols-outlined text-[26px]">
                        {mod.icon}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      Authorized
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-display font-bold text-base text-gray-900 group-hover:text-[#006398] transition-colors leading-tight mb-1">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-gray-500 font-sans line-clamp-2 mb-4 leading-relaxed">
                    {mod.subtitle}
                  </p>
                </div>

                {/* KPI Stat Box */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between font-mono mb-3">
                    <span className="text-[10px] uppercase text-gray-400 font-semibold">{theme.kpiLabel}</span>
                    <span className="text-xs font-bold text-gray-800">{theme.kpiValue}</span>
                  </div>

                  {/* Launch CTA */}
                  <div className="w-full py-2 px-3 bg-gray-50 group-hover:bg-[#006398] rounded-lg text-xs font-mono font-bold text-gray-700 group-hover:text-white transition-colors flex items-center justify-between">
                    <span>LAUNCH WORKSPACE</span>
                    <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Restricted Modules Section (If any) */}
      {restrictedModules.length > 0 && (
        <div className="pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-gray-400 text-[20px]">lock</span>
            <h2 className="font-display font-bold text-base text-gray-600 tracking-tight">
              Restricted Workspaces
            </h2>
            <span className="text-xs font-mono font-bold bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
              {restrictedModules.length} Role-Restricted
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {restrictedModules.map((mod: ModuleDefinition) => (
              <div
                key={mod.id}
                className="bg-gray-50/70 border border-gray-200 rounded-xl p-4 opacity-75 cursor-not-allowed flex flex-col justify-between"
                title={`Access requires SAP Role: ${mod.requiredRoles.join(' or ')}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-9 h-9 rounded-lg bg-gray-200/80 flex items-center justify-center text-gray-500">
                      <span className="material-symbols-outlined text-[20px]">
                        lock
                      </span>
                    </div>
                    <span className="text-[9px] font-mono bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-bold uppercase">
                      Locked
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-sm text-gray-700 mb-1">
                    {mod.title}
                  </h3>
                  <p className="text-[11px] text-gray-500 line-clamp-2">
                    {mod.subtitle}
                  </p>
                </div>

                <div className="pt-2 mt-3 border-t border-gray-200/60 flex items-center justify-between text-[10px] font-mono text-gray-500">
                  <span>Requires:</span>
                  <span className="font-bold text-gray-700">{mod.requiredRoles[0]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Info Strip */}
      <div className="border-t border-gray-200 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 font-mono gap-2">
        <span>Gujarat Fluorochemicals Limited • NetWeaver BSP OData V4</span>
        <span>SAP Client: 200 • Plant: 1000</span>
      </div>
    </div>
  );
};
