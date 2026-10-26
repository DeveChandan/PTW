import React, { useState, useMemo } from 'react';
import { ReportSection } from './ReportSection';
import { PermitTypeDailyAnalytics } from './PermitTypeDailyAnalytics';
import type { Preset, ReportRecord, WorkTypeMode } from './reportConstants';
import { expandRecordsWithWorkTypes } from './reportConstants';

export interface PermitTypeCodeProps {
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
  onCellDrillDown?: (department: string, type: string, records: ReportRecord[]) => void;
}

type PermitReportView = 'all' | 'daily' | 'matrix';

export const PermitTypeCode: React.FC<PermitTypeCodeProps> = ({
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
  isInitialView,
  onCellDrillDown,
}) => {
  // 1. Work Type Mode: 'actual' (primary permit type only) vs 'with-additional' (combined) vs 'additional-only'
  const [workTypeMode, setWorkTypeMode] = useState<WorkTypeMode>('actual');

  // 2. Section Sub-View: 'all' (stacked) vs 'daily' (daily count & chart) vs 'matrix' (department cross-tab)
  const [activeView, setActiveView] = useState<PermitReportView>('all');

  // 3. Expand or filter records based on selected WorkTypeMode
  const displayRecords = useMemo(() => {
    return expandRecordsWithWorkTypes(records, workTypeMode);
  }, [records, workTypeMode]);

  const actualCount = useMemo(() => {
    return records.filter((r) => !r.isAdditional).length;
  }, [records]);

  const additionalCount = useMemo(() => {
    return records.reduce((acc, r) => acc + (r.additionalTypes?.length || 0), 0);
  }, [records]);

  const dynamicMatrixTitle = useMemo(() => {
    if (workTypeMode === 'with-additional') {
      return 'Permit Category Cross-Tabulation (Primary + Additional Applicable Categories · SAP _WorkType)';
    }
    if (workTypeMode === 'additional-only') {
      return 'Additional Applicable Work Categories Cross-Tabulation (SAP _WorkType Only)';
    }
    return 'Permit Category / Type Cross-Tabulation (SAP Config OData - Primary / Actual)';
  }, [workTypeMode]);

  return (
    <div className="space-y-6">
      {/* Top Navigation & View Switcher Bar for Permit Type Module */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-[#006398] font-bold text-sm shadow-2xs">
            <span className="material-symbols-outlined text-[20px]">assignment</span>
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-bold font-display text-slate-900">
              Permit Type Reports &amp; Daily Analytics
            </h3>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-blue-100 text-[#006398] border border-blue-200">
                {actualCount} Primary / Actual (SAP Config OData)
              </span>
              {additionalCount > 0 && (
                <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  +{additionalCount} Active Categories · _WorkType Active (additional)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50/90 p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveView('all')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeView === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">view_agenda</span>
            <span>All Views</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('daily')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeView === 'daily'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">calendar_month</span>
            <span>Daily Count &amp; Chart</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('matrix')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeView === 'matrix'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">grid_on</span>
            <span>Department Matrix</span>
          </button>
        </div>
      </div>

      {/* 1. Daily Permit Creation Count & Visual Chart Section */}
      {(activeView === 'all' || activeView === 'daily') && (
        <PermitTypeDailyAnalytics
          records={records}
          workTypeMode={workTypeMode}
          onWorkTypeModeChange={setWorkTypeMode}
          startDate={startDate}
          endDate={endDate}
          onCellDrillDown={onCellDrillDown}
        />
      )}

      {/* 2. Department-wise Cross-Tabulation Matrix Section */}
      {(activeView === 'all' || activeView === 'matrix') && (
        <ReportSection
          title={dynamicMatrixTitle}
          category="permit"
          records={displayRecords}
          startDate={startDate}
          endDate={endDate}
          onStartDate={onStartDate}
          onEndDate={onEndDate}
          searchOpen={searchOpen}
          onToggleSearch={onToggleSearch}
          search={search}
          onSearch={onSearch}
          selectedPresets={selectedPresets}
          onTogglePreset={onTogglePreset}
          presetOpen={presetOpen}
          onTogglePresetMenu={onTogglePresetMenu}
          onClearPresets={onClearPresets}
          isInitialView={isInitialView}
          onCellDrillDown={onCellDrillDown}
        />
      )}
    </div>
  );
};

export default PermitTypeCode;
