import React, { useState, useMemo } from 'react';
import type { HazardControlRecord } from '../../core/types/ptw.types';
import { toast } from '../../shared/context/ToastContext';

export type RiskMatrixBand = 'GREEN' | 'CYAN' | 'YELLOW' | 'RED';

export interface SeverityCriteriaRow {
  rating: number; // 5 to 1
  label: string;
  people: string;
  asset: string;
  environment: string;
  reputation: string;
}

export interface LikelihoodCol {
  rating: number; // 1 to 5
  code: string;
  frequency: string;
  qualitative: string;
}

export interface RiskMatrixCellDef {
  severity: number;
  likelihood: number;
  score: number;
  band: RiskMatrixBand;
  sapRiskLevel: 'LOW' | 'MED' | 'HIGH' | 'CRIT';
  riskLabel: string;
  actionRequired: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  badgeClass: string;
  hexColor: string;
}

/**
 * Standard Corporate 5x5 Risk Severity Assessment Criteria (Ratings 5 down to 1)
 * Exactly matched to Corporate HSE / Process Plant Risk Matrix Standard.
 */
export const SEVERITY_CRITERIA_ROWS: SeverityCriteriaRow[] = [
  {
    rating: 5,
    label: 'Catastrophic',
    people: 'Multiple Fatality',
    asset: 'Business interruption More than 1 month or loss > RS 500 Lakh',
    environment: 'Severe Impact; Justifies Long interruption or Health / Ecological Impact',
    reputation: 'External reputation irreversibly damaged'
  },
  {
    rating: 4,
    label: 'Major',
    people: 'Single Fatality / Multiple Lost workday case (LWC)',
    asset: 'Business interruption less than 1 month or loss of RS 100 - 500 Lakh',
    environment: 'Measurable Ecological / public impact; regulatory Investigation',
    reputation: 'External reputation severely damaged; considerable efforts & expenses required to recover'
  },
  {
    rating: 3,
    label: 'Moderate',
    people: 'Lost workday case (LWC)',
    asset: 'Business interruption less than 1 week or loss of RS 50 - 100 Lakh',
    environment: 'Reportable release; regulatory orders or fines',
    reputation: 'External reputation damaged. Some efforts & expenses required to recover'
  },
  {
    rating: 2,
    label: 'Minor',
    people: 'Medical Treatment Case (MTC)',
    asset: 'Business interruption less than 1 shift or loss of RS 10 - 50 Lakh',
    environment: 'Non Reportable release to the environment. Regulatory response excluding orders, violations & / or fines',
    reputation: 'External reputation Minimally affected, little efforts & expenses required to recover'
  },
  {
    rating: 1,
    label: 'Insignificant',
    people: 'Minor / First Aid Injury (FAI)',
    asset: 'No Business interruption or loss of < Rs 10 lakh',
    environment: 'Localised release contained within the building. No regulatory exceedance',
    reputation: 'External reputation not affected. NO efforts & expenses required to recover'
  }
];

/**
 * Standard Corporate 5x5 Likelihood / Frequency Probability Scale (Columns 1 to 5)
 */
export const LIKELIHOOD_COLS: LikelihoodCol[] = [
  {
    rating: 1,
    code: '1',
    frequency: '1-in 10000/yr (0.0009-0.0001/yr)',
    qualitative: 'Very Unlikely'
  },
  {
    rating: 2,
    code: '2',
    frequency: '1-in 1000/yr (0.009-0.001/yr)',
    qualitative: 'Unlikely'
  },
  {
    rating: 3,
    code: '3',
    frequency: '1-in 100/yr (0.099-0.01/yr)',
    qualitative: 'Possible'
  },
  {
    rating: 4,
    code: '4',
    frequency: '1-in 10/yr (0.99-0.1/yr)',
    qualitative: 'Likely'
  },
  {
    rating: 5,
    code: '5',
    frequency: 'Once a yr or More',
    qualitative: 'Very Likely'
  }
];

/**
 * Evaluates any cell (Severity, Likelihood) in the 5x5 Matrix according to the corporate spreadsheet mapping:
 * - RED (#FF0000, Black text): Cells (5,3), (5,4), (5,5), (4,4), (4,5), (3,5) -> Scores 15, 16, 20, 25
 * - YELLOW (#FFD966, Black text): Cells (5,2), (4,3), (3,3), (3,4), (2,5) -> Scores 9, 10, 12
 * - CYAN (#66FFFF, Black text): Cells (5,1), (4,1), (4,2), (3,2), (2,2), (2,3), (2,4), (1,4), (1,5) -> Scores 4, 5, 6, 8
 * - GREEN (#CCFF99, Black text): Cells (3,1), (2,1), (1,1), (1,2), (1,3) -> Scores 1, 2, 3
 */
