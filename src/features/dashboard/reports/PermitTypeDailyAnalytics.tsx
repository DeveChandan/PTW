import React, { useState, useMemo } from 'react';
import type { ReportRecord, WorkTypeMode } from './reportConstants';
import {
  getPermitTypeMeta,
  formatDate,
  exportToCSV,
  ALL_APPLICATION_PERMIT_TYPES,
  normalizePermitType,
  getCountDensityBadge,
} from './reportConstants';

export interface PermitTypeDailyAnalyticsProps {
  records: ReportRecord[];
  workTypeMode: WorkTypeMode;
  onWorkTypeModeChange: (mode: WorkTypeMode) => void;
  startDate: string;
  endDate: string;
  onCellDrillDown?: (dateOrDept: string, type: string, records: ReportRecord[]) => void;
}

type ChartMode = 'stacked' | 'grouped' | 'trend';
export type TimeframeFilter = 'all' | '7d' | '14d' | '30d' | 'month';

// Formatter for short date labels on X axis, e.g. "24 Oct"
function formatShortDate(isoDate: string): string {
  if (!isoDate) return '—';
  try {
    const d = new Date(`${isoDate}T12:00:00`);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return isoDate;
  }
}

// Formatter for day of week badge, e.g. "Sat"
function formatDayOfWeek(isoDate: string): string {
  if (!isoDate) return '';
  try {
    const d = new Date(`${isoDate}T12:00:00`);
    return d.toLocaleDateString('en-IN', { weekday: 'short' });
  } catch {
    return '';
  }
}

