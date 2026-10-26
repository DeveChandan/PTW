import React from 'react';
import { ReportSection } from './ReportSection';
import type { Preset, ReportRecord } from './reportConstants';

export interface IsolationTypeProps {
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

export const IsolationType: React.FC<IsolationTypeProps> = ({
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
  return (
    <ReportSection
      title="Isolation Type Cross-Tabulation Report"
      category="isolation"
      records={records}
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
  );
};

export default IsolationType;
