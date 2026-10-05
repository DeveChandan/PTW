import { PrerequisitePanel } from './PrerequisitePanel';
import { useEffect, useRef, useState } from 'react';
import type { ModuleId, SapUser } from '../../core/auth/sapAuthContext';
import type { PermitDeepInsertResponse, PermitInfoRecord } from '../../core/types/ptw.types';
import { sitePermitApi } from '../../core/api/modules/sitePermit.api';
import { ProcedureGuidance } from './SiteProcedureStep';
import { PERMIT_CATEGORIES, PROCEDURE } from '../../core/ptw/siteProcedure';

type Collection = '_Worker' | '_PPE' | '_Safety' | '_HazardControl' | '_Isolation' | '_GasTest' | '_Approval' | '_ShiftRenewal' | '_Attachment' | '_AuditLog';
const SECTIONS: { key: Collection; title: string; columns: [string, string][] }[] = [
  { key: '_Safety', title: 'C–F · Job plan and preparation', columns: [['ValueText', 'Requirement / field'], ['Response', 'Reported response'], ['Remarks', 'Details / reason'], ['ReferenceNo', 'Reference'], ['VerifiedBy', 'Verified by'], ['VerifiedAt', 'Verified at']] },
  { key: '_HazardControl', title: 'E · Hazards and controls', columns: [['HazardDesc', 'Hazard'], ['RiskLevel', 'Risk'], ['ControlDesc', 'Control'], ['ControlStatus', 'Status'], ['ResponsibleUser', 'Responsible'], ['VerifiedBy', 'Verified by']] },
  { key: '_PPE', title: 'G · PPE and protection', columns: [['PpeDesc', 'Equipment'], ['IsRequired', 'Required'], ['IsAvailable', 'Available'], ['IsIssued', 'Issued'], ['CheckedBy', 'Checked by']] },
  { key: '_Isolation', title: 'H · Isolation evidence', columns: [['IsolationPoint', 'Point'], ['IsolType', 'Type'], ['LockTagNo', 'Lock / tag'], ['IsIsolated', 'Isolated'], ['ZeroEnergyConf', 'Zero energy'], ['ZeroEnergyBy', 'Verified by'], ['IsNormalized', 'Restored']] },
  { key: '_GasTest', title: 'I · Gas test record', columns: [['TestDate', 'Date'], ['TestTime', 'Time'], ['TestLocation', 'Location'], ['O2Pct', 'O2 % v/v'], ['LelPct', '% LEL'], ['CoVal', 'CO'], ['H2sVal', 'H2S'], ['OtherGas', 'Other gas'], ['OtherVal', 'Other value'], ['OtherUnit', 'Other unit'], ['MeterId', 'Meter'], ['CalibDate', 'Calibration'], ['TestedBy', 'Tester'], ['TesterSigned', 'Signed']] },
  { key: '_Approval', title: 'J–M · Signatures and approvals', columns: [['Stage', 'Stage'], ['SeqNo', 'Sequence'], ['RoleId', 'Role'], ['Action', 'Action'], ['SignedBy', 'Signed by'], ['ActionDate', 'Date'], ['ActionTime', 'Time'], ['Comments', 'Comments']] },
  { key: '_Worker', title: 'Crew register', columns: [['WorkerName', 'Worker'], ['WorkerTypeCode', 'Agency'], ['EmpId', 'Employee ID'], ['ContractorName', 'Contractor'], ['Shift', 'Shift']] },
  { key: '_ShiftRenewal', title: 'Revalidation and renewal', columns: [['PreviousShift', 'Previous shift'], ['NewShift', 'New shift'], ['NewValidToD', 'New end date'], ['NewValidToT', 'New end time'], ['RequestedBy', 'Requested by'], ['ApprovedBy', 'Approved by'], ['Status', 'Status'], ['Reason', 'Reason']] },
  { key: '_Attachment', title: 'Supporting documents', columns: [['FileName', 'Document'], ['DocumentRef', 'Reference'], ['UploadedBy', 'Uploaded by'], ['UploadedAt', 'Uploaded at']] },
  { key: '_AuditLog', title: 'N · Lifecycle and closure audit', columns: [['Action', 'Action'], ['OldStatus', 'From'], ['NewStatus', 'To'], ['Actor', 'Actor'], ['EventAt', 'Time'], ['Comments', 'Reason / comments']] },
];
const moduleTitle: Partial<Record<ModuleId, string>> = { 'permit-details': 'Permit record', 'permit-approver': 'Approval review', 'permit-issuer': 'Issuer review', 'permit-holder': 'Work execution review', 'gas-tester': 'Gas testing review', isolation: 'Isolation review', 'create-isolation': 'Isolation preparation', 'display-isolation': 'Isolation review' };
const firstSection: Partial<Record<ModuleId, Collection>> = { 'permit-approver': '_Approval', 'permit-issuer': '_Safety', 'permit-holder': '_Worker', 'gas-tester': '_GasTest', isolation: '_Isolation', 'create-isolation': '_Isolation', 'display-isolation': '_Isolation' };

