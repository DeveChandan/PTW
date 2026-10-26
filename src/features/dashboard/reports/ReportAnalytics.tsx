import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { ReportRecord } from './reportConstants';
import {
  DEPARTMENT_COLORS,
  formatPercentage,
} from './reportConstants';

export interface ReportAnalyticsProps {
  records: ReportRecord[];
}

type ChartViewMode = 'grouped' | 'stacked' | 'area';

// Helper to compute SVG Arc Path for a Donut Chart slice
function createDonutSlicePath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const angleDiff = endAngleDeg - startAngleDeg;
  if (angleDiff >= 359.99) {
    const midAngle = startAngleDeg + 180;
    const r1 = (startAngleDeg - 90) * (Math.PI / 180);
    const r2 = (midAngle - 90) * (Math.PI / 180);

    const x1o = cx + outerRadius * Math.cos(r1);
    const y1o = cy + outerRadius * Math.sin(r1);
    const x2o = cx + outerRadius * Math.cos(r2);
    const y2o = cy + outerRadius * Math.sin(r2);

    const x1i = cx + innerRadius * Math.cos(r1);
    const y1i = cy + innerRadius * Math.sin(r1);
    const x2i = cx + innerRadius * Math.cos(r2);
    const y2i = cy + innerRadius * Math.sin(r2);

    return `M ${x1o} ${y1o} A ${outerRadius} ${outerRadius} 0 0 1 ${x2o} ${y2o} A ${outerRadius} ${outerRadius} 0 0 1 ${x1o} ${y1o} M ${x1i} ${y1i} A ${innerRadius} ${innerRadius} 0 0 0 ${x2i} ${y2i} A ${innerRadius} ${innerRadius} 0 0 0 ${x1i} ${y1i} Z`;
  }

  const startRad = (startAngleDeg - 90) * (Math.PI / 180);
  const endRad = (endAngleDeg - 90) * (Math.PI / 180);

  const x1o = cx + outerRadius * Math.cos(startRad);
  const y1o = cy + outerRadius * Math.sin(startRad);
  const x2o = cx + outerRadius * Math.cos(endRad);
  const y2o = cy + outerRadius * Math.sin(endRad);

  const x1i = cx + innerRadius * Math.cos(startRad);
  const y1i = cy + innerRadius * Math.sin(startRad);
  const x2i = cx + innerRadius * Math.cos(endRad);
  const y2i = cy + innerRadius * Math.sin(endRad);

  const largeArcFlag = angleDiff > 180 ? 1 : 0;

  return `M ${x1o} ${y1o} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1i} ${y1i} Z`;
}

