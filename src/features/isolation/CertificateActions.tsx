import { useRef, useState } from 'react';
import type { SapUser } from '../../core/auth/sapAuthContext';
import type { SapIsolationHeader } from '../../core/types/isolation.types';
import { backendWorkflowApi, WorkflowUnconfirmedError, type IsolationAction } from '../../core/api/modules/backendWorkflow.api';
import { isolationApi } from '../../core/api/modules/isolation.api';
import { sitePermitApi } from '../../core/api/modules/sitePermit.api';

export function CertificateActions({ certificate, user, onUpdated }: { certificate: SapIsolationHeader; user: SapUser | null; onUpdated: (certificate: SapIsolationHeader) => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const eligible = !!user?.roles.some(role => ['ZPTW_ISOLATOR', 'ZPTW_AREA_OWNER', 'ZPTW_ADMIN'].includes(role));
  const run = async (action?: IsolationAction) => {
    if (lock.current || (action && (!confirmed || uncertain || !eligible))) return;
    lock.current = true; setBusy(true); setMessage('');
    let actionConfirmed = false;
    try {
      if (action === 'normalizeIsolation' && certificate.PermitNo) {
        const permit = await sitePermitApi.read(certificate.PermitNo);
        if (permit.Status !== 'CLOS') throw new Error('Close the linked permit before restoring isolation.');
      }
      if (action) { await backendWorkflowApi.isolation(certificate, action); actionConfirmed = true; }
      const latest = await isolationApi.read(certificate.IsolationNo);
      if (!latest) throw new Error('Reload the certificate from SAP.');
      onUpdated(latest); setConfirmed(false);
      setMessage(action ? `SAP confirmed ${action}. Certificate status: ${latest.Status}. Reload the linked permit to check its workflow status.` : 'Current SAP certificate loaded.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'SAP workflow action failed.');
      if (actionConfirmed || reason instanceof WorkflowUnconfirmedError) setUncertain(true);
    } finally { lock.current = false; setBusy(false); }
  };
  return <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
    <h3 className="font-semibold">SAP certificate workflow</h3>
    <p className="text-sm">Complete and approve saved certificate items through SAP. Restore isolation only after the linked permit is closed. SAP validates authorization and evidence and assigns signatures.</p>
    <button type="button" disabled={busy} onClick={() => void run()} className="text-sm text-blue-800 underline">Reload certificate and current version</button>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={busy || uncertain || !eligible} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I reviewed the saved points and confirm the selected action is appropriate.</label>
    <div className="flex flex-wrap gap-2">{([['completeIsolation', 'Complete isolation'], ['approveIsolation', 'Approve isolation'], ['normalizeIsolation', 'Restore isolation']] as const).map(([action, label]) => <button type="button" key={action} disabled={busy || uncertain || !eligible || !confirmed || !certificate['@odata.etag']} onClick={() => void run(action)} className="rounded bg-[#006398] px-3 py-2 text-sm text-white disabled:opacity-40">{label}</button>)}</div>
    {!certificate['@odata.etag'] && <p className="text-sm text-amber-900">Reload to obtain the SAP record version. Actions require a current ETag.</p>}
    {uncertain && <p className="text-sm text-amber-900">Check the action outcome in SAP before further changes.</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
