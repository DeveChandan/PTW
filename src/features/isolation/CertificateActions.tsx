import { useEffect, useRef, useState } from 'react';
import type { SapUser } from '../../core/auth/sapAuthContext';
import { type SapIsolationHeader, isPointNormalized } from '../../core/types/isolation.types';
import { backendWorkflowApi, WorkflowUnconfirmedError, type IsolationAction } from '../../core/api/modules/backendWorkflow.api';
import { isolationApi } from '../../core/api/modules/isolation.api';
import { toast } from '../../shared/context/ToastContext';

const ELIGIBLE_ISOLATION_ROLES = [
  'ZPTW_ISOLATOR',
  'PTW_ISOLATOR',
  'ZPTW_AREA_OWNER',
  'PTW_AREA_OWNER',
  'ZPTW_APPROVER',
  'PTW_APPROVER',
  'ZPTW_SAFETY_OFFICER',
  'PTW_SAFETY_OFFICER',
  'ZPTW_ADMIN',
  'PTW_ADMIN',
];

const ACTION_BUTTONS: ReadonlyArray<{
  action: IsolationAction;
  label: string;
  icon: string;
  variantClass: string;
}> = [
  {
    action: 'approveIsolation',
    label: 'Approve Isolation',
    icon: 'verified',
    variantClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
];

export function CertificateActions({
  certificate,
  user,
  onUpdated,
}: {
  certificate: SapIsolationHeader;
  user: SapUser | null;
  onUpdated: (certificate: SapIsolationHeader) => void;
}) {
  const [activeCert, setActiveCert] = useState<SapIsolationHeader>(certificate);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);

  const eligible = !!user?.roles.some((role) => ELIGIBLE_ISOLATION_ROLES.includes(role));

  useEffect(() => {
    setActiveCert(certificate);
  }, [certificate]);

  // Auto-load single-entity ETag when certificate came from a collection list or $expand without ETag
  useEffect(() => {
    if (certificate['@odata.etag'] || !certificate.IsolationNo?.trim()) return;
    const controller = new AbortController();
    setLoadingVersion(true);
    isolationApi
      .read(certificate.IsolationNo, controller.signal)
      .then((latest) => {
        if (!controller.signal.aborted && latest) {
          setActiveCert(latest);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingVersion(false);
        }
      });
    return () => controller.abort();
  }, [certificate.IsolationNo, certificate['@odata.etag']]);

  const allItemsNormalized =
    activeCert._Item && activeCert._Item.length > 0
      ? activeCert._Item.every((item) => isPointNormalized(item))
      : false;
  const isNormalized = activeCert.Status === 'NORM' || allItemsNormalized;
  const isApproved = (activeCert.Status === 'APPR' || activeCert.Status === 'ISOL') && !allItemsNormalized;

  const run = async (action?: IsolationAction) => {
    if (lock.current || (action && (!confirmed || uncertain || !eligible))) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    let actionConfirmed = false;
    try {
      if (action) {
        await backendWorkflowApi.isolation(activeCert, action);
        actionConfirmed = true;
      }
      const latest = await isolationApi.read(activeCert.IsolationNo);
      if (!latest) throw new Error('Reload the certificate from SAP.');
      setActiveCert(latest);
      onUpdated(latest);
      setConfirmed(false);
      const okMsg = action === 'normalizeIsolation'
        ? `SAP confirmed de-isolation & normalization. Certificate ${latest.IsolationNo} is now ${latest.Status} (NORM).`
        : action === 'approveIsolation'
        ? `SAP confirmed isolation approval. Certificate ${latest.IsolationNo} is now ${latest.Status} (ISOL).`
        : action
        ? `SAP confirmed action ${action}. Certificate ${latest.IsolationNo} is now ${latest.Status}.`
        : `Current SAP certificate ${latest.IsolationNo} loaded (Status: ${latest.Status}).`;
      setMessage(okMsg);
      toast.success(okMsg, { title: 'Certificate Updated' });
    } catch (reason) {
      const errMsg = reason instanceof Error ? reason.message : 'SAP workflow action failed.';
      setMessage(errMsg);
      toast.error(errMsg, { title: 'Isolation Action Failed' });
      if (actionConfirmed || reason instanceof WorkflowUnconfirmedError) setUncertain(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/80 via-sky-50/40 to-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#006398] text-white shadow-2xs">
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
          </span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              SAP Isolation Certificate Workflow · {activeCert.IsolationNo}
            </h3>
            <p className="text-[11px] text-slate-600">
              {isApproved
                ? 'Isolation points are approved in SAP. Linked permit work is authorized to proceed.'
                : 'Review and approve engineered isolation points in SAP.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold ${
              isApproved
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                : 'border-blue-200 bg-white text-[#006398]'
            }`}
          >
            Status: {activeCert.Status || 'CRTD'}
          </span>
          <button
            type="button"
            disabled={busy || loadingVersion}
            onClick={() => void run()}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#006398] hover:bg-blue-50 disabled:opacity-50 cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[14px] ${loadingVersion || busy ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{loadingVersion ? 'Syncing...' : 'Reload Version'}</span>
          </button>
        </div>
      </div>

      {isApproved ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50/90 p-3.5 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs shrink-0">
                <span className="material-symbols-outlined text-[20px]">verified</span>
              </span>
              <div>
                <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                  <span>Isolation Certificate Approved in SAP</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-200/90 text-emerald-900 font-mono text-[10px] font-extrabold border border-emerald-300">
                    {activeCert.Status || 'ISOL'} · ISOLATION APPROVED
                  </span>
                </h4>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Physical zero-energy boundaries and lock points are approved. Permit work is authorized to proceed.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-emerald-300 px-3 py-1.5 text-xs font-mono font-bold text-emerald-800 shadow-2xs shrink-0">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
              <span>Approved</span>
            </span>
          </div>

          {/* LOTO Reverse-Order De-Isolation Notice (Certificate-level normalization disabled per plant safety rules) */}
          <div className="rounded-xl border border-teal-200/90 bg-teal-50/60 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white shadow-2xs shrink-0">
                <span className="material-symbols-outlined text-[18px]">swap_vert</span>
              </span>
              <div>
                <h5 className="font-bold text-teal-950 flex items-center gap-2">
                  <span>Sequential De-Isolation Required</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold border border-teal-200">
                    LOTO Reverse Order
                  </span>
                </h5>
                <p className="text-[11px] text-teal-800 mt-0.5">
                  Points must be de-isolated in exact reverse order of isolation creation in the Points Registry below. Overall certificate de-isolation is disabled for safety compliance.
                </p>
              </div>
            </div>
            <a
              href="#points-ledger"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('points-ledger')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-teal-300 text-teal-800 font-bold text-[11px] hover:bg-teal-100/60 transition-colors shadow-2xs shrink-0"
            >
              <span>Go to Points Ledger</span>
              <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
            </a>
          </div>
        </div>
      ) : isNormalized ? (
        <div className="flex items-center justify-between rounded-xl border border-teal-300 bg-teal-50/90 p-3.5 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-2xs shrink-0">
              <span className="material-symbols-outlined text-[20px]">restore</span>
            </span>
            <div>
              <h4 className="text-xs font-bold text-teal-950 flex items-center gap-2">
                <span>De-Isolation Completed · Normalized Condition</span>
                <span className="px-2 py-0.5 rounded-full bg-teal-200/90 text-teal-900 font-mono text-[10px] font-extrabold border border-teal-300">
                  NORM · Normalized
                </span>
              </h4>
              <p className="text-[11px] text-teal-700 mt-0.5">
                Zero-energy isolation points have been restored to normal operating state. De-isolation confirmed in SAP.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-teal-300 px-3 py-1.5 text-xs font-mono font-bold text-teal-800 shadow-2xs shrink-0">
            <span className="material-symbols-outlined text-[16px] text-teal-600">task_alt</span>
            <span>Normalized</span>
          </span>
        </div>
      ) : (
        <>
          <label className="flex items-start gap-2 rounded-xl border border-slate-200/80 bg-white/80 p-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              disabled={busy || uncertain || !eligible}
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 accent-[#006398]"
            />
            <span>I reviewed the saved isolation points and confirm this SAP workflow action is authorized.</span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {ACTION_BUTTONS.map(({ action, label, icon, variantClass }) => (
              <button
                type="button"
                key={action}
                disabled={busy || loadingVersion || uncertain || !eligible || !confirmed}
                onClick={() => void run(action)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-2xs transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed ${variantClass}`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {busy ? 'progress_activity' : icon}
                </span>
                <span>{busy ? 'Approving in SAP...' : label}</span>
              </button>
            ))}
          </div>

          {!eligible && (
            <p className="text-[11px] font-medium text-amber-800">
              Requires an authorized Isolation / Area Owner / Safety / Approver role in SAP /UserRole.
            </p>
          )}
        </>
      )}

      {uncertain && (
        <p className="text-[11px] font-semibold text-amber-900">
          Check the action outcome in SAP before attempting further changes.
        </p>
      )}
      {message && (
        <p role="status" className="text-xs font-medium text-slate-800">
          {message}
        </p>
      )}
    </section>
  );
}
