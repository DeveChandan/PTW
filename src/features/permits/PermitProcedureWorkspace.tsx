import { PrerequisitePanel } from './PrerequisitePanel';
import { useEffect, useRef, useState } from 'react';
import type { ModuleId, SapUser } from '../../core/auth/sapAuthContext';
import type { PermitDeepInsertResponse, PermitInfoRecord } from '../../core/types/ptw.types';
import { sitePermitApi } from '../../core/api/modules/sitePermit.api';
import { ProcedureGuidance } from './SiteProcedureStep';
import { PERMIT_CATEGORIES, PROCEDURE } from '../../core/ptw/siteProcedure';
import { SectionCard } from '../../shared/components/SectionCard';
import { PermitDisplayWorkspace } from './PermitDisplayWorkspace';

type Collection =
  | '_Worker'
  | '_PPE'
  | '_Safety'
  | '_HazardControl'
  | '_Isolation'
  | '_GasTest'
  | '_Approval'
  | '_ShiftRenewal'
  | '_Attachment'
  | '_AuditLog';

interface SectionConfig {
  key: Collection;
  title: string;
  tag: string;
  icon: string;
  theme: 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
  columns: [string, string][];
}

const SECTIONS: SectionConfig[] = [
  {
    key: '_Safety',
    title: 'Job Plan & Preparation Checklist',
    tag: 'SECTION C–F',
    icon: 'fact_check',
    theme: 'emerald',
    columns: [
      ['ValueText', 'Requirement / Field'],
      ['Response', 'Reported Response'],
      ['Remarks', 'Details / Reason'],
      ['ReferenceNo', 'Reference'],
      ['VerifiedBy', 'Verified By'],
      ['VerifiedAt', 'Verified At']
    ]
  },
  {
    key: '_HazardControl',
    title: 'Hazards & Control Measures',
    tag: 'SECTION E',
    icon: 'warning',
    theme: 'amber',
    columns: [
      ['HazardDesc', 'Hazard Description'],
      ['RiskLevel', 'Risk Level'],
      ['ControlDesc', 'Mitigation Control'],
      ['ControlStatus', 'Status'],
      ['ResponsibleUser', 'Responsible'],
      ['VerifiedBy', 'Verified By']
    ]
  },
  {
    key: '_PPE',
    title: 'Personal Protective Equipment',
    tag: 'SECTION G',
    icon: 'health_and_safety',
    theme: 'emerald',
    columns: [
      ['PpeDesc', 'Equipment Item'],
      ['IsRequired', 'Required'],
      ['IsAvailable', 'Available'],
      ['IsIssued', 'Issued'],
      ['CheckedBy', 'Checked By']
    ]
  },
  {
    key: '_Isolation',
    title: 'Positive Isolation & LOTO Ledger',
    tag: 'SECTION H',
    icon: 'lock',
    theme: 'rose',
    columns: [
      ['IsolationPoint', 'Isolation Point / Tag'],
      ['IsolType', 'Type / Method'],
      ['LockTagNo', 'Lock / Tag #'],
      ['IsIsolated', 'Isolated'],
      ['ZeroEnergyConf', 'Zero Energy'],
      ['ZeroEnergyBy', 'Verified By'],
      ['IsNormalized', 'Restored']
    ]
  },
  {
    key: '_GasTest',
    title: 'Atmospheric Gas Testing Records',
    tag: 'SECTION I',
    icon: 'science',
    theme: 'amber',
    columns: [
      ['TestDate', 'Date'],
      ['TestTime', 'Time'],
      ['TestLocation', 'Location'],
      ['O2Pct', 'O₂ % v/v'],
      ['LelPct', '% LEL'],
      ['CoVal', 'CO ppm'],
      ['H2sVal', 'H₂S ppm'],
      ['OtherGas', 'Other Gas'],
      ['OtherVal', 'Other Val'],
      ['OtherUnit', 'Unit'],
      ['MeterId', 'Meter ID'],
      ['CalibDate', 'Calibration'],
      ['TestedBy', 'Tester'],
      ['TesterSigned', 'Signed']
    ]
  },
  {
    key: '_Approval',
    title: 'Digital Signatures & Clearances Chain',
    tag: 'SECTION J–M',
    icon: 'draw',
    theme: 'blue',
    columns: [
      ['Stage', 'Stage'],
      ['SeqNo', 'Sequence'],
      ['RoleId', 'Role ID'],
      ['Action', 'Action'],
      ['SignedBy', 'Signed By (SAP)'],
      ['ActionDate', 'Date'],
      ['ActionTime', 'Time'],
      ['Comments', 'Comments']
    ]
  },
  {
    key: '_Worker',
    title: 'Authorized Crew Roster',
    tag: 'CREW',
    icon: 'engineering',
    theme: 'indigo',
    columns: [
      ['WorkerName', 'Worker Name'],
      ['WorkerTypeCode', 'Agency'],
      ['EmpId', 'Employee ID'],
      ['ContractorName', 'Contractor Firm'],
      ['Shift', 'Shift']
    ]
  },
  {
    key: '_ShiftRenewal',
    title: 'Shift Revalidation & Renewal',
    tag: 'SECTION N.1',
    icon: 'update',
    theme: 'indigo',
    columns: [
      ['PreviousShift', 'Previous Shift'],
      ['NewShift', 'New Shift'],
      ['NewValidToD', 'Extended Date'],
      ['NewValidToT', 'Extended Time'],
      ['RequestedBy', 'Requested By'],
      ['ApprovedBy', 'Approved By'],
      ['Status', 'Status'],
      ['Reason', 'Renewal Reason']
    ]
  },
  {
    key: '_Attachment',
    title: 'Supporting Documents & P&IDs',
    tag: 'DOCS',
    icon: 'attach_file',
    theme: 'slate',
    columns: [
      ['FileName', 'Document Name'],
      ['DocumentRef', 'Reference Number'],
      ['UploadedBy', 'Uploaded By'],
      ['UploadedAt', 'Uploaded At']
    ]
  },
  {
    key: '_AuditLog',
    title: 'Lifecycle & Closure Audit Trail',
    tag: 'SECTION N.2',
    icon: 'history',
    theme: 'slate',
    columns: [
      ['Action', 'Action'],
      ['OldStatus', 'From Status'],
      ['NewStatus', 'To Status'],
      ['Actor', 'SAP Actor'],
      ['EventAt', 'Timestamp'],
      ['Comments', 'Audit Comments']
    ]
  }
];

