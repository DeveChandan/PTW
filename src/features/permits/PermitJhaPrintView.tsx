import React from 'react';
import type { PermitDeepInsertResponse, PermitInfoRecord } from '../../core/types/ptw.types';
import { JhaTemplate, detectBestJhaTemplate } from '../../core/ptw/jhaTemplates';

interface PermitJhaPrintViewProps {
  permit: PermitDeepInsertResponse | PermitInfoRecord | any;
  template?: JhaTemplate;
}

const renderRiskBadge = (risk: { score: number; level: string; likelihood: string; severity: string }) => {
  let colorStyle = 'border-slate-400 bg-slate-50 text-slate-800';
  if (risk.level === 'High') {
    colorStyle = 'border-rose-600 bg-rose-50 text-rose-900';
  } else if (risk.level === 'Medium') {
    colorStyle = 'border-amber-500 bg-amber-50 text-amber-900';
  } else if (risk.level === 'Low') {
    colorStyle = 'border-sky-600 bg-sky-50 text-sky-900';
  } else if (risk.level === 'Negligible') {
    colorStyle = 'border-emerald-600 bg-emerald-50 text-emerald-900';
  }

  return (
    <div className={`p-1 rounded border text-[9.5px] leading-tight font-sans ${colorStyle}`}>
      <div className="font-bold font-mono text-[10.5px]">
        {risk.score} {risk.level}
      </div>
      <div className="text-[8.5px] mt-0.5">
        <span className="block font-medium">Likelihood: {risk.likelihood}</span>
        <span className="block font-medium">Severity: {risk.severity}</span>
      </div>
    </div>
  );
};

