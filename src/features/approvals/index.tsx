import React, { useState } from 'react';
import { CheckCircle2, Clock, XCircle, AlertOctagon, PenTool, ShieldCheck, History } from 'lucide-react';
import { useSapAuth } from '../../core/auth/sapAuthContext';

export const ApprovalsModule: React.FC = () => {
  const { user } = useSapAuth();
  const [selectedDecision, setSelectedDecision] = useState<'APPROVE' | 'REJECT' | 'SUSPEND' | null>(null);
  const [comments, setComments] = useState<string>('');
  const [hasSigned, setHasSigned] = useState<boolean>(false);

  const approvalSteps = [
    {
      step: 1,
      role: 'Permit Applicant',
      user: 'J. DOE (Contractor Lead)',
      status: 'APPROVED',
      timestamp: '2026-09-17 08:30 UTC',
      comment: 'Initial draft submitted with mechanical risk assessment.'
    },
    {
      step: 2,
      role: 'HSE Safety Officer',
      user: 'M. SHARMA (Safety Lead)',
      status: 'APPROVED',
      timestamp: '2026-09-17 09:15 UTC',
      comment: 'Atmosphere checked (O2: 20.8%, LEL: 0%). Approved.'
    },
    {
      step: 3,
      role: 'Area Owner / Isolator',
      user: user?.fullName || 'CURRENT_USER',
      status: 'PENDING',
      timestamp: 'Awaiting Action',
      comment: 'Pending electrical & valve LOTO confirmation.'
    },
    {
      step: 4,
      role: 'Operations Approver',
      user: 'PLANT_MGR_01',
      status: 'WAITING',
      timestamp: '-',
      comment: 'Final authorization pending Stage 3.'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Developer Banner */}
      <div className="bg-amber-50 border-l-4 border-amber-600 p-4 rounded-r-md flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-amber-900 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <span>Developer 2 Module: Approval Workflow & Digital Signatures</span>
          </h2>
          <p className="text-xs text-amber-700 mt-0.5">
            Owns: Multi-Tier Approval Chain, Digital Signature Capture, OData Bound Actions (approve/reject/suspend), and Immutable Audit Trail.
          </p>
        </div>
        <span className="text-xs bg-amber-200 text-amber-800 px-2.5 py-1 rounded font-mono font-medium">
          src/features/approvals/
        </span>
      </div>

      {/* Permit In-Review Card */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap justify-between items-start gap-4 border-b border-gray-200 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                PERMIT-2026-0914
              </span>
              <span className="text-xs bg-red-100 text-red-800 font-semibold px-2 py-0.5 rounded border border-red-200">
                HOT WORK
              </span>
              <span className="text-xs bg-yellow-100 text-yellow-800 font-semibold px-2 py-0.5 rounded border border-yellow-200">
                STAGE 3: AREA CLEARANCE
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mt-1">
              Catalytic Cracking Unit (CCU-2) - Pipe Flange Welding & Repair
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Location: Plant 1000 • Equipment: <span className="font-mono text-gray-700">PIPE-CCU-9921</span> • Valid: 2026-09-17 08:00 to 18:00 UTC
            </p>
          </div>

          {/* Decision Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedDecision('APPROVE')}
              className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 flex items-center space-x-1 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Approve & Sign</span>
            </button>
            <button
              onClick={() => setSelectedDecision('REJECT')}
              className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 flex items-center space-x-1 shadow-sm"
            >
              <XCircle className="w-4 h-4" />
              <span>Reject</span>
            </button>
            <button
              onClick={() => setSelectedDecision('SUSPEND')}
              className="px-3 py-2 bg-amber-500 text-white rounded text-sm font-medium hover:bg-amber-600 flex items-center space-x-1"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>Safety Suspend</span>
            </button>
          </div>
        </div>

        {/* Multi-Tier Approval Progression */}
        <div className="mt-6">
          <h4 className="text-xs font-semibold uppercase text-gray-500 tracking-wider mb-4">
            Approval Progression Chain
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {approvalSteps.map((step) => {
              const isApproved = step.status === 'APPROVED';
              const isPending = step.status === 'PENDING';
              return (
                <div
                  key={step.step}
                  className={`p-4 rounded-lg border relative ${
                    isApproved
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : isPending
                      ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-400/30'
                      : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold uppercase text-gray-500">Stage {step.step}</span>
                    {isApproved && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    {isPending && <Clock className="w-4 h-4 text-blue-600 animate-spin" />}
                  </div>
                  <p className="text-sm font-bold text-gray-900">{step.role}</p>
                  <p className="text-xs text-gray-600 mt-1">{step.user}</p>
                  <p className="text-[11px] text-gray-400 mt-2 font-mono">{step.timestamp}</p>
                  <p className="text-xs text-gray-500 mt-2 italic line-clamp-2">"{step.comment}"</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Digital Signature & Decision Form (When Action Triggered) */}
        {selectedDecision && (
          <div className="mt-6 border-t border-gray-200 pt-6 bg-gray-50 p-4 rounded-lg border">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-gray-800 flex items-center space-x-2">
                <PenTool className="w-4 h-4 text-blue-600" />
                <span>Execute Decision: {selectedDecision}</span>
              </h4>
              <button
                onClick={() => setSelectedDecision(null)}
                className="text-xs text-gray-400 hover:text-gray-700"
              >
                ✕ Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Digital Sign-off (Draw Signature or Verify SAP Identity)
                </label>
                <div
                  onClick={() => setHasSigned(true)}
                  className={`h-28 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    hasSigned
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-300 bg-white hover:bg-gray-100 text-gray-400'
                  }`}
                >
                  <PenTool className="w-5 h-5 mb-1" />
                  <span className="text-xs font-medium">
                    {hasSigned ? `Signed by ${user?.id} (${user?.fullName})` : 'Click here to capture digital signature'}
                  </span>
                  <span className="text-[10px] text-gray-400">Time: {new Date().toISOString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Verification Comments / Safety Remarks
                </label>
                <textarea
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Enter remarks, conditions of approval, or required clarifications..."
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                />
                <button
                  disabled={!hasSigned}
                  onClick={() => {
                    alert(`OData Bound Action: POST /Permits('0914')/approve with signature`);
                    setSelectedDecision(null);
                  }}
                  className="mt-2 w-full py-2 bg-sap-accent text-white rounded text-sm font-semibold disabled:opacity-40 hover:bg-sap-hover"
                >
                  Confirm & Commit to SAP OData V4
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historical Audit Trail */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-sm font-bold text-gray-800 flex items-center space-x-2 mb-4">
          <History className="w-4 h-4 text-gray-600" />
          <span>Immutable SAP Audit Log & Event Timeline</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 text-gray-600 uppercase border-b">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">SAP User</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Status Transition</th>
                <th className="py-2.5 px-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              <tr>
                <td className="py-2.5 px-3 font-mono">2026-09-17 08:30:12 UTC</td>
                <td className="py-2.5 px-3 font-medium">J_DOE</td>
                <td className="py-2.5 px-3">SUBMIT_PERMIT</td>
                <td className="py-2.5 px-3"><span className="bg-gray-100 px-2 py-0.5 rounded">DRAFT → SUBM</span></td>
                <td className="py-2.5 px-3">Permit initiated for CCU-2 welding.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono">2026-09-17 09:15:45 UTC</td>
                <td className="py-2.5 px-3 font-medium">M_SHARMA</td>
                <td className="py-2.5 px-3">HSE_APPROVE</td>
                <td className="py-2.5 px-3"><span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">SUBM → HSE_A</span></td>
                <td className="py-2.5 px-3">Atmospheric gas test passed safely.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
