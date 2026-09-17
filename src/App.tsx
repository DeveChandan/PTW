import React, { useState } from 'react';
import { useSapAuth, MODULE_REGISTRY, ModuleId } from './core/auth/sapAuthContext';
import { SapLoginPage } from './shared/components/SapLoginPage';
import { StitchHeader } from './shared/components/StitchHeader';
import { ModuleLaunchpad } from './features/dashboard/ModuleLaunchpad';
import { ComingSoonModule } from './shared/components/ComingSoonModule';

export const App: React.FC = () => {
  const { isAuthenticated, isModuleUnlocked, user, loading, isSessionRestoring } = useSapAuth();
  const [selectedModule, setSelectedModule] = useState<ModuleId | null>(null);

  // 0. Session Restoration Screen (Prevents login flicker on browser reload)
  if (isSessionRestoring) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#f8f9ff] select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-[#006398] border-t-transparent rounded-full animate-spin"></div>
          <span className="font-mono text-xs text-slate-500 font-semibold tracking-wider uppercase">
            Restoring SAP User Session...
          </span>
        </div>
      </div>
    );
  }

  // 1. If not authenticated, display Modern Login Page
  if (!isAuthenticated) {
    return <SapLoginPage />;
  }

  const activeModuleDef = selectedModule
    ? MODULE_REGISTRY.find((m) => m.id === selectedModule) || MODULE_REGISTRY[0]
    : null;

  // 2. Authenticated Application Shell (Full width, No left row sidebar)
  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9ff] text-[#0b1c30]">
      {/* Top Corporate Command Header */}
      <StitchHeader
        onGoHome={() => setSelectedModule(null)}
        isHome={selectedModule === null}
      />

      {/* Main Content Area: Padding top for fixed header */}
      <main className="flex-1 pt-16 min-h-[calc(100vh-4rem)]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 gap-3 text-gray-500">
            <div className="w-8 h-8 border-2 border-[#006398] border-t-transparent rounded-full animate-spin"></div>
            <span className="font-mono text-xs">Authenticating SAP User & Roles via OData V4...</span>
          </div>
        ) : selectedModule === null ? (
          /* KPI Card Launchpad: All modules displayed as interactive KPI cards */
          <ModuleLaunchpad
            user={user}
            onSelectModule={(moduleId) => setSelectedModule(moduleId)}
          />
        ) : !isModuleUnlocked(selectedModule) ? (
          /* Role Gate Shield: Displays if direct access to locked module is attempted */
          <div className="max-w-xl mx-auto mt-20 bg-white border border-red-200 rounded-2xl p-8 text-center shadow-lg">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
              <span className="material-symbols-outlined text-[36px]">shield_lock</span>
            </div>
            <h2 className="font-display font-bold text-lg text-gray-900">Module Access Restricted</h2>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              Current SAP User <strong className="text-gray-900 font-mono">{user?.id}</strong> has role(s):{' '}
              <span className="text-[#006398] font-mono font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                {user?.roles.join(', ') || 'NONE'}
              </span>
              . This workspace requires higher operational authorization.
            </p>
            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center gap-3">
              <button
                onClick={() => setSelectedModule(null)}
                className="px-4 py-2 bg-[#006398] hover:bg-[#004f7a] text-white rounded-lg text-xs font-mono font-bold transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">grid_view</span>
                <span>Return to Launchpad</span>
              </button>
            </div>
          </div>
        ) : (
          /* Active Unlocked Module Workspace */
          activeModuleDef && (
            <ComingSoonModule
              module={activeModuleDef}
              user={user}
              onBack={() => setSelectedModule(null)}
            />
          )
        )}
      </main>
    </div>
  );
};

export default App;
