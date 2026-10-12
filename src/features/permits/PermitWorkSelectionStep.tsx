import React, { useEffect, useRef, useState } from 'react';
import {
  WORK_CATEGORIES,
  WorkCategory,
  WorkReference,
  WorkSelection,
  WorkSource,
  availableSources,
  availableOrderTypes,
  permitWorkLookupApi,
  referenceId,
  referenceKey,
  validateWorkSearch
} from '../../core/api/modules/permitWorkLookup.api';
import { SectionCard } from '../../shared/components/SectionCard';
import { toast } from '../../shared/context/ToastContext';

const SOURCES: { id: WorkSource; title: string; share: string; description: string; icon: string }[] = [
  {
    id: 'notification',
    title: 'Maintenance Notification',
    share: '85% of work',
    description: 'M2 · Corrective maintenance notifications created by plant operations',
    icon: 'notification_important'
  },
  {
    id: 'order',
    title: 'Maintenance Order',
    share: '13% of work',
    description: 'PM01 / PM03 / PM05 / PM06 / PM07 / PM08 scheduled maintenance orders',
    icon: 'build'
  },
  {
    id: 'shutdown',
    title: 'Planned Shutdown',
    share: '2% of work',
    description: 'PM03 · Major overhaul and planned shutdown maintenance orders',
    icon: 'event_busy'
  }
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
    if (!category || !source) {
      const msg = 'Choose a work category and a reference source.';
      setError(msg);
      toast.warning(msg, { title: 'Mandatory Field Missing' });
      return;
    }
    const criteria = { category, source, fromDate, toDate, orderType };
    const validation = validateWorkSearch(criteria);
    if (validation) {
      setError(validation);
      toast.warning(validation, { title: 'Search Validation' });
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const results = await permitWorkLookupApi.search(criteria, controller.signal, client);
      if (controller.signal.aborted) return;
      setRows(results);
      setSearched(true);
      if (results.length === 0) {
        toast.info('No matching work orders or notifications found for the selected criteria.');
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        const msg = reason instanceof Error ? reason.message : 'Could not load work references. Please try again.';
        setError(msg);
        toast.error(msg, { title: 'SAP Lookup Failed' });
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="work-selection-title">
      {/* Step Header Context Banner */}
      <div className="ptw-card p-3 sm:p-4 bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-white border-blue-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#006398] text-white flex items-center justify-center shrink-0 shadow-2xs">
              <span className="material-symbols-outlined text-[20px] sm:text-[22px]">search_insights</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-[#006398]/10 text-[#006398] border border-[#006398]/20">
                  STEP 1
                </span>
                <h2 id="work-selection-title" className="font-display font-bold text-sm sm:text-base text-slate-900 tracking-tight">
                  Work Selection & SAP Reference Linkage
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 font-sans leading-relaxed max-w-3xl">
                Choose the maintenance category and reference source, then query SAP to retrieve active work orders or corrective notifications.
              </p>
            </div>
          </div>
          {chosen && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold shrink-0">
              <span className="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
              <span>Linked: {source ? referenceId(source, chosen) : 'Ready'}</span>
            </div>
          )}
        </div>
      </div>

      {/* 1. Work Category Selection Card */}
      <SectionCard
        theme="blue"
        sectionTag="STEP 1.1"
        title="Maintenance Work Category"
        subtitle="Select the primary maintenance discipline for this permit request."
        icon="category"
        badge={
          category ? (
            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-blue-100 text-[#006398]">
              {category} ✓
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              Required *
            </span>
          )
        }
      >
        <fieldset>
          <legend className="sr-only">Work category</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {WORK_CATEGORIES.filter((item) => item !== 'Predictive').map((item) => {
              const isSelected = category === item;

              return (
                <label
                  key={item}
                  className={`flex flex-col justify-between p-2.5 sm:p-3 rounded-xl border text-xs font-semibold transition-all select-none cursor-pointer hover:border-slate-300 hover:-translate-y-0.5 ${
                    isSelected
                      ? 'border-[#006398] bg-gradient-to-br from-sky-50 via-white to-sky-100/60 text-[#006398] ring-2 ring-[#006398]/20 shadow-[0_4px_12px_rgba(0,99,152,0.12),inset_0_1px_0_rgba(255,255,255,1)] -translate-y-0.5'
                      : 'border-slate-200/80 bg-gradient-to-b from-white to-slate-50/70 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_3px_rgba(15,23,42,0.03)] hover:shadow-card'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[9px] font-bold text-slate-400">
                      ACTIVE
                    </span>
                    <input
                      type="radio"
                      name="work-category"
                      value={item}
                      checked={isSelected}
                      onChange={() => {
                        invalidate();
                        setCategory(item);
                        setOrderType('');
                        const sources = availableSources(item);
                        setSource(sources.length === 1 ? sources[0] : null);
                      }}
                      className="accent-[#006398] cursor-pointer"
                    />
                  </div>
                  <span className="font-display font-bold text-xs truncate">{item}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </SectionCard>

      {/* 2. Reference Source Selection Card */}
      <SectionCard
        theme="indigo"
        sectionTag="STEP 1.2"
        title="Reference Document Source"
        subtitle="Select whether work originates from a corrective notification, maintenance order, or planned shutdown."
        icon="source"
        badge={
          source ? (
            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase">
              {source} ✓
            </span>
          ) : !category ? (
            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-slate-100 text-slate-600">
              Select category first
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              Required * (Select source)
            </span>
          )
        }
      >
        <fieldset disabled={!category} className={!category ? 'opacity-50' : ''}>
          <legend className="sr-only">Reference source</legend>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {SOURCES.map((item) => {
              const isSourceAllowed = category && availableSources(category).includes(item.id);
              const isSelected = source === item.id;

              return (
                <label
                  key={item.id}
                  className={`p-3 sm:p-3.5 rounded-xl border transition-all select-none flex flex-col justify-between ${
                    !isSourceAllowed
                      ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200'
                      : 'cursor-pointer hover:border-slate-300 hover:-translate-y-0.5'
                  } ${
                    isSelected
                      ? 'border-[#006398] bg-gradient-to-br from-sky-50 via-white to-sky-100/60 ring-2 ring-[#006398]/20 shadow-[0_4px_12px_rgba(0,99,152,0.12),inset_0_1px_0_rgba(255,255,255,1)] -translate-y-0.5'
                      : 'border-slate-200/80 bg-gradient-to-b from-white to-slate-50/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_3px_rgba(15,23,42,0.03)] hover:shadow-card'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#006398]">
                        <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.2 font-mono text-[9px] font-bold text-slate-600">
                        {item.share}
                      </span>
                    </div>
                    <div className="font-display font-bold text-xs sm:text-sm text-slate-900 flex items-center justify-between">
                      <span>{item.title}</span>
                      <input
                        type="radio"
                        name="work-source"
                        value={item.id}
                        checked={isSelected}
                        disabled={!isSourceAllowed}
                        onChange={() => {
                          invalidate();
                          setSource(item.id);
                          setOrderType('');
                        }}
                        className="accent-[#006398] cursor-pointer"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-normal font-sans">
                      {item.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>
      </SectionCard>

      {/* 3. Search Date Range & Criteria */}
      {source && category && (
        <SectionCard
          theme="emerald"
          sectionTag="STEP 1.3"
          title="Search Filters & Date Range"
          subtitle="Specify maintenance dates to search matching SAP records."
          icon="calendar_month"
        >
          <form onSubmit={search}>
            <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="ptw-label">
                  From date <span className="text-red-500">*</span>
                </label>
                <input
                  aria-label="From date"
                  type="date"
                  required
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(event) => {
                    invalidate();
                    setFromDate(event.target.value);
                  }}
                  className="ptw-input font-mono"
                />
              </div>

              <div>
                <label className="ptw-label">
                  To date <span className="text-red-500">*</span>
                </label>
                <input
                  aria-label="To date"
                  type="date"
                  required
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => {
                    invalidate();
                    setToDate(event.target.value);
                  }}
                  className="ptw-input font-mono"
                />
              </div>

              {source === 'order' && (
                <div>
                  <label className="ptw-label">Order type (AUART)</label>
                  <select
                    value={orderType}
                    onChange={(event) => {
                      invalidate();
                      setOrderType(event.target.value);
                    }}
                    className="ptw-select font-mono"
                  >
                    <option value="">All matching order types</option>
                    {availableOrderTypes(category).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[42px] px-4 rounded-xl bg-[#006398] hover:bg-[#004f7a] text-white text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>
                    {loading ? 'progress_activity' : 'search'}
                  </span>
                  <span>{loading ? 'Querying SAP...' : 'Find Work References'}</span>
                </button>
              </div>
            </div>
          </form>
        </SectionCard>
      )}

      {/* Error Banner */}
      {error && (
        <div role="alert" className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 text-xs sm:text-sm text-rose-800 flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[20px] text-rose-600 shrink-0">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* 4. Results List Card */}
      <div aria-live="polite" aria-busy={loading}>
        {loading && (
          <div className="ptw-card p-8 text-center text-slate-500">
            <span className="material-symbols-outlined text-[32px] text-[#006398] animate-spin mb-2">
              progress_activity
            </span>
            <p className="text-xs font-semibold text-slate-700">Retrieving matching work references from SAP...</p>
          </div>
        )}

        {searched && !rows.length && !loading && (
          <div className="ptw-card p-8 text-center text-slate-500">
            <span className="material-symbols-outlined text-[36px] text-slate-400 mb-2">inventory_2</span>
            <p className="text-sm font-bold text-slate-700">No matching work found</p>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              No SAP orders or notifications match the selected dates and category. Try widening your date range.
            </p>
          </div>
        )}

        {rows.length > 0 && source && (
          <SectionCard
            theme="amber"
            sectionTag="STEP 1.4"
            title={`Matching Work References (${rows.length})`}
            subtitle="Click on a row to select and bind it to this permit request."
            icon="checklist"
          >
            <fieldset className="space-y-2.5">
              <legend className="sr-only">Select a work reference</legend>
              {rows.map((row) => {
                const isChosen = chosen === row;
                return (
                  <label
                    key={referenceKey(row)}
                    className={`flex cursor-pointer items-start gap-3.5 p-4 rounded-xl border transition-all ${
                      isChosen
                        ? 'border-[#006398] bg-sky-50/70 ring-1 ring-[#006398]/30 shadow-xs'
                        : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="work-reference"
                      checked={isChosen}
                      onChange={() => {
                        setChosen(row);
                        onInvalidate();
                      }}
                      className="mt-1 accent-[#006398] cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {referenceId(source, row)}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-900">
                          {row.JobDescription || 'Maintenance Work Reference'}
                        </span>
                        {isChosen && (
                          <span className="px-2 py-0.2 rounded-full font-mono text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500 flex-wrap font-sans">
                        <span>Source: <strong className="text-slate-700">{row.ReferenceSource}</strong></span>
                        <span>·</span>
                        <span>Type: <strong className="text-slate-700">{row.OrderNotifType}</strong></span>
                        <span>·</span>
                        <span>Category: <strong className="text-slate-700">{row.WorkCategory}</strong></span>
                        <span>·</span>
                        <span>Date: <strong className="text-slate-700">{row.WorkDate || 'No date'}</strong></span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 font-mono text-[11px] text-slate-500 flex-wrap">
                        <span>Plant: <strong className="text-slate-700">{row.Plant || '—'}</strong></span>
                        <span>·</span>
                        <span>Equipment: <strong className="text-slate-700">{row.EquipmentTag || '—'}</strong></span>
                        <span>·</span>
                        <span>Location: <strong className="text-slate-700">{row.FunctionalLocation || '—'}</strong></span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </fieldset>
          </SectionCard>
        )}
      </div>

      {/* Action Footer */}
      <div className="ptw-card p-4 bg-slate-50/80 border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-slate-500 font-sans text-center sm:text-left">
          The selected reference will automatically populate Plant, Equipment, Functional Location, and Scope.
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            if (!category || !source) {
              toast.warning('Please select a work category and reference source.', { title: 'Mandatory Field Missing' });
              return;
            }
            if (!chosen) {
              toast.warning('Please search and select a work order or notification reference before continuing.', { title: 'Selection Required' });
              return;
            }
            onContinue({ category, source, fromDate, toDate, orderType, reference: chosen });
          }}
          className={`w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#006398] hover:bg-[#004f7a] text-white text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center justify-center gap-2 ${
            !chosen ? 'opacity-80 hover:opacity-100' : ''
          }`}
        >
          <span>Continue to Permit Details</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </section>
  );
};

export default PermitWorkSelectionStep;
