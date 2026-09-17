import React from 'react';
import { useSapAuth } from '../../core/auth/sapAuthContext';

export const AdminModule: React.FC = () => {
  const { user } = useSapAuth();

  const userRolesList = [
    { userId: 'VERTIF-V', name: '1 VERTIF-V', email: 'testuser2@gfl.co.in', roles: ['ZPTW_REQUESTER'], modulesCount: '2 Modules' },
    { userId: 'APPROVER_01', name: 'M. Sharma', email: 'approver1@gfl.co.in', roles: ['ZPTW_APPROVER'], modulesCount: '2 Modules' },
    { userId: 'ISSUER_01', name: 'R. Davis', email: 'issuer1@gfl.co.in', roles: ['ZPTW_ISSUER'], modulesCount: '2 Modules' },
    { userId: 'HOLDER_01', name: 'D. Miller', email: 'holder1@gfl.co.in', roles: ['ZPTW_HOLDER'], modulesCount: '2 Modules' },
    { userId: 'GAS_TECH_01', name: 'S. Al-Nasser', email: 'gastech1@gfl.co.in', roles: ['ZPTW_GAS_TESTER'], modulesCount: '2 Modules' },
    { userId: 'ISOLATOR_01', name: 'M. Mansoor', email: 'isolator1@gfl.co.in', roles: ['ZPTW_ISOLATOR'], modulesCount: '2 Modules' },
    { userId: 'ADMIN_01', name: 'Plant Chief', email: 'admin@gfl.co.in', roles: ['ZPTW_ADMIN'], modulesCount: 'All 8 Modules' }
  ];

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-gray-500 uppercase tracking-wider font-semibold">PTW Admin</span>
          <span className="text-gray-300 text-xs">/</span>
          <span className="font-mono text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 font-bold">
            SYSTEM ADMINISTRATION & ROLE ASSIGNMENTS
          </span>
        </div>
        <span className="bg-gray-50 border border-gray-200 px-3 py-1 rounded font-mono text-xs text-gray-700">
          Super Admin: <strong className="text-red-700">{user?.id}</strong>
        </span>
      </div>

      {/* Admin Control Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <span className="text-xs font-mono text-gray-500 uppercase font-bold">Target SAP Gateway</span>
          <span className="font-display font-bold text-base text-[#006398] block mt-1">
            vhgfldevci.sap.gfl.co.in:44300
          </span>
          <span className="text-[11px] font-mono text-emerald-700 mt-1 block">OData V4 Service Active (200 OK)</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <span className="text-xs font-mono text-gray-500 uppercase font-bold">Registered SAP Users</span>
          <span className="font-display font-bold text-2xl text-gray-900 block mt-1">
            7 Test Profiles
          </span>
          <span className="text-[11px] font-mono text-gray-500 mt-1 block">Entity: userinfo ($filter active)</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <span className="text-xs font-mono text-gray-500 uppercase font-bold">Total Functional Modules</span>
          <span className="font-display font-bold text-2xl text-emerald-700 block mt-1">
            8 Modules
          </span>
          <span className="text-[11px] font-mono text-gray-500 mt-1 block">Role-governed visibility</span>
        </div>
      </div>

      {/* SAP User Role Matrix Table */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-3">
          <div>
            <h3 className="font-display font-bold text-sm text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006398]">manage_accounts</span>
              <span>SAP User-to-Role Mapping & Module Access Ledger</span>
            </h3>
            <p className="text-xs text-gray-500">
              Corresponds directly to SAP OData service <code className="text-[#006398] font-mono">/sap/opu/odata4/.../userinfo</code>
            </p>
          </div>
          <button
            onClick={() => alert('Synchronizing user authorizations with SAP backend...')}
            className="px-3 py-1.5 bg-[#006398] hover:bg-[#004f7a] text-white text-xs font-mono font-bold rounded flex items-center gap-1 shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>Sync from SAP</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-gray-50 text-gray-600 uppercase border-b border-gray-200">
              <tr>
                <th className="py-2.5 px-3">SAP User ID</th>
                <th className="py-2.5 px-3">Full Name</th>
                <th className="py-2.5 px-3">Corporate Email</th>
                <th className="py-2.5 px-3">Assigned SAP Roles</th>
                <th className="py-2.5 px-3">Unlocked Modules</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {userRolesList.map((u, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="py-3 px-3 font-bold text-[#006398]">{u.userId}</td>
                  <td className="py-3 px-3 font-sans font-medium text-gray-900">{u.name}</td>
                  <td className="py-3 px-3 text-gray-500">{u.email}</td>
                  <td className="py-3 px-3">
                    <div className="flex gap-1 flex-wrap">
                      {u.roles.map((r, rIdx) => (
                        <span key={rIdx} className="bg-blue-50 text-[#006398] border border-blue-200 px-1.5 py-0.2 rounded text-[10px] font-bold">
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                      {u.modulesCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
