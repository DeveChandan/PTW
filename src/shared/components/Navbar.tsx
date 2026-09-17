import React from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';
import { ShieldAlert, FileText, CheckSquare, LayoutDashboard, User } from 'lucide-react';

interface NavbarProps {
  activeTab: 'permits' | 'approvals' | 'dashboard';
  onTabChange: (tab: 'permits' | 'approvals' | 'dashboard') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  const { user, loading } = useSapAuth();

  return (
    <header className="bg-sap-shell text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand / Logo */}
          <div className="flex items-center space-x-3">
            <div className="bg-sap-accent p-2 rounded-lg text-white">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-wide">SAP Permit To Work (PTW)</span>
                <span className="text-xs bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded border border-blue-400/30">
                  OData V4 • BSP
                </span>
              </div>
              <p className="text-xs text-gray-300">Plant Maintenance & Environmental Health and Safety (EHS)</p>
            </div>
          </div>

          {/* Navigation Tabs (Linked to Developer Domains) */}
          <nav className="flex space-x-1">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-sap-hover text-white'
                  : 'text-gray-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Operations & LOTO</span>
              <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded">Dev 3</span>
            </button>

            <button
              onClick={() => onTabChange('permits')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'permits'
                  ? 'bg-sap-hover text-white'
                  : 'text-gray-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Permit Lifecycle</span>
              <span className="text-[10px] bg-blue-500/30 text-blue-300 px-1.5 py-0.2 rounded">Dev 1</span>
            </button>

            <button
              onClick={() => onTabChange('approvals')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'approvals'
                  ? 'bg-sap-hover text-white'
                  : 'text-gray-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>Approvals & Signatures</span>
              <span className="text-[10px] bg-amber-500/30 text-amber-300 px-1.5 py-0.2 rounded">Dev 2</span>
            </button>
          </nav>

          {/* SAP User Profile Context */}
          <div className="flex items-center space-x-3 border-l border-slate-600 pl-4">
            <div className="text-right">
              {loading ? (
                <div className="text-xs text-gray-300 animate-pulse">Authenticating SAP...</div>
              ) : (
                <>
                  <div className="text-sm font-semibold flex items-center justify-end space-x-1">
                    <User className="w-3.5 h-3.5 text-blue-300 inline" />
                    <span>{user?.fullName}</span>
                  </div>
                  <div className="text-xs text-blue-200">
                    ID: <span className="font-mono">{user?.id}</span> | Plant: {user?.plant}
                  </div>
                </>
              )}
            </div>
            {user?.isFlpShell && (
              <span className="text-[10px] bg-green-500 text-white font-bold px-1.5 py-0.5 rounded">
                FLP Shell
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
