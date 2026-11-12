import { useEffect, useRef, useState } from 'react';
import type { SapUser } from '../../core/auth/sapAuthContext';
import type { SapIsolationHeader } from '../../core/types/isolation.types';
import { backendWorkflowApi, WorkflowUnconfirmedError, type IsolationAction } from '../../core/api/modules/backendWorkflow.api';
import { isolationApi } from '../../core/api/modules/isolation.api';
import { sitePermitApi } from '../../core/api/modules/sitePermit.api';
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
    action: 'completeIsolation',
    label: 'Complete Isolation',
    icon: 'lock',
    variantClass: 'bg-sky-700 hover:bg-sky-800 text-white',
  },
  {
    action: 'approveIsolation',
    label: 'Approve Isolation',
    icon: 'verified',
    variantClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  {
    action: 'normalizeIsolation',
    label: 'Restore Isolation',
    icon: 'lock_open',
    variantClass: 'bg-amber-600 hover:bg-amber-700 text-white',
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

  const run = async (action?: IsolationAction) => {
    if (lock.current || (action && (!confirmed || uncertain || !eligible))) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    let actionConfirmed = false;
    try {
      if (action === 'normalizeIsolation' && activeCert.PermitNo) {
        const permit = await sitePermitApi.read(activeCert.PermitNo);
        if (permit.Status !== 'CLOS') {
          throw new Error('Close the linked permit before restoring isolation.');
        }
      }
      if (action) {
        await backendWorkflowApi.isolation(activeCert, action);
        actionConfirmed = true;
      }
      const latest = await isolationApi.read(activeCert.IsolationNo);
      if (!latest) throw new Error('Reload the certificate from SAP.');
      setActiveCert(latest);
      onUpdated(latest);
      setConfirmed(false);
      const okMsg = action
        ? `SAP confirmed ${action}. Certificate ${latest.IsolationNo} status: ${latest.Status}.`
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

  const hasEtag = Boolean(activeCert['@odata.etag'] && activeCert['@odata.etag'] !== '*');

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
              Complete and approve isolation points in SAP. Restore isolation only after the linked permit is closed.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-blue-200 bg-white px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#006398]">
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
            <span>{loadingVersion ? 'Syncing ETag...' : 'Reload Version'}</span>
          </button>
        </div>
      </div>

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
            disabled={busy || loadingVersion || uncertain || !eligible || !confirmed || !hasEtag}
            onClick={() => void run(action)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-2xs transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed ${variantClass}`}
          >
            <span className="material-symbols-outlined text-[16px]">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {!eligible && (
        <p className="text-[11px] font-medium text-amber-800">
          Requires an authorized Isolation / Area Owner / Safety / Approver role in SAP /UserRole.
        </p>
      )}
      {eligible && !hasEtag && !loadingVersion && (
        <p className="text-[11px] font-medium text-amber-900">
          Reload to obtain the SAP record version (ETag). Workflow actions require a current ETag.
        </p>
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