export function getRiskMatrixCell(severity: number, likelihood: number): RiskMatrixCellDef {
  const score = severity * likelihood;
  let band: RiskMatrixBand = 'GREEN';
  let sapRiskLevel: 'LOW' | 'MED' | 'HIGH' | 'CRIT' = 'LOW';
  let riskLabel = 'Low Risk';
  let actionRequired = 'Broadly acceptable. Manage via standard operating procedures and standard PPE.';
  let bgClass = 'bg-[#CCFF99]';
  let textClass = 'text-black';
  let borderClass = 'border-black';
  let badgeClass = 'bg-lime-100 text-black border-lime-400';
  let hexColor = '#CCFF99';

  // Check Red cells
  if (
    (severity === 5 && likelihood >= 3) ||
    (severity === 4 && likelihood >= 4) ||
    (severity === 3 && likelihood === 5)
  ) {
    band = 'RED';
    sapRiskLevel = 'CRIT';
    riskLabel = 'Critical Risk';
    actionRequired = 'Intolerable risk. Work must NOT proceed without immediate hierarchy of controls & executive approval.';
    bgClass = 'bg-[#FF0000]';
    textClass = 'text-black';
    borderClass = 'border-black';
    badgeClass = 'bg-red-100 text-black border-red-400';
    hexColor = '#FF0000';
  }
  // Check Yellow cells
  else if (
    (severity === 5 && likelihood === 2) ||
    (severity === 4 && likelihood === 3) ||
    (severity === 3 && (likelihood === 3 || likelihood === 4)) ||
    (severity === 2 && likelihood === 5)
  ) {
    band = 'YELLOW';
    sapRiskLevel = 'HIGH';
    riskLabel = 'High Risk';
    actionRequired = 'Substantial risk. Area in-charge & safety officer sign-off mandatory before permit issuance.';
    bgClass = 'bg-[#FFD966]';
    textClass = 'text-black';
    borderClass = 'border-black';
    badgeClass = 'bg-amber-100 text-black border-amber-400';
    hexColor = '#FFD966';
  }
  // Check Cyan cells (including (3,2)=6 and (2,2)=4 as in user matrix)
  else if (
    (severity === 5 && likelihood === 1) ||
    (severity === 4 && (likelihood === 1 || likelihood === 2)) ||
    (severity === 3 && likelihood === 2) ||
    (severity === 2 && (likelihood === 2 || likelihood === 3 || likelihood === 4)) ||
    (severity === 1 && (likelihood === 4 || likelihood === 5))
  ) {
    band = 'CYAN';
    sapRiskLevel = 'MED';
    riskLabel = 'Moderate Risk';
    actionRequired = 'Tolerable with controls. Specific job procedures, continuous supervision & specialized PPE required.';
    bgClass = 'bg-[#66FFFF]';
    textClass = 'text-black';
    borderClass = 'border-black';
    badgeClass = 'bg-cyan-100 text-black border-cyan-400';
    hexColor = '#66FFFF';
  }
  // Default Green cells
  else {
    band = 'GREEN';
    sapRiskLevel = 'LOW';
    riskLabel = 'Low Risk';
    actionRequired = 'Broadly acceptable. Manage via standard operating procedures and standard PPE.';
    bgClass = 'bg-[#CCFF99]';
    textClass = 'text-black';
    borderClass = 'border-black';
    badgeClass = 'bg-lime-100 text-black border-lime-400';
    hexColor = '#CCFF99';
  }

  return {
    severity,
    likelihood,
    score,
    band,
    sapRiskLevel,
    riskLabel,
    actionRequired,
    bgClass,
    textClass,
    borderClass,
    badgeClass,
    hexColor
  };
}

export interface RiskMatrix5x5SectionProps {
  hazards: HazardControlRecord[];
  setHazards: React.Dispatch<React.SetStateAction<HazardControlRecord[]>>;
  selectedHazardIdx: number;
  setSelectedHazardIdx: (idx: number) => void;
  selectedMatrixCell: { c: number; l: number };
  setSelectedMatrixCell: (cell: { c: number; l: number }) => void;
  newHazardCode: string;
  setNewHazardCode: (val: string) => void;
  newHazardDesc: string;
  setNewHazardDesc: (val: string) => void;
  newControlCode: string;
  setNewControlCode: (val: string) => void;
  newControlDesc: string;
  setNewControlDesc: (val: string) => void;
  handleAddHazard: () => void;
  onMatrixCellClick?: (consequence: number, likelihood: number) => void;
  userPersonResp?: string;
  permitNo?: string;
}

