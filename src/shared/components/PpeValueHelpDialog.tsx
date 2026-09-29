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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#006398]">
              <span className="material-symbols-outlined text-[24px]">shield</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg text-slate-900">
                  Select PPE (F4 Value Help)
                </h2>
                <span className="text-[10px] font-mono font-bold bg-blue-100 text-[#006398] px-2 py-0.5 rounded-full border border-blue-200">
                  SAP Config
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Official plant PPE catalog from SAP OData V4 service
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Search & Category Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by PPE code or description (e.g., GLOVE, HELMET, ARC)..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#006398] focus:border-transparent font-sans"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono font-semibold text-slate-400 mr-1">Category:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#006398] text-white font-bold shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {cat === 'ALL' ? 'All Items' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* PPE Table */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-500 font-mono text-xs">
              <div className="w-7 h-7 border-2 border-[#006398] border-t-transparent rounded-full animate-spin"></div>
              <span>Fetching live PPE configurations from SAP...</span>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-sans text-xs">
              <span className="material-symbols-outlined text-[36px] mb-2 text-slate-300">search_off</span>
              <p>No PPE items matched your search criteria.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-mono text-[11px] uppercase bg-slate-50/60 sticky top-0">
                  <th className="py-2.5 px-3 w-10 text-center">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="py-2.5 px-3 w-28">Config Code</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 w-28">Category</th>
                  <th className="py-2.5 px-3 w-20 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((item) => {
                  const isChecked = selectedCodes.has(item.Config_Code);
                  return (
                    <tr
                      key={item.Config_Code}
                      className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${
                        isChecked ? 'bg-blue-50/70' : ''
                      }`}
                      onClick={() => toggleSelectCode(item.Config_Code)}
                    >
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectCode(item.Config_Code)}
                          className="rounded text-[#006398] focus:ring-[#006398]"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#006398]">
                        {item.Config_Code}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {item.Config_Desc}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                          {item.Parent_Code || 'GENERAL'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(item.Config_Code, item.Config_Desc);
                            onClose();
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-[#006398] text-[#006398] hover:text-white border border-[#006398] rounded-md font-mono text-[11px] font-bold transition-colors"
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
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500">
            {filteredList.length} PPE items available
            {selectedCodes.size > 0 && ` • ${selectedCodes.size} selected`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition-colors"
            >
              Cancel
            </button>
            {selectedCodes.size > 0 && (
              <button
                type="button"
                onClick={handleApplySelected}
                className="px-4 py-2 bg-[#006398] hover:bg-[#004f7a] text-white rounded-xl font-bold transition-colors flex items-center gap-1.5"
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
