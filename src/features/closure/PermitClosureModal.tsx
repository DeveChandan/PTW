import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SapUser } from '../../core/auth/sapAuthContext';
import type { PermitDeepInsertResponse, PermitInfoRecord } from '../../core/types/ptw.types';
import {
  permitClosureApi,
  type ClosureWorkflowStep
} from '../../core/api/modules/permitClosure.api';
import { PERMIT_CATEGORIES } from '../../core/ptw/siteProcedure';
import { toast } from '../../shared/context/ToastContext';

export interface PermitClosureModalProps {
  isOpen: boolean;
  onClose: () => void;
  permit: PermitDeepInsertResponse | PermitInfoRecord | null;
  user: SapUser | null;
  onSuccess: (newStatus: string, updatedRecord?: any) => void;
  onOpenPermit?: (permitNo: string) => void;
}

interface StageConfig {
  title: string;
  subtitle: string;
  stageName: string;
  targetStatus: string;
  badgeColor: string;
  headerGradient: string;
  buttonLabel: string;
  buttonIcon: string;
  roleRequired: string;
  checklistItems: string[];
  presets: string[];
}

const STAGE_CONFIGS: Record<ClosureWorkflowStep, StageConfig> = {
  WORK_COMPLETION: {
    title: '1. Acceptor — Confirm Work Completion',
    subtitle: 'Acknowledge site execution finished, tools cleared, and site left safe.',
    stageName: 'Stage 1 of 4 · Work Completion',
    targetStatus: 'ACTV',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    headerGradient: 'from-teal-700 via-teal-800 to-emerald-800',
    buttonLabel: 'Confirm Work Completion (Keep ACTV)',
    buttonIcon: 'engineering',
    roleRequired: 'Permit Acceptor (PTW_ACCEPTOR / PTW_ACCP)',
    checklistItems: [
      'All physical maintenance/contractor work within approved permit scope is completed.',
      'Tools, portable machines, cables, scaffolding, and loose debris have been completely removed.',
      'Housekeeping and site cleaning performed; work area left in neat, hazard-free condition.',
      'Contractor workforce and personnel are accounted for and cleared from the site.'
    ],
    presets: [
      'Work completed and site cleaned.',
      'Job execution concluded. All maintenance tools and debris removed from site.',
      'Work finished per scope. Contractor crew disbanded and site cleared.'
    ]
  },
  ACCEPTOR_CLOSURE: {
    title: '2. Acceptor — Complete Handover & Closure',
    subtitle: 'Formally surrender permit to Area Operator for physical site clearance.',
    stageName: 'Stage 2 of 4 · Handover to Area Operator',
    targetStatus: 'ACCL',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
    headerGradient: 'from-sky-800 via-teal-800 to-cyan-900',
    buttonLabel: 'Complete Acceptor Handover (Set ACCL)',
    buttonIcon: 'handshake',
    roleRequired: 'Permit Acceptor (PTW_ACCEPTOR / PTW_ACCP)',
    checklistItems: [
      'Toolbox safety meeting concluded; execution crew stood down and dismissed.',
      'Preliminary locks and acceptor tags accounted for and prepared for handover.',
      'Permit surrendered to Area Operator for physical plant verification and inspection.'
    ],
    presets: [
      'Acceptor handover and closure confirmed.',
      'Tools removed, personnel accounted for, site left in clean and safe condition.',
      'Field work completed. Handing over permit for area restoration.'
    ]
  },
  AREA_OPERATOR: {
    title: '3. Area Operator — Complete Area Clearance',
    subtitle: 'Inspect physical boundary, verify zero-energy de-isolation, and clear area.',
    stageName: 'Stage 3 of 4 · Area Authority Clearance',
    targetStatus: 'AROP',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    headerGradient: 'from-cyan-800 via-indigo-800 to-slate-900',
    buttonLabel: 'Complete Area Operator Clearance (Set AROP)',
    buttonIcon: 'verified_user',
    roleRequired: 'Area Operator (PTW_AREA_OWNER / PTW_AREA_OPP)',
    checklistItems: [
      'Field site physically inspected by Area Authority / Operator.',
      'Positive isolation points, breakers, and LOTO valves verified and restored to normal.',
      'Area atmosphere and process containment verified safe for normal operations.'
    ],
    presets: [
      'Area checked and restored. Area Operator closure confirmed.',
      'Physical plant inspection completed. Housekeeping verified, safety devices active.',
      'Field verified and restored to normal process operating parameters.'
    ]
  },
  ISSUER_FINAL: {
    title: '4. Issuer — Final Permit Closure & Archival',
    subtitle: 'Verify full lifecycle handovers and permanently archive the permit.',
    stageName: 'Stage 4 of 4 · Final Archive',
    targetStatus: 'CLSD',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    headerGradient: 'from-indigo-800 via-purple-800 to-slate-900',
    buttonLabel: 'Authorize Final Closure (Set CLSD)',
    buttonIcon: 'task_alt',
    roleRequired: 'Permit Issuer / Approver (PTW_ISSUER / PTW_APPROVER)',
    checklistItems: [
      'Acceptor handover and Area Operator clearance verified in SAP ledger.',
      'All linked isolation certificates confirmed approved/restored.',
      'Authorize final closure and permanent archival in SAP (CLSD).'
    ],
    presets: [
      'Final permit closure approved and archived.',
      'All handovers and area clearances confirmed. Permit officially closed in SAP.',
      'Scope completed, all isolations de-isolated/verified, permit closed (CLSD).'
    ]
  },
  CLOSED: {
    title: 'Permit Closed (CLSD)',
    subtitle: 'This permit is archived and closed in SAP.',
    stageName: 'Archived',
    targetStatus: 'CLSD',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    headerGradient: 'from-slate-700 to-slate-900',
    buttonLabel: 'Permit Already Closed',
    buttonIcon: 'lock',
    roleRequired: 'None',
    checklistItems: [],
    presets: []
  },
  NOT_READY: {
    title: 'Permit Not Ready for Closure',
    subtitle: 'Permit must be in ACTIVE status (ACTV) before closure can begin.',
    stageName: 'Not Ready',
    targetStatus: 'ACTV',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    headerGradient: 'from-amber-700 to-amber-900',
    buttonLabel: 'Permit Not Active',
    buttonIcon: 'info',
    roleRequired: 'None',
    checklistItems: [],
    presets: []
  }
};