// Generate smooth cubic Bézier SVG path from array of coordinates
function buildSmoothSplinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    // Catmull-Rom to Cubic Bézier conversion
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export const ReportAnalytics: React.FC<ReportAnalyticsProps> = ({ records }) => {
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [hoveredPeriodKey, setHoveredPeriodKey] = useState<string | null>(null);
  const [deptSearchQuery, setDeptSearchQuery] = useState<string>('');
  const [showAllDepts, setShowAllDepts] = useState<boolean>(false);

  // Chart View Mode: Grouped (Dual Bar), Stacked Bar, or Area Curve Trend
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('grouped');

  const [activityDateRange, setActivityDateRange] = useState<string>('6 months');
  const [activityDateRangeOpen, setActivityDateRangeOpen] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Click outside and Escape key to close range dropdown
  useEffect(() => {
    if (!activityDateRangeOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActivityDateRangeOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActivityDateRangeOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activityDateRangeOpen]);

  // Grand total count across all records
  const grandTotalCount = records.length;

  // 1. Department Distribution for Donut Chart & Leaderboard
  const departmentData = useMemo(() => {
    const total = records.length;
    if (total === 0 || grandTotalCount === 0) return [];

    const counts: Record<string, number> = {};
    records.forEach((r) => {
      counts[r.department] = (counts[r.department] || 0) + 1;
    });

    let currentAngle = 0;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([dept, count], index) => {
        const percentage = (count / grandTotalCount) * 100;
        const angle = (count / total) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        const midAngle = startAngle + angle / 2;
        const midRad = (midAngle - 90) * (Math.PI / 180);

        return {
          department: dept,
          count,
          percentage,
          color: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
          startAngle,
          endAngle,
          midAngle,
          midRad,
        };
      });
  }, [records, grandTotalCount]);

  const activeHighlightedDept = hoveredDept || selectedDept;
  const activeDeptItem = useMemo(() => {
    if (!activeHighlightedDept) return null;
    return departmentData.find((d) => d.department === activeHighlightedDept) || null;
  }, [activeHighlightedDept, departmentData]);

  const filteredDepartments = useMemo(() => {
    if (!deptSearchQuery.trim()) return departmentData;
    const q = deptSearchQuery.toLowerCase().trim();
    return departmentData.filter((d) => d.department.toLowerCase().includes(q));
  }, [departmentData, deptSearchQuery]);

  const displayedDepartments = useMemo(() => {
    if (deptSearchQuery.trim() || showAllDepts) {
      return filteredDepartments;
    }
    return filteredDepartments.slice(0, 7);
  }, [filteredDepartments, deptSearchQuery, showAllDepts]);

  const activityDateRangeOptions = [
    'Last 7 days',
    'Last 10 days',
    'Last 15 days',
    'Last 20 days',
    'Month',
    'Quarter',
    '6 months',
    'Year',
  ];

  // 2. Filter records for Trajectory Chart (respecting selectedDept if active)
  const scopedRecords = useMemo(() => {
    if (!selectedDept) return records;
    return records.filter((r) => r.department === selectedDept);
  }, [records, selectedDept]);

  const isDailyAggregation = useMemo(() => {
    return ['Last 7 days', 'Last 10 days', 'Last 15 days', 'Last 20 days'].includes(activityDateRange);
  }, [activityDateRange]);

  const activityFilteredRecords = useMemo(() => {
    if (scopedRecords.length === 0) return [];

    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(todayDate);

    switch (activityDateRange) {
      case 'Last 7 days':
        startDate.setDate(todayDate.getDate() - 6);
        break;
      case 'Last 10 days':
        startDate.setDate(todayDate.getDate() - 9);
        break;
      case 'Last 15 days':
        startDate.setDate(todayDate.getDate() - 14);
        break;
      case 'Last 20 days':
        startDate.setDate(todayDate.getDate() - 19);
        break;
      case 'Month':
        startDate.setDate(1);
        break;
      case 'Quarter': {
        const currentMonth = todayDate.getMonth();
        const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
        startDate.setMonth(quarterStartMonth);
        startDate.setDate(1);
        break;
      }
      case '6 months':
        startDate.setMonth(todayDate.getMonth() - 5);
        startDate.setDate(1);
        break;
      case 'Year':
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
      default:
        return scopedRecords;
    }

    const startDateString = [
      startDate.getFullYear(),
      String(startDate.getMonth() + 1).padStart(2, '0'),
      String(startDate.getDate()).padStart(2, '0'),
    ].join('-');

    return scopedRecords.filter((record) => record.date >= startDateString);
  }, [scopedRecords, activityDateRange]);

  // Aggregate by Month OR Day based on selected range
  const trajectoryPeriods = useMemo(() => {
    const counts: Record<string, { permit: number; isolation: number }> = {};

    activityFilteredRecords.forEach((record) => {
      // If daily range, key by YYYY-MM-DD; else key by YYYY-MM
      const key = isDailyAggregation ? record.date : record.date.substring(0, 7);
      if (!counts[key]) {
        counts[key] = { permit: 0, isolation: 0 };
      }
      if (record.category === 'permit') {
        counts[key].permit += 1;
      } else {
        counts[key].isolation += 1;
      }
    });

    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) => {
        // Human readable display label
        let label = key;
        if (isDailyAggregation) {
          // Format "2026-10-24" -> "24 Oct"
          try {
            const d = new Date(`${key}T12:00:00`);
            label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          } catch {
            label = key.slice(5);
          }
        } else {
          // Format "2026-05" -> "May '26"
          try {
            const [y, m] = key.split('-');
            const d = new Date(Number(y), Number(m) - 1, 1);
            label = d.toLocaleDateString('en-IN', { month: 'short' }) + " '" + y.slice(2);
          } catch {
            label = key;
          }
        }

        return {
          key,
          label,
          permit: values.permit,
          isolation: values.isolation,
          total: values.permit + values.isolation,
        };
      });
  }, [activityFilteredRecords, isDailyAggregation]);

  // Maximum value for scaling (grouped dual bar uses max of individual, stacked uses max of totals)
  const maxSingleMetric = useMemo(() => {
    if (trajectoryPeriods.length === 0) return 1;
    return Math.max(...trajectoryPeriods.map((p) => Math.max(p.permit, p.isolation)));
  }, [trajectoryPeriods]);

  const maxStackedMetric = useMemo(() => {
    if (trajectoryPeriods.length === 0) return 1;
    return Math.max(...trajectoryPeriods.map((p) => p.total));
  }, [trajectoryPeriods]);

  const activeScaleMax = useMemo(() => {
    const raw = chartViewMode === 'stacked' ? maxStackedMetric : maxSingleMetric;
    if (raw <= 10) return 10;
    if (raw <= 20) return 20;
    if (raw <= 30) return 30;
    if (raw <= 50) return 50;
    if (raw <= 75) return 75;
    if (raw <= 100) return 100;
    return Math.ceil(raw / 15) * 15;
  }, [chartViewMode, maxSingleMetric, maxStackedMetric]);

  const totalPeriodPermits = useMemo(
    () => trajectoryPeriods.reduce((sum, item) => sum + item.permit, 0),
    [trajectoryPeriods]
  );

  const totalPeriodIsolations = useMemo(
    () => trajectoryPeriods.reduce((sum, item) => sum + item.isolation, 0),
    [trajectoryPeriods]
  );

  const totalPeriodCombined = totalPeriodPermits + totalPeriodIsolations;

  const averagePerPeriod = useMemo(() => {
    if (trajectoryPeriods.length === 0) return 0;
    return (totalPeriodCombined / trajectoryPeriods.length).toFixed(1);
  }, [totalPeriodCombined, trajectoryPeriods.length]);

  const peakPeriodItem = useMemo(() => {
    if (trajectoryPeriods.length === 0) return null;
    return [...trajectoryPeriods].sort((a, b) => b.total - a.total)[0];
  }, [trajectoryPeriods]);

  // Active hovered period details
  const activeHoveredPeriod = useMemo(() => {
    if (!hoveredPeriodKey) return null;
    return trajectoryPeriods.find((p) => p.key === hoveredPeriodKey) || null;
  }, [hoveredPeriodKey, trajectoryPeriods]);

  // SVG Area Trend points computation
  const svgTrendData = useMemo(() => {
    if (trajectoryPeriods.length === 0) {
      return { permitPath: '', isolationPath: '', permitPoints: [], isolationPoints: [] };
    }

    const width = 1000;
    const height = 240;
    const paddingX = 40;
    const count = trajectoryPeriods.length;
    const step = count > 1 ? (width - paddingX * 2) / (count - 1) : 0;

    const permitPoints = trajectoryPeriods.map((p, idx) => {
      const x = count === 1 ? width / 2 : paddingX + idx * step;
      const y = height - (p.permit / activeScaleMax) * height;
      return { x, y: Math.max(10, Math.min(height - 5, y)), key: p.key };
    });

    const isolationPoints = trajectoryPeriods.map((p, idx) => {
      const x = count === 1 ? width / 2 : paddingX + idx * step;
      const y = height - (p.isolation / activeScaleMax) * height;
      return { x, y: Math.max(10, Math.min(height - 5, y)), key: p.key };
    });

    const permitSpline = buildSmoothSplinePath(permitPoints);
    const isolationSpline = buildSmoothSplinePath(isolationPoints);

    // Close area paths to bottom baseline
    const lastP = permitPoints[permitPoints.length - 1];
    const firstP = permitPoints[0];
    const permitAreaPath = `${permitSpline} L ${lastP.x} ${height} L ${firstP.x} ${height} Z`;

    const lastI = isolationPoints[isolationPoints.length - 1];
    const firstI = isolationPoints[0];
    const isolationAreaPath = `${isolationSpline} L ${lastI.x} ${height} L ${firstI.x} ${height} Z`;

    return {
      permitSpline,
      isolationSpline,
      permitAreaPath,
      isolationAreaPath,
      permitPoints,
      isolationPoints,
    };
  }, [trajectoryPeriods, activeScaleMax]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[44fr_56fr] xl:grid-cols-[40fr_60fr] gap-6 items-start">
      {/* =========================================================================
          LEFT COLUMN: REDESIGNED INTERACTIVE DONUT CHART + LEADERBOARD
          ========================================================================= */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between min-h-[660px] border-t-4 border-t-[#006398]">
        {/* Header Strip */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006398] text-[22px]">donut_large</span>
              <h2 className="text-base sm:text-lg font-bold font-display text-slate-900">
                Department Distribution
              </h2>
            </div>
            <span className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-[#006398] border border-blue-200">
              {departmentData.length} Units Active
            </span>
          </div>

          <p className="text-xs text-slate-500 font-sans mt-1">
            Proportional work volume and permit allocation across plant execution departments.
          </p>

          {/* Active Filter Pill */}
          {selectedDept && (
            <div className="mt-2.5 flex items-center justify-between bg-blue-50/90 border border-blue-200 px-3 py-1.5 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      departmentData.find((d) => d.department === selectedDept)?.color || '#006398',
                  }}
                />
                <span className="font-bold text-blue-900">Filtered: {selectedDept}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDept(null)}
                className="text-xs font-mono font-bold text-blue-700 hover:text-blue-950 flex items-center gap-0.5 cursor-pointer"
              >
                <span>Clear</span>
                <span>×</span>
              </button>
            </div>
          )}
        </div>

        {departmentData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <span className="material-symbols-outlined text-[48px] mb-2 text-slate-300">pie_chart</span>
            <p className="text-xs font-mono">No records available for department breakdown.</p>
          </div>
        ) : (
          <div className="my-4 space-y-4">
            {/* SVG Donut Chart with Interactive Slices & Dynamic Center Badge */}
            <div className="relative flex items-center justify-center py-1">
              <svg
                viewBox="0 0 300 300"
                className="h-[240px] w-[240px] sm:h-[260px] sm:w-[260px] drop-shadow-sm transition-transform duration-300"
              >
                <g transform="translate(150, 150)">
                  {departmentData.map((d) => {
                    const isHovered = hoveredDept === d.department;
                    const isSelected = selectedDept === d.department;
                    const isActive = isHovered || isSelected;

                    const outerR = isActive ? 134 : 124;
                    const innerR = 74;

                    const pathString = createDonutSlicePath(
                      0,
                      0,
                      outerR,
                      innerR,
                      d.startAngle,
                      d.endAngle
                    );

                    const translateX = isActive ? Math.cos(d.midRad) * 4 : 0;
                    const translateY = isActive ? Math.sin(d.midRad) * 4 : 0;

                    return (
                      <path
                        key={d.department}
                        d={pathString}
                        fill={d.color}
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        transform={`translate(${translateX}, ${translateY})`}
                        className="transition-all duration-200 cursor-pointer hover:opacity-95"
                        onMouseEnter={() => setHoveredDept(d.department)}
                        onMouseLeave={() => setHoveredDept(null)}
                        onClick={() => setSelectedDept(isSelected ? null : d.department)}
                      >
                        <title>{`${d.department}: ${d.count} works (${formatPercentage(d.percentage)})`}</title>
                      </path>
                    );
                  })}
                </g>
              </svg>

              {/* Central Hole Interactive Readout Widget */}
              <div
                className="absolute flex flex-col items-center justify-center text-center p-3 rounded-full bg-white shadow-md border border-slate-100 transition-all cursor-pointer pointer-events-auto h-[128px] w-[128px]"
                onClick={() => setSelectedDept(null)}
                title={selectedDept ? 'Click to clear filter' : undefined}
              >
                {activeDeptItem ? (
                  <div className="space-y-0.5 animate-fadeIn">
                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: activeDeptItem.color }}
                      />
                      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        {activeDeptItem.percentage.toFixed(1)}% Share
                      </span>
                    </div>

                    <div className="text-[11px] font-bold text-slate-900 leading-tight line-clamp-2 px-1">
                      {activeDeptItem.department}
                    </div>

                    <div className="text-base font-black font-display text-blue-700 leading-none pt-0.5">
                      {activeDeptItem.count}
                    </div>

                    <div className="text-[9px] font-mono font-medium text-slate-400">
                      of {grandTotalCount} works
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                      Grand Total
                    </span>
                    <div className="text-2xl sm:text-3xl font-black font-display text-slate-900 leading-none">
                      {grandTotalCount}
                    </div>
                    <span className="text-[10px] font-mono font-bold text-blue-600 block">
                      All Works
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 block">
                      {departmentData.length} Departments
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Department Breakdown Leaderboard */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1 max-w-xs">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[15px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={deptSearchQuery}
                    onChange={(e) => setDeptSearchQuery(e.target.value)}
                    placeholder={`Filter ${departmentData.length} departments...`}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 py-1 text-[11px] font-mono text-slate-800 outline-none focus:border-blue-500 shadow-2xs"
                  />
                  {deptSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDeptSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                {!deptSearchQuery && departmentData.length > 7 && (
                  <button
                    type="button"
                    onClick={() => setShowAllDepts((prev) => !prev)}
                    className="text-[11px] font-mono font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer shrink-0"
                  >
                    {showAllDepts ? 'Show Top 7' : `View All (${departmentData.length})`}
                  </button>
                )}
              </div>

              <div className="space-y-1 max-h-[190px] overflow-y-auto pr-1">
                {displayedDepartments.map((d) => {
                  const isHovered = hoveredDept === d.department;
                  const isSelected = selectedDept === d.department;
                  const isActive = isHovered || isSelected;

                  return (
                    <div
                      key={d.department}
                      onMouseEnter={() => setHoveredDept(d.department)}
                      onMouseLeave={() => setHoveredDept(null)}
                      onClick={() => setSelectedDept(isSelected ? null : d.department)}
                      className={`flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-sans transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-100 text-blue-950 font-bold border border-blue-300 shadow-2xs'
                          : isHovered
                          ? 'bg-white text-slate-900 border border-slate-200 shadow-2xs'
                          : 'hover:bg-white text-slate-700'
                      }`}
                      title="Click to filter trajectory chart"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full transition-transform ${
                            isActive ? 'scale-125 ring-2 ring-blue-300' : ''
                          }`}
                          style={{ backgroundColor: d.color }}
                        />
                        <span className="truncate text-xs font-medium">{d.department}</span>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="w-16 sm:w-20 bg-slate-200/80 rounded-full h-1.5 overflow-hidden hidden sm:block">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(d.percentage, 4)}%`,
                              backgroundColor: d.color,
                            }}
                          />
                        </div>

                        <span className="font-mono text-xs font-bold text-slate-900 min-w-[20px] text-right">
                          {d.count}
                        </span>

                        <span className="font-mono text-[11px] text-slate-500 min-w-[42px] text-right font-semibold">
                          {formatPercentage(d.percentage)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer info tip */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] text-blue-600">touch_app</span>
            <span>Click any slice or department row to filter trajectory.</span>
          </span>
          <span className="font-bold text-slate-700">100% Normalized</span>
        </div>
      </section>

      {/* =========================================================================
          RIGHT COLUMN: REDESIGNED ADVANCED ACTIVITY TRAJECTORY
          ========================================================================= */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between min-h-[660px] border-t-4 border-t-indigo-600">
        {/* Header with Title, Mode Switcher, and Range Dropdown */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="material-symbols-outlined text-indigo-600 text-[22px]">
                {chartViewMode === 'area' ? 'show_chart' : chartViewMode === 'stacked' ? 'stacked_bar_chart' : 'bar_chart'}
              </span>
              <h2 className="text-base sm:text-lg font-bold font-display text-slate-900">
                {isDailyAggregation ? 'Daily Activity Progression' : 'Monthly Activity Trajectory'}
              </h2>
              {selectedDept && (
                <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {selectedDept}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 font-sans">
              Operational volume comparing Work Permits and Hazardous Energy Isolations.
            </p>
          </div>

          {/* Controls: Chart View Switcher & Range Selector */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* View Mode Toggle Switcher */}
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setChartViewMode('grouped')}
                className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition cursor-pointer ${
                  chartViewMode === 'grouped'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
                title="Dual Grouped Bar View"
              >
                Dual Bar
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('stacked')}
                className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition cursor-pointer ${
                  chartViewMode === 'stacked'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
                title="Stacked Cumulative Bar View"
              >
                Stacked
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('area')}
                className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition cursor-pointer ${
                  chartViewMode === 'area'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
                title="Smooth Spline Area Trend View"
              >
                Area Trend
              </button>
            </div>

            {/* Time Range Selector */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setActivityDateRangeOpen((prev) => !prev)}
                className="flex min-w-[135px] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono font-bold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-indigo-600">calendar_month</span>
                  <span>{activityDateRange}</span>
                </span>
                <span className="material-symbols-outlined text-[15px] text-slate-400">expand_more</span>
              </button>

              {activityDateRangeOpen && (
                <div className="absolute right-0 z-30 mt-1.5 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
                  {activityDateRangeOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setActivityDateRange(option);
                        setActivityDateRangeOpen(false);
                      }}
                      className={`block w-full px-3.5 py-2 text-left text-xs font-mono transition cursor-pointer ${
                        activityDateRange === option
                          ? 'bg-blue-50 font-bold text-blue-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Trajectory Plot Canvas */}
        <div className="w-full my-2">
          {trajectoryPeriods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-28 text-slate-400">
              <span className="material-symbols-outlined text-[48px] mb-2 text-slate-300">bar_chart</span>
              <p className="text-xs font-mono">No activity found in the selected range.</p>
            </div>
          ) : (
            <div
              className="grid w-full"
              style={{
                gridTemplateColumns: '44px minmax(0, 1fr)',
              }}
            >
              {/* Y Axis Numbers */}
              <div className="relative h-[310px]">
                <div className="absolute left-0 right-0 top-3 bottom-10">
                  {Array.from({ length: 6 }, (_, index) => {
                    const value = Math.round(
                      activeScaleMax - (activeScaleMax / 5) * index
                    );

                    return (
                      <span
                        key={value}
                        className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-slate-400 font-medium"
                        style={{
                          top: `${(index / 5) * 100}%`,
                        }}
                      >
                        {value}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Chart Plot Area */}
              <div className="relative h-[310px] min-w-0">
                {/* Unified Plot Box (matches Y-axis top-3 bottom-10 precisely) */}
                <div className="absolute inset-x-0 top-3 bottom-10">
                  {/* Horizontal Dashed Grid Lines */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-x-0 top-0 border-t border-slate-200" />
                    <div className="absolute inset-x-0 top-[20%] border-t border-dashed border-slate-200" />
                    <div className="absolute inset-x-0 top-[40%] border-t border-dashed border-slate-200" />
                    <div className="absolute inset-x-0 top-[60%] border-t border-dashed border-slate-200" />
                    <div className="absolute inset-x-0 top-[80%] border-t border-dashed border-slate-200" />
                    {/* Baseline 0 Solid Line */}
                    <div className="absolute inset-x-0 bottom-0 border-t border-slate-300" />
                  </div>

                  {/* VIEW 1 & 2: GROUPED BARS & STACKED BARS */}
                  {chartViewMode !== 'area' ? (
                    <div className="absolute inset-0 flex items-end justify-between px-1.5 sm:px-3 gap-2 sm:gap-3">
                      {trajectoryPeriods.map((item) => {
                        const permitH = (item.permit / activeScaleMax) * 100;
                        const isolationH = (item.isolation / activeScaleMax) * 100;
                        const stackedTotalH = (item.total / activeScaleMax) * 100;
                        const isHovered = hoveredPeriodKey === item.key;

                        return (
                          <div
                            key={item.key}
                            className={`flex-1 h-full flex flex-col justify-end items-center relative rounded-t-xl transition-all cursor-pointer ${
                              isHovered
                                ? 'bg-blue-50/60 shadow-2xs'
                                : 'hover:bg-slate-50/50'
                            }`}
                            onMouseEnter={() => setHoveredPeriodKey(item.key)}
                            onMouseLeave={() => setHoveredPeriodKey(null)}
                          >
                            {/* Hover Tooltip Card */}
                            {isHovered && (
                              <div className="absolute -top-16 z-30 flex flex-col items-center pointer-events-none animate-fadeIn">
                                <div className="rounded-xl bg-slate-900/95 text-white px-3 py-1.5 text-[10px] font-mono shadow-xl whitespace-nowrap border border-slate-700 backdrop-blur-xs">
                                  <div className="font-bold text-sky-400">{item.label}</div>
                                  <div className="text-slate-300">
                                    Permits: <strong>{item.permit}</strong> ({((item.permit / Math.max(item.total, 1)) * 100).toFixed(0)}%) • Isolations: <strong>{item.isolation}</strong>
                                  </div>
                                  <div className="text-emerald-400 font-bold">Total: {item.total} Works</div>
                                </div>
                                <div className="h-1.5 w-1.5 rotate-45 bg-slate-900 -mt-0.5" />
                              </div>
                            )}

                            {chartViewMode === 'grouped' ? (
                              /* GROUPED DUAL BARS - resting directly on the 0 baseline line */
                              <div className="w-full h-full flex items-end justify-center gap-1.5 sm:gap-2 pb-0">
                                {/* Permit Bar */}
                                <div
                                  className="relative flex w-5 sm:w-7 items-end group"
                                  style={{
                                    height: `${Math.max(permitH, item.permit > 0 ? 3 : 0)}%`,
                                  }}
                                >
                                  {item.permit > 0 && (
                                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] font-bold text-blue-700 opacity-90 group-hover:opacity-100 whitespace-nowrap">
                                      {item.permit}
                                    </span>
                                  )}
                                  <div className="h-full w-full rounded-t-lg bg-gradient-to-t from-blue-700 via-blue-500 to-cyan-400 hover:from-blue-800 hover:to-cyan-500 transition-all shadow-xs" />
                                </div>

                                {/* Isolation Bar */}
                                <div
                                  className="relative flex w-5 sm:w-7 items-end group"
                                  style={{
                                    height: `${Math.max(isolationH, item.isolation > 0 ? 3 : 0)}%`,
                                  }}
                                >
                                  {item.isolation > 0 && (
                                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] font-bold text-purple-700 opacity-90 group-hover:opacity-100 whitespace-nowrap">
                                      {item.isolation}
                                    </span>
                                  )}
                                  <div className="h-full w-full rounded-t-lg bg-gradient-to-t from-purple-700 via-violet-500 to-pink-400 hover:from-purple-800 hover:to-pink-500 transition-all shadow-xs" />
                                </div>
                              </div>
                            ) : (
                              /* STACKED BAR - resting directly on the 0 baseline line */
                              <div className="w-full h-full flex items-end justify-center pb-0">
                                <div
                                  className="relative flex flex-col justify-end w-8 sm:w-11 rounded-t-xl overflow-hidden shadow-xs group"
                                  style={{
                                    height: `${Math.max(stackedTotalH, item.total > 0 ? 3 : 0)}%`,
                                  }}
                                >
                                  {/* Total label on top */}
                                  {item.total > 0 && (
                                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] font-black text-slate-800 whitespace-nowrap">
                                      {item.total}
                                    </span>
                                  )}

                                  {/* Top segment: Isolation */}
                                  <div
                                    className="w-full bg-gradient-to-t from-purple-700 via-violet-500 to-pink-400 transition-all"
                                    style={{
                                      height: `${(item.isolation / Math.max(item.total, 1)) * 100}%`,
                                    }}
                                    title={`Isolation: ${item.isolation}`}
                                  />

                                  {/* Bottom segment: Permit */}
                                  <div
                                    className="w-full bg-gradient-to-t from-blue-700 via-blue-500 to-cyan-400 transition-all"
                                    style={{
                                      height: `${(item.permit / Math.max(item.total, 1)) * 100}%`,
                                    }}
                                    title={`Permit: ${item.permit}`}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* VIEW 3: AREA SPLINE CURVE TREND */
                    <div className="absolute inset-0">
                      <svg viewBox="0 0 1000 240" className="h-full w-full overflow-visible" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="permitAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                          </linearGradient>
                          <linearGradient id="isolationAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#9333ea" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#9333ea" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Area Fills */}
                        <path d={svgTrendData.permitAreaPath} fill="url(#permitAreaGrad)" />
                        <path d={svgTrendData.isolationAreaPath} fill="url(#isolationAreaGrad)" />

                        {/* Spline Strokes */}
                        <path
                          d={svgTrendData.permitSpline}
                          fill="none"
                          stroke="#0284c7"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d={svgTrendData.isolationSpline}
                          fill="none"
                          stroke="#9333ea"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Data Point Dots & Hover Targets */}
                        {svgTrendData.permitPoints.map((pt, idx) => {
                          const item = trajectoryPeriods[idx];
                          const isHovered = hoveredPeriodKey === pt.key;
                          const isoPt = svgTrendData.isolationPoints[idx];

                          return (
                            <g key={pt.key} className="cursor-pointer">
                              {/* Vertical Hover Guide Line */}
                              {isHovered && (
                                <line
                                  x1={pt.x}
                                  y1="0"
                                  x2={pt.x}
                                  y2="240"
                                  stroke="#94a3b8"
                                  strokeWidth="1.5"
                                  strokeDasharray="3 3"
                                />
                              )}

                              {/* Permit Dot */}
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={isHovered ? 6 : 4}
                                fill="#0284c7"
                                stroke="#ffffff"
                                strokeWidth="2.5"
                                className="transition-all"
                              />

                              {/* Isolation Dot */}
                              {isoPt && (
                                <circle
                                cx={isoPt.x}
                                cy={isoPt.y}
                                r={isHovered ? 6 : 4}
                                fill="#9333ea"
                                stroke="#ffffff"
                                strokeWidth="2.5"
                                className="transition-all"
                              />
                            )}

                            {/* Transparent Click & Hover Sensor Column */}
                            <rect
                              x={pt.x - 25}
                              y="0"
                              width="50"
                              height="240"
                              fill="transparent"
                              onMouseEnter={() => setHoveredPeriodKey(pt.key)}
                              onMouseLeave={() => setHoveredPeriodKey(null)}
                            >
                              <title>{`${item.label}: Permits ${item.permit}, Isolations ${item.isolation}`}</title>
                            </rect>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                )}

                {/* Common X-Axis Labels Row: Positioned cleanly below the 0 baseline line */}
                <div className="absolute inset-x-0 top-full pt-2 flex items-center justify-between px-1.5 sm:px-3 gap-2 sm:gap-3">
                  {trajectoryPeriods.map((item) => {
                    const isHovered = hoveredPeriodKey === item.key;
                    return (
                      <div
                        key={item.key}
                        className={`flex-1 text-center font-mono text-[10px] sm:text-[11px] truncate transition-colors cursor-pointer ${
                          isHovered ? 'font-bold text-blue-700' : 'font-medium text-slate-500'
                        }`}
                        onMouseEnter={() => setHoveredPeriodKey(item.key)}
                        onMouseLeave={() => setHoveredPeriodKey(null)}
                      >
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            </div>
          )}
        </div>

        {/* Legend with Mode Indicator */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-gradient-to-r from-blue-600 to-cyan-400 shadow-2xs" />
              <span className="font-mono text-xs font-semibold text-slate-700">Permit Records</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-gradient-to-r from-purple-600 to-pink-400 shadow-2xs" />
              <span className="font-mono text-xs font-semibold text-slate-700">Isolation Records</span>
            </div>
          </div>

          {activeHoveredPeriod && (
            <div className="font-mono text-xs text-slate-600">
              Selected: <strong className="text-blue-700">{activeHoveredPeriod.label}</strong> (
              {activeHoveredPeriod.total} total)
            </div>
          )}
        </div>

        {/* Rich Summary Metrics Grid */}
        <div className="mt-4 border-t border-slate-200/90 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            {/* 1. Total Permits */}
            <div className="rounded-xl bg-gradient-to-br from-blue-50/70 to-indigo-50/40 border border-blue-100 p-3">
              <p className="font-mono text-[10px] text-blue-700 uppercase tracking-wider font-bold">
                Total Permits
              </p>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-2xl font-bold font-display text-blue-800">
                  {totalPeriodPermits}
                </span>
                <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-100/80 px-1.5 py-0.2 rounded">
                  {((totalPeriodPermits / Math.max(totalPeriodCombined, 1)) * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* 2. Total Isolations */}
            <div className="rounded-xl bg-gradient-to-br from-purple-50/70 to-violet-50/40 border border-purple-100 p-3">
              <p className="font-mono text-[10px] text-purple-700 uppercase tracking-wider font-bold">
                Total Isolations
              </p>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-2xl font-bold font-display text-purple-800">
                  {totalPeriodIsolations}
                </span>
                <span className="font-mono text-[10px] font-bold text-purple-600 bg-purple-100/80 px-1.5 py-0.2 rounded">
                  {((totalPeriodIsolations / Math.max(totalPeriodCombined, 1)) * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* 3. Combined Activity */}
            <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/70 border border-slate-200 p-3">
              <p className="font-mono text-[10px] text-slate-600 uppercase tracking-wider font-bold">
                Combined Activity
              </p>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-2xl font-bold font-display text-slate-900">
                  {totalPeriodCombined}
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-200/80 px-1.5 py-0.2 rounded">
                  {trajectoryPeriods.length} {isDailyAggregation ? 'Days' : 'Months'}
                </span>
              </div>
            </div>

            {/* 4. Average / Peak Benchmark */}
            <div className="rounded-xl bg-gradient-to-br from-emerald-50/60 to-teal-50/40 border border-emerald-100 p-3">
              <p className="font-mono text-[10px] text-emerald-800 uppercase tracking-wider font-bold">
                Average Run-Rate
              </p>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-2xl font-bold font-display text-emerald-900">
                  ~{averagePerPeriod}
                </span>
                {peakPeriodItem && (
                  <span
                    className="font-mono text-[9px] font-bold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.2 rounded truncate max-w-[80px]"
                    title={`Peak: ${peakPeriodItem.label} with ${peakPeriodItem.total} works`}
                  >
                    Peak: {peakPeriodItem.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ReportAnalytics;