export const RiskMatrix5x5Section: React.FC<RiskMatrix5x5SectionProps> = ({
  hazards,
  setHazards,
  selectedHazardIdx,
  setSelectedHazardIdx,
  selectedMatrixCell,
  setSelectedMatrixCell,
  newHazardCode,
  setNewHazardCode,
  newHazardDesc,
  setNewHazardDesc,
  newControlCode,
  setNewControlCode,
  newControlDesc,
  setNewControlDesc,
  handleAddHazard,
  onMatrixCellClick,
  userPersonResp = '',
  permitNo = ''
}) => {
  const [activeDimensionFilter, setActiveDimensionFilter] = useState<'ALL' | 'PEOPLE' | 'ASSET' | 'ENVIRONMENT' | 'REPUTATION'>('ALL');
  const [hoveredCell, setHoveredCell] = useState<{ c: number; l: number } | null>(null);

  // Active evaluated hazard
  const activeHazard = hazards[selectedHazardIdx] || hazards[0];

  // Active selected cell details
  const activeCellDef = useMemo(() => {
    return getRiskMatrixCell(selectedMatrixCell.c, selectedMatrixCell.l);
  }, [selectedMatrixCell]);

  // Hovered or active cell for tooltips
  const displayCellDef = useMemo(() => {
    if (hoveredCell) {
      return getRiskMatrixCell(hoveredCell.c, hoveredCell.l);
    }
    return activeCellDef;
  }, [hoveredCell, activeCellDef]);

  // Severity row for display
  const activeSeverityRow = useMemo(() => {
    return SEVERITY_CRITERIA_ROWS.find(r => r.rating === displayCellDef.severity) || SEVERITY_CRITERIA_ROWS[0];
  }, [displayCellDef.severity]);

  // Likelihood column for display
  const activeLikelihoodCol = useMemo(() => {
    return LIKELIHOOD_COLS.find(c => c.rating === displayCellDef.likelihood) || LIKELIHOOD_COLS[0];
  }, [displayCellDef.likelihood]);

  // Cell click handler
  const handleCellClick = (severity: number, likelihood: number) => {
    setSelectedMatrixCell({ c: severity, l: likelihood });
    const cellDef = getRiskMatrixCell(severity, likelihood);

    // Update selected hazard's risk level
    setHazards(prev =>
      prev.map((h, i) =>
        i === selectedHazardIdx
          ? {
              ...h,
              RiskLevel: cellDef.sapRiskLevel,
              Remarks: `[5x5 S=${severity}, L=${likelihood}, Score=${cellDef.score}: ${cellDef.riskLabel.toUpperCase()}] ${
                h.Remarks && !h.Remarks.startsWith('[5x5') ? h.Remarks : 'MANDATORY CONTROL VERIFICATION'
              }`.substring(0, 255)
            }
          : h
      )
    );

    if (onMatrixCellClick) {
      onMatrixCellClick(severity, likelihood);
    }

    const hazardTitle = activeHazard ? activeHazard.HazardDesc : `Hazard #${selectedHazardIdx + 1}`;
    toast.success(
      `Matrix Score: ${cellDef.score} (${cellDef.riskLabel}) assigned to "${hazardTitle}"`,
      { title: '5x5 Risk Assessment Updated' }
    );
  };

  // Quick hazard templates presets
  const handleApplyPreset = (code: string, desc: string, controlCode: string, controlDesc: string, defaultC: number, defaultL: number) => {
    setNewHazardCode(code);
    setNewHazardDesc(desc);
    setNewControlCode(controlCode);
    setNewControlDesc(controlDesc);
    setSelectedMatrixCell({ c: defaultC, l: defaultL });
  };

  return (
    <div className="space-y-6">
      {/* SECTION TOP: Active Hazard Focus & Matrix Assessment Score Banner */}
      <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Active Hazard Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Evaluating Hazard:
              </span>
              {hazards.length > 0 ? (
                <div className="inline-flex items-center gap-2">
                  <select
                    value={selectedHazardIdx}
                    onChange={(e) => setSelectedHazardIdx(Number(e.target.value))}
                    className="font-mono font-bold text-xs bg-[#006398] text-white px-3 py-1 rounded-xl shadow-xs border-0 focus:ring-2 focus:ring-[#006398]"
                  >
                    {hazards.map((h, idx) => (
                      <option key={idx} value={idx}>
                        #{h.ItemNo || idx + 1} - {h.HazardDesc} ({h.RiskLevel || 'MED'})
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-500">
                    ({selectedHazardIdx + 1} of {hazards.length})
                  </span>
                </div>
              ) : (
                <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200">
                  No hazards added yet. Add a hazard below to evaluate.
                </span>
              )}
            </div>

            {activeHazard && (
              <p className="text-xs text-slate-600 font-sans">
                Control Measure: <strong className="text-slate-800">{activeHazard.ControlDesc}</strong> · Code:{' '}
                <span className="font-mono text-[#006398]">{activeHazard.ControlCode}</span>
                {permitNo && <span className="ml-2 text-slate-400 font-mono">· Permit: {permitNo}</span>}
                {userPersonResp && <span className="ml-2 text-slate-400">· Evaluator: {userPersonResp}</span>}
              </p>
            )}
          </div>

          {/* Right: Active Matrix Assessment Pill */}
          <div className="flex items-center gap-3 self-start lg:self-center flex-wrap">
            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Score:</span>
              <span className="font-mono text-xl font-extrabold text-slate-900">
                {activeCellDef.score}
              </span>
              <span className="text-xs font-mono text-slate-400">
                (S:{activeCellDef.severity} × L:{activeCellDef.likelihood})
              </span>
            </div>

            <div
              className={`px-3 py-2 rounded-xl border font-mono font-bold text-xs uppercase flex items-center gap-1.5 shadow-xs ${activeCellDef.badgeClass}`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {activeCellDef.band === 'RED'
                  ? 'dangerous'
                  : activeCellDef.band === 'YELLOW'
                  ? 'warning'
                  : activeCellDef.band === 'CYAN'
                  ? 'info'
                  : 'check_circle'}
              </span>
              <span>{activeCellDef.riskLabel}</span>
              <span className="text-[10px] opacity-80">({activeCellDef.sapRiskLevel})</span>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW FILTER: Dimension Focus Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#006398] text-[20px]">grid_on</span>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              Corporate 5×5 Risk Assessment Matrix
            </h3>
            <p className="text-[11px] text-slate-500">
              Severity across People, Asset, Environment &amp; Reputation vs. Frequency Likelihood
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-semibold text-slate-600 flex-wrap">
          <span className="px-2 text-slate-400 font-mono text-[10px]">Filter View:</span>
          {(['ALL', 'PEOPLE', 'ASSET', 'ENVIRONMENT', 'REPUTATION'] as const).map(dim => (
            <button
              key={dim}
              type="button"
              onClick={() => setActiveDimensionFilter(dim)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeDimensionFilter === dim
                  ? 'bg-white text-[#006398] font-bold shadow-2xs'
                  : 'hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              {dim === 'ALL'
                ? 'All Pillars'
                : dim === 'PEOPLE'
                ? '👤 People'
                : dim === 'ASSET'
                ? '🏭 Asset'
                : dim === 'ENVIRONMENT'
                ? '🌿 Environment'
                : '🏢 Reputation'}
            </button>
          ))}
        </div>
      </div>

      {/* THE INTEGRATED SPREADSHEET MATRIX TABLE */}
      <div className="border-2 border-black rounded-lg overflow-hidden shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs font-sans min-w-[920px]">
            {/* Table Header */}
            <thead>
              <tr className="bg-slate-100 text-black border-b border-black font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3 w-16 text-center border border-black font-mono bg-slate-100">
                  Rating
                </th>
                {(activeDimensionFilter === 'ALL' || activeDimensionFilter === 'PEOPLE') && (
                  <th className="py-2.5 px-3 border border-black min-w-[150px] bg-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span>👤</span>
                      <span>People</span>
                    </div>
                  </th>
                )}
                {(activeDimensionFilter === 'ALL' || activeDimensionFilter === 'ASSET') && (
                  <th className="py-2.5 px-3 border border-black min-w-[180px] bg-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span>🏭</span>
                      <span>Asset / Financial</span>
                    </div>
                  </th>
                )}
                {(activeDimensionFilter === 'ALL' || activeDimensionFilter === 'ENVIRONMENT') && (
                  <th className="py-2.5 px-3 border border-black min-w-[190px] bg-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span>🌿</span>
                      <span>Environment</span>
                    </div>
                  </th>
                )}
                {(activeDimensionFilter === 'ALL' || activeDimensionFilter === 'REPUTATION') && (
                  <th className="py-2.5 px-3 border border-black min-w-[190px] bg-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span>🏢</span>
                      <span>Reputation</span>
                    </div>
                  </th>
                )}

                {/* 5 Likelihood Columns Header */}
                <th
                  colSpan={5}
                  className="py-2.5 px-3 text-center bg-slate-200 text-black font-bold border border-black"
                >
                  <div className="flex items-center justify-center gap-1 font-mono tracking-wider">
                    <span className="material-symbols-outlined text-[15px]">trending_up</span>
                    <span>Likelihood (Probability Scale 1 to 5)</span>
                  </div>
                </th>
              </tr>
            </thead>

            {/* Table Body: Rows 5 down to 1 */}
            <tbody>
              {SEVERITY_CRITERIA_ROWS.map((sRow) => {
                const isSelectedRow = selectedMatrixCell.c === sRow.rating;

                return (
                  <tr key={`sev-${sRow.rating}`}>
                    {/* Column A: Rating Number */}
                    <td
                      className={`py-2 px-3 text-center font-mono font-extrabold text-sm text-black border border-black ${
                        isSelectedRow ? 'bg-amber-100/60' : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-base font-bold">{sRow.rating}</span>
                        <span className="text-[9px] font-bold text-slate-600 font-sans">
                          {sRow.label}
                        </span>
                      </div>
                    </td>

                    {/* Column B: People */}
                    {(activeDimensionFilter === 'ALL' || activeDimensionFilter === 'PEOPLE') && (
                      <td
                        className={`py-2 px-3 text-black border border-black align-middle ${
                          isSelectedRow ? 'bg-amber-50/40' : 'bg-white'
                        }`}
                      >
                        <span className="font-semibold text-slate-900 leading-snug block">
                          {sRow.people}
                        </span>
                      </td>
                    )}

                    {/* Column C: Asset */}
                    {(activeDimensionFilter === 'ALL' || activeDimensionFilter === 'ASSET') && (
                      <td
                        className={`py-2 px-3 text-slate-800 border border-black align-middle ${
                          isSelectedRow ? 'bg-amber-50/40' : 'bg-white'
                        }`}
                      >
                        <span className="leading-snug block">{sRow.asset}</span>
                      </td>
                    )}

                    {/* Column D: Environment */}
                    {(activeDimensionFilter === 'ALL' || activeDimensionFilter === 'ENVIRONMENT') && (
                      <td
                        className={`py-2 px-3 text-slate-800 border border-black align-middle ${
                          isSelectedRow ? 'bg-amber-50/40' : 'bg-white'
                        }`}
                      >
                        <span className="leading-snug block">{sRow.environment}</span>
                      </td>
                    )}

                    {/* Column E: Reputation */}
                    {(activeDimensionFilter === 'ALL' || activeDimensionFilter === 'REPUTATION') && (
                      <td
                        className={`py-2 px-3 text-slate-800 border border-black align-middle ${
                          isSelectedRow ? 'bg-amber-50/40' : 'bg-white'
                        }`}
                      >
                        <span className="leading-snug block">{sRow.reputation}</span>
                      </td>
                    )}

                    {/* Columns F, G, H, I, J: The 5 Matrix Cell Buttons (Exact Seamless Excel Grid) */}
                    {[1, 2, 3, 4, 5].map((lCol) => {
                      const cell = getRiskMatrixCell(sRow.rating, lCol);
                      const isSelectedCell =
                        selectedMatrixCell.c === sRow.rating && selectedMatrixCell.l === lCol;
                      const isHovered =
                        hoveredCell?.c === sRow.rating && hoveredCell?.l === lCol;

                      return (
                        <td
                          key={`cell-${sRow.rating}-${lCol}`}
                          className="p-0 m-0 w-16 sm:w-20 md:w-24 h-12 sm:h-14 border border-black align-middle text-center"
                          style={{ backgroundColor: cell.hexColor }}
                        >
                          <button
                            type="button"
                            onClick={() => handleCellClick(sRow.rating, lCol)}
                            onMouseEnter={() => setHoveredCell({ c: sRow.rating, l: lCol })}
                            onMouseLeave={() => setHoveredCell(null)}
                            title={`Severity ${sRow.rating} × Likelihood ${lCol} = ${cell.score} (${cell.riskLabel}) - Click to assign`}
                            className={`w-full h-full min-h-[50px] sm:min-h-[56px] p-0 m-0 border-0 rounded-none flex items-center justify-center font-bold font-mono text-base sm:text-lg text-black transition-all cursor-pointer select-none relative ${
                              isSelectedCell
                                ? 'ring-4 ring-inset ring-[#006398] font-black z-10'
                                : isHovered
                                ? 'brightness-95'
                                : ''
                            }`}
                            style={{ backgroundColor: cell.hexColor }}
                          >
                            <span>{cell.score}</span>

                            {isSelectedCell && (
                              <span
                                className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#006398] text-white shadow-xs"
                                title="Active Selection"
                              >
                                <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            {/* Table Footer: Likelihood Scale Exactly Matching the Corporate Excel Sheet */}
            <tfoot>
              {/* Row 1: Likelihood Numbers (1 to 5) */}
              <tr className="bg-slate-100 text-black border-t-2 border-black font-mono font-bold text-sm">
                <td
                  colSpan={
                    1 +
                    (activeDimensionFilter === 'ALL'
                      ? 4
                      : 1)
                  }
                  className="py-2.5 px-3 border border-black font-sans font-bold text-xs uppercase tracking-wider text-slate-700 bg-slate-100"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#006398]">trending_up</span>
                    <span>Likelihood Probability Rating (1 to 5)</span>
                  </div>
                </td>

                {[1, 2, 3, 4, 5].map((rating) => {
                  const isSelectedCol = selectedMatrixCell.l === rating;
                  return (
                    <td
                      key={`l-foot-rating-${rating}`}
                      className={`py-2 px-1 text-center border border-black font-mono font-extrabold text-base text-black transition-colors ${
                        isSelectedCol ? 'bg-amber-100 ring-2 ring-inset ring-[#006398]' : 'bg-white'
                      }`}
                    >
                      {rating}
                    </td>
                  );
                })}
              </tr>

              {/* Row 2: Frequency Criteria */}
              <tr className="bg-slate-50 text-slate-800 text-[10px] font-sans">
                <td
                  colSpan={
                    1 +
                    (activeDimensionFilter === 'ALL'
                      ? 4
                      : 1)
                  }
                  className="py-2 px-3 border border-black font-semibold text-slate-600 bg-slate-50"
                >
                  <span>Frequency / Occurrence Rate Criteria</span>
                </td>

                {LIKELIHOOD_COLS.map((lCol) => {
                  const isSelectedCol = selectedMatrixCell.l === lCol.rating;
                  return (
                    <td
                      key={`l-foot-freq-${lCol.rating}`}
                      className={`p-1.5 text-center border border-black font-mono text-[10px] leading-tight text-slate-800 transition-colors ${
                        isSelectedCol ? 'bg-amber-50 font-bold' : 'bg-white'
                      }`}
                    >
                      {lCol.frequency}
                    </td>
                  );
                })}
              </tr>

              {/* Row 3: Qualitative Likelihood Scale */}
              <tr className="bg-slate-100 text-slate-900 text-xs font-sans">
                <td
                  colSpan={
                    1 +
                    (activeDimensionFilter === 'ALL'
                      ? 4
                      : 1)
                  }
                  className="py-2 px-3 border border-black font-bold text-slate-700 uppercase tracking-wider text-[11px] bg-slate-100"
                >
                  <span>Qualitative Scale</span>
                </td>

                {LIKELIHOOD_COLS.map((lCol) => {
                  const isSelectedCol = selectedMatrixCell.l === lCol.rating;
                  return (
                    <td
                      key={`l-foot-qual-${lCol.rating}`}
                      className={`py-2 px-1 text-center border border-black font-bold text-xs text-slate-900 transition-colors ${
                        isSelectedCol ? 'bg-amber-100 font-extrabold text-[#006398]' : 'bg-slate-50'
                      }`}
                    >
                      {lCol.qualitative}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ASSESSMENT BREAKDOWN CARD: Shows exactly what the selected cell represents */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span
              className="flex h-10 w-10 items-center justify-center border border-black font-mono font-extrabold text-base text-black shadow-xs"
              style={{ backgroundColor: displayCellDef.hexColor }}
            >
              {displayCellDef.score}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  Score {displayCellDef.score}: {displayCellDef.riskLabel}
                </span>
                <span className={`px-2 py-0.2 rounded-full font-mono text-[10px] font-bold ${displayCellDef.badgeClass}`}>
                  SAP: {displayCellDef.sapRiskLevel}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Severity Rating {displayCellDef.severity} ({activeSeverityRow.label}) × Likelihood Rating{' '}
                {displayCellDef.likelihood} ({activeLikelihoodCol.qualitative})
              </p>
            </div>
          </div>

          <div className="text-[11px] font-semibold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 max-w-md">
            <span className="font-bold text-[#006398] mr-1">Hierarchy Rule:</span>
            {displayCellDef.actionRequired}
          </div>
        </div>

        {/* 4 Dimension Thresholds for Selected Severity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="font-bold text-slate-700 block mb-1 text-[11px] flex items-center gap-1">
              <span>👤</span> People Threshold:
            </span>
            <span className="text-slate-800 font-medium leading-snug block">
              {activeSeverityRow.people}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="font-bold text-slate-700 block mb-1 text-[11px] flex items-center gap-1">
              <span>🏭</span> Asset / Interruption:
            </span>
            <span className="text-slate-800 font-medium leading-snug block">
              {activeSeverityRow.asset}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="font-bold text-slate-700 block mb-1 text-[11px] flex items-center gap-1">
              <span>🌿</span> Environment Impact:
            </span>
            <span className="text-slate-800 font-medium leading-snug block">
              {activeSeverityRow.environment}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="font-bold text-slate-700 block mb-1 text-[11px] flex items-center gap-1">
              <span>🏢</span> Reputation Impact:
            </span>
            <span className="text-slate-800 font-medium leading-snug block">
              {activeSeverityRow.reputation}
            </span>
          </div>
        </div>
      </div>

      {/* FOUR-TIER RISK LEGEND STRIP (Matching Excel Palette) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-black bg-white flex items-start gap-2.5 shadow-xs">
          <span
            className="flex h-6 w-6 items-center justify-center border border-black text-black font-extrabold text-xs shrink-0"
            style={{ backgroundColor: '#FF0000' }}
          >
            !
          </span>
          <div>
            <span className="font-bold text-xs text-black block">Critical Risk (Scores 15-25)</span>
            <span className="text-[11px] text-slate-700 leading-tight block mt-0.5">
              Intolerable risk. Work halted until fail-safe controls &amp; Plant Head sign-off secured.
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-black bg-white flex items-start gap-2.5 shadow-xs">
          <span
            className="flex h-6 w-6 items-center justify-center border border-black text-black font-extrabold text-xs shrink-0"
            style={{ backgroundColor: '#FFD966' }}
          >
            ▲
          </span>
          <div>
            <span className="font-bold text-xs text-black block">High Risk (Scores 9-12)</span>
            <span className="text-[11px] text-slate-700 leading-tight block mt-0.5">
              Substantial risk. Detailed JSA, additional barrier controls &amp; HOD review mandatory.
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-black bg-white flex items-start gap-2.5 shadow-xs">
          <span
            className="flex h-6 w-6 items-center justify-center border border-black text-black font-extrabold text-xs shrink-0"
            style={{ backgroundColor: '#66FFFF' }}
          >
            ◆
          </span>
          <div>
            <span className="font-bold text-xs text-black block">Moderate Risk (Scores 4-8)</span>
            <span className="text-[11px] text-slate-700 leading-tight block mt-0.5">
              Tolerable. Specific safety work instructions, continuous monitoring &amp; PPE required.
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-black bg-white flex items-start gap-2.5 shadow-xs">
          <span
            className="flex h-6 w-6 items-center justify-center border border-black text-black font-extrabold text-xs shrink-0"
            style={{ backgroundColor: '#CCFF99' }}
          >
            ✓
          </span>
          <div>
            <span className="font-bold text-xs text-black block">Low Risk (Scores 1-3)</span>
            <span className="text-[11px] text-slate-700 leading-tight block mt-0.5">
              Broadly acceptable. Manage with routine operating procedures and standard site PPE.
            </span>
          </div>
        </div>
      </div>

      {/* IDENTIFIED HAZARDS LIST & CONTROL STATUS */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-slate-900">
              Identified Hazards &amp; Control Measures ({hazards.length})
            </h4>
            <p className="text-xs text-slate-500">
              Click any hazard row below to activate and re-evaluate its score in the 5×5 matrix.
            </p>
          </div>
        </div>

        {hazards.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <span className="material-symbols-outlined text-[36px] text-slate-300">warning</span>
            <p className="text-xs font-semibold text-slate-700">No hazard controls have been added yet</p>
            <p className="text-[11px] text-slate-400">
              Use the form below or pick a preset to add mandatory work safety hazards.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {hazards.map((hazard, idx) => {
              const isSelected = selectedHazardIdx === idx;
              const isCritOrHigh = hazard.RiskLevel === 'HIGH' || hazard.RiskLevel === 'CRIT';

              return (
                <div
                  key={hazard.ItemNo || idx}
                  onClick={() => setSelectedHazardIdx(idx)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                    isSelected
                      ? 'bg-blue-50/50 border-[#006398] ring-2 ring-[#006398]/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 font-mono font-extrabold text-[11px] border border-black shadow-2xs text-black"
                      style={{
                        backgroundColor:
                          hazard.RiskLevel === 'CRIT'
                            ? '#FF0000'
                            : hazard.RiskLevel === 'HIGH'
                            ? '#FFD966'
                            : hazard.RiskLevel === 'MED'
                            ? '#66FFFF'
                            : '#CCFF99'
                      }}
                    >
                      <span>{hazard.RiskLevel}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">
                          {hazard.HazardDesc}
                        </span>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold border border-slate-200">
                          {hazard.HazardCode}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Item #{hazard.ItemNo || idx + 1}
                        </span>
                        {isCritOrHigh && (
                          <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                            Strict Control Req
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 mt-1 font-medium">
                        Control:{' '}
                        <span className="font-mono font-bold text-[#006398]">{hazard.ControlCode}</span>{' '}
                        — {hazard.ControlDesc}
                      </p>
                      {hazard.Remarks && (
                        <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                          {hazard.Remarks}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs self-end md:self-center">
                    <select
                      value={hazard.RiskLevel}
                      onChange={(e) => {
                        const val = e.target.value;
                        setHazards((prev) =>
                          prev.map((h, i) => (i === idx ? { ...h, RiskLevel: val } : h))
                        );
                      }}
                      className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                    >
                      <option value="LOW">LOW</option>
                      <option value="MED">MED</option>
                      <option value="HIGH">HIGH</option>
                      <option value="CRIT">CRIT</option>
                    </select>

                    <select
                      value={hazard.ControlStatus}
                      onChange={(e) => {
                        const val = e.target.value;
                        setHazards((prev) =>
                          prev.map((h, i) => (i === idx ? { ...h, ControlStatus: val } : h))
                        );
                      }}
                      className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="CLOSED">CLOSED / VERIFIED</option>
                    </select>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHazards(prev => prev.filter((_, i) => i !== idx));
                        if (selectedHazardIdx >= idx && selectedHazardIdx > 0) {
                          setSelectedHazardIdx(selectedHazardIdx - 1);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition"
                      title="Remove Hazard"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QUICK PRESET TEMPLATES */}
      <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-amber-600">bolt</span>
            <span>Quick-Load Industry Hazard Presets:</span>
          </span>
          <span className="text-[11px] text-slate-400">Click to load into form</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            {
              label: '🔥 Hot Work & Sparks',
              code: 'FIRE',
              desc: 'HOT WORK / OPEN FLAME / WELDING SPARKS',
              cCode: 'FIRE01',
              cDesc: 'FIRE BLANKET & 10KG DCP EXTINGUISHER ON STANDBY',
              sev: 4,
              lik: 3
            },
            {
              label: '☁️ Flammable / Toxic Gas',
              code: 'GAS',
              desc: 'FLAMMABLE VAPOR OR HYDROCARBON ACCUMULATION',
              cCode: 'GAS01',
              cDesc: 'CONTINUOUS 4-GAS MONITORING & VENTILATION BLOWER',
              sev: 5,
              lik: 2
            },
            {
              label: '⚡ High Voltage Electricity',
              code: 'ELEC',
              desc: 'HIGH VOLTAGE 415V/6.6KV ELECTRICAL SHOCK RISK',
              cCode: 'ELEC01',
              cDesc: 'ELECTRICAL BREAKER RACK-OUT & VOLTAGE ABSENCE TEST',
              sev: 4,
              lik: 2
            },
            {
              label: '🪜 Fall from Height',
              code: 'FALL',
              desc: 'PERSONNEL OR OBJECT FALL FROM HEIGHT (>1.8M)',
              cCode: 'FALL01',
              cDesc: 'FULL BODY HARNESS WITH 100% TIE-OFF & TOE BOARDS',
              sev: 3,
              lik: 3
            },
            {
              label: '🧪 Corrosive Chemical Splash',
              code: 'TOXIC',
              desc: 'ACID / ALKALI CORROSIVE CHEMICAL LINE SPRAY',
              cCode: 'TOX01',
              cDesc: 'CHEMICAL RESISTANT SUIT, FULL FACE SHIELD & EYE WASH',
              sev: 3,
              lik: 2
            }
          ].map((preset, pIdx) => (
            <button
              key={pIdx}
              type="button"
              onClick={() =>
                handleApplyPreset(
                  preset.code,
                  preset.desc,
                  preset.cCode,
                  preset.cDesc,
                  preset.sev,
                  preset.lik
                )
              }
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-[#006398] hover:text-[#006398] font-medium text-[11px] transition shrink-0 shadow-2xs"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* ADD CUSTOM HAZARD INLINE STRIP */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
        <span className="block font-mono text-xs font-bold text-slate-800 uppercase">
          Add Hazard Control Measure
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-sans">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Hazard Code</label>
            <select
              value={newHazardCode}
              onChange={(e) => {
                setNewHazardCode(e.target.value);
                setNewControlCode(`${e.target.value}01`);
              }}
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs"
            >
              <option value="FIRE">FIRE - Ignition &amp; Welding</option>
              <option value="GAS">GAS - Flammable Gas</option>
              <option value="ELEC">ELEC - High Voltage</option>
              <option value="FALL">FALL - Work at Height</option>
              <option value="TOXIC">TOXIC - Chemical Vapor</option>
              <option value="MECH">MECH - Mechanical / Rotating</option>
              <option value="CONF">CONF - Confined Space Engulfment</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">
              Control Code <span className="text-slate-400 font-mono text-[10px]">({newControlCode})</span>
            </label>
            <input
              type="text"
              value={newControlCode}
              onChange={(e) => setNewControlCode(e.target.value.toUpperCase())}
              placeholder="e.g. ELEC01"
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs uppercase"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Hazard Description *</label>
            <input
              type="text"
              value={newHazardDesc}
              onChange={(e) => setNewHazardDesc(e.target.value)}
              placeholder="e.g. CHEMICAL SPLASH RISK"
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs uppercase"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Control Description *</label>
            <input
              type="text"
              value={newControlDesc}
              onChange={(e) => setNewControlDesc(e.target.value)}
              placeholder="e.g. EYE WASH STATION READY"
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs uppercase"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleAddHazard}
              className="w-full px-4 py-2 bg-[#006398] hover:bg-[#004f7a] text-white rounded-xl font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <span className="material-symbols-outlined text-[17px]">add_circle</span>
              <span>Add Hazard Control</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