export const PermitJhaPrintView: React.FC<PermitJhaPrintViewProps> = ({
  permit,
  template
}) => {
  const activeTemplate = template || detectBestJhaTemplate(permit);
  const permitNo = permit?.Permit_No || permit?.PermitNo || '—';

  return (
    <div className="jha-official-print font-sans text-black leading-tight bg-white w-full">
      {/* ========================================================================= */}
      {/* JHA PRINT PAGE */}
      {/* ========================================================================= */}
      <div className="print-page border-2 border-black p-3.5 bg-white max-w-[210mm] w-full mx-auto flex flex-col justify-between box-border min-h-[290mm] mb-6 shadow-xl print:m-0 print:p-2.5 print:max-w-none print:w-full print:min-h-[285mm] print:shadow-none print:border-2 print:border-black">
        <div>
          {/* 1. Header Banner */}
          <div className="border-b-2 border-black pb-2 mb-2">
            <div className="flex justify-between items-start">
              <div className="text-left">
                <h1 className="font-black text-xs uppercase tracking-wide">
                  Gujarat Fluorochemicals Limited
                </h1>
                <p className="text-[9px] font-mono text-slate-700">Health, Safety & Environment Department</p>
              </div>
              <div className="text-center flex-1 px-2">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  {activeTemplate.title}
                </h2>
                <p className="text-[10px] font-bold text-slate-800 underline">
                  {activeTemplate.subtitle}
                </p>
              </div>
              <div className="text-right text-[9px] font-mono shrink-0">
                <span className="block font-bold">Format: HSE/SAF/F/05</span>
                <span className="block text-slate-600">Standard: GFL/COR/EHSS</span>
              </div>
            </div>

            {/* Reference Bar */}
            <div className="mt-2 pt-1 border-t border-slate-300 grid grid-cols-4 gap-2 text-[10px] bg-slate-50 p-1.5 border border-black/30">
              <div>
                <span className="font-bold mr-1">Permit No:</span>
                <span className="font-mono font-bold text-[11px] underline">{permitNo}</span>
              </div>
              <div>
                <span className="font-bold mr-1">Plant / Werks:</span>
                <span className="font-mono">{permit?.Werks || '1002'}</span>
              </div>
              <div>
                <span className="font-bold mr-1">Area / Location:</span>
                <span>{permit?.AreaLoc || '—'}</span>
              </div>
              <div>
                <span className="font-bold mr-1">Supervisor:</span>
                <span>{permit?.SupvName || '—'}</span>
              </div>
              <div className="col-span-4 mt-0.5">
                <span className="font-bold mr-1">Job Description:</span>
                <span className="italic">{permit?.JobDesc || '—'}</span>
              </div>
            </div>
          </div>

          {/* 2. Main JSA / JHA Table */}
          <table className="w-full border-collapse border border-black text-[9.5px] mb-2.5">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-center font-bold font-sans">
                <th className="border border-black p-1 w-24">Activity Description</th>
                <th className="border border-black p-1 w-24">Hazards</th>
                <th className="border border-black p-1 w-28">Hazard Effects (Consequence)</th>
                <th className="border border-black p-1 w-24">Initial Risk</th>
                <th className="border border-black p-1">Preventive & Mitigation Measures</th>
                <th className="border border-black p-1 w-24">Residual Risk</th>
              </tr>
            </thead>
            <tbody>
              {activeTemplate.rows.map((row, idx) => (
                <tr key={idx} className="border-b border-black/40 align-top">
                  <td className="border border-black p-1 font-semibold text-slate-900 bg-slate-50/50">
                    {row.activity}
                  </td>
                  <td className="border border-black p-1 font-semibold text-slate-900">
                    {row.hazard}
                  </td>
                  <td className="border border-black p-1 text-slate-800">
                    {row.consequence}
                  </td>
                  <td className="border border-black p-1 text-center">
                    {renderRiskBadge(row.initialRisk)}
                  </td>
                  <td className="border border-black p-1">
                    <ol className="list-decimal pl-3 space-y-0.5 text-[9px] leading-snug">
                      {row.mitigationMeasures.map((measure, mIdx) => (
                        <li key={mIdx}>{measure}</li>
                      ))}
                    </ol>
                  </td>
                  <td className="border border-black p-1 text-center">
                    {renderRiskBadge(row.residualRisk)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 3. Additional Inputs */}
          <div className="border border-black p-1.5 mb-2 bg-slate-50/30 text-[9.5px]">
            <div className="font-bold uppercase text-[10px] mb-1">Additional Inputs</div>
            <div className="space-y-1">
              <div>
                <span className="font-semibold mr-1">Additional Hazards:</span>
                <span className="inline-block border-b border-black w-3/4 min-h-[14px]"></span>
              </div>
              <div>
                <span className="font-semibold mr-1">Additional Controls:</span>
                <span className="inline-block border-b border-black w-3/4 min-h-[14px]"></span>
              </div>
            </div>
          </div>

          {/* 4. General Safety Guidelines */}
          <div className="border border-black p-2 mb-2 bg-slate-50/40 text-[9px] leading-relaxed">
            <div className="font-bold uppercase text-[9.5px] mb-1 text-slate-900 underline">
              General Safety Guidelines (Mandatory for Job Execution)
            </div>
            <ol className="list-decimal pl-3 space-y-0.5 grid grid-cols-1 sm:grid-cols-2 gap-x-3 text-[8.5px]">
              {activeTemplate.generalGuidelines.map((guideline, gIdx) => (
                <li key={gIdx} className="leading-tight">
                  {guideline}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* 5. Authorization & Signatures Block */}
        <div className="border-t-2 border-black pt-2 mt-auto">
          <div className="grid grid-cols-3 gap-3 text-[9px] text-center">
            <div className="border border-black p-1.5">
              <div className="font-bold uppercase text-[9.5px]">JSA Prepared By</div>
              <p className="text-[8.5px] text-slate-600 mb-6">Permit Acceptor / Contractor Supervisor</p>
              <div className="border-t border-dashed border-black pt-1">
                <span>Sign: ___________________ Date: ________</span>
              </div>
            </div>

            <div className="border border-black p-1.5">
              <div className="font-bold uppercase text-[9.5px]">Joint Site Verified By</div>
              <p className="text-[8.5px] text-slate-600 mb-6">Safety Officer / Area In-Charge</p>
              <div className="border-t border-dashed border-black pt-1">
                <span>Sign: ___________________ Date: ________</span>
              </div>
            </div>

            <div className="border border-black p-1.5">
              <div className="font-bold uppercase text-[9.5px]">JSA Approved By</div>
              <p className="text-[8.5px] text-slate-600 mb-6">Permit Issuing Authority (Issuer)</p>
              <div className="border-t border-dashed border-black pt-1">
                <span>Sign: ___________________ Date: ________</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
