import { useRef, useState } from 'react';
import type { ModuleId, SapUser } from '../../core/auth/sapAuthContext';
import type { PermitDeepInsertResponse } from '../../core/types/ptw.types';
import { readGasRequirement } from '../../core/ptw/prerequisites';
import { backendWorkflowApi, WorkflowUnconfirmedError } from '../../core/api/modules/backendWorkflow.api';
import { sitePermitApi } from '../../core/api/modules/sitePermit.api';
import { CertificateActions } from '../isolation/CertificateActions';

export function PrerequisitePanel({ permit, module, user, onUpdated, onBusyChange }: { permit: PermitDeepInsertResponse; module: ModuleId; user: SapUser | null; onUpdated: (permit: PermitDeepInsertResponse) => void; onBusyChange: (busy: boolean) => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const gasRequired = readGasRequirement(permit);
  const eligible = !!user?.roles.some(role => ['ZPTW_GAS_TESTER', 'ZPTW_SAFETY_OFFICER', 'ZPTW_ADMIN'].includes(role));
  const finalize = async () => {
    if (lock.current || uncertain || !confirmed || !eligible || !permit._GasTest?.length || gasRequired !== 'Y') return;
    lock.current = true; setBusy(true); onBusyChange(true); setMessage('');
    let actionConfirmed = false;
    try {
      await backendWorkflowApi.finalizeGas(permit);
      actionConfirmed = true;
      const latest = await sitePermitApi.read(permit.Permit_No);
      onUpdated(latest);
      setConfirmed(false);
      setMessage(`SAP confirmed gas finalization. Permit status: ${latest.Status}.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to finalize gas testing.');
      if (actionConfirmed || reason instanceof WorkflowUnconfirmedError) setUncertain(true);
    } finally { lock.current = false; setBusy(false); onBusyChange(false); }
  };
  const label = (value: string) => (value === 'Y' || value === 'X') ? 'Yes' : (value === 'N' || value === ' ') ? 'No' : 'Not recorded';
  return <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
    <h3 className="font-semibold">Prerequisites · {permit.Status}</h3>
    <p className="text-sm">Isolation required: {label(permit.IsolationRequired)} · Gas testing required: {label(gasRequired)}</p>
    <p className="text-sm">SAP controls the permit status after all required checks are approved. CRTD does not release work.</p>
    {['isolation', 'create-isolation'].includes(module) && permit._Isolation?.map(certificate => <CertificateActions key={certificate.IsolationNo} certificate={certificate} user={user} onUpdated={() => { void sitePermitApi.read(permit.Permit_No).then(onUpdated).catch(reason => setMessage(String(reason))); }} />)}
    {module === 'gas-tester' && <>
      <p className="text-sm text-amber-900">Gas records are read from SAP. New readings require a backend measurement-entry API; the current service supports finalizing existing tests.</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy || uncertain || !eligible} onChange={event => setConfirmed(event.target.checked)} />I reviewed the saved gas tests below and confirm they are ready for SAP validation.</label>
      <button type="button" disabled={busy || uncertain || !eligible || !confirmed || permit.Status !== 'INTD' || gasRequired !== 'Y' || !permit._GasTest?.length || !permit['@odata.etag']} onClick={() => void finalize()} className="rounded bg-[#006398] px-4 py-2 text-sm text-white disabled:opacity-40">Finalize saved gas tests</button>
      {!permit['@odata.etag'] && <p className="text-sm text-amber-900">SAP must return the current permit ETag before finalization.</p>}
    </>}
    {uncertain && <p className="text-sm text-amber-900">Check the action outcome in SAP before further changes.</p>}
    {message && <p role="status" className="text-sm text-red-800">{message}</p>}
  </section>;
}
