import React, { useState, useMemo, useEffect } from 'react';
import { ChecklistAnswer, ChecklistAnswerType, SapChecklistItem } from '../../core/types/checklist.types';

interface PermitChecklistModalProps {
  isOpen: boolean;
  permitType: string;
  permitTypeName?: string;
  items: SapChecklistItem[];
  initialAnswers?: Record<string, { response: ChecklistAnswerType; remarks: string }>;
  onSave: (answers: ChecklistAnswer[]) => void;
  onClose: () => void;
}

export const PermitChecklistModal: React.FC<PermitChecklistModalProps> = ({
  isOpen,
  permitType,
  permitTypeName,
  items,
  initialAnswers = {},
  onSave,
  onClose,
}) => {
  // Local state for user answers: keyed by QuestionaireId
  const [answers, setAnswers] = useState<Record<string, { response: ChecklistAnswerType; remarks: string }>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Synchronize initial answers when modal opens or items change
  useEffect(() => {
    if (!isOpen) return;

    const initialMap: Record<string, { response: ChecklistAnswerType; remarks: string }> = {};
    items.forEach((item) => {
      const existing = initialAnswers[item.QuestionaireId];
      initialMap[item.QuestionaireId] = {
        response: existing?.response || '',
        remarks: existing?.remarks || '',
      };
    });
    setAnswers(initialMap);
    setSelectedCategory('ALL');
    setSearchQuery('');
  }, [isOpen, items, initialAnswers]);

  // Extract unique categories and counts
  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const cat = item.Category || 'GENERAL';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [items]);

  // Filtered items based on Category and Search Query
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        selectedCategory === 'ALL' || (item.Category || 'GENERAL') === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        item.Question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.Category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.QuestionaireId.includes(searchQuery);
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  // Response statistics
  const stats = useMemo(() => {
    let yes = 0;
    let no = 0;
    let na = 0;
    let answered = 0;

    items.forEach((item) => {
      const resp = answers[item.QuestionaireId]?.response;
      if (resp === 'YES') {
        yes++;
        answered++;
      } else if (resp === 'NO') {
        no++;
        answered++;
      } else if (resp === 'NA') {
        na++;
        answered++;
      }
    });

    const total = items.length;
    const pending = total - answered;
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;

    return { yes, no, na, answered, total, pending, percent };
  }, [items, answers]);

  // Handlers for individual question edits
  const handleResponseChange = (questionaireId: string, response: ChecklistAnswerType) => {
    setAnswers((prev) => ({
      ...prev,
      [questionaireId]: {
        response: prev[questionaireId]?.response === response ? '' : response,
        remarks: prev[questionaireId]?.remarks || '',
      },
    }));
  };

  const handleRemarksChange = (questionaireId: string, remarks: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionaireId]: {
        response: prev[questionaireId]?.response || '',
        remarks,
      },
    }));
  };

  // Bulk action handlers
  const handleBulkSet = (response: ChecklistAnswerType) => {
    setAnswers((prev) => {
      const updated = { ...prev };
      filteredItems.forEach((item) => {
        updated[item.QuestionaireId] = {
          response,
          remarks: updated[item.QuestionaireId]?.remarks || '',
        };
      });
      return updated;
    });
  };

  const handleReset = () => {
    setAnswers((prev) => {
      const updated = { ...prev };
      filteredItems.forEach((item) => {
        updated[item.QuestionaireId] = {
          response: '',
          remarks: '',
        };
      });
      return updated;
    });
  };

  const handleSave = () => {
    const result: ChecklistAnswer[] = items.map((item) => {
      const ans = answers[item.QuestionaireId] || { response: '', remarks: '' };
      return {
        questionaireId: item.QuestionaireId,
        permitType: item.PermitType || permitType,
        category: item.Category || 'GENERAL',
        question: item.Question,
        sequence: item.Sequence,
        response: ans.response,
        remarks: ans.remarks,
      };
    });
    onSave(result);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checklist-modal-title"
    >
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-sky-50 via-slate-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#006398] text-white flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[24px]">fact_check</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="checklist-modal-title" className="text-lg font-bold text-slate-900 font-display">
                  {permitTypeName || permitType} Compliance Checklist
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#006398]/10 text-[#006398] border border-[#006398]/20">
                  {permitType}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-100 text-emerald-800 font-semibold">
                  SAP OData V4
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Mandatory Safety Verification Questionnaire · Answer YES / NO / NA with Remarks
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* PROGRESS & SUMMARY STRIP */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Completion:</span>
              <span className="font-mono font-bold text-slate-900">
                {stats.answered} / {stats.total}
              </span>
              <span className="text-slate-400">({stats.percent}%)</span>
            </div>

            <div className="w-36 sm:w-48 bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  stats.percent === 100
                    ? 'bg-emerald-500'
                    : stats.percent > 50
                    ? 'bg-[#006398]'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>

          {/* QUICK BULK ACTIONS */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 mr-1">Quick Actions:</span>
            <button
              type="button"
              onClick={() => handleBulkSet('YES')}
              className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">check</span>
              All YES
            </button>
            <button
              type="button"
              onClick={() => handleBulkSet('NA')}
              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold text-xs flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">remove</span>
              All NA
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-2 py-1 rounded hover:bg-slate-200 text-slate-500 text-xs transition-colors"
              title="Clear visible responses"
            >
              Reset
            </button>
          </div>
        </div>

        {/* CATEGORY TABS & SEARCH */}
        <div className="px-6 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === 'ALL'
                  ? 'bg-[#006398] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ALL ({items.length})
            </button>
            {Object.entries(categories).map(([cat, count]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#006398] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat} ({count})
              </button>
            ))}
          </div>

          {/* Search Filter */}
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Filter questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#006398] focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* QUESTIONS LIST / TABLE BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/50">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <span className="material-symbols-outlined text-[40px] text-slate-300">search_off</span>
              <p className="mt-2 text-sm font-semibold">No questions match your current filter.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSearchQuery('');
                }}
                className="mt-2 text-xs text-[#006398] hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            filteredItems.map((item) => {
              const currentAns = answers[item.QuestionaireId] || { response: '', remarks: '' };
              const isAnswered = Boolean(currentAns.response);
              const needsRemarksPrompt =
                (currentAns.response === 'NO' || currentAns.response === 'NA') &&
                !currentAns.remarks.trim();

              return (
                <div
                  key={item.QuestionaireId}
                  className={`p-4 rounded-xl border transition-all ${
                    isAnswered
                      ? currentAns.response === 'YES'
                        ? 'bg-white border-emerald-200/80 shadow-xs'
                        : currentAns.response === 'NO'
                        ? 'bg-rose-50/30 border-rose-200 shadow-xs'
                        : 'bg-white border-slate-200'
                      : 'bg-white border-amber-200/70'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* QUESTION CONTENT */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          #{item.QuestionaireId}
                        </span>
                        <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-sky-100 text-sky-800">
                          {item.Category}
                        </span>
                        {!isAnswered && (
                          <span className="text-[11px] font-medium text-amber-600 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[14px]">pending</span>
                            Pending answer
                          </span>
                        )}
                      </div>
                      <p className="text-slate-800 font-semibold text-xs sm:text-sm leading-relaxed">
                        {item.Question}
                      </p>
                    </div>

                    {/* RESPONSE SELECTOR & REMARKS */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:w-[480px] shrink-0">
                      {/* YES / NO / NA BUTTONS */}
                      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 w-full sm:w-[210px] shrink-0 font-mono">
                        {(['YES', 'NO', 'NA'] as ChecklistAnswerType[]).map((resp) => {
                          const isSelected = currentAns.response === resp;
                          return (
                            <button
                              key={resp}
                              type="button"
                              onClick={() => handleResponseChange(item.QuestionaireId, resp)}
                              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                isSelected
                                  ? resp === 'YES'
                                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                                    : resp === 'NO'
                                    ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400'
                                    : 'bg-slate-700 text-white shadow-sm ring-1 ring-slate-500'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                              }`}
                            >
                              {resp === 'YES' && isSelected && (
                                <span className="material-symbols-outlined text-[14px]">check</span>
                              )}
                              {resp === 'NO' && isSelected && (
                                <span className="material-symbols-outlined text-[14px]">close</span>
                              )}
                              {resp === 'NA' && isSelected && (
                                <span className="material-symbols-outlined text-[14px]">remove</span>
                              )}
                              {resp}
                            </button>
                          );
                        })}
                      </div>

                      {/* REMARKS INPUT COLUMN */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          placeholder={
                            currentAns.response === 'NO'
                              ? 'Required reason for NO...'
                              : currentAns.response === 'NA'
                              ? 'Required reason for NA...'
                              : 'Remarks / Observations / CES tag...'
                          }
                          value={currentAns.remarks}
                          maxLength={255}
                          onChange={(e) => handleRemarksChange(item.QuestionaireId, e.target.value)}
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border bg-white focus:outline-none transition-colors ${
                            needsRemarksPrompt
                              ? 'border-amber-400 focus:border-amber-500 bg-amber-50/20'
                              : 'border-slate-300 focus:border-[#006398]'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4">
          {/* STATS BADGES */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Answers:</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
              YES: {stats.yes}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono font-bold">
              NO: {stats.no}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-mono font-bold">
              NA: {stats.na}
            </span>
            {stats.pending > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-bold">
                Pending: {stats.pending}
              </span>
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-[#006398] hover:bg-[#004e78] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              Save & Apply Checklist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermitChecklistModal;
