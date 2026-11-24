import React, { useState } from 'react';
import type { SapUser } from '../../core/auth/sapAuthContext';
import type { PermitDeepInsertResponse, PermitInfoRecord } from '../../core/types/ptw.types';
import { permitClosureApi } from '../../core/api/modules/permitClosure.api';
import { PermitClosureModal } from './PermitClosureModal';

export interface PermitClosureActionCardProps {
  permit: PermitDeepInsertResponse | PermitInfoRecord;
  user: SapUser | null;
  onSuccess?: (newStatus: string, updatedRecord?: any) => void;
  compact?: boolean;
}

export const PermitClosureActionCard: React.FC<PermitClosureActionCardProps> = ({
  permit,
  user,
  onSuccess,
  compact = false
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const currentStep = permitClosureApi.getClosureStep(permit);
  const userRoles = user?.roles || [];
  const canAct = permitClosureApi.canExecuteClosureStep(userRoles, currentStep);

  const isWorkCompleted = permit.WorkCompleted === 'X' || permit.WorkCompleted === 'Y';
  const isClosedByAcceptor = permit.ClosedByAcceptor === 'X' || permit.ClosedByAcceptor === 'Y';
  const isClosedByAreaOpp = permit.ClosedByAreaOpp === 'X' || permit.ClosedByAreaOpp === 'Y';
  const isFinalClosed = permit.Status === 'CLSD' || permit.Status === 'CLOS';

  const stepsConfig = [
    {
      id: 'WORK_COMPLETION',
      number: '1',
      title: 'Acceptor Work Done',
      subtitle: 'Work completed, site clean',
      targetStatus: 'ACTV',
      flag: 'WorkCompleted = "X"',
      done: isWorkCompleted || isClosedByAcceptor || isClosedByAreaOpp || isFinalClosed,
      current: currentStep === 'WORK_COMPLETION',
      icon: 'engineering'
    },
    {
      id: 'ACCEPTOR_CLOSURE',
      number: '2',
      title: 'Acceptor Handover',
      subtitle: 'Acceptor closure confirmed',
      targetStatus: 'ACCL',
      flag: 'ClosedByAcceptor = "X"',
      done: isClosedByAcceptor || isClosedByAreaOpp || isFinalClosed,
      current: currentStep === 'ACCEPTOR_CLOSURE',
      icon: 'handshake'
    },
    {
      id: 'AREA_OPERATOR',
      number: '3',
      title: 'Area Operator Clearance',
      subtitle: 'Area inspected & restored',
      targetStatus: 'AROP',
      flag: 'ClosedByAreaOpp = "X"',
      done: isClosedByAreaOpp || isFinalClosed,
      current: currentStep === 'AREA_OPERATOR',
      icon: 'verified_user'
    },
    {
      id: 'ISSUER_FINAL',
      number: '4',
      title: 'Issuer Final Closure',
      subtitle: 'Permit officially closed in SAP',
      targetStatus: 'CLSD',
      flag: 'Status = "CLSD"',
      done: isFinalClosed,
      current: currentStep === 'ISSUER_FINAL',
      icon: 'task_alt'
    }
  ];

  if (isFinalClosed) {
    return (
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-2xl border border-emerald-200/90 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <span className="material-symbols-outlined text-[22px]">task_alt</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-900">Permit Closed in SAP</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-600 text-white shadow-xs">
                  CLSD
                </span>
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                Work completed, acceptor handover done, area operator cleared, and issuer closed.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-emerald-800 bg-white/80 px-3 py-1.5 rounded-xl border border-emerald-200">
            <span className="material-symbols-outlined text-[15px] text-emerald-600">verified</span>
            <span>All 4 Closure Milestones Completed</span>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'NOT_READY') {
    return (
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3.5 text-xs text-slate-500 flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-slate-400">info</span>
        <span>Permit closure workflow will activate once the permit is approved and issued to the field (ACTV).</span>
      </div>
    );
  }

  const getStepButtonLabel = () => {
    switch (currentStep) {
      case 'WORK_COMPLETION':
        return '1. Confirm Work Completion';
      case 'ACCEPTOR_CLOSURE':
        return '2. Complete Acceptor Handover (ACCL)';
      case 'AREA_OPERATOR':
        return '3. Complete Area Clearance (AROP)';
      case 'ISSUER_FINAL':
        return '4. Finalize Closure (CLSD)';
      default:
        return 'Execute Action';
    }
  };

  const getRequiredRoleLabel = () => {
    switch (currentStep) {
      case 'WORK_COMPLETION':
      case 'ACCEPTOR_CLOSURE':
        return 'Permit Acceptor (PTW_ACCEPTOR)';
      case 'AREA_OPERATOR':
        return 'Area Operator (PTW_AREA_OWNER / AREA_OPP)';
      case 'ISSUER_FINAL':
        return 'Permit Issuer / Approver (PTW_ISSUER / APPROVER)';
      default:
        return 'Authorized Role';
    }
  };

  return (
    <>
      <div className="bg-gradient-to-br from-white via-slate-50/50 to-teal-50/20 rounded-2xl border border-teal-200/80 shadow-sm p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>SAP Permit Closure & Handover Workflow</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-100 text-teal-800">
                  4-Stage Pipeline
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Sequential authorization from field execution to SAP archival (CLSD).
              </p>
            </div>
          </div>

          {/* Action Trigger Button */}
          <div>
            {canAct ? (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">task_alt</span>
                <span>{getStepButtonLabel()}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200">
                <span className="material-symbols-outlined text-[14px] text-amber-600">lock</span>
                <span>Requires {getRequiredRoleLabel()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stepper Grid */}
        <div className={`grid grid-cols-1 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-4'} gap-2.5`}>
          {stepsConfig.map((step) => {
            const isDone = step.done;
            const isCurrent = step.current;

            let badgeBg = 'bg-slate-100 text-slate-500 border-slate-200';
            let icon = step.icon;

            if (isDone) {
              badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/20';
              icon = 'check_circle';
            } else if (isCurrent) {
              badgeBg = 'bg-teal-50 text-teal-900 border-teal-400 ring-2 ring-teal-500/30';
            }

            return (
              <div
                key={step.id}
                className={`p-3 rounded-xl border transition-all ${badgeBg} flex flex-col justify-between`}
              >
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-white text-slate-700 font-bold font-mono text-[11px] flex items-center justify-center border shadow-2xs">
                    {step.number}
                  </span>
                  <span className="material-symbols-outlined text-[18px]">
                    {icon}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold leading-snug">{step.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{step.subtitle}</p>
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400">Target:</span>
                  <span className="font-bold text-slate-700">{step.targetStatus}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unified SAP Action Modal */}
      <PermitClosureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        permit={permit}
        user={user}
        onSuccess={(newStatus, updatedRecord) => {
          if (onSuccess) onSuccess(newStatus, updatedRecord);
        }}
      />
    </>
  );
};

export default PermitClosureActionCard;