// Generate smooth cubic Bézier SVG path from array of coordinates
function buildSmoothSplinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export const PermitTypeDailyAnalytics: React.FC<PermitTypeDailyAnalyticsProps> = ({
  records,
  workTypeMode,
  onWorkTypeModeChange,
  startDate,
  endDate,
  onCellDrillDown,
}) => {
  const [chartMode, setChartMode] = useState<ChartMode>('stacked');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Column Scope Toggle: All standard application types (11) vs Active only
  const [showAllApplicationTypes, setShowAllApplicationTypes] = useState<boolean>(true);

  // Quick Timeframe Filter: All, 7 Days, 14 Days, 30 Days, Latest Month
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>('all');

  // Dual-Axis Crosshair State: highlights row (date) and column (permit type) simultaneously
  const [hoveredCell, setHoveredCell] = useState<{ date: string; type: string } | null>(null);

  // 1. Separate actual permits vs additional work types in the underlying set
  const actualPermitsCount = useMemo(() => {
    return records.filter((r) => !r.isAdditional).length;
  }, [records]);

  const additionalWorkTypesCount = useMemo(() => {
    return records.reduce((acc, r) => acc + (r.additionalTypes?.length || 0), 0);
  }, [records]);

  // Set of types actually present in records
  const presentTypesSet = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.type) set.add(normalizePermitType(r.type));
      if (workTypeMode !== 'actual' && r.additionalTypes) {
        r.additionalTypes.forEach((t) => set.add(normalizePermitType(t)));
      }
    });
    return set;
  }, [records, workTypeMode]);

  // 2. Discover all distinct permit types to display
  const permitTypes = useMemo(() => {
    if (!showAllApplicationTypes) {
      // Active types only, ordered by standard application categories
      const active = ALL_APPLICATION_PERMIT_TYPES.filter((t) => presentTypesSet.has(t));
      const custom = [...presentTypesSet].filter((t) => !ALL_APPLICATION_PERMIT_TYPES.includes(t as any)).sort();
      return [...active, ...custom];
    }

    // All application types in standard procedure order + any extra custom codes
    const custom = [...presentTypesSet].filter((t) => !ALL_APPLICATION_PERMIT_TYPES.includes(t as any)).sort();
    return [...ALL_APPLICATION_PERMIT_TYPES, ...custom];
  }, [showAllApplicationTypes, presentTypesSet]);

  // 3. Compute day-by-day record aggregations
  const dailyData = useMemo(() => {
    // Map of date -> list of records
    const dateMap = new Map<string, ReportRecord[]>();

    records.forEach((r) => {
      if (!r.date) return;
      const list = dateMap.get(r.date) || [];
      list.push(r);
      dateMap.set(r.date, list);
    });

    // Sort dates
    const sortedDates = [...dateMap.keys()].sort((a, b) => {
      return sortDirection === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
    });

    return sortedDates.map((date) => {
      const dayRecords = dateMap.get(date) || [];
      const typeCounts: Record<string, number> = {};
      const typeRecordsMap: Record<string, ReportRecord[]> = {};

      permitTypes.forEach((t) => {
        typeCounts[t] = 0;
        typeRecordsMap[t] = [];
      });

      let actualCountOnDay = 0;
      let additionalCountOnDay = 0;

      dayRecords.forEach((r) => {
        const t = normalizePermitType(r.type);
        if (t) {
          typeCounts[t] = (typeCounts[t] || 0) + 1;
          const currentList = typeRecordsMap[t] || [];
          currentList.push(r);
          typeRecordsMap[t] = currentList;
        }

        if (r.isAdditional) {
          additionalCountOnDay++;
        } else {
          actualCountOnDay++;
        }
      });

      const totalOnDay = dayRecords.length;

      return {
        date,
        dayRecords,
        typeCounts,
        typeRecordsMap,
        totalOnDay,
        actualCountOnDay,
        additionalCountOnDay,
      };
    });
  }, [records, permitTypes, sortDirection]);

  // Filter daily data by quick timeframe and search query
  const filteredDailyData = useMemo(() => {
    let list = dailyData;

    // Apply quick timeframe filter
    if (timeframeFilter !== 'all' && list.length > 0) {
      if (timeframeFilter === '7d') {
        list = list.slice(0, 7);
      } else if (timeframeFilter === '14d') {
        list = list.slice(0, 14);
      } else if (timeframeFilter === '30d') {
        list = list.slice(0, 30);
      } else if (timeframeFilter === 'month') {
        // match the latest month present in the data
        const latestMonth = list[0].date.substring(0, 7);
        list = list.filter((d) => d.date.startsWith(latestMonth));
      }
    }

    if (!searchFilter.trim()) return list;
    const q = searchFilter.trim().toLowerCase();
    return list.filter((d) => {
      const formatted = formatDate(d.date).toLowerCase();
      const raw = d.date.toLowerCase();
      const dayName = formatDayOfWeek(d.date).toLowerCase();
      return raw.includes(q) || formatted.includes(q) || dayName.includes(q);
    });
  }, [dailyData, timeframeFilter, searchFilter]);

  // Column totals across all filtered days
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    permitTypes.forEach((t) => {
      totals[t] = filteredDailyData.reduce((sum, d) => sum + (d.typeCounts[t] || 0), 0);
    });
    const grandTotal = filteredDailyData.reduce((sum, d) => sum + d.totalOnDay, 0);
    return { totals, grandTotal };
  }, [filteredDailyData, permitTypes]);

  // Peak creation day
  const peakDay = useMemo(() => {
    if (dailyData.length === 0) return null;
    let max = dailyData[0];
    dailyData.forEach((d) => {
      if (d.totalOnDay > max.totalOnDay) max = d;
    });
    return max;
  }, [dailyData]);

  // Top permit type
  const topType = useMemo(() => {
    let topCode = '';
    let maxCount = -1;
    permitTypes.forEach((t) => {
      const count = columnTotals.totals[t] || 0;
      if (count > maxCount) {
        maxCount = count;
        topCode = t;
      }
    });
    return topCode ? { code: topCode, count: maxCount, meta: getPermitTypeMeta(topCode) } : null;
  }, [permitTypes, columnTotals]);

  // Daily average
  const dailyAverage = useMemo(() => {
    if (dailyData.length === 0) return '0.0';
    const total = dailyData.reduce((sum, d) => sum + d.totalOnDay, 0);
    return (total / dailyData.length).toFixed(1);
  }, [dailyData]);

  // Export Daily Counts CSV
  const handleExportCSV = () => {
    const headers = ['Date', 'Day', ...permitTypes, 'Daily Total', 'Actual Permits', 'Additional Work Types'];
    const rows = filteredDailyData.map((d) => [
      `"${d.date}"`,
      `"${formatDayOfWeek(d.date)}"`,
      ...permitTypes.map((t) => d.typeCounts[t] || 0),
      d.totalOnDay,
      d.actualCountOnDay,
      d.additionalCountOnDay,
    ]);

    rows.push([
      `"Grand Total"`,
      `"—"`,
      ...permitTypes.map((t) => columnTotals.totals[t] || 0),
      columnTotals.grandTotal,
      records.filter((r) => !r.isAdditional).length,
      records.filter((r) => r.isAdditional).length,
    ]);

    exportToCSV(`GFL-permit-type-daily-creation-count-${workTypeMode}.csv`, headers, rows);
  };

  // 4. SVG Chart Coordinates Calculation
  // We chronologically sort data for the chart from left to right (oldest to newest)
  const chartData = useMemo(() => {
    return [...dailyData].sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyData]);

  const maxDailyCount = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.totalOnDay), 1);
    // Round up to nice number for grid
    return Math.ceil(max / 5) * 5 || 5;
  }, [chartData]);

  const chartWidth = 960;
  const chartHeight = 220;
  const paddingLeft = 45;
  const paddingRight = 25;
  const paddingTop = 20;
  const paddingBottom = 40;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const barCount = Math.max(chartData.length, 1);
  const barSlotWidth = innerWidth / barCount;
  const barWidth = Math.min(Math.max(barSlotWidth * 0.65, 14), 44);

  // Hovered item details for floating tooltip
  const hoveredItem = useMemo(() => {
    if (!hoveredDate) return null;
    return dailyData.find((d) => d.date === hoveredDate) || null;
  }, [hoveredDate, dailyData]);

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs font-bold text-xs">
              <span className="material-symbols-outlined text-[16px]">calendar_month</span>
            </span>
            <h2 className="text-base sm:text-lg font-bold font-display text-slate-900">
              Daily Permit Type Creation Count &amp; Trend
            </h2>
            <span className="rounded-md bg-blue-100 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-800">
              {dailyData.length} Days Active
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Day-by-day creation count across Dahej units. Compare <strong>Permit Category / Type (SAP Config OData - Primary/Actual)</strong> with <strong>Additional Applicable Work Categories (SAP child table _WorkType)</strong> for combined activity insights.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Work Type Mode Switcher Pill */}
          <div className="flex rounded-xl border border-slate-200 bg-slate-50/90 p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => onWorkTypeModeChange('actual')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                workTypeMode === 'actual'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="Permit Category / Type (SAP Config OData) - Primary / Actual authorization category from Section 2.1"
            >
              <span>Permit Category / Type (Primary)</span>
              <span className={`ml-1.5 px-1.5 py-0.2 rounded font-mono text-[10px] ${
                workTypeMode === 'actual' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {actualPermitsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onWorkTypeModeChange('with-additional')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                workTypeMode === 'with-additional'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="Includes primary category plus Additional Applicable Work Categories stored in SAP child table _WorkType"
            >
              <span>With Additional (_WorkType)</span>
              <span className={`ml-1.5 px-1.5 py-0.2 rounded font-mono text-[10px] ${
                workTypeMode === 'with-additional' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
              }`}>
                +{additionalWorkTypesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onWorkTypeModeChange('additional-only')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                workTypeMode === 'additional-only'
                  ? 'bg-purple-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="Shows only supplementary work categories attached via SAP child table _WorkType"
            >
              <span>Additional Only (_WorkType)</span>
            </button>
          </div>

          {/* Quick Timeframe Filter Chips */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/90 p-0.5 shadow-2xs">
            {(
              [
                ['all', 'All Days', 'calendar_view_month'],
                ['7d', '7 Days', 'looks_one'],
                ['14d', '14 Days', 'looks_two'],
                ['30d', '30 Days', 'today'],
                ['month', 'This Month', 'calendar_today'],
              ] as const
            ).map(([key, label, iconName]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTimeframeFilter(key)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                  timeframeFilter === key
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title={`Filter window to ${label}`}
              >
                <span className="material-symbols-outlined text-[13px]">{iconName}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Column Scope Toggle: All 11 Application Types vs Active Only */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/90 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setShowAllApplicationTypes(true)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                showAllApplicationTypes
                  ? 'bg-[#006398] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show columns for all 11 standard application categories defined in procedure"
            >
              <span className="material-symbols-outlined text-[14px]">apps</span>
              <span>All Types ({ALL_APPLICATION_PERMIT_TYPES.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAllApplicationTypes(false)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                !showAllApplicationTypes
                  ? 'bg-[#006398] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show only columns that have active permits in the selected period"
            >
              <span className="material-symbols-outlined text-[14px]">filter_list</span>
              <span>Active ({presentTypesSet.size})</span>
            </button>
          </div>

          {/* Export CSV Button */}
          {filteredDailyData.length > 0 && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition shadow-2xs cursor-pointer"
              title="Export Daily Count Matrix to CSV"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Key Daily Summary KPI Cards with Cohesive Corporate Color Palette */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Metric 1: Total Created */}
        <div className="rounded-xl border border-slate-200/90 border-t-4 border-t-[#006398] bg-gradient-to-br from-white via-white to-sky-50/70 p-3.5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              {workTypeMode === 'actual' ? 'Permits (Primary)' : workTypeMode === 'with-additional' ? 'Combined Tasks' : 'Additional Only'}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-[#006398] text-xs font-black shadow-2xs">
              Σ
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-display text-slate-900">
              {columnTotals.grandTotal}
            </span>
            <span className="text-[10px] font-mono font-medium text-slate-500">
              in window
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium truncate">
            {workTypeMode === 'actual'
              ? `${actualPermitsCount} primary permits (SAP Config OData)`
              : workTypeMode === 'with-additional'
              ? `${actualPermitsCount} primary + ${additionalWorkTypesCount} _WorkType active`
              : `${additionalWorkTypesCount} active categories (_WorkType)`}
          </p>
        </div>

        {/* Metric 2: Daily Average */}
        <div className="rounded-xl border border-slate-200/90 border-t-4 border-t-emerald-600 bg-gradient-to-br from-white via-white to-emerald-50/70 p-3.5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Daily Average</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold shadow-2xs">
              <span className="material-symbols-outlined text-[15px]">trending_up</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-display text-emerald-950">
              {dailyAverage}
            </span>
            <span className="text-[10px] font-mono font-medium text-emerald-700">
              / active day
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">
            Across {filteredDailyData.length} operating days
          </p>
        </div>

        {/* Metric 3: Peak Creation Day */}
        <div className="rounded-xl border border-slate-200/90 border-t-4 border-t-amber-500 bg-gradient-to-br from-white via-white to-amber-50/70 p-3.5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Peak Volume Day</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800 text-xs font-bold shadow-2xs">
              <span className="material-symbols-outlined text-[15px]">grade</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-display text-amber-950">
              {peakDay ? peakDay.totalOnDay : 0}
            </span>
            <span className="text-[10px] font-mono font-medium text-amber-700">
              permits
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium truncate">
            {peakDay ? formatDate(peakDay.date) : 'No data'}
          </p>
        </div>

        {/* Metric 4: Top Permit Type */}
        <div className="rounded-xl border border-slate-200/90 border-t-4 border-t-rose-500 bg-gradient-to-br from-white via-white to-rose-50/70 p-3.5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Top Permit Type</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-700 text-xs font-bold shadow-2xs">
              <span className="material-symbols-outlined text-[15px]">local_fire_department</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-display text-slate-900">
              {topType ? topType.code : '—'}
            </span>
            <span className="text-[10px] font-mono font-medium text-rose-700">
              {topType ? `${topType.count} permits` : ''}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium truncate">
            {topType ? topType.meta.label : 'None'}
          </p>
        </div>

        {/* Metric 5: Combined Work Ratio */}
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200/90 border-t-4 border-t-indigo-600 bg-gradient-to-br from-white via-white to-indigo-50/70 p-3.5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">Multi-Type Ratio</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold shadow-2xs">
              <span className="material-symbols-outlined text-[15px]">layers</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-display text-indigo-950">
              {actualPermitsCount > 0
                ? `${Math.round((additionalWorkTypesCount / actualPermitsCount) * 100)}%`
                : '0%'}
            </span>
            <span className="text-[10px] font-mono font-medium text-indigo-700">
              expansion
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium truncate">
            +{additionalWorkTypesCount} additional tasks attached
          </p>
        </div>
      </div>

      {/* 3. Interactive Daily Trend Chart */}
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs sm:text-sm font-bold font-display text-slate-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#006398]">query_stats</span>
              Daily Permit Type Creation Trend
            </h3>
            <p className="text-[11px] text-slate-500">
              {chartMode === 'stacked'
                ? 'Stacked distribution showing proportion of each permit type created per day.'
                : chartMode === 'grouped'
                ? 'Clustered bar comparison across active permit types.'
                : 'Timeline wave displaying overall daily permit creation curve.'}
            </p>
          </div>

          {/* Chart Mode Switcher */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setChartMode('stacked')}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                chartMode === 'stacked'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">stacked_bar_chart</span>
              <span>Stacked</span>
            </button>

            <button
              type="button"
              onClick={() => setChartMode('grouped')}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                chartMode === 'grouped'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">bar_chart</span>
              <span>Grouped</span>
            </button>

            <button
              type="button"
              onClick={() => setChartMode('trend')}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                chartMode === 'trend'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">show_chart</span>
              <span>Area Trend</span>
            </button>
          </div>
        </div>

        {/* SVG Chart Surface */}
        <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          {chartData.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center text-center text-slate-400">
              <span className="material-symbols-outlined text-[36px] text-slate-300 mb-1">bar_chart</span>
              <p className="text-xs font-medium">No permit creation records in the selected period.</p>
            </div>
          ) : (
            <svg
              className="w-full h-auto min-w-[700px] select-none"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="dailyTrendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#006398" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#006398" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Y Axis Gridlines & Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const yVal = Math.round(maxDailyCount * ratio);
                const yPos = paddingTop + innerHeight - ratio * innerHeight;
                return (
                  <g key={ratio}>
                    <line
                      x1={paddingLeft}
                      y1={yPos}
                      x2={chartWidth - paddingRight}
                      y2={yPos}
                      stroke="#e2e8f0"
                      strokeDasharray={ratio === 0 ? 'none' : '3 3'}
                      strokeWidth={ratio === 0 ? 1.5 : 1}
                    />
                    <text
                      x={paddingLeft - 8}
                      y={yPos + 3.5}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono font-medium"
                    >
                      {yVal}
                    </text>
                  </g>
                );
              })}

              {/* Chart Mode: Stacked Bar */}
              {chartMode === 'stacked' &&
                chartData.map((d, i) => {
                  const xCenter = paddingLeft + (i + 0.5) * barSlotWidth;
                  const xLeft = xCenter - barWidth / 2;
                  let currentY = paddingTop + innerHeight;
                  const isHovered = hoveredDate === d.date;

                  return (
                    <g
                      key={d.date}
                      onMouseEnter={() => setHoveredDate(d.date)}
                      onMouseLeave={() => setHoveredDate(null)}
                      className="cursor-pointer transition-opacity"
                      style={{ opacity: hoveredDate && !isHovered ? 0.45 : 1 }}
                    >
                      {/* Background highlight bar on hover */}
                      {isHovered && (
                        <rect
                          x={xCenter - barSlotWidth / 2 + 2}
                          y={paddingTop}
                          width={barSlotWidth - 4}
                          height={innerHeight}
                          fill="#f0f9ff"
                          rx={6}
                        />
                      )}

                      {/* Stacked type segments */}
                      {permitTypes.map((type, tIdx) => {
                        const count = d.typeCounts[type] || 0;
                        if (count === 0) return null;
                        if (activeTypeFilter && activeTypeFilter !== type) return null;

                        const meta = getPermitTypeMeta(type);
                        const segHeight = (count / maxDailyCount) * innerHeight;
                        currentY -= segHeight;

                        // Check if this is top segment for rounded corners
                        const isTop = tIdx === permitTypes.length - 1 || currentY <= paddingTop + innerHeight - (d.totalOnDay / maxDailyCount) * innerHeight + 1;

                        return (
                          <rect
                            key={type}
                            x={xLeft}
                            y={currentY}
                            width={barWidth}
                            height={Math.max(segHeight, 1.5)}
                            fill={meta.color}
                            rx={isTop ? 4 : 0}
                            className="transition-all hover:brightness-110"
                          />
                        );
                      })}

                      {/* Total label above bar */}
                      {d.totalOnDay > 0 && (
                        <text
                          x={xCenter}
                          y={paddingTop + innerHeight - (d.totalOnDay / maxDailyCount) * innerHeight - 5}
                          textAnchor="middle"
                          className="fill-slate-700 text-[10px] font-mono font-bold"
                        >
                          {d.totalOnDay}
                        </text>
                      )}

                      {/* X-axis date label */}
                      <text
                        x={xCenter}
                        y={chartHeight - paddingBottom + 16}
                        textAnchor="middle"
                        className={`text-[10px] font-mono ${
                          isHovered ? 'fill-blue-700 font-bold' : 'fill-slate-500'
                        }`}
                      >
                        {formatShortDate(d.date)}
                      </text>
                      <text
                        x={xCenter}
                        y={chartHeight - paddingBottom + 28}
                        textAnchor="middle"
                        className="fill-slate-400 text-[9px] font-mono"
                      >
                        {formatDayOfWeek(d.date)}
                      </text>
                    </g>
                  );
                })}

              {/* Chart Mode: Grouped Bar */}
              {chartMode === 'grouped' &&
                chartData.map((d, i) => {
                  const xSlotLeft = paddingLeft + i * barSlotWidth + 4;
                  const activeTypesForGroup = activeTypeFilter
                    ? [activeTypeFilter]
                    : permitTypes.filter((t) => (d.typeCounts[t] || 0) > 0);

                  const groupBarWidth = Math.max(
                    Math.min((barSlotWidth - 8) / Math.max(activeTypesForGroup.length, 1), 16),
                    4
                  );

                  const isHovered = hoveredDate === d.date;

                  return (
                    <g
                      key={d.date}
                      onMouseEnter={() => setHoveredDate(d.date)}
                      onMouseLeave={() => setHoveredDate(null)}
                      className="cursor-pointer"
                      style={{ opacity: hoveredDate && !isHovered ? 0.45 : 1 }}
                    >
                      {isHovered && (
                        <rect
                          x={paddingLeft + i * barSlotWidth}
                          y={paddingTop}
                          width={barSlotWidth}
                          height={innerHeight}
                          fill="#f0f9ff"
                          rx={6}
                        />
                      )}

                      {activeTypesForGroup.map((type, tIdx) => {
                        const count = d.typeCounts[type] || 0;
                        const meta = getPermitTypeMeta(type);
                        const barH = (count / maxDailyCount) * innerHeight;
                        const bx = xSlotLeft + tIdx * (groupBarWidth + 2);
                        const by = paddingTop + innerHeight - barH;

                        return (
                          <rect
                            key={type}
                            x={bx}
                            y={by}
                            width={groupBarWidth}
                            height={Math.max(barH, 1.5)}
                            fill={meta.color}
                            rx={3}
                          />
                        );
                      })}

                      {/* X-axis date label */}
                      <text
                        x={paddingLeft + (i + 0.5) * barSlotWidth}
                        y={chartHeight - paddingBottom + 16}
                        textAnchor="middle"
                        className={`text-[10px] font-mono ${
                          isHovered ? 'fill-blue-700 font-bold' : 'fill-slate-500'
                        }`}
                      >
                        {formatShortDate(d.date)}
                      </text>
                      <text
                        x={paddingLeft + (i + 0.5) * barSlotWidth}
                        y={chartHeight - paddingBottom + 28}
                        textAnchor="middle"
                        className="fill-slate-400 text-[9px] font-mono"
                      >
                        {formatDayOfWeek(d.date)}
                      </text>
                    </g>
                  );
                })}

              {/* Chart Mode: Area Trend Wave */}
              {chartMode === 'trend' && (() => {
                const points = chartData.map((d, i) => ({
                  x: paddingLeft + (i + 0.5) * barSlotWidth,
                  y: paddingTop + innerHeight - (d.totalOnDay / maxDailyCount) * innerHeight,
                }));

                const splinePath = buildSmoothSplinePath(points);
                const areaPath = `${splinePath} L ${points[points.length - 1].x} ${
                  paddingTop + innerHeight
                } L ${points[0].x} ${paddingTop + innerHeight} Z`;

                return (
                  <g>
                    {/* Area under spline */}
                    <path d={areaPath} fill="url(#dailyTrendGradient)" />

                    {/* Smooth curve */}
                    <path
                      d={splinePath}
                      fill="none"
                      stroke="#006398"
                      strokeWidth={3}
                      strokeLinecap="round"
                    />

                    {/* Data Points */}
                    {chartData.map((d, i) => {
                      const pt = points[i];
                      const isHovered = hoveredDate === d.date;
                      return (
                        <g
                          key={d.date}
                          onMouseEnter={() => setHoveredDate(d.date)}
                          onMouseLeave={() => setHoveredDate(null)}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isHovered ? 6 : 4}
                            fill={isHovered ? '#0284c7' : '#006398'}
                            stroke="#ffffff"
                            strokeWidth={2}
                            className="transition-all"
                          />
                          <text
                            x={pt.x}
                            y={pt.y - 8}
                            textAnchor="middle"
                            className="fill-slate-800 text-[10px] font-mono font-bold"
                          >
                            {d.totalOnDay}
                          </text>

                          {/* X-axis date label */}
                          <text
                            x={pt.x}
                            y={chartHeight - paddingBottom + 16}
                            textAnchor="middle"
                            className={`text-[10px] font-mono ${
                              isHovered ? 'fill-blue-700 font-bold' : 'fill-slate-500'
                            }`}
                          >
                            {formatShortDate(d.date)}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}
            </svg>
          )}

          {/* Floating Hover Card */}
          {hoveredItem && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-950 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-700 text-[18px]">event</span>
                <span className="font-bold font-display text-sm">
                  {formatDate(hoveredItem.date)} ({formatDayOfWeek(hoveredItem.date)})
                </span>
                <span className="rounded-md bg-blue-600 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                  {hoveredItem.totalOnDay} permits created
                </span>
                {workTypeMode === 'with-additional' && (
                  <span className="text-[11px] font-mono text-slate-600">
                    ({hoveredItem.actualCountOnDay} Actual + {hoveredItem.additionalCountOnDay} Additional Work Types)
                  </span>
                )}
              </div>

              {/* Type pills on hovered date */}
              <div className="flex flex-wrap items-center gap-1.5">
                {permitTypes.map((t) => {
                  const count = hoveredItem.typeCounts[t] || 0;
                  if (count === 0) return null;
                  const meta = getPermitTypeMeta(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        if (onCellDrillDown) {
                          onCellDrillDown(hoveredItem.date, t, hoveredItem.typeRecordsMap[t]);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold bg-white text-slate-800 border border-slate-200 hover:border-blue-400 hover:bg-blue-100 transition shadow-2xs cursor-pointer"
                      title={`Inspect ${count} ${t} permit(s) on ${hoveredItem.date}`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                      <span>{t}:</span>
                      <span className="text-blue-700">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Chart Legend with Type Filter Toggles */}
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
          <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">
            Legend:
          </span>
          {permitTypes.map((type) => {
            const meta = getPermitTypeMeta(type);
            const total = columnTotals.totals[type] || 0;
            const isSelected = activeTypeFilter === type;

            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveTypeFilter(isSelected ? null : type)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer shadow-2xs ${
                  isSelected
                    ? 'border-blue-500 bg-blue-100/90 text-blue-900 font-bold ring-2 ring-blue-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
                title={`Click to ${isSelected ? 'clear filter' : `focus on ${meta.label}`}`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: meta.color }}
                />
                <span className="font-semibold">{type}</span>
                <span className="text-slate-400">({total})</span>
              </button>
            );
          })}

          {activeTypeFilter && (
            <button
              type="button"
              onClick={() => setActiveTypeFilter(null)}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer ml-1"
            >
              Show all types
            </button>
          )}
        </div>
      </div>

      {/* 4. Daily Count Table: Permit Types Created */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-600">table_chart</span>
            <h3 className="text-sm font-bold font-display text-slate-900">
              Daily Breakdown Matrix: Permit Types Created
            </h3>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 border border-slate-200">
              {filteredDailyData.length} Days
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Filter by Date */}
            <div className="relative">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter date (e.g. 24 Oct)..."
                className="w-48 sm:w-56 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 shadow-2xs"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            {/* Sort Toggle Button */}
            <button
              type="button"
              onClick={() => setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
              title={`Sort by Date: currently ${sortDirection === 'desc' ? 'Newest first' : 'Oldest first'}`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {sortDirection === 'desc' ? 'arrow_downward' : 'arrow_upward'}
              </span>
              <span>{sortDirection === 'desc' ? 'Newest' : 'Oldest'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Matrix Table */}
        <div className="max-h-[500px] overflow-auto rounded-xl border border-slate-200/90 shadow-2xs">
          <table
            className="border-collapse text-xs"
            style={{ width: 'max-content', minWidth: '100%' }}
          >
            <thead>
              <tr>
                {/* Sticky Left: Date Header */}
                <th className="sticky left-0 top-0 z-30 border border-slate-200 bg-gradient-to-r from-[#002f4a] to-[#004f7a] px-4 py-3 text-left font-display font-bold text-white shadow-xs">
                  Created Date
                </th>

                {/* Dynamic Permit Type Columns with active crosshair indicator */}
                {permitTypes.map((type) => {
                  const meta = getPermitTypeMeta(type);
                  const isColActive = hoveredCell?.type === type || activeTypeFilter === type;

                  return (
                    <th
                      key={type}
                      className={`sticky top-0 z-10 whitespace-nowrap border border-slate-200 px-3.5 py-3 text-center font-mono font-bold tracking-wider text-white shadow-xs transition-all ${
                        isColActive
                          ? 'bg-gradient-to-r from-blue-950 to-[#003b5c] ring-2 ring-cyan-400 shadow-md'
                          : 'bg-gradient-to-r from-[#004f7a] to-[#006398]'
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

                {/* Sticky Right: Daily Total Header */}
                <th className="sticky right-0 top-0 z-30 border border-slate-200 bg-gradient-to-r from-blue-700 to-indigo-800 px-4 py-3 text-center font-display font-extrabold text-white shadow-xs">
                  Daily Total
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredDailyData.length === 0 ? (
                <tr>
                  <td
                    colSpan={permitTypes.length + 2}
                    className="py-12 text-center text-xs text-slate-500 font-medium"
                  >
                    No daily permit creation records match the active criteria.
                  </td>
                </tr>
              ) : (
                filteredDailyData.map((d) => {
                  const isRowActive = hoveredCell?.date === d.date || hoveredDate === d.date;

                  return (
                    <tr
                      key={d.date}
                      className={`transition-colors ${
                        isRowActive ? 'bg-sky-50/70' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Sticky Date Column with Row Crosshair Highlight */}
                      <td
                        className={`sticky left-0 z-10 whitespace-nowrap border border-slate-200 px-4 py-2.5 text-left font-medium shadow-2xs transition-colors ${
                          isRowActive
                            ? 'bg-sky-50 text-blue-950 font-bold border-l-4 border-l-blue-600 shadow-sm'
                            : 'bg-white text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold border ${
                              isRowActive
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {formatDayOfWeek(d.date)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (onCellDrillDown) {
                                onCellDrillDown(d.date, 'ALL', d.dayRecords);
                              }
                            }}
                            className={`font-semibold hover:underline cursor-pointer ${
                              isRowActive ? 'text-blue-700 font-bold' : 'text-slate-900'
                            }`}
                            title={`Inspect all ${d.totalOnDay} permit(s) created on ${formatDate(d.date)}`}
                          >
                            {formatDate(d.date)}
                          </button>
                        </div>
                      </td>

                      {/* Counts per Permit Type with Dual-Axis Crosshair Highlighting & Density Badges */}
                      {permitTypes.map((type) => {
                        const count = d.typeCounts[type] || 0;
                        const cellRecords = d.typeRecordsMap[type] || [];
                        const meta = getPermitTypeMeta(type);

                        const isCellActive = hoveredCell?.date === d.date && hoveredCell?.type === type;
                        const isCrosshair =
                          hoveredCell && (hoveredCell.date === d.date || hoveredCell.type === type);
                        const density = getCountDensityBadge(
                          count,
                          meta.badgeBg,
                          meta.badgeText,
                          meta.borderClass
                        );

                        return (
                          <td
                            key={type}
                            onMouseEnter={() => setHoveredCell({ date: d.date, type })}
                            onMouseLeave={() => setHoveredCell(null)}
                            className={`border border-slate-200 px-3 py-2 text-center font-mono transition-colors ${
                              isCellActive
                                ? 'bg-blue-100/80 ring-2 ring-blue-500 z-10 relative'
                                : isCrosshair
                                ? 'bg-sky-50/40'
                                : ''
                            }`}
                          >
                            {count > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (onCellDrillDown) {
                                    onCellDrillDown(d.date, type, cellRecords);
                                  }
                                }}
                                className={`inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-1 font-mono text-xs transition-all transform hover:scale-110 cursor-pointer shadow-2xs ${
                                  density.badgeClass
                                } ${isCellActive ? 'ring-2 ring-blue-600 scale-105' : ''}`}
                                title={`Inspect ${count} ${type} permit(s) created on ${formatDate(d.date)}`}
                              >
                                <span>{count}</span>
                                {density.isHigh && (
                                  <span
                                    className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping inline-block"
                                    title="High daily volume concentration (6+ permits)"
                                  />
                                )}
                              </button>
                            ) : (
                              <span className="text-slate-300 font-light select-none">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Sticky Daily Total Column with Crosshair Highlight */}
                      <td
                        className={`sticky right-0 z-10 border border-slate-200 px-4 py-2.5 text-center font-mono font-bold text-xs border-l shadow-2xs transition-colors ${
                          isRowActive
                            ? 'bg-blue-100 text-blue-950 font-black border-l-blue-400 ring-1 ring-blue-300'
                            : 'bg-blue-50/90 text-blue-950 border-l-blue-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (onCellDrillDown) {
                              onCellDrillDown(d.date, 'ALL', d.dayRecords);
                            }
                          }}
                          className="font-bold hover:underline cursor-pointer text-blue-800"
                          title={`Inspect all ${d.totalOnDay} permit(s) created on ${d.date}`}
                        >
                          {d.totalOnDay}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Summary Footer with Active Column Crosshair Highlight */}
            <tfoot>
              <tr className="sticky bottom-0 z-20 bg-blue-100 font-bold text-blue-950 shadow-xs border-t-2 border-blue-300">
                <td className="sticky bottom-0 left-0 z-30 border border-slate-300 bg-blue-100 px-4 py-3 font-display font-bold text-xs text-blue-950 shadow-2xs">
                  Grand Total ({filteredDailyData.length} Days)
                </td>

                {permitTypes.map((type) => {
                  const typeTotal = columnTotals.totals[type] || 0;
                  const allRecordsForType = records.filter(
                    (r) => (r.type || '').toUpperCase() === type
                  );
                  const isColActive = hoveredCell?.type === type || activeTypeFilter === type;

                  return (
                    <td
                      key={type}
                      className={`sticky bottom-0 z-10 border border-slate-300 px-3.5 py-3 text-center font-mono font-bold text-xs text-blue-950 transition-colors ${
                        isColActive ? 'bg-blue-200 ring-2 ring-blue-500 font-black' : 'bg-blue-100'
                      }`}
                    >
                      {typeTotal > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (onCellDrillDown) {
                              onCellDrillDown('ALL', type, allRecordsForType);
                            }
                          }}
                          className="hover:underline cursor-pointer font-bold"
                          title={`Inspect all ${typeTotal} ${type} permit(s)`}
                        >
                          {typeTotal}
                        </button>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                  );
                })}

                <td className="sticky bottom-0 right-0 z-30 border border-slate-300 bg-blue-200 px-4 py-3 text-center font-mono font-black text-sm text-blue-950 shadow-2xs">
                  {columnTotals.grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Tip footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500 font-mono gap-1 pt-1">
          <span>
            Displaying daily count of permit types created from{' '}
            <strong>{formatDate(startDate)}</strong> to <strong>{formatDate(endDate)}</strong>.
          </span>
          <span className="text-slate-400">
            Click any count badge to drill down into matching permit dossiers.
          </span>
        </div>
      </div>
    </div>
  );
};

export default PermitTypeDailyAnalytics;
