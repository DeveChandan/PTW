import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Category, Preset, ReportRecord } from './reportConstants';
import {
  PRESETS,
  formatDate,
  exportToCSV,
  ALL_APPLICATION_PERMIT_TYPES,
  ALL_APPLICATION_ISOLATION_TYPES,
  normalizePermitType,
  getPermitTypeMeta,
  getIsolationTypeMeta,
  getCountDensityBadge,
  getPresetStart,
  todayISO,
} from './reportConstants';

export interface ReportSectionProps {
  title: string;
  category: Category;
  records: ReportRecord[];
  startDate: string;
  endDate: string;
  onStartDate: (value: string) => void;
  onEndDate: (value: string) => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  search: string;
  onSearch: (value: string) => void;
  selectedPresets: Preset[];
  onTogglePreset: (preset: Preset) => void;
  presetOpen: boolean;
  onTogglePresetMenu: () => void;
  onClearPresets: () => void;
  isInitialView?: boolean;
  onSelectRecordDetail?: (record: ReportRecord) => void;
  onCellDrillDown?: (department: string, type: string, records: ReportRecord[]) => void;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs';

const buttonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 shadow-2xs cursor-pointer';

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200/80 text-xl font-mono text-slate-500">
        ∅
      </div>
      <h3 className="text-sm font-bold text-slate-800">{message}</h3>
      <p className="mt-1 max-w-md text-xs text-slate-500">
        Try modifying the date range, unchecking range filters, or clearing the type search.
      </p>
    </div>
  );
}

