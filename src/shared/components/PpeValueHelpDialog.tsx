import React, { useState, useEffect, useMemo } from 'react';
import { configApi } from '../../core/api';
import { SapConfigRecord } from '../../core/types/config.types';

interface PpeValueHelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (code: string, description: string) => void;
  onSelectMultiple?: (items: { code: string; description: string }[]) => void;
}

export const PpeValueHelpDialog: React.FC<PpeValueHelpDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  onSelectMultiple
}) => {
  const [ppeList, setPpeList] = useState<SapConfigRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  // Fetch live PPE items from SAP Config on open
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      configApi.fetchPpeConfig()
        .then((data) => {
          setPpeList(data);
        })
        .catch((err) => {
          console.error('[PpeValueHelpDialog] Error loading PPE config:', err);
        })
        .finally(() => {
          setLoading(false);
        });
      setSelectedCodes(new Set());
      setSearchTerm('');
    }
  }, [isOpen]);

  // Distinct parent categories for filtering
  const categories = useMemo(() => {
    const cats = new Set<string>();
    ppeList.forEach(item => {
      if (item.Parent_Code) cats.add(item.Parent_Code);
    });
    return ['ALL', ...Array.from(cats)];
  }, [ppeList]);

  // Filtered PPE items
  const filteredList = useMemo(() => {
    return ppeList.filter(item => {
      const matchesCategory = selectedCategory === 'ALL' || item.Parent_Code === selectedCategory;
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = !term ||
        item.Config_Code.toLowerCase().includes(term) ||
        item.Config_Desc.toLowerCase().includes(term) ||
        item.Parent_Code.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [ppeList, selectedCategory, searchTerm]);

  if (!isOpen) return null;

  const toggleSelectCode = (code: string) => {
    const next = new Set(selectedCodes);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setSelectedCodes(next);
  };

  const handleApplySelected = () => {
    if (selectedCodes.size === 0) return;
    const selectedItems = ppeList
      .filter(item => selectedCodes.has(item.Config_Code))
      .map(item => ({ code: item.Config_Code, description: item.Config_Desc }));

    if (onSelectMultiple && selectedItems.length > 0) {
      onSelectMultiple(selectedItems);
    } else if (selectedItems.length > 0) {
      onSelect(selectedItems[0].code, selectedItems[0].description);
    }
    onClose();
  };

  const isAllFilteredSelected =
    filteredList.length > 0 && filteredList.every((item) => selectedCodes.has(item.Config_Code));

  const toggleSelectAll = () => {
    const next = new Set(selectedCodes);
    if (isAllFilteredSelected) {
      filteredList.forEach((item) => next.delete(item.Config_Code));
    } else {
      filteredList.forEach((item) => next.add(item.Config_Code));
    }
    setSelectedCodes(next);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_24px_64px_-12px_rgba(15,23,42,0.25),inset_0_1px_0_0_rgba(255,255,255,1)] w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-slate-200/80 bg-gradient-to-r from-sky-50/90 via-blue-50/30 to-white/95 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#006398] to-[#004f7a] text-white flex items-center justify-center shadow-md shadow-sky-900/15 shrink-0">
              <span className="material-symbols-outlined text-[24px]">shield</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg text-slate-900 tracking-tight">
                  Select PPE (F4 Value Help)
                </h2>
                <span className="text-[10px] font-mono font-bold bg-blue-100 text-[#006398] px-2.5 py-0.5 rounded-full border border-blue-200/80">
                  SAP Config
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Official plant PPE catalog from SAP OData V4 service
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-10 h-10 rounded-xl border border-slate-200/80 bg-white/90 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all shadow-xs hover:shadow-sm shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Search & Category Filter Toolbar */}
        <div className="px-6 sm:px-8 py-3.5 border-b border-slate-200/80 bg-slate-50/60 space-y-3 shrink-0">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by PPE code or description (e.g., GLOVE, HELMET, ARC)..."
              className="w-full pl-10 pr-9 py-2 bg-white border border-slate-300/90 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006398]/20 focus:border-[#006398] font-sans shadow-xs transition-all"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-sans font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-slate-400">filter_list</span>
              Category:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-sans transition-all ${
                  selectedCategory === cat
                    ? 'bg-[#006398] text-white font-semibold shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80 font-medium'
                }`}
              >
                {cat === 'ALL' ? 'All Items' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* PPE Table Container */}
        <div className="flex-1 overflow-y-auto min-h-[320px] bg-white relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-56 gap-3 text-slate-500 text-xs">
              <div className="w-8 h-8 border-2 border-[#006398] border-t-transparent rounded-full animate-spin" />
              <span className="font-medium">Fetching live PPE configurations from SAP...</span>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto mb-3 flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">search_off</span>
              </div>
              <p className="font-semibold text-slate-700 text-sm">No PPE items matched</p>
              <p className="text-slate-400 mt-1">Try adjusting your search terms or selecting another category.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_0_rgba(226,232,240,1)]">
                <tr>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3 px-4 w-12 text-center border-b border-slate-200">
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all visible items"
                      className="w-4 h-4 rounded text-[#006398] border-slate-300 focus:ring-[#006398]/30 cursor-pointer"
                    />
                  </th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3 px-4 w-36 font-semibold text-slate-700 text-xs tracking-normal border-b border-slate-200">
                    Config Code
                  </th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3 px-4 font-semibold text-slate-700 text-xs tracking-normal border-b border-slate-200">
                    Description
                  </th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3 px-4 w-32 font-semibold text-slate-700 text-xs tracking-normal border-b border-slate-200">
                    Category
                  </th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3 px-4 w-24 text-right font-semibold text-slate-700 text-xs tracking-normal border-b border-slate-200">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredList.map((item) => {
                  const isChecked = selectedCodes.has(item.Config_Code);
                  return (
                    <tr
                      key={item.Config_Code}
                      className={`cursor-pointer transition-colors group ${
                        isChecked
                          ? 'bg-sky-50/80 hover:bg-sky-100/70'
                          : 'hover:bg-slate-50/80'
                      }`}
                      onClick={() => toggleSelectCode(item.Config_Code)}
                    >
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectCode(item.Config_Code)}
                          className="w-4 h-4 rounded text-[#006398] border-slate-300 focus:ring-[#006398]/30 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-xs text-[#006398] group-hover:text-[#004f7a]">
                        {item.Config_Code}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 text-xs">
                        {item.Config_Desc}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200/80">
                          {item.Parent_Code || 'GENERAL'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(item.Config_Code, item.Config_Desc);
                            onClose();
                          }}
                          className="px-3 py-1 bg-white hover:bg-[#006398] text-[#006398] hover:text-white border border-[#006398]/40 hover:border-[#006398] rounded-lg font-sans text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-8 py-3.5 border-t border-slate-200/80 bg-slate-50/90 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-600 font-sans">
            <span className="font-semibold text-slate-700">{filteredList.length}</span>
            <span className="text-slate-500">PPE items available</span>
            {selectedCodes.size > 0 && (
              <span className="ml-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-[#006398] font-bold text-[11px] border border-sky-200/70">
                {selectedCodes.size} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold shadow-xs transition-colors"
            >
              Cancel
            </button>
            {selectedCodes.size > 0 && (
              <button
                type="button"
                onClick={handleApplySelected}
                className="px-5 py-2 bg-gradient-to-r from-[#006398] to-[#004f7a] hover:from-[#00527e] hover:to-[#004165] text-white rounded-xl font-bold shadow-md shadow-sky-900/15 transition-all flex items-center gap-1.5 active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Add Selected ({selectedCodes.size})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PpeValueHelpDialog;
