import { approvalGuidance, DOCUMENT_DECISIONS, fieldsFor, LIFECYCLE, NATURE_OF_WORK, PERMIT_CATEGORIES, preparationsFor, PROCEDURE, selectedTypes, SitePlan, TOOLS } from '../../core/ptw/siteProcedure';

const input = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm';
const toggle = (values: string[], value: string) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];

export function SiteProcedureStep({ primary, plan, startTime, onChange }: { primary: string; plan: SitePlan; startTime: string; onChange: (plan: SitePlan) => void }) {
  const types = selectedTypes(primary, plan);
  return <div className="space-y-6">
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <h2 className="text-lg font-bold">Client procedure and job preparation</h2>
      <p className="mt-1 text-sm">{PROCEDURE.id} · Revision {PROCEDURE.revision} · {PROCEDURE.form}</p>
      <p className="mt-2 text-sm">Record the job plan and supporting references. Proposed people and preparation responses do not constitute verified signatures or authority to start work.</p>
    </div>
    <section>
      <h3 className="font-bold">A · Additional applicable work categories</h3>
      <p className="mb-3 text-sm text-slate-600">Select combined activities, for example hot work inside a confined space. The primary category remains in General Details.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {PERMIT_CATEGORIES.map(category => <label key={category.code} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
          <input type="checkbox" checked={types.includes(category.code)} disabled={primary === category.code}
            onChange={() => onChange({ ...plan, additionalTypes: toggle(plan.additionalTypes, category.code) })} />
          {category.label}{primary === category.code ? ' (primary)' : ''}
        </label>)}
      </div>
    </section>
    {([['nature', 'C · Nature of work', NATURE_OF_WORK], ['tools', 'D · Tools and equipment', TOOLS]] as const).map(([key, label, choices]) => <section key={key}>
      <h3 className="mb-3 font-bold">{label}</h3>
      <div className="grid gap-2 sm:grid-cols-3">{choices.map(choice => <label key={choice} className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={plan[key].includes(choice)} onChange={() => onChange({ ...plan, [key]: toggle(plan[key], choice) })} />{choice}
      </label>)}</div>
    </section>)}
    <section>
      <h3 className="font-bold">JSA, shift and proposed responsibilities</h3>
      <p className="mb-3 text-sm text-slate-600">Times use Dahej site time (IST). Initial validity is limited to eight hours or shift end, whichever is earlier. Proposed signatories must be checked against the approved permit matrix.</p>
      <div className="grid gap-4 sm:grid-cols-2">{fieldsFor(types).map(field => <label key={field.code} className="text-sm">
        {field.label}{'required' in field && field.required ? ' *' : ''}
        <input className={input} type={'datetime' in field ? 'datetime-local' : 'text'}
          maxLength={'user' in field ? 12 : 'reference' in field ? 30 : 255}
          value={plan.fields[field.code] || ''} onChange={event => onChange({ ...plan, fields: { ...plan.fields, [field.code]: event.target.value } })} />
      </label>)}</div>
      <div className="mt-4 rounded-lg bg-slate-50 p-4"><h4 className="font-semibold">Approval planning guidance</h4><ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{approvalGuidance(types, startTime).map(item => <li key={item}>{item}</li>)}</ul><p className="mt-2 text-sm text-slate-600">This guidance does not establish authorization. Confirm the current permit matrix, holidays, delegation and client clarifications.</p></div>
    </section>
    <section>
      <h3 className="font-bold">F · Job and equipment preparation</h3>
      <p className="mb-3 text-sm text-slate-600">“Reported complete” is a requester statement awaiting verification. Outstanding preparations may remain pending in a request. Explain every Not applicable selection.</p>
      <div className="space-y-3">{preparationsFor(types).map(item => {
        const check = plan.checks[item.code] || { response: '', remarks: '' };
        return <div key={item.code} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_180px_1fr]">
          <div className="text-sm font-medium">{item.label}<span className="block text-xs font-normal text-slate-500">Procedure p. {item.page}</span></div>
          <select aria-label={item.label + ' response'} className={input} value={check.response}
            onChange={event => onChange({ ...plan, checks: { ...plan.checks, [item.code]: { ...check, response: event.target.value as typeof check.response } } })}>
            <option value="">Pending assessment</option><option value="YES">Reported complete</option><option value="NO">Outstanding</option><option value="NA">Not applicable</option>
          </select>
          <input aria-label={item.label + ' evidence or reason'} className={input} placeholder="Evidence reference / reason / action" maxLength={255} value={check.remarks}
            onChange={event => onChange({ ...plan, checks: { ...plan.checks, [item.code]: { ...check, remarks: event.target.value } } })} />
        </div>;
      })}</div>
    </section>
    <ProcedureGuidance />
  </div>;
}

export function ProcedureGuidance() {
  return <div className="space-y-4">
    <section className="rounded-xl border p-4"><h3 className="mb-3 font-bold">Required permit lifecycle</h3>
      <ol className="grid gap-3 sm:grid-cols-2">{LIFECYCLE.map((stage, index) => <li key={stage.title} className="rounded-lg bg-slate-50 p-3">
        <div className="text-sm font-semibold">{index + 1}. {stage.title}</div><p className="mt-1 text-sm text-slate-600">{stage.detail}</p>
      </li>)}</ol>
      <p className="mt-3 text-sm text-slate-600">Cold / height extensions: up to seven days with unchanged conditions and daily signed JSA review. Other listed activities: the procedure specifies same-day extension with each shift revalidated. Special exceptions require documented authorization.</p>
    </section>
    <details className="rounded-xl border border-amber-200 bg-amber-50 p-4"><summary className="cursor-pointer font-semibold">Client clarifications required before field release</summary>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{DOCUMENT_DECISIONS.map(item => <li key={item}>{item}</li>)}</ul>
      <p className="mt-3 text-sm">The separate format revision DOCX is rights-managed and was not readable. This screen follows the supplied procedure and its embedded form. Current individual safety standards take precedence where the procedure states they do.</p>
    </details>
  </div>;
}