import { PermitDisplayWorkspace } from './PermitDisplayWorkspace';

export function PermitProcedureWorkspace({ module, user, onBack }: { module: ModuleId; user: SapUser | null; onBack: () => void }) {
  if (module === 'permit-details') {
    return <PermitDisplayWorkspace user={user} onBack={onBack} />;
  }
  const [plant, setPlant] = useState(user?.plant || '');
  const [search, setSearch] = useState('');
  const [permits, setPermits] = useState<PermitInfoRecord[]>([]);
  const [permit, setPermit] = useState<PermitDeepInsertResponse | null>(null);
  const [active, setActive] = useState<Collection>(firstSection[module] || '_Safety');
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [offset, setOffset] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const load = async (number?: string, skip = 0) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(''); setPermit(null);
    if (!number) { setPermits([]); setHasSearched(true); }
    try {
      if (number) {
        const data = await sitePermitApi.read(number, controller.signal);
        if (!controller.signal.aborted) setPermit(data);
      } else {
        const data = await sitePermitApi.list(plant, search, skip, controller.signal);
        if (!controller.signal.aborted) { setPermits(data); setOffset(skip); }
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load SAP permit records.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  };
  const section = SECTIONS.find(item => item.key === active)!;
  const rows = active === '_Isolation' ? permit?._Isolation?.flatMap(certificate => (certificate._Item || []).map(point => ({ ...point, IsolationNo: certificate.IsolationNo, CertificateStatus: certificate.Status }))) : permit?.[active];
  return <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
    <header className="flex items-center justify-between gap-4 border-b pb-4">
      <div>
        <div className="mb-3 flex items-center gap-2.5">
          <button
            type="button"
            disabled={updating}
            onClick={onBack}
            className="group inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all duration-200 hover:border-[#006398] hover:bg-slate-50 hover:text-[#006398] hover:shadow-sm active:scale-[0.98] disabled:opacity-50"
            title="Return to Launchpad"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors duration-200 group-hover:bg-[#006398]/10 group-hover:text-[#006398]">
              <span className="material-symbols-outlined text-[15px] transition-transform duration-200 group-hover:-translate-x-0.5">
                arrow_back
              </span>
            </span>
            <span>Return to Launchpad</span>
          </button>
          <span className="text-slate-300 font-light">/</span>
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <span>PTW Suite</span>
            <span>/</span>
            <span className="font-semibold text-slate-600">{moduleTitle[module] || 'PTW Review'}</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{moduleTitle[module] || 'PTW review'}</h1>
        <p className="mt-1 text-xs text-slate-500 font-mono">{PROCEDURE.id} · Rev {PROCEDURE.revision} · SAP records</p>
      </div>
    </header>
    <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">Review saved permit evidence here. Signing, issue, revalidation, suspension and closure actions require the SAP workflow integration. This view cannot authorize or restart work.</p>
    <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4" onSubmit={event => { event.preventDefault(); if (!updating) void load(); }}>
      <label className="text-sm">Plant<input className="mt-1 block rounded-lg border p-2" value={plant} maxLength={4} onChange={event => setPlant(event.target.value)} /></label>
      <label className="flex-1 text-sm">Permit number or job description<input className="mt-1 block w-full min-w-[200px] rounded-lg border p-2" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <button type="submit" disabled={loading || updating} className="rounded-lg bg-[#006398] px-4 py-2 text-white disabled:opacity-50">Search SAP permits</button>
    </form>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading && <p role="status">Loading SAP evidence…</p>}
    {!permit && !loading && <section className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{['Permit', 'Type', 'Job', 'Plant / area', 'Status', 'Valid until (IST)'].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead>
        <tbody>{permits.map(item => <tr key={item.Permit_No} className="border-t"><td className="p-3"><button type="button" className="font-semibold text-blue-700 underline" onClick={() => void load(item.Permit_No)}>{item.Permit_No}</button></td><td className="p-3">{item.PermitType}</td><td className="p-3">{item.JobDesc}</td><td className="p-3">{item.Werks} / {item.AreaLoc}</td><td className="p-3">{item.Status}</td><td className="p-3">{item.ValidToD} {item.ValidToT}</td></tr>)}</tbody>
      </table>
      {!permits.length && <p className="p-6 text-sm text-slate-500">{hasSearched ? 'No matching permits returned by SAP.' : 'Search to load current permit records.'}</p>}
      {hasSearched && <div className="flex justify-end gap-3 border-t p-3"><button disabled={offset === 0} className="disabled:opacity-40" onClick={() => void load(undefined, Math.max(0, offset - 25))}>Previous</button><span className="text-sm">Page {offset / 25 + 1}</span><button disabled={permits.length < 25} className="disabled:opacity-40" onClick={() => void load(undefined, offset + 25)}>Next</button></div>}
    </section>}
    {permit && <section className="space-y-4 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-bold">Permit {permit.Permit_No} · {permit.Status}</h2><button className="text-sm text-blue-700" disabled={updating} onClick={() => setPermit(null)}>Back to results</button></div>
      <p>{permit.JobDesc}</p>
      <button type="button" disabled={updating} className="text-sm text-blue-700 disabled:opacity-40" onClick={() => void load(permit.Permit_No)}>Reload current SAP evidence (discards unsaved edits)</button>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">{[
        ['Category', PERMIT_CATEGORIES.find(item => item.code === permit.PermitType)?.label || permit.PermitType],
        ['Plant / area', `${permit.Werks} / ${permit.AreaLoc}`], ['Equipment', permit.Equnr],
        ['SAP reference', permit.Qmnum || permit.Aufnr], ['From (IST)', `${permit.ValidFromD || ''} ${permit.ValidFromT}`], ['To (IST)', `${permit.ValidToD || ''} ${permit.ValidToT}`],
        ['Execution department', permit.ExecDept], ['Suspension reason', permit.SuspendReason], ['Cancellation reason', permit.CancelReason],
      ].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>
      <PrerequisitePanel key={permit.Permit_No} permit={permit} module={module} user={user} onBusyChange={setUpdating} onUpdated={updated => setPermit(current => current?.Permit_No === updated.Permit_No && current?.['@odata.etag'] === permit['@odata.etag'] ? updated : current)} />
      <div className="flex flex-wrap gap-2" aria-label="Permit evidence sections">{SECTIONS.map(item => <button type="button" aria-pressed={active === item.key} key={item.key} onClick={() => setActive(item.key)} className={`rounded-lg border px-3 py-2 text-xs ${active === item.key ? 'bg-[#006398] text-white' : 'bg-slate-50'}`}>{item.title}</button>)}</div>
      <h3 className="font-semibold">{section.title}</h3>
      {active === '_GasTest' && <p className="text-sm text-amber-800">Gas results are displayed as recorded. HSE must reconcile the source gas limits before automatic clearance is enabled. Confirm the approved units for CO and H2S.</p>}
      {active === '_Safety' && <p className="text-sm text-slate-600">PTW planning rows contain proposed values. NA on descriptive fields means no checklist response applies; it is not a safety exemption. YES on preparation checks is requester-reported, not a verified signature.</p>}
      {active === '_Worker' && <p className="text-sm text-slate-600">The crew register does not prove toolbox attendance or confined-space entry / exit. Those signed records must be verified separately.</p>}
      {rows === undefined ? <p className="text-sm text-amber-800">SAP did not include this evidence collection; its status is unknown.</p> : !Array.isArray(rows) ? <p className="text-sm text-red-800">SAP returned an unsupported evidence format.</p> : rows.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm">No records returned for this section.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{section.columns.map(([key, label]) => <th className="whitespace-nowrap border-b bg-slate-50 p-3" key={key}>{label}</th>)}</tr></thead><tbody>{rows.map((record, index) => <tr key={index}>{section.columns.map(([key]) => <td className="min-w-[100px] border-b p-3 align-top" key={key}>{String((record as unknown as Record<string, unknown>)[key] ?? '—')}</td>)}</tr>)}</tbody></table></div>}
    </section>}
    <ProcedureGuidance />
  </div>;
}
