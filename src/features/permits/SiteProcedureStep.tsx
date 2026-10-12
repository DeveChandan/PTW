import {
  approvalGuidance,
  DOCUMENT_DECISIONS,
  fieldsFor,
  LIFECYCLE,
  NATURE_OF_WORK,
  PERMIT_CATEGORIES,
  preparationsFor,
  PROCEDURE,
  selectedTypes,
  SitePlan,
  TOOLS
} from '../../core/ptw/siteProcedure';
import { SectionCard } from '../../shared/components/SectionCard';

const toggle = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

export function SiteProcedureStep({
  primary,
  plan,
  startTime,
  onChange,
  onOpenChecklist,
  checklistProgress
}: {
  primary: string;
  plan: SitePlan;
  startTime: string;
  onChange: (plan: SitePlan) => void;
  onOpenChecklist?: (categoryCode: string) => void;
  checklistProgress?: Record<string, { answered: number; total: number; verified: number }>;
}) {
  const types = selectedTypes(primary, plan);

  return (
    <div className="space-y-4">
      {/* Hero Header: Client Procedure Document Context */}
      <div className="ptw-card p-3 sm:p-4 bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-white border-blue-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#006398] text-white flex items-center justify-center shrink-0 shadow-2xs">
              <span className="material-symbols-outlined text-[20px] sm:text-[22px]">verified_user</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-bold text-sm sm:text-base text-slate-900 tracking-tight">
                  Client Procedure & Site Preparation
                </h2>
                <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-[#006398]/10 text-[#006398] border border-[#006398]/20">
                  {PROCEDURE.id} · Rev {PROCEDURE.revision}
                </span>
                <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  {PROCEDURE.form}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 font-sans leading-relaxed max-w-3xl">
                Record the job plan, combined hazard categories, and preparation checks. Proposed personnel and preparation responses do not constitute verified signatures or field authorization.
              </p>
            </div>
          </div>
          <div className="hidden lg:flex flex-col items-end text-right font-mono text-[10px] text-slate-500 shrink-0">
            <span className="font-bold text-slate-700">Site: Dahej Complex</span>
            <span>Standard: Corporate EHS</span>
          </div>
        </div>
      </div>

      {/* SECTION A: Additional Applicable Work Categories */}
      <SectionCard
        theme="blue"
        sectionTag="SECTION A"
        title="Additional Applicable Work Categories"
        subtitle="Select combined activities, e.g. hot work inside a confined space. Primary permit category is defined in Section 2.1. When multiple categories are selected, primary and additional work types are stored in SAP child table _WorkType."
        icon="category"
        badge={
          <span className="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-blue-100 text-[#006398]">
            {types.length} Active {types.length === 1 ? 'Category' : 'Categories'}
            {types.length > 1 ? ' · _WorkType Active' : ''}
          </span>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PERMIT_CATEGORIES.map((category) => {
            const isPrimary = primary === category.code || primary === category.sapCode;
            const isSelected = types.includes(category.code) || types.includes(category.sapCode);
            const progress = checklistProgress?.[category.sapCode];

            return (
              <div
                key={category.code}
                className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                  isPrimary
                    ? 'bg-blue-50/70 border-[#006398] ring-1 ring-[#006398]/30 shadow-xs'
                    : isSelected
                    ? 'bg-sky-50/60 border-[#006398] shadow-xs'
                    : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isSelected || isPrimary
                          ? 'bg-[#006398] text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{category.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-slate-900 truncate">
                        {category.label}
                      </span>
                      <span className="block font-mono text-[10px] text-slate-500 truncate">
                        Code: {category.sapCode}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isPrimary ? (
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-[#006398] text-white">
                        PRIMARY
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isPrimary}
                        onChange={() => {
                          const willSelect = !isSelected;
                          const newTypes = toggle(plan.additionalTypes, category.sapCode);
                          onChange({
                            ...plan,
                            additionalTypes: newTypes
                          });
                          if (willSelect && onOpenChecklist && progress && progress.total > 0) {
                            onOpenChecklist(category.sapCode);
                          }
                        }}
                        className="w-4 h-4 rounded text-[#006398] focus:ring-[#006398] border-slate-300 transition-colors cursor-pointer"
                      />
                    )}
                  </div>
                </div>

                {/* Checklist Action Pill on Card - ONLY shown if category has a checklist */}
                {(isPrimary || isSelected) && onOpenChecklist && progress && progress.total > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenChecklist(category.sapCode);
                    }}
                    className={`mt-2.5 w-full py-1 px-2 rounded-lg text-[10px] font-mono font-bold flex items-center justify-between transition-all ${
                      progress.answered === progress.total
                        ? 'bg-emerald-100/90 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                        : progress.answered > 0
                        ? 'bg-sky-100/90 text-sky-800 border border-sky-300 hover:bg-sky-200'
                        : 'bg-amber-100/80 text-amber-900 border border-amber-300 hover:bg-amber-200'
                    }`}
                    title={`Open ${category.label} Compliance Checklist`}
                  >
                    <span className="flex items-center gap-1 truncate">
                      <span className="material-symbols-outlined text-[13px]">
                        {progress.answered === progress.total ? 'verified' : 'fact_check'}
                      </span>
                      <span>Checklist</span>
                    </span>
                    <span className="shrink-0 ml-1 font-semibold">
                      {progress.answered}/{progress.total} Verified
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Multi-Activity Safety Questionnaires Hub - only shown for categories with a found checklist */}
        {(() => {
          const activeWithChecklists = types.filter((typeCode) => {
            const cat = PERMIT_CATEGORIES.find((c) => c.code === typeCode || c.sapCode === typeCode);
            const sap = cat?.sapCode || typeCode;
            return (checklistProgress?.[sap]?.total || 0) > 0;
          });

          if (activeWithChecklists.length === 0) return null;

          return (
            <div className="mt-5 pt-4 border-t border-slate-200/90 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#006398] text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <span className="material-symbols-outlined text-[15px]">checklist</span>
                  </div>
                  <h4 className="font-display font-bold text-xs text-slate-900 uppercase tracking-wider">
                    Compliance Checklists ({activeWithChecklists.length} {activeWithChecklists.length === 1 ? 'Category' : 'Categories'})
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Complete and verify safety questionnaire for each applicable work activity
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeWithChecklists.map((typeCode) => {
                const cat = PERMIT_CATEGORIES.find((c) => c.code === typeCode || c.sapCode === typeCode);
                const isCatPrimary = primary === typeCode || (cat && (primary === cat.code || primary === cat.sapCode));
                const progress = checklistProgress?.[cat?.sapCode || typeCode];
                const answered = progress?.answered || 0;
                const total = progress?.total || 0;
                const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
                const isComplete = total > 0 && answered === total;

                return (
                  <div
                    key={typeCode}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all shadow-xs ${
                      isComplete
                        ? 'bg-emerald-50/70 border-emerald-300'
                        : answered > 0
                        ? 'bg-sky-50/60 border-sky-300'
                        : 'bg-amber-50/60 border-amber-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isComplete
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#006398] text-white'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {cat?.icon || 'fact_check'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {cat?.label || typeCode}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold ${
                                  isCatPrimary
                                    ? 'bg-blue-100 text-[#006398]'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {isCatPrimary ? 'PRIMARY' : 'ADDITIONAL'}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-500 block truncate">
                              SAP: {cat?.sapCode || typeCode}
                            </span>
                          </div>
                        </div>

                        {isComplete && (
                          <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">
                            check_circle
                          </span>
                        )}
                      </div>

                      {/* Progress bar and metrics */}
                      <div className="space-y-1 my-2">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-slate-600 font-medium">
                            {total > 0 ? `${answered}/${total} questions` : 'Checklist pending'}
                          </span>
                          <span
                            className={`font-bold ${
                              isComplete ? 'text-emerald-700' : 'text-slate-700'
                            }`}
                          >
                            {percent}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              isComplete ? 'bg-emerald-500' : 'bg-[#006398]'
                            }`}
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenChecklist?.(cat?.sapCode || typeCode)}
                      className={`mt-2 w-full py-1.5 px-3 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                        isComplete
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-[#006398] hover:bg-[#004f7a] text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {isComplete ? 'edit' : 'assignment_turned_in'}
                      </span>
                      <span>
                        {isComplete ? 'Review Answers' : 'Open Checklist'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
      </SectionCard>

      {/* SECTION B: Nature of Work */}
      <SectionCard
        theme="indigo"
        sectionTag="SECTION B"
        title="Nature of Work *"
        subtitle="Specify all physical tasks, hot operations, line breaking, and fabrication planned on site (At least 1 required)."
        icon="engineering"
        badge={
          plan.nature.length === 0 ? (
            <span className="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              Required * (Select at least 1)
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-indigo-100 text-indigo-700">
              {plan.nature.length} Selected ✓
            </span>
          )
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {NATURE_OF_WORK.map((choice) => {
            const isChecked = plan.nature.includes(choice);
            return (
              <label
                key={choice}
                className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer select-none ${
                  isChecked
                    ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-semibold shadow-xs'
                    : 'bg-white border-slate-200/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() =>
                    onChange({
                      ...plan,
                      nature: toggle(plan.nature, choice)
                    })
                  }
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 transition-colors cursor-pointer"
                />
                <span className="leading-snug">{choice}</span>
              </label>
            );
          })}
        </div>
      </SectionCard>

      {/* SECTION C: Tools and Equipment */}
      <SectionCard
        theme="amber"
        sectionTag="SECTION C"
        title="Tools & Equipment *"
        subtitle="Declare all mechanical, electrical, pneumatic, and heavy equipment brought to the permit area (At least 1 required)."
        icon="construction"
        badge={
          plan.tools.length === 0 ? (
            <span className="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              Required * (Declare at least 1)
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-amber-100 text-amber-800">
              {plan.tools.length} Declared ✓
            </span>
          )
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {TOOLS.map((choice) => {
            const isChecked = plan.tools.includes(choice);
            return (
              <label
                key={choice}
                className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer select-none ${
                  isChecked
                    ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-semibold shadow-xs'
                    : 'bg-white border-slate-200/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() =>
                    onChange({
                      ...plan,
                      tools: toggle(plan.tools, choice)
                    })
                  }
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 transition-colors cursor-pointer"
                />
                <span className="leading-snug">{choice}</span>
              </label>
            );
          })}
        </div>
      </SectionCard>

      {/* SECTION D: JSA, Shift and Proposed Responsibilities */}
      <SectionCard
        theme="emerald"
        sectionTag="SECTION D"
        title="JSA, Shift & Proposed Responsibilities"
        subtitle="Times use Dahej site time (IST). Initial validity is limited to eight hours or shift end, whichever is earlier. Proposed signatories must match the approved permit matrix."
        icon="assignment_ind"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fieldsFor(types).map((field) => {
              const isRequired = 'required' in field && field.required;
              const isDateTime = 'datetime' in field;
              const maxLen = 'user' in field ? 12 : 'reference' in field ? 30 : 255;
              const value = plan.fields[field.code] || '';

              return (
                <div key={field.code} className="space-y-1.5">
                  <label className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1">
                      <span>{field.label}</span>
                      {isRequired && <span className="text-red-500 font-bold">*</span>}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      Code: {field.code}
                    </span>
                  </label>
                  <input
                    type={isDateTime ? 'datetime-local' : 'text'}
                    maxLength={maxLen}
                    value={value}
                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                    onChange={(event) =>
                      onChange({
                        ...plan,
                        fields: { ...plan.fields, [field.code]: event.target.value }
                      })
                    }
                    className="ptw-input font-sans"
                  />
                </div>
              );
            })}
          </div>

          {/* Approval Planning Guidance Box */}
          <div className="ptw-card p-4 bg-slate-50/80 border-slate-200/90">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="material-symbols-outlined text-[18px] text-[#006398]">route</span>
              <h4 className="font-display font-bold text-xs sm:text-sm text-slate-900">
                Approval Planning Guidance
              </h4>
            </div>
            <ul className="space-y-2 font-sans text-xs text-slate-700 pl-1">
              {approvalGuidance(types, startTime).map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[15px] text-emerald-600 shrink-0 mt-0.5">
                    check_circle
                  </span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-500 leading-normal">
              This guidance does not establish legal authorization. Confirm the current permit matrix, plant holiday schedule, delegation of authority, and client clarifications before starting.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* SECTION E: Job & Equipment Preparation */}
      <SectionCard
        theme="rose"
        sectionTag="SECTION E"
        title="Job & Equipment Preparation *"
        subtitle="“Reported complete” is a requester statement awaiting field verification. All checks must be reviewed (YES, NO, or NA with mandatory justification)."
        icon="checklist_rtl"
        badge={(() => {
          const items = preparationsFor(types);
          const reviewedCount = items.filter((i) =>
            ['YES', 'NO', 'NA'].includes(plan.checks[i.code]?.response || '')
          ).length;
          const isAllReviewed = items.length > 0 && reviewedCount === items.length;
          return (
            <span
              className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold border ${
                isAllReviewed
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}
            >
              {reviewedCount}/{items.length} Checks Reviewed {isAllReviewed ? '✓' : '*'}
            </span>
          );
        })()}
      >
        <div className="space-y-3">
          {preparationsFor(types).map((item) => {
            const check = plan.checks[item.code] || { response: '', remarks: '' };

            return (
              <div
                key={item.code}
                className="ptw-card p-3.5 sm:p-4 border-slate-200/90 hover:border-slate-300 transition-all grid gap-3 sm:grid-cols-[1.2fr_180px_1fr] items-center"
              >
                {/* Preparation Requirement Name & Doc Reference */}
                <div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight flex items-center gap-1">
                    <span>{item.label}</span>
                    <span className="text-red-500 font-bold">*</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Code: {item.code}
                    </span>
                    <span className="text-[11px] text-slate-500 font-sans">
                      Procedure p. {item.page}
                    </span>
                  </div>
                </div>

                {/* Status Dropdown Selector */}
                <div>
                  <select
                    aria-label={item.label + ' response'}
                    className={`ptw-select font-semibold text-xs ${
                      check.response === 'YES'
                        ? 'border-emerald-300 bg-emerald-50/50 text-emerald-800'
                        : check.response === 'NO'
                        ? 'border-rose-300 bg-rose-50/50 text-rose-800'
                        : check.response === 'NA'
                        ? 'border-slate-300 bg-slate-50 text-slate-700'
                        : 'border-amber-300 bg-amber-50/30 text-amber-800'
                    }`}
                    value={check.response}
                    onChange={(event) =>
                      onChange({
                        ...plan,
                        checks: {
                          ...plan.checks,
                          [item.code]: {
                            ...check,
                            response: event.target.value as typeof check.response
                          }
                        }
                      })
                    }
                  >
                    <option value="">Pending assessment</option>
                    <option value="YES">Reported complete</option>
                    <option value="NO">Outstanding</option>
                    <option value="NA">Not applicable</option>
                  </select>
                </div>

                {/* Remarks & Evidence Input */}
                <div>
                  <input
                    aria-label={item.label + ' evidence or reason'}
                    className={`ptw-input text-xs ${
                      check.response === 'NA' && !check.remarks.trim()
                        ? 'border-amber-400 focus:border-amber-500 bg-amber-50/20'
                        : ''
                    }`}
                    placeholder={
                      check.response === 'NA'
                        ? 'Mandatory reason why NA *'
                        : 'Evidence reference / reason / action...'
                    }
                    maxLength={255}
                    value={check.remarks}
                    onChange={(event) =>
                      onChange({
                        ...plan,
                        checks: {
                          ...plan.checks,
                          [item.code]: { ...check, remarks: event.target.value }
                        }
                      })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Lifecycle Guidance & Mandatory Clarifications */}
      <ProcedureGuidance />
    </div>
  );
}

export function ProcedureGuidance() {
  return (
    <div className="space-y-4 pt-2">
      {/* Required Permit Lifecycle Pipeline */}
      <section className="ptw-card p-5 border-slate-200/90">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-[20px] text-[#006398]">timeline</span>
          <h3 className="font-display font-bold text-sm sm:text-base text-slate-900">
            Required Permit Lifecycle Pipeline
          </h3>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LIFECYCLE.map((stage, index) => (
            <li
              key={stage.title}
              className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 flex flex-col justify-between hover:bg-slate-50 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#006398] text-white flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-900">{stage.title}</span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-600 leading-relaxed font-sans">
                  {stage.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 pt-3 border-t border-slate-200/80 text-xs text-slate-500 font-sans leading-relaxed">
          Cold / height extensions: up to seven days with unchanged conditions and daily signed JSA review. Other listed activities: the procedure specifies same-day extension with each shift revalidated. Special exceptions require documented authorization.
        </p>
      </section>

      {/* Client Clarifications Alert Box */}
      <details className="ptw-card border-amber-200/90 bg-amber-50/50 p-4 sm:p-5 group">
        <summary className="cursor-pointer font-display font-bold text-xs sm:text-sm text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-amber-600">warning</span>
            <span>Client Clarifications Required Before Field Release</span>
          </div>
          <span className="material-symbols-outlined text-[18px] text-amber-600 group-open:rotate-180 transition-transform">
            expand_more
          </span>
        </summary>
        <div className="mt-3 pt-3 border-t border-amber-200/60 font-sans">
          <ul className="list-disc space-y-2 pl-5 text-xs text-amber-900">
            {DOCUMENT_DECISIONS.map((item, index) => (
              <li key={index} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-amber-800/90 leading-relaxed">
            The separate format revision DOCX is rights-managed and was not readable. This screen follows the supplied procedure and its embedded form. Current individual safety standards take precedence where the procedure states they do.
          </p>
        </div>
      </details>
    </div>
  );
}

export default SiteProcedureStep;