export const ReportSection: React.FC<ReportSectionProps> = ({
  title,
  category,
  records,
  startDate,
  endDate,
  onStartDate,
  onEndDate,
  searchOpen,
  onToggleSearch,
  search,
  onSearch,
  selectedPresets,
  onTogglePreset,
  presetOpen,
  onTogglePresetMenu,
  onClearPresets,
  onCellDrillDown,
}) => {
  const isPermit = category === 'permit';
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Toggle between: All standard application types vs active types only (default: All Types)
  const [showAllTypes, setShowAllTypes] = useState<boolean>(true);

  // Dual-Axis Crosshair State: highlights department row & type column simultaneously
  const [hoveredCell, setHoveredCell] = useState<{ department: string; type: string } | null>(null);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    if (!presetOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onTogglePresetMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onTogglePresetMenu();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [presetOpen, onTogglePresetMenu]);

  // Filter records by type search query
  const matchingRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (!query) return true;
      const t = (record.type || '').toLowerCase();
      const norm = isPermit ? normalizePermitType(record.type).toLowerCase() : t;
      return t.includes(query) || norm.includes(query);
    });
  }, [records, search, isPermit]);

  // Extract unique sorted departments
  const departments = useMemo(
    () => [...new Set(matchingRecords.map((r) => r.department))].sort(),
    [matchingRecords]
  );

  // Active distinct types present in matchingRecords
  const activeTypes = useMemo(() => {
    const set = new Set<string>();
    matchingRecords.forEach((r) => {
      set.add(isPermit ? normalizePermitType(r.type) : r.type.toUpperCase());
    });
    return [...set].sort();
  }, [matchingRecords, isPermit]);

  // Standard application types list
  const standardTypes = useMemo(() => {
    return isPermit ? [...ALL_APPLICATION_PERMIT_TYPES] : [...ALL_APPLICATION_ISOLATION_TYPES];
  }, [isPermit]);

  // Final columns to display
  const types = useMemo(() => {
    if (!showAllTypes) {
      return activeTypes;
    }
    // All application types in standard order + any extra custom codes
    const result = [...standardTypes];
    activeTypes.forEach((t) => {
      if (!result.includes(t as any)) {
        result.push(t as any);
      }
    });
    return result;
  }, [showAllTypes, standardTypes, activeTypes]);

  function getRecordsForCell(department: string, type: string) {
    const target = isPermit ? normalizePermitType(type) : type.toUpperCase();
    return matchingRecords.filter((r) => {
      const rType = isPermit ? normalizePermitType(r.type) : r.type.toUpperCase();
      return r.department === department && rType === target;
    });
  }

  function countRecords(department: string, type: string) {
    return getRecordsForCell(department, type).length;
  }

  function getRecordsForDepartment(department: string) {
    return matchingRecords.filter((r) => r.department === department);
  }

  function departmentTotal(department: string) {
    return getRecordsForDepartment(department).length;
  }

  function getRecordsForType(type: string) {
    const target = isPermit ? normalizePermitType(type) : type.toUpperCase();
    return matchingRecords.filter((r) => {
      const rType = isPermit ? normalizePermitType(r.type) : r.type.toUpperCase();
      return rType === target;
    });
  }

  function typeTotal(type: string) {
    return getRecordsForType(type).length;
  }

  const total = matchingRecords.length;

  // Handle Export CSV
  const handleExport = () => {
    const headers = ['Department', ...types, 'Total'];
    const rows = departments.map((dept) => [
      `"${dept}"`,
      ...types.map((type) => countRecords(dept, type)),
      departmentTotal(dept),
    ]);

    rows.push([
      `"Grand Total"`,
      ...types.map((type) => typeTotal(type)),
      total,
    ]);

    exportToCSV(`GFL-${category}-cross-tab-matrix.csv`, headers, rows);
  };

  const cellClass = 'border border-slate-200 px-4 py-2.5 bg-white';
  const numberClass = `${cellClass} text-center font-mono`;

  return (
    <section className="overflow-visible rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Section Title & Category Pill */}
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black shadow-xs font-display border ${
              isPermit
                ? 'bg-blue-100/80 text-[#006398] border-blue-200'
                : 'bg-purple-100/80 text-purple-700 border-purple-200'
            }`}
          >
            {isPermit ? 'P' : 'I'}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold font-display text-slate-900">{title}</h2>
              <span
                className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                  isPermit
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {isPermit ? 'Permit Matrix' : 'Isolation Matrix'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 font-sans">
              <strong>{total}</strong> active records distributed across <strong>{departments.length}</strong> departments and <strong>{types.length}</strong> {isPermit ? 'permit' : 'isolation'} codes.
            </p>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Column Scope Toggle: All Types vs Active Only */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/90 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setShowAllTypes(true)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                showAllTypes
                  ? isPermit
                    ? 'bg-[#006398] text-white shadow-2xs'
                    : 'bg-purple-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={`Show columns for all standard application ${isPermit ? 'permit' : 'isolation'} types`}
            >
              <span className="material-symbols-outlined text-[14px]">apps</span>
              <span>All Types ({standardTypes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAllTypes(false)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                !showAllTypes
                  ? isPermit
                    ? 'bg-[#006398] text-white shadow-2xs'
                    : 'bg-purple-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show only columns that have active records in the selected period"
            >
              <span className="material-symbols-outlined text-[14px]">filter_list</span>
              <span>Active ({activeTypes.length})</span>
            </button>
          </div>

          {matchingRecords.length > 0 && (
            <button
              type="button"
              className={buttonClass}
              onClick={handleExport}
              title="Download Matrix Table as CSV"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-600">download</span>
              <span>Export CSV</span>
            </button>
          )}

          {/* Type Quick Search */}
          <div className="flex items-center gap-1.5 relative">
            {searchOpen && (
              <div className="relative">
                <input
                  autoFocus
                  id={`${category}-search-input`}
                  name={`${category}-search`}
                  className={`${inputClass} w-44 sm:w-56 pr-7`}
                  value={search}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder={
                    isPermit
                      ? 'Filter permit type (e.g. COLD)...'
                      : 'Filter isolation type (e.g. LOTO)...'
                  }
                  aria-label={`Search ${title}`}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => onSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              className={`${buttonClass} h-9 w-9 p-0 ${
                searchOpen ? 'border-blue-300 bg-blue-50 text-blue-700' : ''
              }`}
              onClick={onToggleSearch}
              aria-label={`Toggle ${title} search`}
              title="Search types"
            >
              <span className="material-symbols-outlined text-[18px]">search</span>
            </button>
          </div>

          {/* Date Ranges Multi-Preset Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              className={`${buttonClass} h-9`}
              onClick={onTogglePresetMenu}
              aria-expanded={presetOpen}
            >
              <span className="material-symbols-outlined text-[16px] text-slate-600">date_range</span>
              <span>Date ranges</span>
              <span className="material-symbols-outlined text-[16px] text-slate-400">expand_more</span>

              {selectedPresets.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 font-mono text-[10px] font-bold text-white">
                  {selectedPresets.length}
                </span>
              )}
            </button>

            {presetOpen && (
              <div className="absolute right-0 z-40 mt-2 max-h-[400px] w-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                <div className="mb-2.5 flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold font-display text-slate-800 uppercase tracking-wide">
                    Date Range Presets
                  </h3>
                  <button
                    type="button"
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                    onClick={onClearPresets}
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-0.5">
                  {PRESETS.map((preset) => (
                    <label
                      key={preset}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded accent-blue-600 cursor-pointer"
                        checked={selectedPresets.includes(preset)}
                        onChange={() => onTogglePreset(preset)}
                      />
                      <span>{preset}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Pickers Strip */}
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-4 sm:px-5 py-3 md:flex-row md:items-end md:flex-wrap">
        <label className="block w-full md:w-44">
          <span className="mb-1 block text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500">
            From Date
          </span>
          <input
            type="date"
            id={`${category}-start-date`}
            name={`${category}-start-date`}
            className={inputClass}
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => onStartDate(e.target.value)}
          />
        </label>

        <span className="hidden pb-2 text-xs font-mono text-slate-400 md:block">to</span>

        <label className="block w-full md:w-44">
          <span className="mb-1 block text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500">
            To Date
          </span>
          <input
            type="date"
            id={`${category}-end-date`}
            name={`${category}-end-date`}
            className={inputClass}
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => onEndDate(e.target.value)}
          />
        </label>

        {/* Quick Range Presets & Active Preset Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pb-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mr-0.5">
            Quick Ranges:
          </span>
          {(
            [
              ['7d', '7 Days', 'Last 7 days' as Preset],
              ['15d', '15 Days', 'Last 15 days' as Preset],
              ['month', 'This Month', 'Month' as Preset],
              ['quarter', 'Quarter (3M)', 'Quarter' as Preset],
            ] as const
          ).map(([id, label, presetName]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                const end = endDate || todayISO();
                const start = getPresetStart(presetName, end);
                onStartDate(start);
              }}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition shadow-2xs cursor-pointer"
              title={`Set date window to ${presetName}`}
            >
              {label}
            </button>
          ))}

          {(startDate || selectedPresets.length > 0) && (
            <button
              type="button"
              onClick={() => {
                onStartDate('');
                onClearPresets();
              }}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition shadow-2xs cursor-pointer"
              title="Clear date filter"
            >
              Reset
            </button>
          )}

          {selectedPresets.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap ml-1">
              <span className="text-[11px] font-mono font-medium text-slate-500">Active Presets:</span>
              {selectedPresets.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-100/90 text-blue-800"
                >
                  {p}
                  <button
                    type="button"
                    onClick={() => onTogglePreset(p)}
                    className="hover:text-blue-950 cursor-pointer"
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Matrix Cross-Tabulation Table */}
      <div className="p-4 sm:p-5">
        {matchingRecords.length === 0 ? (
          <EmptyState
            message={
              records.length === 0
                ? `No ${isPermit ? 'work permits' : 'isolations'} recorded in the selected period.`
                : 'No matching records match the search filter.'
            }
          />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-slate-500">grid_on</span>
                Department-wise {isPermit ? 'Permit Type Matrix' : 'Isolation Type Matrix'}
              </h3>
              <span className="font-mono text-[11px] text-slate-500">
                Window: <strong>{formatDate(startDate)}</strong> – <strong>{formatDate(endDate)}</strong>
              </span>
            </div>

            {/* Generous Scroll Area utilizing screen space properly */}
            <div className="max-h-[480px] min-h-[220px] overflow-auto rounded-xl border border-slate-200/90 shadow-2xs">
              <table
                className="border-collapse text-xs"
                style={{
                  width: 'max-content',
                  minWidth: '100%',
                }}
              >
                <thead>
                  <tr>
                    {/* Sticky Top-Left Header: Department */}
                    <th
                      className={`sticky left-0 top-0 z-30 border border-slate-200 px-4 py-3 text-left font-display font-bold text-white shadow-xs ${
                        isPermit
                          ? 'bg-gradient-to-r from-[#002f4a] to-[#004f7a]'
                          : 'bg-gradient-to-r from-[#3b0764] to-[#581c87]'
                      }`}
                    >
                      Department
                    </th>

                    {/* Dynamic Type Columns */}
                    {types.map((type) => {
                      const meta = isPermit ? getPermitTypeMeta(type) : getIsolationTypeMeta(type);
                      const isColActive = hoveredCell?.type === type;

                      return (
                        <th
                          key={type}
                          className={`sticky top-0 z-10 whitespace-nowrap border border-slate-200 px-3.5 py-3 text-center font-mono font-bold tracking-wider text-white shadow-xs transition-all ${
                            isColActive
                              ? isPermit
                                ? 'bg-gradient-to-r from-blue-950 to-[#003b5c] ring-2 ring-cyan-400 shadow-md'
                                : 'bg-gradient-to-r from-purple-950 to-[#4c1d95] ring-2 ring-pink-400 shadow-md'
                              : isPermit
                              ? 'bg-gradient-to-r from-[#004f7a] to-[#006398]'
                              : 'bg-gradient-to-r from-[#581c87] to-[#7c3aed]'
                          }`}
                          title={`${meta.label}: ${meta.desc}`}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className={`h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs transition-transform ${
                                isColActive ? 'scale-125 ring-2 ring-white' : ''
                              }`}
                              style={{ backgroundColor: meta.color }}
                            />
                            <span>{type}</span>
                          </div>
                        </th>
                      );
                    })}

                    {/* Sticky Top-Right Header: Total */}
                    <th
                      className={`sticky right-0 top-0 z-30 border border-slate-200 px-4 py-3 text-center font-display font-extrabold text-white shadow-xs ${
                        isPermit
                          ? 'bg-gradient-to-r from-blue-700 to-indigo-800'
                          : 'bg-gradient-to-r from-purple-700 to-violet-800'
                      }`}
                    >
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {departments.map((department) => {
                    const rowSum = departmentTotal(department);
                    const isRowActive = hoveredCell?.department === department;

                    return (
                      <tr
                        key={department}
                        className={`transition-colors ${
                          isRowActive
                            ? isPermit
                              ? 'bg-sky-50/70'
                              : 'bg-purple-50/70'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Sticky Left: Department Name with Row Crosshair Highlight */}
                        <td
                          className={`${cellClass} sticky left-0 z-10 whitespace-nowrap font-medium border-r border-slate-200 shadow-2xs transition-colors ${
                            isRowActive
                              ? isPermit
                                ? 'bg-sky-50 text-blue-950 font-bold border-l-4 border-l-blue-600 shadow-sm'
                                : 'bg-purple-50 text-purple-950 font-bold border-l-4 border-l-purple-600 shadow-sm'
                              : 'bg-white text-slate-800'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (onCellDrillDown) {
                                onCellDrillDown(department, 'ALL', getRecordsForDepartment(department));
                              }
                            }}
                            className={`text-left font-semibold hover:underline cursor-pointer transition-colors ${
                              isRowActive
                                ? isPermit
                                  ? 'text-blue-700 font-bold'
                                  : 'text-purple-700 font-bold'
                                : 'text-slate-800'
                            }`}
                            title={`Inspect all records for ${department}`}
                          >
                            {department}
                          </button>
                        </td>

                        {/* Counts per Type with Dual-Axis Crosshairs & Density Badges */}
                        {types.map((type) => {
                          const cellRecords = getRecordsForCell(department, type);
                          const count = cellRecords.length;
                          const meta = isPermit ? getPermitTypeMeta(type) : getIsolationTypeMeta(type);

                          const isCellActive =
                            hoveredCell?.department === department && hoveredCell?.type === type;
                          const isCrosshair =
                            hoveredCell &&
                            (hoveredCell.department === department || hoveredCell.type === type);
                          const density = getCountDensityBadge(
                            count,
                            meta.badgeBg,
                            meta.badgeText,
                            meta.borderClass
                          );

                          return (
                            <td
                              key={type}
                              onMouseEnter={() => setHoveredCell({ department, type })}
                              onMouseLeave={() => setHoveredCell(null)}
                              className={`${numberClass} transition-colors ${
                                isCellActive
                                  ? 'bg-blue-100/80 ring-2 ring-blue-500 z-10 relative'
                                  : isCrosshair
                                  ? isPermit
                                    ? 'bg-sky-50/40'
                                    : 'bg-purple-50/40'
                                  : ''
                              }`}
                            >
                              {count > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onCellDrillDown) {
                                      onCellDrillDown(department, type, cellRecords);
                                    }
                                  }}
                                  className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md font-mono text-xs transition-all transform hover:scale-110 cursor-pointer shadow-2xs ${
                                    density.badgeClass
                                  } ${isCellActive ? 'ring-2 ring-blue-600 scale-105' : ''}`}
                                  title={`Inspect ${count} ${meta.label} record(s) for ${department}`}
                                >
                                  <span>{count}</span>
                                  {density.isHigh && (
                                    <span
                                      className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping inline-block"
                                      title="High volume density (6+ records)"
                                    />
                                  )}
                                </button>
                              ) : (
                                <span className="text-slate-300 font-light select-none">—</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Sticky Right: Department Total with Row Crosshair Highlight */}
                        <td
                          className={`sticky right-0 z-10 border border-slate-200 px-4 py-2.5 text-center font-mono font-bold text-xs border-l shadow-2xs transition-colors ${
                            isRowActive
                              ? isPermit
                                ? 'bg-blue-100 text-blue-950 font-black border-l-blue-400 ring-1 ring-blue-300'
                                : 'bg-purple-100 text-purple-950 font-black border-l-purple-400 ring-1 ring-purple-300'
                              : isPermit
                              ? 'bg-blue-50/90 text-blue-900 border-l-blue-200'
                              : 'bg-purple-50/90 text-purple-900 border-l-purple-200'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (onCellDrillDown) {
                                onCellDrillDown(department, 'ALL', getRecordsForDepartment(department));
                              }
                            }}
                            className="font-bold hover:underline cursor-pointer"
                            title={`Inspect all ${rowSum} records for ${department}`}
                          >
                            {rowSum}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  {/* Sticky Bottom Footer: Grand Total with Column Crosshair Highlight */}
                  <tr
                    className={`font-bold shadow-xs ${
                      isPermit ? 'bg-blue-100/90 text-blue-950' : 'bg-purple-100/90 text-purple-950'
                    }`}
                  >
                    <td
                      className={`sticky bottom-0 left-0 z-30 border border-slate-300 px-4 py-3 font-display font-bold text-xs ${
                        isPermit ? 'bg-blue-100 text-blue-950' : 'bg-purple-100 text-purple-950'
                      }`}
                    >
                      Grand Total
                    </td>

                    {types.map((type) => {
                      const typeSum = typeTotal(type);
                      const meta = isPermit ? getPermitTypeMeta(type) : getIsolationTypeMeta(type);
                      const isColActive = hoveredCell?.type === type;

                      return (
                        <td
                          key={type}
                          className={`sticky bottom-0 z-10 border border-slate-300 px-3.5 py-3 text-center font-mono font-bold text-xs transition-colors ${
                            isColActive
                              ? isPermit
                                ? 'bg-blue-200 ring-2 ring-blue-500 font-black'
                                : 'bg-purple-200 ring-2 ring-purple-500 font-black'
                              : isPermit
                              ? 'bg-blue-100 text-blue-950'
                              : 'bg-purple-100 text-purple-950'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (onCellDrillDown) {
                                onCellDrillDown('ALL', type, getRecordsForType(type));
                              }
                            }}
                            className="font-bold hover:underline cursor-pointer"
                            title={`Inspect all ${typeSum} records for ${meta.label}`}
                          >
                            {typeSum}
                          </button>
                        </td>
                      );
                    })}

                    <td
                      className={`sticky bottom-0 right-0 z-30 border border-slate-300 px-4 py-3 text-center font-mono font-extrabold text-sm ${
                        isPermit ? 'bg-blue-200 text-blue-950' : 'bg-purple-200 text-purple-950'
                      }`}
                    >
                      {total}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>
                Showing <strong>{total}</strong> {isPermit ? 'permit' : 'isolation'} records from{' '}
                {formatDate(startDate)} to {formatDate(endDate)}.
              </span>
              <span className="hidden sm:inline text-slate-400">
                Tip: Click any number badge to inspect records in detail.
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default ReportSection;