export const PermitClosureModal: React.FC<PermitClosureModalProps> = ({
  isOpen,
  onClose,
  permit,
  user,
  onSuccess,
  onOpenPermit
}) => {
  const [comments, setComments] = useState<string>('');
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const currentStep = permit ? permitClosureApi.getClosureStep(permit) : 'NOT_READY';
  const config = STAGE_CONFIGS[currentStep] || STAGE_CONFIGS.NOT_READY;
  const userRoles = user?.roles || [];
  const isAuthorized = permitClosureApi.canExecuteClosureStep(userRoles, currentStep);

  // Initialize comments and checklist when modal opens or step changes
  useEffect(() => {
    if (isOpen && permit) {
      setComments(config.presets[0] || '');
      const initialChecks: Record<number, boolean> = {};
      config.checklistItems.forEach((_, idx) => {
        initialChecks[idx] = true; // Default pre-checked for convenient verification
      });
      setCheckedItems(initialChecks);
      setSubmissionError(null);
    }
  }, [isOpen, permit, currentStep]);

  if (!isOpen || !permit) return null;

  const allChecklistConfirmed = config.checklistItems.length === 0 ||
    config.checklistItems.every((_, idx) => Boolean(checkedItems[idx]));

  const canSubmit = isAuthorized && allChecklistConfirmed && comments.trim().length > 0 && !submitting;

  const handleSelectAll = (select: boolean) => {
    const updated: Record<number, boolean> = {};
    config.checklistItems.forEach((_, idx) => {
      updated[idx] = select;
    });
    setCheckedItems(updated);
  };

  const handleToggleCheck = (index: number) => {
    setCheckedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleExecute = async () => {
    if (!permit.Permit_No) return;
    setSubmitting(true);
    setSubmissionError(null);

    try {
      let result;
      switch (currentStep) {
        case 'WORK_COMPLETION':
          result = await permitClosureApi.confirmWorkCompletion({
            permitNo: permit.Permit_No,
            comments: comments.trim(),
            etag: (permit as any)['@odata.etag']
          });
          toast.success(result.message || 'Work completion recorded in SAP.');
          break;

        case 'ACCEPTOR_CLOSURE':
          result = await permitClosureApi.completeAcceptorClosure({
            permitNo: permit.Permit_No,
            comments: comments.trim()
          });
          toast.success(result.message || 'Acceptor handover confirmed in SAP (ACCL).');
          break;

        case 'AREA_OPERATOR':
          result = await permitClosureApi.completeAreaOperatorClosure({
            permitNo: permit.Permit_No,
            comments: comments.trim()
          });
          toast.success(result.message || 'Area Operator clearance confirmed in SAP (AROP).');
          break;

        case 'ISSUER_FINAL':
          result = await permitClosureApi.completeIssuerClosure({
            permitNo: permit.Permit_No,
            comments: comments.trim(),
            etag: (permit as any)['@odata.etag']
          });
          toast.success(result.message || 'Permit successfully closed and archived in SAP (CLSD).');
          break;

        default:
          throw new Error('No closure action available for the current permit state.');
      }

      onSuccess(result?.newStatus || config.targetStatus, result?.data);
      onClose();
    } catch (err: any) {
      console.error('[PermitClosureModal] Action failed:', err);
      const sapMsg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'SAP Gateway rejected the action. Please verify site conditions and permissions.';
      setSubmissionError(sapMsg);
      toast.error(sapMsg, { title: 'SAP Gateway Action Error' });
    } finally {
      setSubmitting(false);
    }
  };

  const cat = PERMIT_CATEGORIES.find(
    (c) => c.code === permit.PermitType || c.sapCode === permit.PermitType
  );

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="closure-modal-title"
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 bg-gradient-to-r ${config.headerGradient} text-white shrink-0`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs text-white flex items-center justify-center shadow-inner shrink-0 mt-0.5 border border-white/20">
                <span className="material-symbols-outlined text-[24px]">
                  {config.buttonIcon}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 id="closure-modal-title" className="text-base sm:text-lg font-bold tracking-tight">
                    {config.title}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/20 text-white border border-white/30">
                    {config.stageName}
                  </span>
                </div>
                <p className="text-xs text-white/80 mt-0.5">
                  {config.subtitle}
                </p>
                <div className="flex items-center gap-2 text-[11px] font-mono mt-1 text-white/90 flex-wrap">
                  <span className="font-bold">Permit #{permit.Permit_No}</span>
                  <span>·</span>
                  <span>Plant {permit.Werks || '1002'}</span>
                  <span>·</span>
                  <span>Category: {cat?.label || permit.PermitType}</span>
                  <span>·</span>
                  <span className="px-1.5 py-0.2 rounded bg-white/20 font-bold">
                    Current: {permit.Status} → Target: {config.targetStatus}
                  </span>
                  {onOpenPermit && (
                    <>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenPermit(permit.Permit_No);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-white/90 hover:text-white underline underline-offset-2 cursor-pointer"
                        title="View Full Permit Dossier"
                      >
                        <span>Full Dossier</span>
                        <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Close modal"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Submission Error Banner */}
          {submissionError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0 mt-0.5">
                error
              </span>
              <div className="space-y-0.5">
                <p className="font-bold">SAP Gateway Error</p>
                <p className="text-[11px] leading-relaxed">{submissionError}</p>
              </div>
            </div>
          )}

          {/* 4-Stage Stepper Ribbon */}
          <div className="grid grid-cols-4 gap-1.5 p-1.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
            {[
              { id: 'WORK_COMPLETION', num: '1', label: 'Work Done', code: 'ACTV' },
              { id: 'ACCEPTOR_CLOSURE', num: '2', label: 'Acceptor', code: 'ACCL' },
              { id: 'AREA_OPERATOR', num: '3', label: 'Area Clearance', code: 'AROP' },
              { id: 'ISSUER_FINAL', num: '4', label: 'Issuer Final', code: 'CLSD' }
            ].map((step) => {
              const isActive = currentStep === step.id;
              return (
                <div
                  key={step.id}
                  className={`py-1.5 px-1 rounded-lg transition-all ${
                    isActive
                      ? 'bg-teal-600 text-white font-bold shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  <div className="font-mono text-[10px] opacity-80">Step {step.num}</div>
                  <div className="font-semibold text-[11px] truncate">{step.label}</div>
                  <div className="font-mono text-[9px] opacity-75">{step.code}</div>
                </div>
              );
            })}
          </div>

          {/* Permit Context Overview */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block font-mono text-[10px]">JOB DESCRIPTION</span>
                <span className="font-semibold text-slate-800 leading-snug">
                  {permit.JobDesc || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-mono text-[10px]">WORK LOCATION / WORK CENTER</span>
                <span className="font-mono font-medium text-slate-800">
                  {permit.Arbpl || permit.AreaLoc || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-mono text-[10px]">ORDER / NOTIFICATION</span>
                <span className="font-mono font-medium text-slate-800">
                  {permit.Aufnr ? `Order #${permit.Aufnr}` : ''}
                  {permit.Qmnum ? ` · Notif #${permit.Qmnum}` : ''}
                  {!permit.Aufnr && !permit.Qmnum && 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-mono text-[10px]">SUPERVISOR / CONTRACTOR</span>
                <span className="font-medium text-slate-800">
                  {permit.SupvName || permit.PersonResp || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Stage Safety Checklist */}
          {config.checklistItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-teal-600">
                    checklist
                  </span>
                  <span>Mandatory Verification Checklist *</span>
                </label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="text-teal-700 hover:text-teal-900 font-semibold cursor-pointer"
                  >
                    Check All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {config.checklistItems.map((item, idx) => (
                  <label
                    key={idx}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      checkedItems[idx]
                        ? 'bg-teal-50/70 border-teal-300 text-teal-950 font-medium'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(checkedItems[idx])}
                      onChange={() => handleToggleCheck(idx)}
                      className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                    />
                    <span className="leading-snug text-xs">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Comments & Remarks Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-teal-600">
                  edit_note
                </span>
                <span>Handover Remarks / Comments *</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {comments.length} characters (sent in SAP POST payload)
              </span>
            </div>

            {/* Quick Comment Preset Pills */}
            <div className="flex flex-wrap gap-1.5">
              {config.presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setComments(preset)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border text-left transition-all cursor-pointer ${
                    comments === preset
                      ? 'bg-teal-50 border-teal-500 text-teal-900 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Enter specific handover or closure remarks..."
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none leading-relaxed transition-all"
            />
          </div>

          {/* User Sign-off Information */}
          <div className="bg-slate-100/70 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-slate-500">
                badge
              </span>
              <span>
                Authorized by: <strong className="text-slate-800">{user?.fullName || user?.id || 'User'}</strong> ({user?.id})
              </span>
            </div>
            {!isAuthorized && (
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                <span>Requires {config.roleRequired}</span>
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecute}
            disabled={!canSubmit}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm flex items-center gap-2 cursor-pointer ${
              canSubmit
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-95'
                : 'bg-slate-300 opacity-60 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">
                  progress_activity
                </span>
                <span>Posting to SAP Gateway...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">
                  {config.buttonIcon}
                </span>
                <span>{config.buttonLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};

export default PermitClosureModal;