const moduleTitle: Partial<Record<ModuleId, string>> = {
  'permit-details': 'Permit Record & Dossier',
  'permit-approver': 'Approver Clearances & Review',
  'permit-issuer': 'Issuer Field Inspection & Handover',
  'permit-holder': 'Work Execution & Holder Review',
  'gas-tester': 'Gas Testing Clearances',
  isolation: 'Isolation & LOTO Review',
  'create-isolation': 'Isolation Certificate Preparation',
  'display-isolation': 'Isolation Master Register'
};

const firstSection: Partial<Record<ModuleId, Collection>> = {
  'permit-approver': '_Approval',
  'permit-issuer': '_Safety',
  'permit-holder': '_Worker',
  'gas-tester': '_GasTest',
  isolation: '_Isolation',
  'create-isolation': '_Isolation',
  'display-isolation': '_Isolation'
};

export function PermitProcedureWorkspace({
  module,
  user,
  onBack
}: {
  module: ModuleId;
  user: SapUser | null;
  onBack: () => void;
}) {
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
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    setPermit(null);
    if (!number) {
      setPermits([]);
      setHasSearched(true);
    }
    try {
      if (number) {
        const data = await sitePermitApi.read(number, controller.signal);
        if (!controller.signal.aborted) setPermit(data);
      } else {
        const data = await sitePermitApi.list(plant, search, skip, controller.signal);
        if (!controller.signal.aborted) {
          setPermits(data);
          setOffset(skip);
        }
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : 'Unable to load SAP permit records.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const section = SECTIONS.find((item) => item.key === active)!;
  const rows =
    active === '_Isolation'
      ? permit?._Isolation?.flatMap((certificate) =>
          (certificate._Item || []).map((point) => ({
            ...point,
            IsolationNo: certificate.IsolationNo,
            CertificateStatus: certificate.Status
          }))
        )
      : permit?.[active];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 font-sans">
      {/* 1. Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="mb-2.5 flex items-center gap-2.5">
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#006398]/10 text-[#006398]">
              <span className="material-symbols-outlined text-[24px]">verified</span>
            </span>
            <span>{moduleTitle[module] || 'PTW Review'}</span>
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-mono">
            Procedure {PROCEDURE.id} · Rev {PROCEDURE.revision} · SAP NetWeaver OData V4 Records
          </p>
        </div>
      </header>

      {/* 2. Notice Alert Strip */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-xs sm:text-sm text-slate-700 flex items-start gap-3 shadow-xs">
        <span className="material-symbols-outlined text-[20px] text-[#006398] shrink-0 mt-0.5">info</span>
        <div>
          <strong className="text-slate-900 font-semibold block mb-0.5">
            SAP Workflow Evidence Review
          </strong>
          <p className="leading-relaxed">
            Review saved permit evidence here. Signing, issue, revalidation, suspension, and closure
            actions require verified SAP authorization roles. This view cannot authorize or restart
            work without prerequisite sign-offs.
          </p>
        </div>
      </div>

      {/* 3. Search Form SectionCard */}
      <SectionCard
        theme="blue"
        sectionTag="SEARCH"
        title="Search & Live SAP Query"
        subtitle="Lookup permit records by plant code, permit number, or equipment description."
        icon="search"
      >
        <form
          className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
          onSubmit={(event) => {
            event.preventDefault();
            if (!updating) void load();
          }}
        >
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Plant (Werks)</label>
            <input
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:outline-none focus:border-[#006398]"
              value={plant}
              maxLength={4}
              placeholder="e.g. 1000"
              onChange={(event) => setPlant(event.target.value.toUpperCase())}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-slate-600 font-semibold mb-1">
              Permit Number or Scope / Description
            </label>
            <input
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-sans text-xs focus:bg-white focus:outline-none focus:border-[#006398]"
              value={search}
              placeholder="Search by permit #, job scope, equipment..."
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading || updating}
              className="w-full py-2 bg-[#006398] hover:bg-[#004e78] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">search</span>
              )}
              <span>Search SAP</span>
            </button>
          </div>
        </form>
      </SectionCard>

      {/* Global Error Banner */}
      {error && (
        <div role="alert" className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-xs sm:text-sm text-rose-800 flex items-start gap-2.5 shadow-xs">
          <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0">error</span>
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div role="status" className="p-8 text-center text-xs font-mono text-slate-500 flex flex-col items-center justify-center gap-2">
          <span className="material-symbols-outlined animate-spin text-[24px] text-[#006398]">progress_activity</span>
          <span>Loading SAP evidence from gateway...</span>
        </div>
      )}

      {/* 4. Results List View */}
      {!permit && !loading && (
        <SectionCard
          theme="slate"
          sectionTag="RESULTS"
          title="Matching SAP Permits"
          subtitle="Select any permit number to load deep evidence collections."
          icon="table_chart"
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#006398]/10 text-[#006398] border border-[#006398]/20">
              {permits.length} Records
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[11px]">
                  {['Permit #', 'Type', 'Job Description', 'Plant / Area', 'Status', 'Valid Until (IST)', 'Action'].map(
                    (label) => (
                      <th className="p-3" key={label}>
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {permits.map((item) => (
                  <tr key={item.Permit_No} className="hover:bg-sky-50/50 transition-colors">
                    <td className="p-3 font-mono font-bold text-[#006398]">
                      <button
                        type="button"
                        className="hover:underline flex items-center gap-1"
                        onClick={() => void load(item.Permit_No)}
                      >
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        <span>{item.Permit_No}</span>
                      </button>
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-700">{item.PermitType}</td>
                    <td className="p-3 font-medium text-slate-900 max-w-xs truncate">{item.JobDesc}</td>
                    <td className="p-3 font-mono text-slate-600">
                      {item.Werks} / {item.AreaLoc || '—'}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {item.Status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                      {item.ValidToD} {item.ValidToT}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => void load(item.Permit_No)}
                        className="px-2.5 py-1 bg-[#006398] hover:bg-[#004e78] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1"
                      >
                        <span>Review</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!permits.length && (
            <p className="p-8 text-center text-xs text-slate-500 font-mono">
              {hasSearched ? 'No matching permits returned by SAP.' : 'Search to load current permit records.'}
            </p>
          )}

          {hasSearched && permits.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-mono">
              <span className="text-slate-500">Page {Math.floor(offset / 25) + 1}</span>
              <div className="flex gap-2">
                <button
                  disabled={offset === 0}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  onClick={() => void load(undefined, Math.max(0, offset - 25))}
                >
                  Previous
                </button>
                <button
                  disabled={permits.length < 25}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  onClick={() => void load(undefined, offset + 25)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* 5. Deep Detail Inspection Section */}
      {permit && (
        <div className="space-y-6">
          {/* Dossier Header Card */}
          <SectionCard
            theme="indigo"
            sectionTag="DOSSIER"
            title={`Permit ${permit.Permit_No}`}
            subtitle={permit.JobDesc}
            icon="description"
            badge={
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                  Status: {permit.Status}
                </span>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => setPermit(null)}
                  className="px-3 py-1 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                  <span>Back to Results</span>
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <button
                  type="button"
                  disabled={updating}
                  className="text-xs text-[#006398] hover:underline font-semibold flex items-center gap-1 disabled:opacity-40"
                  onClick={() => void load(permit.Permit_No)}
                >
                  <span className="material-symbols-outlined text-[15px]">refresh</span>
                  <span>Reload SAP Evidence</span>
                </button>
              </div>

              {/* Master Data Grid */}
              <dl className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                {[
                  ['Category', PERMIT_CATEGORIES.find((item) => item.code === permit.PermitType || item.sapCode === permit.PermitType)?.label || permit.PermitType],
                  ['Plant / Area', `${permit.Werks} / ${permit.AreaLoc || '—'}`],
                  ['Equipment (Equnr)', permit.Equnr || 'Not linked'],
                  ['SAP Reference', permit.Qmnum ? `Notif #${permit.Qmnum}` : permit.Aufnr ? `MO #${permit.Aufnr}` : '—'],
                  ['Valid From (IST)', `${permit.ValidFromD || ''} ${permit.ValidFromT}`],
                  ['Valid To (IST)', `${permit.ValidToD || ''} ${permit.ValidToT}`],
                  ['Execution Dept', permit.ExecDept || '—'],
                  ['Suspension Reason', permit.SuspendReason || 'None'],
                  ['Cancellation Reason', permit.CancelReason || 'None']
                ].map(([label, value]) => (
                  <div key={label} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <dt className="text-slate-400 font-mono text-[10px]">{label}</dt>
                    <dd className="font-bold text-slate-800 mt-0.5">{value}</dd>
                  </div>
                ))}
              </dl>

              {/* Embedded Prerequisite Actions */}
              <div className="pt-3 border-t border-slate-100">
                <PrerequisitePanel
                  key={permit.Permit_No}
                  permit={permit}
                  module={module}
                  user={user}
                  onBusyChange={setUpdating}
                  onUpdated={(updated) =>
                    setPermit((current) =>
                      current?.Permit_No === updated.Permit_No &&
                      current?.['@odata.etag'] === permit['@odata.etag']
                        ? updated
                        : current
                    )
                  }
                />
              </div>
            </div>
          </SectionCard>

          {/* Evidence Collections Tab Navigation */}
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1" aria-label="Permit evidence sections">
            {SECTIONS.map((item) => (
              <button
                type="button"
                aria-pressed={active === item.key}
                key={item.key}
                onClick={() => setActive(item.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
                  active === item.key
                    ? 'bg-[#006398] text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
                <span>{item.title}</span>
              </button>
            ))}
          </div>

          {/* Active Evidence Section */}
          <SectionCard
            theme={section.theme}
            sectionTag={section.tag}
            title={section.title}
            subtitle={`Entity Collection: ${section.key}`}
            icon={section.icon}
          >
            {active === '_GasTest' && (
              <p className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                Gas results are displayed as recorded. HSE must reconcile the source gas limits before
                automatic clearance is enabled. Confirm the approved units for CO and H2S.
              </p>
            )}
            {active === '_Safety' && (
              <p className="mb-4 p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 leading-relaxed">
                PTW planning rows contain proposed values. NA on descriptive fields means no checklist
                response applies; it is not a safety exemption. YES on preparation checks is
                requester-reported, not a verified signature.
              </p>
            )}
            {active === '_Worker' && (
              <p className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 leading-relaxed">
                The crew register does not prove toolbox attendance or confined-space entry / exit.
                Those signed records must be verified separately.
              </p>
            )}

            {rows === undefined ? (
              <p className="p-6 text-center text-xs text-amber-800 font-mono">
                SAP did not include this evidence collection; its status is unknown.
              </p>
            ) : !Array.isArray(rows) ? (
              <p className="p-6 text-center text-xs text-rose-800 font-mono">
                SAP returned an unsupported evidence format.
              </p>
            ) : rows.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-6 text-center text-xs text-slate-400 font-mono">
                No records returned for this section.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[11px]">
                      {section.columns.map(([key, label]) => (
                        <th className="whitespace-nowrap p-3" key={key}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {rows.map((record, index) => (
                      <tr key={index} className="hover:bg-slate-50/60">
                        {section.columns.map(([key]) => (
                          <td className="min-w-[100px] p-3 align-top" key={key}>
                            {String((record as unknown as Record<string, unknown>)[key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* 6. Procedure Guidance */}
      <ProcedureGuidance />
    </div>
  );
}
