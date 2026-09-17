import React from 'react';
import { useSapAuth } from './core/auth/sapAuthContext';
import { SapLoginPage } from './shared/components/SapLoginPage';
import { StitchHeader } from './shared/components/StitchHeader';
import { StitchSidebar } from './shared/components/StitchSidebar';

// 8 Dedicated Enterprise PTW Modules
import { IssuePtwStudio } from './features/permits/IssuePtwStudio';
import { PermitDetailsModule } from './features/permits/PermitDetailsModule';
import { ApprovalsStudio } from './features/approvals/ApprovalsStudio';
import { PermitIssuerModule } from './features/workflow/PermitIssuerModule';
import { PermitHolderModule } from './features/workflow/PermitHolderModule';
import { GasTesterModule } from './features/safety/GasTesterModule';
import { LotoVault } from './features/dashboard/LotoVault';
import { AdminModule } from './features/admin/AdminModule';

export const App: React.FC = () => {
  const { isAuthenticated, activeModule, isModuleUnlocked, user, loading } = useSapAuth();

  // 1. If not authenticated, display SAP NetWeaver Login Page
  if (!isAuthenticated) {
    return <SapLoginPage />;
  }

  // 2. Authenticated Application Shell
  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9ff] text-[#0b1c30]">
      {/* Google Stitch Top Command Header */}
      <StitchHeader />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 pt-16">
        {/* Dynamic Role-Filtered Sidebar */}
        <StitchSidebar />

        {/* Content Viewport */}
        <main className="flex-1 pl-72 p-6 overflow-x-hidden min-h-[calc(100vh-4rem)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-96 gap-3 text-gray-500">
              <div className="w-8 h-8 border-2 border-[#006398] border-t-transparent rounded-full animate-spin"></div>
              <span className="font-mono text-xs">Authenticating SAP User & Roles via OData V4...</span>
            </div>
          ) : !isModuleUnlocked(activeModule) ? (
            /* Role Gate Shield: Displays if direct access to locked module is attempted */
            <div className="max-w-xl mx-auto mt-20 bg-white border border-red-200 rounded-xl p-8 text-center shadow-lg">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                <span className="material-symbols-outlined text-[36px]">shield_lock</span>
              </div>
              <h2 className="font-display font-bold text-lg text-gray-900">Module Access Restricted</h2>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                Current SAP User <strong className="text-gray-900 font-mono">{user?.id}</strong> has role(s):{' '}
                <span className="text-[#006398] font-mono font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                  {user?.roles.join(', ') || 'NONE'}
                </span>
                . This module requires higher operational privileges.
              </p>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center gap-2 text-xs text-gray-500">
                Click the profile badge in the top-right header to switch roles or log out.
              </div>
            </div>
          ) : (
            /* Active Unlocked Module Screen */
            <>
              {activeModule === 'permit-create' && <IssuePtwStudio />}
              {activeModule === 'permit-details' && <PermitDetailsModule />}
              {activeModule === 'permit-approver' && <ApprovalsStudio />}
              {activeModule === 'permit-issuer' && <PermitIssuerModule />}
              {activeModule === 'permit-holder' && <PermitHolderModule />}
              {activeModule === 'gas-tester' && <GasTesterModule />}
              {activeModule === 'isolation' && <LotoVault />}
              {activeModule === 'admin' && <AdminModule />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
