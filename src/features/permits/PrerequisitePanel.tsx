import { useRef, useState } from 'react';
import type { PermitDeepInsertResponse } from '../../core/types/ptw.types';
import type { ModuleId, SapUser } from '../../core/auth/sapAuthContext';
import { prerequisiteAction, prerequisiteApi, PrerequisiteUnconfirmedError, type GasEvidence, type IsolationEvidence, type PrerequisiteDecision, type PrerequisiteKind } from '../../core/api/modules/prerequisite.api';
import { readGasRequirement } from '../../core/ptw/prerequisites';

const blankPoint = (): IsolationEvidence => ({ IsolationPoint: '', IsolType: '', IsolMethod: '', LockTagNo: '', IsIsolated: false, ZeroEnergyConf: false });
const inputClass = 'mt-1 block w-full rounded border bg-white p-2 text-sm';
export function PrerequisitePanel({ permit, module, user, onUpdated, onBusyChange }: { permit: PermitDeepInsertResponse; module: ModuleId; user: SapUser | null; onUpdated: (permit: PermitDeepInsertResponse) => void; onBusyChange: (busy: boolean) => void }) {
  const kind: PrerequisiteKind | undefined = module === 'gas-tester' ? 'GAS' : ['isolation', 'create-isolation'].includes(module) ? 'ISOLATION' : undefined;
  const [points, setPoints] = useState<IsolationEvidence[]>(() => permit._Isolation?.length ? permit._Isolation.map(point => ({ IsolationPoint: point.IsolationPoint || '', IsolType: point.IsolType || '', IsolMethod: point.IsolMethod || '', LockTagNo: point.LockTagNo || '', IsIsolated: point.IsIsolated === 'Y', ZeroEnergyConf: point.ZeroEnergyConf === 'Y' })) : [blankPoint()]);
  const [gas, setGas] = useState<GasEvidence>({ TestAt: '', TestLocation: '', MeterId: '', PolicyRef: '', BumpTestOk: false, O2Pct: '', LelPct: '', CoPpm: '', H2sPpm: '' });
  const [comments, setComments] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const gasRequired = readGasRequirement(permit);
  const isIsoReq = permit.IsolationRequired === 'Y' || permit.IsolationRequired === 'X';
  const required = kind === 'ISOLATION' ? (isIsoReq ? 'Y' : 'N') : gasRequired;
  const canAct = !!kind && !!user?.roles.some(role => (kind === 'GAS' ? ['ZPTW_GAS_TESTER', 'ZPTW_SAFETY_OFFICER', 'ZPTW_ADMIN'] : ['ZPTW_ISOLATOR', 'ZPTW_AREA_OWNER', 'ZPTW_ADMIN']).includes(role));
  const blocked = !canAct || !prerequisiteAction || permit.Status !== 'INTD' || required !== 'Y' || !permit['@odata.etag'] || busy || uncertain;
  const send = async (decision: PrerequisiteDecision) => {
    if (lock.current || blocked || !kind || (decision === 'APPROVE' && (!confirmed || dirty))) return;
    lock.current = true; setBusy(true); onBusyChange(true); setError('');
    try {
      const result = await prerequisiteApi.update(permit, { RequestId: crypto.randomUUID(), Kind: kind, Decision: decision, Comments: comments,
        ...(decision === 'SAVE' ? kind === 'ISOLATION' ? { IsolationPoints: points } : { GasTest: { ...gas, TestAt: gas.TestAt ? `${gas.TestAt}:00+05:30` : '' } } : {}) });
      onUpdated(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update prerequisite.');
      if (reason instanceof PrerequisiteUnconfirmedError) setUncertain(true);
    } finally { lock.current = false; setBusy(false); onBusyChange(false); }
  };
  const requirementLabel = (value: string) => (value === 'Y' || value === 'X') ? 'Yes' : (value === 'N' || value === ' ') ? 'No' : 'Not recorded';
  return <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
    <h3 className="font-semibold">Prerequisites · {permit.Status}</h3>
    <p className="text-sm">Isolation required: {requirementLabel(permit.IsolationRequired)} · Gas testing required: {requirementLabel(gasRequired)}</p>
    <p className="text-sm">Required checks keep the permit in INTD until SAP confirms all approvals. CRTD is ready for the next permit workflow step; it is not permission to start work.</p>
    {kind && <>
      <h4 className="font-semibold">{kind === 'ISOLATION' ? 'Isolation points and verification' : 'Gas test evidence'}</h4>
      {!prerequisiteAction && <p role="status" className="text-sm text-amber-900">Backend integration pending. You can prepare evidence below; saving and approval will be available after the SAP action is connected.</p>}
      {!canAct && <p className="text-sm">A designated module role is required to save or approve evidence.</p>}
      {permit.Status === 'INTD' && required === 'Y' && <>
        <fieldset disabled={busy || uncertain || !canAct} className="space-y-3">
          {kind === 'ISOLATION' ? <>
            {points.map((point, index) => <div key={index} className="rounded border bg-white p-3"><div className="grid gap-3 sm:grid-cols-2">
              {([['IsolationPoint', 'Isolation point'], ['IsolType', 'Isolation type'], ['IsolMethod', 'Method'], ['LockTagNo', 'Lock / tag']] as const).map(([key, label]) => <label className="text-sm" key={key}>{label}<input className={inputClass} maxLength={{ IsolationPoint: 60, IsolType: 6, IsolMethod: 10, LockTagNo: 30 }[key]} value={point[key]} onChange={event => { setDirty(true); setConfirmed(false); setPoints(rows => rows.map((row, i) => i === index ? { ...row, [key]: event.target.value } : row)); }} /></label>)}
              {([['IsIsolated', 'Physically isolated'], ['ZeroEnergyConf', 'Zero energy verified']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={point[key]} onChange={event => { setDirty(true); setConfirmed(false); setPoints(rows => rows.map((row, i) => i === index ? { ...row, [key]: event.target.checked } : row)); }} />{label}</label>)}
            </div><button type="button" className="mt-2 text-sm text-red-700" onClick={() => { setDirty(true); setConfirmed(false); setPoints(rows => rows.filter((_, i) => i !== index)); }}>Remove point</button></div>)}
            <button type="button" className="text-sm text-blue-800" onClick={() => { setDirty(true); setConfirmed(false); setPoints(rows => [...rows, blankPoint()]); }}>+ Add isolation point</button>
          </> : <div className="grid gap-3 sm:grid-cols-2">
            {([['TestAt', 'Test date and time (IST)', 'datetime-local'], ['TestLocation', 'Sample location / level', 'text'], ['MeterId', 'Calibrated meter ID', 'text'], ['PolicyRef', 'Approved gas policy reference', 'text'], ['O2Pct', 'Oxygen (% v/v)', 'number'], ['LelPct', 'Flammable gas (% LEL)', 'number'], ['CoPpm', 'Carbon monoxide (ppm)', 'number'], ['H2sPpm', 'Hydrogen sulphide (ppm)', 'number']] as const).map(([key, label, type]) => <label className="text-sm" key={key}>{label}<input className={inputClass} type={type} step={type === 'number' ? 'any' : undefined} min={type === 'number' ? 0 : undefined} maxLength={100} value={gas[key]} onChange={event => { setDirty(true); setConfirmed(false); setGas(current => ({ ...current, [key]: event.target.value })); }} /></label>)}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={gas.BumpTestOk} onChange={event => { setDirty(true); setConfirmed(false); setGas(current => ({ ...current, BumpTestOk: event.target.checked })); }} />Bump test completed successfully</label>
            <p className="text-sm text-amber-900">SAP must validate current calibration, test freshness and the approved policy limits. An entered reading alone does not clear the permit.</p>
          </div>}
          <label className="block text-sm">Comment / rejection reason *<textarea maxLength={255} className={inputClass} value={comments} onChange={event => setComments(event.target.value)} /></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={dirty} onChange={event => setConfirmed(event.target.checked)} />I reviewed the saved evidence below and confirm this prerequisite is complete. {dirty && 'Save changes before approval.'}</label>
        </fieldset>
        <div className="flex flex-wrap gap-3">{(['SAVE', 'APPROVE', 'REJECT'] as const).map(decision => <button type="button" key={decision} disabled={blocked || !comments.trim() || (decision === 'APPROVE' && (!confirmed || dirty))} onClick={() => void send(decision)} className="rounded bg-[#006398] px-4 py-2 text-sm text-white disabled:opacity-40">{decision === 'SAVE' ? 'Save evidence' : decision === 'APPROVE' ? 'Approve saved evidence' : 'Reject prerequisite'}</button>)}</div>
        {!permit['@odata.etag'] && <p className="text-sm text-amber-900">SAP must supply the current record version before changes can be saved.</p>}
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      </>}
    </>}
  </section>;
}
