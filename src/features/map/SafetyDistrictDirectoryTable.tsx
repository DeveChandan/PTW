import React, { useState, useMemo } from 'react';
import { SafetyDistrict, SAFETY_DISTRICTS } from '../../core/ptw/safetyDistricts';

interface SafetyDistrictDirectoryTableProps {
  onSelectDistrict: (district: SafetyDistrict) => void;
  selectedDistrict: SafetyDistrict | null;
}

export const SafetyDistrictDirectoryTable: React.FC<SafetyDistrictDirectoryTableProps> = ({
  onSelectDistrict,
  selectedDistrict
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredDistricts = useMemo(() => {
    return SAFETY_DISTRICTS.filter((d) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        d.id.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.owner.toLowerCase().includes(q) ||
        d.shortLabel.toLowerCase().includes(q) ||
        d.streets.some((s) => s.toString().includes(q)) ||
        d.avenues.some((a) => a.toString().includes(q));

      const matchesCat =
        selectedCategory === 'ALL' || d.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [searchTerm, selectedCategory]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full font-sans select-none">
      {/* Search & Filter Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-sky-50/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h3 className="font-bold text-base text-slate-900 leading-tight">
            Safety Districts Demarcation Schedule
          </h3>
          <p className="text-xs text-slate-500">
            Official 26 Districts Master Schedule · Drawing GFL-PP-DWG-SD-04-15-D0127 Rev. 03
          </p>
        </div>

        {/* Filter Inputs */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by SD#, name, owner..."
              className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#006398] focus:ring-2 focus:ring-[#006398]/10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-[#006398]"
          >
            <option value="ALL">All Categories ({SAFETY_DISTRICTS.length})</option>
            <option value="FLUOROPOLYMERS">Fluoropolymers</option>
            <option value="CHLOR_ALKALI">Chlor-Alkali</option>
            <option value="CHEMICALS">Chemicals & Monomers</option>
            <option value="POWER_UTILITIES">Power & Utilities</option>
            <option value="LOGISTICS_WAREHOUSE">Logistics & Stores</option>
            <option value="ADMIN_SERVICES">Labs & Admin</option>
            <option value="ENVIRONMENT">Environmental & ETP</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200/90 text-slate-500 uppercase tracking-wider font-mono text-[10px] sticky top-0 z-10">
            <tr>
              <th className="py-3 px-4 w-16 text-center">SD #</th>
              <th className="py-3 px-4">District Demarcation & Facilities</th>
              <th className="py-3 px-4">Owner / HOD</th>
              <th className="py-3 px-4">Connected Avenues (N-S)</th>
              <th className="py-3 px-4">Connected Streets (E-W)</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredDistricts.map((d) => {
              const isSelected = selectedDistrict?.id === d.id;
              return (
                <tr
                  key={d.id}
                  onClick={() => onSelectDistrict(d)}
                  className={`hover:bg-sky-50/50 cursor-pointer transition-colors ${
                    isSelected ? 'bg-amber-50/80 font-medium' : ''
                  }`}
                >
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-600 text-white font-mono font-bold text-xs shadow-xs">
                      {d.code}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{d.shortLabel}</div>
                    <div className="text-[11px] text-slate-500 line-clamp-1">{d.name}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-800 font-semibold">{d.owner}</div>
                    <div className="text-[10px] text-slate-400">Area Authority</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {d.avenues.map((ave) => (
                        <span
                          key={ave}
                          className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                        >
                          Av-{ave}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {d.streets.map((st) => (
                        <span
                          key={st}
                          className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                        >
                          St-{st}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDistrict(d);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#006398] hover:bg-sky-700 text-white text-[11px] font-semibold transition"
                    >
                      Locate
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Showing {filteredDistricts.length} of {SAFETY_DISTRICTS.length} Safety Districts</span>
        <span className="font-mono">Plot Plan Drawing: REV 03</span>
      </div>
    </div>
  );
};
