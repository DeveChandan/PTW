import React, { useEffect, useRef, useState } from 'react';
import {
  ORDER_TYPES, WORK_CATEGORIES, WorkCategory, WorkReference, WorkSelection, WorkSource,
  permitWorkLookupApi, referenceId, validateWorkSearch,
} from '../../core/api/modules/permitWorkLookup.api';

const SOURCES: { id: WorkSource; title: string; share: string; description: string; icon: string }[] = [
  { id: 'notification', title: 'Notification', share: '85%', description: 'M2 notification · QMART · linked PM02 order', icon: 'notification_important' },
  { id: 'order', title: 'Maintenance order', share: '13%', description: 'PM01 / PM03 / PM05 / PM06 / PM07 / PM08', icon: 'build' },
  { id: 'shutdown', title: 'Shutdown', share: '2%', description: 'Planned shutdown work and turnaround activities', icon: 'event_busy' },
];

interface Props {
  selection: WorkSelection | null;
  client?: string;
  onInvalidate: () => void;
  onContinue: (selection: WorkSelection) => void;
}

function currentMonthRange(): { fromDate: string; toDate: string } {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return { fromDate: `${month}-01`, toDate: `${month}-${String(now.getDate()).padStart(2, '0')}` };
}

export const PermitWorkSelectionStep: React.FC<Props> = ({ selection, client, onInvalidate, onContinue }) => {
  const [category, setCategory] = useState<WorkCategory | ''>(selection?.category || '');
  const [source, setSource] = useState<WorkSource | null>(selection?.source || null);
  const [fromDate, setFromDate] = useState(() => selection?.fromDate || currentMonthRange().fromDate);
  const [toDate, setToDate] = useState(() => selection?.toDate || currentMonthRange().toDate);
  const [orderType, setOrderType] = useState(selection?.orderType || '');
  const [rows, setRows] = useState<WorkReference[]>(selection ? [selection.reference] : []);
  const [chosen, setChosen] = useState<WorkReference | null>(selection?.reference || null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(Boolean(selection));
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const invalidate = () => {
    request.current?.abort();
    request.current = null;
    setLoading(false);
    setChosen(null);
    setRows([]);
    setSearched(false);
    setError(null);
    onInvalidate();
  };

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    invalidate();
    if (!category || !source) { setError('Choose a work category and a reference source.'); return; }
    const criteria = { source, fromDate, toDate, orderType };
    const validation = validateWorkSearch(criteria);
    if (validation) { setError(validation); return; }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const results = await permitWorkLookupApi.search(criteria, controller.signal, client);
      if (controller.signal.aborted) return;
      setRows(results);
      setSearched(true);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load work references. Please try again.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const controlClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006398]';
  return (
    <section className="space-y-6" aria-labelledby="work-selection-title">
      <div>
        <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#006398]">Step 1 · Work selection</p>
        <h2 id="work-selection-title" className="mt-1 text-xl font-bold text-slate-900">What work is this permit for?</h2>
        <p className="mt-2 text-sm text-slate-500">Choose the maintenance category and reference, then find the work within your date range.</p>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700">Work category *</legend>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {WORK_CATEGORIES.map(item => (
            <label key={item} className={`cursor-pointer rounded-xl border p-3 text-sm ${category === item ? 'border-[#006398] bg-sky-50 text-[#006398]' : 'border-slate-200'}`}>
              <input type="radio" name="work-category" value={item} checked={category === item}
                onChange={() => { invalidate(); setCategory(item); }} className="mr-2 accent-[#006398]" />{item}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={!category} className={!category ? 'opacity-50' : ''}>
        <legend className="mb-2 text-sm font-semibold text-slate-700">Reference source *</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {SOURCES.map(item => (
            <label key={item.id} className={`cursor-pointer rounded-xl border p-4 ${source === item.id ? 'border-[#006398] bg-sky-50 ring-1 ring-[#006398]' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="material-symbols-outlined text-[#006398]" aria-hidden="true">{item.icon}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{item.share} of work</span>
              </div>
              <div className="mt-3 font-semibold text-slate-900">
                <input type="radio" name="work-source" value={item.id} checked={source === item.id}
                  onChange={() => { invalidate(); setSource(item.id); setOrderType(''); }} className="mr-2 accent-[#006398]" />{item.title}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.description}</p>
            </label>
          ))}
        </div>
      </fieldset>
      {source && category && (
        <form onSubmit={search} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium text-slate-700">From date *
              <input aria-label="From date" type="date" required value={fromDate} max={toDate || undefined}
                onChange={event => { invalidate(); setFromDate(event.target.value); }} className={controlClass} />
            </label>
            <label className="text-sm font-medium text-slate-700">To date *
              <input aria-label="To date" type="date" required value={toDate} min={fromDate || undefined}
                onChange={event => { invalidate(); setToDate(event.target.value); }} className={controlClass} />
            </label>
            {source === 'order' && <label className="text-sm font-medium text-slate-700">Order type (AUART)
              <select value={orderType} onChange={event => { invalidate(); setOrderType(event.target.value); }} className={controlClass}>
                <option value="">All listed order types</option>
                {ORDER_TYPES.map(type => <option key={type}>{type}</option>)}
              </select>
            </label>}
            <button type="submit" disabled={loading} className="rounded-lg bg-[#006398] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {loading ? 'Loading work…' : 'Find work'}
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      <div aria-live="polite" aria-busy={loading}>
        {loading && <p className="text-sm text-slate-500">Retrieving matching work references…</p>}
        {searched && !rows.length && <p className="rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">No matching work found. Change the date range or reference source and try again.</p>}
        {rows.length > 0 && source && (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold text-slate-700">Select a work reference ({rows.length})</legend>
            {rows.map((row, index) => (
              <label key={`${referenceId(source, row)}-${index}`} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${chosen === row ? 'border-[#006398] bg-sky-50' : 'border-slate-200'}`}>
                <input type="radio" name="work-reference" checked={chosen === row} onChange={() => { setChosen(row); onInvalidate(); }} className="mt-1 accent-[#006398]" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{referenceId(source, row)} · {row.JobDesc || row.Description || 'Work reference'}</span>
                  <span className="mt-1 block text-xs text-slate-500">Plant: {row.Werks || '—'} · Equipment: {row.Equnr || '—'} · Area: {row.AreaLoc || '—'}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </div>
      <div className="flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
        <p className="text-xs text-slate-500">The selected reference will fill the general permit details.</p>
        <button type="button" disabled={!chosen || !category || !source || loading}
          onClick={() => { if (chosen && category && source) onContinue({ category, source, fromDate, toDate, orderType, reference: chosen }); }}
          className="rounded-lg bg-[#006398] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
          Continue to permit details →
        </button>
      </div>
    </section>
  );
};
