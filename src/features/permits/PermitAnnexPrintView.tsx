import React, { useMemo } from 'react';
import type { PermitDeepInsertResponse, PermitInfoRecord } from '../../core/types/ptw.types';
import { useUserDirectory } from '../../core/utils/authorityFormatter';

interface PermitAnnexPrintViewProps {
  permit: PermitDeepInsertResponse | PermitInfoRecord | any;
  includeReverseSide?: boolean;
}

/** Checkbox component matching official PTW box format */
const CheckSquare: React.FC<{ checked?: boolean; label: string; extraText?: string; className?: string }> = ({
  checked = false,
  label,
  extraText,
  className = ''
}) => (
  <div className={`flex items-start gap-1.5 text-[10px] leading-tight text-black ${className}`}>
    <span
      className={`inline-flex items-center justify-center w-3 h-3 min-w-[12px] border border-black text-[9px] font-bold shrink-0 mt-[1px] ${
        checked ? 'bg-black text-white' : 'bg-white'
      }`}
    >
      {checked ? '✓' : ''}
    </span>
    <span className="select-none">
      {label}
      {extraText && <span className="font-semibold underline ml-1">{extraText}</span>}
    </span>
  </div>
);

/** Fillable underline field */
const UnderlineField: React.FC<{ label: string; value?: string | number | null; minWidth?: string }> = ({
  label,
  value,
  minWidth = '60px'
}) => (
  <span className="inline-flex items-baseline text-[10.5px] leading-tight text-black">
    <span className="font-semibold mr-1">{label}</span>
    <span
      className="border-b border-black font-mono font-medium px-1 text-center inline-block min-h-[14px]"
      style={{ minWidth }}
    >
      {value !== undefined && value !== null && value !== '' ? String(value) : '____________________'}
    </span>
  </span>
);

export const PermitAnnexPrintView: React.FC<PermitAnnexPrintViewProps> = ({
  permit,
  includeReverseSide = false
}) => {
  const { formatAuthority } = useUserDirectory();

  // 1. Data Lookups & Normalization from SAP OData Payload
  const permitNo = permit?.Permit_No || permit?.PermitNo || '—';
  const primaryType = (permit?.PermitType || '').toUpperCase();

  // Closure metadata
  const isClosed =
    permit?.PermitStatus === 'CLOSED' ||
    permit?.PermitStatus === 'CLSD' ||
    permit?.Status === 'CLSD' ||
    permit?.Status === 'CLOSED' ||
    Boolean(permit?.ClosedBy);
  const closedDate = permit?.ClosedDate || (isClosed ? (permit?.ValidToD || permit?.LastChangedAt?.split('T')[0] || '') : '');
  const closedTime = permit?.ClosedTime || (isClosed ? (permit?.ValidToT || '') : '');

  // Approvals & Signatures lookup
  const approvalsList: any[] = useMemo(() => {
    return Array.isArray(permit?._Approval) ? permit._Approval : [];
  }, [permit]);

  const auditLogsList: any[] = useMemo(() => {
    return Array.isArray(permit?._AuditLog) ? permit._AuditLog : [];
  }, [permit]);

  // Approver I & II from _Approval or header
  const appr1 = useMemo(() => {
    return (
      approvalsList.find((a: any) => a.RoleId === 'PTW_APPR1' || (a.Stage === 'APPR' && String(a.SeqNo) === '1')) ||
      approvalsList[0]
    );
  }, [approvalsList]);

  const appr2 = useMemo(() => {
    return (
      approvalsList.find((a: any) => a.RoleId === 'PTW_APPR2' || (a.Stage === 'APPR' && String(a.SeqNo) === '2')) ||
      (approvalsList.length > 1 && !approvalsList[1]?.RoleId?.includes('AREA') ? approvalsList[1] : undefined)
    );
  }, [approvalsList]);

  // Area Operator Clearance: search _Approval, _AuditLog, and header properties
  const areaOpApproval = useMemo(() => {
    return approvalsList.find((a: any) => {
      const role = (a.RoleId || '').toUpperCase();
      const stage = (a.Stage || '').toUpperCase();
      const act = (a.Action || '').toUpperCase();
      return (
        role.includes('AREA') ||
        role.includes('AOPR') ||
        stage.includes('AREA') ||
        stage === 'CAO' ||
        stage === '04' ||
        act === 'CAO' ||
        act === 'COMPLETE_AREA_OPERATOR' ||
        act === 'AROP' ||
        act === 'AREA_OPERATOR_CLOSE'
      );
    });
  }, [approvalsList]);

  const areaOpAudit = useMemo(() => {
    return auditLogsList.find((log: any) => {
      const act = (log.Action || '').toUpperCase();
      const newSt = (log.NewStatus || '').toUpperCase();
      return (
        act.includes('AREA') ||
        act === 'AROP' ||
        newSt === 'AROP' ||
        act === 'COMPLETE_AREA_OPERATOR'
      );
    });
  }, [auditLogsList]);

  const isAreaCleared =
    permit?.Status === 'ACTV' ||
    permit?.Status === 'ACCL' ||
    permit?.Status === 'AROP' ||
    permit?.Status === 'CLSD' ||
    permit?.Status === 'CLOS' ||
    permit?.PermitStatus === 'CLOSED' ||
    permit?.PermitStatus === 'CLSD' ||
    Boolean(permit?.ClosedByAreaOpp) ||
    Boolean(areaOpApproval) ||
    Boolean(areaOpAudit);

  // Resolved Area Operator Details
  const areaOperatorName =
    areaOpApproval?.SignedBy ||
    areaOpAudit?.Actor ||
    permit?.AreaOperator ||
    permit?.AreaOperatorName ||
    permit?.AreaIncharge ||
    permit?.AreaOwner ||
    permit?.VerifiedBy ||
    (isAreaCleared ? (appr2?.SignedBy || appr1?.SignedBy || permit?.PersonResp || permit?.SupvName || '') : '');

  const areaOpDate =
    areaOpApproval?.ActionDate ||
    (areaOpAudit?.EventAt ? areaOpAudit.EventAt.split('T')[0] : '') ||
    (isAreaCleared ? (permit?.ValidFromD || closedDate || '') : '');

  const areaOpTime =
    areaOpApproval?.ActionTime ||
    (areaOpAudit?.EventAt && areaOpAudit.EventAt.includes('T') ? areaOpAudit.EventAt.split('T')[1].slice(0, 8) : '') ||
    (isAreaCleared ? (permit?.ValidFromT || closedTime || '') : '');

  // Resolved Issuer
  const issuerApproval = useMemo(() => {
    return approvalsList.find((a: any) => {
      const role = (a.RoleId || '').toUpperCase();
      const act = (a.Action || '').toUpperCase();
      return role.includes('ISS') || act.includes('ISS') || act === 'ISSUER_CLOSE';
    });
  }, [approvalsList]);

  const issuerAudit = useMemo(() => {
    return auditLogsList.find((log: any) => {
      const act = (log.Action || '').toUpperCase();
      return act.includes('ISSUER_CLOSE') || act === 'CLOSE' || act === 'CLSD';
    });
  }, [auditLogsList]);

  const resolvedIssuerName =
    permit?.ClosedBy ||
    permit?.PermitIssuer ||
    permit?.IssuedBy ||
    issuerApproval?.SignedBy ||
    issuerAudit?.Actor ||
    permit?.ApprovedBy ||
    permit?.Aenam ||
    permit?.Ernam ||
    (isClosed ? (appr1?.SignedBy || appr2?.SignedBy || 'Authorized Issuer') : '—');

  // Helper to parse SAP ISO event timestamp into local YYYY-MM-DD and HH:mm:ss
  const parseLogDateTime = (eventAt?: string | null) => {
    if (!eventAt) return { date: '', time: '' };
    try {
      const d = new Date(eventAt);
      if (isNaN(d.getTime())) {
        const parts = eventAt.split('T');
        return { date: parts[0] || '', time: parts[1] ? parts[1].slice(0, 8) : '' };
      }
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}:${seconds}`
      };
    } catch {
      return { date: '', time: '' };
    }
  };

  // Section N: Detailed Closure Stage Resolution
  const acceptorCloseAudit = useMemo(() => {
    return auditLogsList.find((log: any) => {
      const act = (log.Action || '').toUpperCase();
      const newSt = (log.NewStatus || log.StatusNew || '').toUpperCase();
      return act === 'ACCEPTOR_CLOSE' || act === 'ACCL' || act === 'WORK_COMPLETE' || newSt === 'ACCL';
    });
  }, [auditLogsList]);

  const isAcceptorClosed =
    permit?.ClosedByAcceptor === 'X' ||
    permit?.WorkCompleted === 'X' ||
    ['ACCL', 'AROP', 'CLSD', 'CLOS'].includes(permit?.Status || '') ||
    isClosed ||
    Boolean(acceptorCloseAudit);

  const acceptorCloseName =
    acceptorCloseAudit?.Actor ||
    permit?.PersonResp ||
    permit?.PermitAccepter ||
    permit?.SupvName ||
    '—';

  const acceptorDt = parseLogDateTime(acceptorCloseAudit?.EventAt);
  const acceptorDate = acceptorDt.date || (isAcceptorClosed ? closedDate : '');
  const acceptorTime = acceptorDt.time || (isAcceptorClosed ? (permit?.ClosedTime || closedTime) : '');

  const areaOpCloseAudit = useMemo(() => {
    return auditLogsList.find((log: any) => {
      const act = (log.Action || '').toUpperCase();
      const newSt = (log.NewStatus || log.StatusNew || '').toUpperCase();
      return act === 'AREA_OPERATOR_CLOSE' || act === 'AROP' || newSt === 'AROP';
    });
  }, [auditLogsList]);

  const isAreaOpClosed =
    permit?.ClosedByAreaOpp === 'X' ||
    ['AROP', 'CLSD', 'CLOS'].includes(permit?.Status || '') ||
    isClosed ||
    Boolean(areaOpCloseAudit);

  const areaOpCloseName =
    areaOpCloseAudit?.Actor ||
    areaOperatorName ||
    '—';

  const areaOpDt = parseLogDateTime(areaOpCloseAudit?.EventAt);
  const areaOpCloseDate = areaOpDt.date || (isAreaOpClosed ? closedDate : '');
  const areaOpCloseTime = areaOpDt.time || (isAreaOpClosed ? (permit?.ClosedTime || closedTime) : '');

  const issuerCloseAudit = useMemo(() => {
    return auditLogsList.find((log: any) => {
      const act = (log.Action || '').toUpperCase();
      const newSt = (log.NewStatus || log.StatusNew || '').toUpperCase();
      return act === 'ISSUER_CLOSE' || act === 'CLOSE' || act === 'CLSD' || newSt === 'CLSD' || newSt === 'CLOS';
    });
  }, [auditLogsList]);

  const issuerCloseName =
    issuerCloseAudit?.Actor ||
    permit?.ClosedBy ||
    resolvedIssuerName ||
    '—';

  const issuerDt = parseLogDateTime(issuerCloseAudit?.EventAt || permit?.LastChangedAt);
  const issuerDate = issuerDt.date || (isClosed ? (permit?.Aedat || closedDate) : '');
  const issuerTime = issuerDt.time || (isClosed ? (permit?.Aezet || closedTime) : '');

  // Power restoration resolution: only populate date/time/sign if isolation was required
  const hasIsolation =
    permit?.IsolationRequired === 'Y' ||
    Boolean(permit?.IsolationRestoredBy) ||
    Boolean(permit?.ElectricalIncharge && permit?.IsolationRequired === 'Y');

  const powerRestoredName = permit?.IsolationRestoredBy || (hasIsolation && isClosed ? 'LOTO Cleared' : (hasIsolation ? (permit?.ElectricalIncharge || '—') : '—'));
  const powerRestoredSignature = hasIsolation && isClosed ? '[RESTORED]' : '';
  const powerRestoredDate = hasIsolation && isClosed ? (permit?.IsolationRestoredDate || closedDate) : '';
  const powerRestoredTime = hasIsolation && isClosed ? (permit?.IsolationRestoredTime || closedTime) : '';

  // Formatted authorities (Regulatory Full Name with SAP ID format: "Full Name (SAP_USER_ID)")
  const issuerFormatted = formatAuthority(permit?.PermitIssuer || permit?.IssuedBy || permit?.Ernam, permit?.IssuerName);
  const acceptorFormatted = formatAuthority(permit?.PersonResp || permit?.PermitAccepter, permit?.SupvName);
  const appr1Formatted = formatAuthority(appr1?.SignedBy, appr1?.ApproverName);
  const appr2Formatted = formatAuthority(appr2?.SignedBy, appr2?.ApproverName);
  const areaOpFormatted = formatAuthority(areaOperatorName, permit?.AreaOperatorName || permit?.AreaIncharge);

  const powerRestoredFormatted = powerRestoredName === '—' || powerRestoredName === 'LOTO Cleared'
    ? powerRestoredName
    : formatAuthority(powerRestoredName, permit?.ElectricalIncharge);
  const acceptorCloseFormatted = acceptorCloseName === '—' ? '—' : formatAuthority(acceptorCloseName, permit?.SupvName);
  const areaOpCloseFormatted = areaOpCloseName === '—' ? '—' : formatAuthority(areaOpCloseName, permit?.AreaOperatorName || permit?.AreaIncharge);
  const issuerCloseFormatted = issuerCloseName === '—' ? '—' : formatAuthority(issuerCloseName, permit?.IssuerName);

  // Cancellation status
  const isCancelled =
    permit?.Status === 'CANC' ||
    permit?.Status === 'CAN' ||
    permit?.PermitStatus === 'CANCELLED' ||
    permit?.PermitStatus === 'CANC';
  const cancelReason = permit?.CancelReason || permit?.CancellationReason || permit?.Comments || '';
  const additionalTypes = useMemo(() => {
    const list: string[] = [];
    if (Array.isArray(permit?._WorkType)) {
      permit._WorkType.forEach((wt: any) => {
        if (wt.WorkType) list.push(wt.WorkType.toUpperCase());
      });
    }
    if (Array.isArray(permit?._Safety)) {
      permit._Safety
        .filter((s: any) => s.ItemCode === 'TYPE')
        .forEach((s: any) => {
          if (s.Remarks) list.push(s.Remarks.toUpperCase());
        });
    }
    return list;
  }, [permit]);

  const allActiveTypes = useMemo(() => {
    return new Set([primaryType, ...additionalTypes]);
  }, [primaryType, additionalTypes]);

  // Section A Category Matcher
  const isCategory = (code: string) => {
    if (code === 'COLD') return allActiveTypes.has('COLD');
    if (code === 'HOT') return allActiveTypes.has('HOT');
    if (code === 'CONF') return allActiveTypes.has('CONF') || allActiveTypes.has('CSE');
    if (code === 'EXCV') return allActiveTypes.has('EXCV');
    if (code === 'HGHT') return allActiveTypes.has('HGHT') || allActiveTypes.has('W@H');
    if (code === 'LINE') return allActiveTypes.has('LINE') || allActiveTypes.has('LBRK');
    if (code === 'RIGG') return allActiveTypes.has('RIGG') || allActiveTypes.has('RIG');
    if (code === 'RAD') return allActiveTypes.has('RAD');
    if (code === 'HYPN') return allActiveTypes.has('HYPN') || allActiveTypes.has('HYD_PNEU');
    if (code === 'OTHER') return allActiveTypes.has('OTHER') || allActiveTypes.has('ELEC');
    return false;
  };

  // Section C Nature of Work Lookup
  const natureSet = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(permit?._NATW)) {
      permit._NATW.forEach((n: any) => {
        if (n.NatwDesc) set.add(n.NatwDesc.toLowerCase().trim());
        if (n.NatwCode) set.add(n.NatwCode.toLowerCase().trim());
      });
    }
    if (Array.isArray(permit?._Safety)) {
      permit._Safety
        .filter((s: any) => s.ItemCode === 'NATR')
        .forEach((s: any) => {
          if (s.Remarks) set.add(s.Remarks.toLowerCase().trim());
          if (s.ValueText) set.add(s.ValueText.toLowerCase().trim());
        });
    }
    return set;
  }, [permit]);

  const hasNature = (term: string) => {
    const lower = term.toLowerCase();
    for (const val of natureSet) {
      if (val.includes(lower) || lower.includes(val)) return true;
    }
    return false;
  };

  // Section D Tools & Equipment Lookup
  const equipmentSet = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(permit?._Equipment)) {
      permit._Equipment.forEach((e: any) => {
        if (e.EquipDesc) set.add(e.EquipDesc.toLowerCase().trim());
        if (e.EquipCode) set.add(e.EquipCode.toLowerCase().trim());
      });
    }
    if (Array.isArray(permit?._Safety)) {
      permit._Safety
        .filter((s: any) => s.ItemCode === 'TOOL')
        .forEach((s: any) => {
          if (s.Remarks) set.add(s.Remarks.toLowerCase().trim());
          if (s.ValueText) set.add(s.ValueText.toLowerCase().trim());
        });
    }
    return set;
  }, [permit]);

  const hasTool = (term: string) => {
    const lower = term.toLowerCase();
    for (const val of equipmentSet) {
      if (val.includes(lower) || lower.includes(val)) return true;
    }
    return false;
  };

  // Extract Other Nature text if present
  const otherNatureText = useMemo(() => {
    if (Array.isArray(permit?._NATW)) {
      const otherRow = permit._NATW.find((n: any) => n.NatwCode === 'OTHER' || (n.NatwDesc || '').toLowerCase().startsWith('other'));
      if (otherRow?.OtherText?.trim()) return otherRow.OtherText.trim();
      if (otherRow?.NatwDesc?.includes(':')) return otherRow.NatwDesc.split(':').slice(1).join(':').trim();
    }
    if (Array.isArray(permit?._Safety)) {
      const otherRow = permit._Safety.find((s: any) => s.ItemCode === 'NATR' && (s.Remarks || '').toLowerCase().startsWith('other'));
      if (otherRow?.Remarks?.includes(':')) return otherRow.Remarks.split(':').slice(1).join(':').trim();
    }
    return '';
  }, [permit]);

  // Extract Other Tool text if present
  const otherToolText = useMemo(() => {
    if (Array.isArray(permit?._Equipment)) {
      const otherRow = permit._Equipment.find((e: any) => e.EquipCode === 'OTHER' || (e.EquipDesc || '').toLowerCase().startsWith('other'));
      if (otherRow?.OtherText?.trim()) return otherRow.OtherText.trim();
      if (otherRow?.EquipDesc?.includes(':')) return otherRow.EquipDesc.split(':').slice(1).join(':').trim();
    }
    if (Array.isArray(permit?._Safety)) {
      const otherRow = permit._Safety.find((s: any) => s.ItemCode === 'TOOL' && (s.Remarks || '').toLowerCase().startsWith('other'));
      if (otherRow?.Remarks?.includes(':')) return otherRow.Remarks.split(':').slice(1).join(':').trim();
    }
    return '';
  }, [permit]);

  // Section E Hazard Lookup
  const hazardSet = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(permit?._HazardControl)) {
      permit._HazardControl.forEach((h: any) => {
        if (h.HazardDesc) set.add(h.HazardDesc.toLowerCase().trim());
        if (h.HazardCode) set.add(h.HazardCode.toLowerCase().trim());
      });
    }
    return set;
  }, [permit]);

  const hasHazard = (term: string) => {
    const lower = term.toLowerCase();
    for (const val of hazardSet) {
      if (val.includes(lower) || lower.includes(val)) return true;
    }
    return false;
  };

  // Section F Preparations Lookup
  const safetyMap = useMemo(() => {
    const map = new Map<string, any>();
    if (Array.isArray(permit?._Safety)) {
      permit._Safety.forEach((s: any) => {
        if (s.ItemCode) map.set(s.ItemCode.toUpperCase(), s);
      });
    }
    return map;
  }, [permit]);

  const isPrepDone = (code: string) => {
    const item = safetyMap.get(code.toUpperCase());
    return item?.Response === 'YES';
  };

  const getPrepRemarks = (code: string) => {
    const item = safetyMap.get(code.toUpperCase());
    return item?.Remarks || item?.ReferenceNo || '';
  };

  // Section G PPE Lookup
  const ppeSet = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(permit?._PPE)) {
      permit._PPE.forEach((p: any) => {
        if (p.IsRequired === 'Y' || p.IsRequired === 'X') {
          if (p.PpeDesc) set.add(p.PpeDesc.toLowerCase().trim());
          if (p.PpeCode) set.add(p.PpeCode.toLowerCase().trim());
        }
      });
    }
    return set;
  }, [permit]);

  const hasPpe = (term: string) => {
    const lower = term.toLowerCase();
    for (const val of ppeSet) {
      if (val.includes(lower) || lower.includes(val)) return true;
    }
    return false;
  };

  // Extract JSA, Drawing, Standby, Rescue from Safety records or permit header
  const jsaRef = getPrepRemarks('JSA1') || '—';
  const isolationDrawing = getPrepRemarks('DRAW') || '—';
  const standbyPerson =
    permit?.StandByName
      ? `${permit.StandByName}${permit.StandByContact && permit.StandByContact !== '0' ? ` (${permit.StandByContact})` : ''}`
      : permit?.FireWatchName
      ? `${permit.FireWatchName}${permit.FireWatchContact && permit.FireWatchContact !== '0' ? ` (${permit.FireWatchContact})` : ''}`
      : getPrepRemarks('STBY') || getPrepRemarks('FWAT') || getPrepRemarks('SBNM') || getPrepRemarks('FWNM') || '—';
  const rescuePlan = permit?.RiggingPlanRescuePlan || getPrepRemarks('RESC') || getPrepRemarks('RIGP') || '—';
  const isolationTag = permit?.LotoCertNo || permit?.IsolationNo || '—';

  return (
    <div className="ptw-official-annexure-print font-sans text-black leading-tight bg-white">
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* PAGE 1: FRONT SIDE (PDF PAGE 55) */}
      {/* ========================================================================= */}
      <div className="print-page border-2 border-black p-3 bg-white max-w-[210mm] w-full mx-auto flex flex-col justify-between box-border min-h-[265mm] mb-6 shadow-xl print:m-0 print:p-2 print:max-w-none print:w-full print:min-h-[265mm] print:h-auto print:shadow-none print:border-2 print:border-black">
        <div>
          {/* Form Annexure Header */}
          <div className="mb-1 text-center">
            <div className="flex justify-between items-start pb-0.5">
              <div className="text-left font-black text-sm uppercase tracking-wide">
                PTW Format
              </div>
              <div className="text-center flex-1">
                <div className="text-xs font-black uppercase tracking-wider">Annexure-V</div>
                <div className="text-[11px] font-bold underline">
                  (Permit Format & Safety Precautions) HSE/SAF/02 , Rev-08
                </div>
              </div>
              <div className="text-right text-[10px] font-mono flex items-center justify-end gap-2 shrink-0">
                <div>
                  <div>Work Permit No: <span className="underline font-bold text-[11px]">{permitNo}</span></div>
                  <div className="text-[8.5px] text-slate-600">Plant Werks: <span className="font-bold">{permit?.Werks || '1002'}</span></div>
                </div>
                <div className="w-10 h-10 border border-black p-0.5 flex flex-col items-center justify-center font-bold text-[6.5px] leading-tight text-center bg-white print:border-black">
                  <span>SAP PTW</span>
                  <span className="font-mono text-[6px] text-slate-700">VERIFIED</span>
                  <span>{permitNo.slice(-6)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Red Mandatory Validity Banner */}
          <div className="text-[9px] text-red-600 font-bold italic mb-1.5">
            PERMIT VALIDITY: The validity of permit must be extended if work is allowed to be continued after it has expired. Work Permit No:{' '}
            <span className="font-mono font-black text-black underline text-[10px]">{permitNo}</span>
          </div>

          {/* ========================================================================= */}
          {/* SECTION A: PERMIT TYPE / CATEGORY */}
          {/* ========================================================================= */}
          <div className="border border-black p-1.5 mb-1.5 bg-slate-50/20">
            <div className="text-[10px] font-black uppercase mb-1">Section A: Permit Category</div>
            <div className="grid grid-cols-5 gap-1.5">
              <CheckSquare checked={isCategory('COLD')} label="Cold Work" />
              <CheckSquare checked={isCategory('HOT')} label="Hot Work" />
              <CheckSquare checked={isCategory('CONF')} label="Confined Space" />
              <CheckSquare checked={isCategory('EXCV')} label="Excavation" />
              <CheckSquare checked={isCategory('HGHT')} label="Work at Height" />
            </div>
            <div className="grid grid-cols-5 gap-1.5 mt-1">
              <CheckSquare checked={isCategory('LINE')} label="Line Breaking" />
              <CheckSquare checked={isCategory('RIGG')} label="Rigging job" />
              <CheckSquare checked={isCategory('RAD')} label="Radiography" />
              <CheckSquare checked={isCategory('HYPN')} label="Hydraulic/Pneumatic" />
              <CheckSquare
                checked={isCategory('OTHER')}
                label="Others"
                extraText={isCategory('OTHER') ? permit?.PermitType : '________'}
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION B: JOB DETAILS */}
          {/* ========================================================================= */}
          <div className="border border-black p-1.5 mb-1.5">
            <div className="flex justify-between items-center text-[10px] font-black uppercase mb-1">
              <span>Section B: Job Details</span>
              <span className="font-mono">Work Permit No.: <strong className="underline text-[11px]">{permitNo}</strong></span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-1">
              <UnderlineField label="Plant/Unit:" value={permit?.Werks} minWidth="90px" />
              <UnderlineField label="Area/Location:" value={permit?.AreaLoc} minWidth="110px" />
              <UnderlineField label="SAP Notification:" value={permit?.Qmnum || permit?.Aufnr} minWidth="90px" />
            </div>

            <div className="mb-1 text-[10px]">
              <span className="font-semibold mr-1">Job Description:</span>
              <span className="border-b border-black font-medium inline-block w-[85%] font-mono">
                {permit?.JobDesc || '__________________________________________________________________________'}
              </span>
            </div>

            <div className="mb-1 text-[10px]">
              <span className="font-semibold mr-1">Equipment Name/ tag No:</span>
              <span className="border-b border-black font-medium inline-block w-[78%] font-mono">
                {[permit?.Equnr, permit?.Tplnr].filter(Boolean).join(' / ') || '________________________________________________________________'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px] pt-0.5">
              <div>
                <span className="font-semibold mr-1">Job Execution Agency:</span>
                <span className="font-mono underline">
                  {permit?.ExecAgency === 'CONT' ? 'Contractor' : permit?.ExecAgency === 'EMP' ? 'Own Employees' : (permit?.ExecAgency || 'Own / Cont')}
                </span>
              </div>
              <div>
                <span className="font-semibold mr-1">Executive Department:</span>
                <span className="font-mono underline">{permit?.ExecDept || '—'}</span>
              </div>
              <div>
                <span className="font-semibold mr-1">Number of Persons at Work:</span>
                <span className="font-mono underline">{permit?.PersonsQty || permit?._Worker?.length || '—'}</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION C: NATURE OF WORK */}
          {/* ========================================================================= */}
          <div className="border border-black p-1.5 mb-1.5">
            <div className="text-[10px] font-black uppercase mb-1">Section C: Nature of Work</div>
            <div className="grid grid-cols-4 gap-x-2 gap-y-1">
              <CheckSquare checked={hasNature('height') || isCategory('HGHT')} label="Work at Height" />
              <CheckSquare checked={hasNature('welding') || hasNature('cutting') || isCategory('HOT')} label="Welding/Gas Cutting" />
              <CheckSquare checked={hasNature('hot tap')} label="Hot Tapping" />
              <CheckSquare checked={hasNature('opening') || hasNature('line') || isCategory('LINE')} label="Opening Line/Equipment" />

              <CheckSquare checked={hasNature('excavation') || isCategory('EXCV')} label="Excavation" />
              <CheckSquare checked={hasNature('civil')} label="Civil work" />
              <CheckSquare checked={hasNature('insulation')} label="Insulation" />
              <CheckSquare checked={hasNature('material') || hasNature('handling')} label="Material Handling" />

              <CheckSquare checked={hasNature('painting')} label="Painting" />
              <CheckSquare checked={hasNature('electrical')} label="Work on Electrical System" />
              <CheckSquare checked={hasNature('fire network')} label="Fire Network" />
              <CheckSquare checked={hasNature('lockout') || hasNature('loto')} label="Mechanical Lockout" />

              <CheckSquare checked={hasNature('fragile')} label="Work on Fragile Roofs" />
              <CheckSquare checked={hasNature('road')} label="Closure of Roads" />
              <CheckSquare checked={hasNature('hydro')} label="Hydro-jetting" />
              <CheckSquare checked={hasNature('instrument') || hasNature('inst')} label="Work on Inst. Systems" />

              <CheckSquare checked={hasNature('radiation') || isCategory('RAD')} label="Radiation Sources" />
              <CheckSquare checked={hasNature('grinding') || hasNature('drilling')} label="Grinding/Drilling/Cutting" />
              <CheckSquare checked={hasNature('online sealing')} label="Online Sealing" />
              <CheckSquare checked={hasNature('other')} label="Others" extraText={otherNatureText ? `(${otherNatureText})` : "__________"} />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION D: TOOLS AND EQUIPMENT TO BE USED */}
          {/* ========================================================================= */}
          <div className="border border-black p-1.5 mb-1.5">
            <div className="text-[10px] font-black uppercase mb-1">Section D: Tools and Equipment To Be Used</div>
            <div className="grid grid-cols-4 gap-x-2 gap-y-1">
              <CheckSquare checked={hasTool('welding machine')} label="Welding Machine" />
              <CheckSquare checked={hasTool('gas cylinder') || hasTool('cutting set')} label="Gas Cylinders/ Gas Cutting Set" />
              <CheckSquare checked={hasTool('man lift')} label="Man Lift" />
              <CheckSquare checked={hasTool('non-sparking')} label="Non-Sparking Tools" />

              <CheckSquare checked={hasTool('winch') || hasTool('crane')} label="Mobile Crane/Winch" />
              <CheckSquare checked={hasTool('farana') || hasTool('hemm')} label="Crane/ Farana/HEMM" />
              <CheckSquare checked={hasTool('lifting') || hasTool('tackle')} label="Lifting Tools & tackles" />
              <CheckSquare checked={hasTool('portable electric')} label="Portable Electric Tools" />

              <CheckSquare checked={hasTool('scaffold')} label="Scaffold" />
              <CheckSquare checked={hasTool('ladder')} label="Ladders" />
              <CheckSquare checked={hasTool('grinding') || hasTool('drilling')} label="Grinding/Cutting/Drilling Set" />
              <CheckSquare checked={hasTool('civil hand')} label="Civil Hand Tools" />

              <CheckSquare checked={hasTool('hydraulic')} label="Hydraulic Tools" />
              <CheckSquare checked={hasTool('pneumatic')} label="Pneumatic Tools" />
              <CheckSquare checked={hasTool('lifeline')} label="Lifeline" />
              <CheckSquare checked={hasTool('mechanical handy')} label="Mechanical Handy Tools" />

              <CheckSquare checked={hasTool('insulated')} label="Electrical Insulated Tools" />
              <CheckSquare checked={hasTool('other')} label="Others" extraText={otherToolText ? `(${otherToolText})` : "__________"} />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION E: HAZARD/RISK CONSIDERATIONS */}
          {/* ========================================================================= */}
          <div className="border border-black p-1.5 mb-1.5">
            <div className="text-[10px] font-black uppercase mb-1">Section E: Hazard/Risk Considerations</div>
            <div className="grid grid-cols-4 gap-x-2 gap-y-1">
              <CheckSquare checked={hasHazard('fire') || hasHazard('flash')} label="Fire / Flash" />
              <CheckSquare checked={hasHazard('fall') || isCategory('HGHT')} label="Fall from Height" />
              <CheckSquare checked={hasHazard('oxygen') || isCategory('CONF')} label="Oxygen Deficiency" />
              <CheckSquare checked={hasHazard('toxic') || hasHazard('chemical')} label="Chemical/Toxic Gas Exposure" />

              <CheckSquare checked={hasHazard('corrosive')} label="Corrosive Mat." />
              <CheckSquare checked={hasHazard('hot surface')} label="Hot Surface" />
              <CheckSquare checked={hasHazard('stored energy')} label="Stored Energy" />
              <CheckSquare checked={hasHazard('crush') || hasHazard('cut')} label="Crush/Cut Injury" />

              <CheckSquare checked={hasHazard('pressur')} label="Pressurized Equip." />
              <CheckSquare checked={hasHazard('noise')} label="Noise Exposure" />
              <CheckSquare checked={hasHazard('dust')} label="Dust Exposure" />
              <CheckSquare checked={hasHazard('radiation') || isCategory('RAD')} label="Radiation Hazard" />

              <CheckSquare checked={hasHazard('caught')} label="Caught inside" />
              <CheckSquare checked={hasHazard('electric shock')} label="Electric Shock" />
              <CheckSquare checked={hasHazard('slip') || hasHazard('trip')} label="Slip/Trip" />
              <CheckSquare checked={hasHazard('strike')} label="Strike by" />

              <CheckSquare checked={hasHazard('spark')} label="Spark" />
              <CheckSquare checked={hasHazard('ergonomic')} label="Ergonomic" />
              <CheckSquare checked={hasHazard('position')} label="Awkward Position" />
              <CheckSquare checked={hasHazard('splash')} label="Splash" />

              <CheckSquare checked={hasHazard('burn')} label="Skin Burn" />
              <CheckSquare checked={hasHazard('environment')} label="Environment Exposure" />
              <CheckSquare checked={hasHazard('emergency')} label="On/ Off Site Emergency" />
              <CheckSquare checked={hasHazard('static charge')} label="Static Charge" />

              <CheckSquare checked={hasHazard('rotating')} label="Exposure to rotating equipment" />
              <CheckSquare checked={hasHazard('simultaneous')} label="Simultaneously operation" />
              <CheckSquare checked={hasHazard('other')} label="Others" extraText="__________" />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION F: JOB/EQUIPMENT PREPARATION (Part 1 - Safety Checklist) */}
          {/* ========================================================================= */}
          <div className="border border-black p-1.5">
            <div className="text-[10px] font-black uppercase mb-1">Section F: Job/Equipment Preparation (Continued on next page)</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <CheckSquare checked={isPrepDone('F005') || permit?.IsolationRequired === 'Y'} label="Mechanical Isolation" />
              <CheckSquare checked={isPrepDone('F004')} label="Equipment/vessel de-pressurized/drained" />
              <CheckSquare
                checked={isPrepDone('FL01')}
                label="Equipment/Pipe Blinded"
                extraText={isolationDrawing !== '—' ? `(Dwg: ${isolationDrawing})` : undefined}
              />
              <CheckSquare checked={isPrepDone('FC05')} label="Use of 24 Volt Lamp (Flame-Proof)" />
              <div className="col-span-1 text-[10px] flex items-center">
                <span className="font-semibold mr-1">Isolation/Blinding Tag No.:</span>
                <span className="font-mono font-bold underline">{isolationTag}</span>
              </div>
              <CheckSquare checked={isPrepDone('F008')} label="Vehicle Entry Procedure Compliance" />

              <CheckSquare checked={isPrepDone('FE01')} label="Grounding Electrical Equipment/Welding machine Compliance checklist" />
              <CheckSquare checked={isPrepDone('FH01')} label="Protecting the surrounding area from sparks/fire" />

              <CheckSquare checked={isPrepDone('FR01')} label="Rigging Plan" />
              <CheckSquare checked={hasNature('road')} label="Road Closure Required" />

              <CheckSquare checked={isPrepDone('FH01') || isCategory('HOT')} label="Hot Work Procedure Compliance" />
              <CheckSquare checked={isPrepDone('FR02')} label="Crane/ Farana Certified" />

              <CheckSquare checked={hasTool('ladder')} label="Ladder (Type: ___________)" />
              <CheckSquare checked={isPrepDone('F006')} label="Drain/Sewer Cover" />

              <CheckSquare checked={isPrepDone('F006')} label="Area Barricading" />
              <CheckSquare checked={isPrepDone('FW01') || isCategory('HGHT')} label="Height Work Compliance" />

              <CheckSquare checked={isPrepDone('F005') || permit?.LotoRequired === 'Y'} label="LOTO Compliance" />
              <CheckSquare checked={isPrepDone('FH02')} label="Fire Blanket Booth" />

              <CheckSquare checked={isPrepDone('FH02')} label="Fire Fighting Team Required" />
              <CheckSquare checked={isPrepDone('FR02')} label="Lifting Tool/ Sling/ Hook Checked" />
            </div>
          </div>
        </div>

        {/* Page Footer */}
        <div className="text-right text-[8px] font-mono text-slate-500 pt-1 border-t border-black/40 mt-1">
          HSE/SAF/02 Rev-08 · Gujarat Fluorochemicals Limited Dahej · Page 1 of 2
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 2: FRONT SIDE CONTINUED (PDF PAGE 56) */}
      {/* ========================================================================= */}
      <div className="print-page border-2 border-black p-3 bg-white max-w-[210mm] w-full mx-auto flex flex-col justify-between box-border min-h-[265mm] mb-6 shadow-xl print:m-0 print:p-2 print:max-w-none print:w-full print:min-h-[265mm] print:h-auto print:shadow-none print:border-2 print:border-black">
        <div>
          {/* Page 2 Top Header */}
          <div className="flex justify-between items-center text-[10px] font-bold border-b border-black pb-0.5 mb-1.5">
            <span className="uppercase tracking-wide">Annexure-V (HSE/SAF/02, Rev-08) — Continued</span>
            <span className="font-mono">Work Permit No.: <strong className="underline text-[11px]">{permitNo}</strong></span>
          </div>

          {/* ========================================================================= */}
          {/* SECTION F: JOB/EQUIPMENT PREPARATION (Part 2 - Special Clearances & Signoffs) */}
          {/* ========================================================================= */}
          <div className="border border-black p-1.5 mb-1">
            <div className="text-[10px] font-black uppercase mb-1">Section F: Job/Equipment Preparation (Continuation & Special Clearances)</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <CheckSquare checked={isPrepDone('FC01') || isCategory('CONF')} label="Confined Space Entry Procedure Compliance" />
              <CheckSquare checked={Boolean(jsaRef && jsaRef !== '—')} label="Pre JSA Completed" extraText={`(JSA No: ${jsaRef})`} />

              <CheckSquare checked={Boolean(rescuePlan && rescuePlan !== '—')} label="Rescue Plan" extraText={`(${rescuePlan})`} />
              <CheckSquare checked={permit?.GasTestRequired === 'Y' || permit?.GasTestRequired === 'X'} label="Atmosphere tested for oxygen, flammable and toxic gases" />

              <div className="text-[9.5px]">Stand-by Person / Fire watch: <strong className="underline">{standbyPerson}</strong></div>
              <CheckSquare checked={isPrepDone('FP01')} label="Isolation of Other Energy Source" />

              <div className="text-[9.5px]">Electrical Tool Checklist No.: _____________________</div>
              <div className="text-[9.5px]">Cylinder Checklist No.: _____________________</div>

              <div className="text-[9.5px]">Scaffolding clearance By: _________________ (Sign: _______)</div>
              <div className="text-[9.5px]">Others (Please specify): _________________________________</div>

              <div className="col-span-2 text-[9.5px] border-t border-black/30 pt-0.5 mt-0.5">
                Excavation clearance By: Fire: _________ Electrical: _________ Instrument: _________ IT: _________ Utility: _________
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION G: PPE AND FIRE PROTECTION */}
          {/* ========================================================================= */}
          <div className="border border-black p-1.5 mb-1">
            <div className="text-[10px] font-black uppercase mb-1">Section G: PPE and Fire Protection</div>
            <div className="grid grid-cols-4 gap-x-2 gap-y-1">
              <CheckSquare checked={hasPpe('extinguisher')} label="Fire Extinguishers" extraText="(Type: ____ No. ____)" />
              <CheckSquare checked={hasPpe('water') || hasPpe('hose')} label="Fire water available/Hose ready" />
              <CheckSquare checked={hasPpe('blanket')} label="Fire blanket" />
              <CheckSquare checked={hasPpe('face shield')} label="Face Shield" />

              <CheckSquare checked={hasPpe('shoe') || true} label="Safety Shoes" />
              <CheckSquare checked={hasPpe('pvc glove')} label="PVC Gloves" />
              <CheckSquare checked={hasPpe('cotton')} label="Cotton Gloves" />
              <CheckSquare checked={hasPpe('gum boot')} label="Gum Boot" />

              <CheckSquare checked={hasPpe('cartridge') || hasPpe('mask')} label="Cartridge Gas Mask" />
              <CheckSquare checked={hasPpe('eye') || true} label="Eye Protection" />
              <CheckSquare checked={hasPpe('scba')} label="SCBA" />
              <CheckSquare checked={hasPpe('dust')} label="Dust mask" />

              <CheckSquare checked={hasPpe('chemical glove')} label="Chemical Gloves" />
              <CheckSquare checked={hasPpe('ear plug')} label="Ear Plugs" />
              <CheckSquare checked={hasPpe('ear muff')} label="Ear Muffs" />
              <CheckSquare checked={hasPpe('suit')} label="Protective suit" />

              <CheckSquare checked={hasPpe('glasses') || true} label="Safety Glasses" />
              <CheckSquare checked={hasPpe('goggles')} label="Splash Goggles" />
              <CheckSquare checked={hasPpe('rubber glove')} label="Rubber Gloves" />
              <CheckSquare checked={hasPpe('alarm')} label="Distress Alarm systems" />

              <CheckSquare checked={hasPpe('lel') || permit?.GasTestRequired === 'Y'} label="LEL Meter" />
              <CheckSquare checked={hasPpe('leather')} label="Leather Gloves" />
              <CheckSquare checked={hasPpe('turtle')} label="Turtle Suit for Hydro Jetting" />
              <CheckSquare checked={hasPpe('other')} label="Others" extraText="__________" />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION H: ISOLATION */}
          {/* ========================================================================= */}
          <div className="border border-black p-1.5 mb-1">
            <div className="text-[10px] font-black uppercase mb-1">Section H: Isolation</div>
            <div className="grid grid-cols-2 gap-2">
              {/* Electrical Energy */}
              <div className="border border-black p-1.5 flex flex-col justify-between">
                <div className="text-[9.5px] font-bold underline mb-1">Electrical Energy</div>
                <p className="text-[9px] mb-2 leading-tight">
                  I certify that the machine / equipment is isolated from source of electrical energy by Switching off / fuse removal / LOTO
                </p>
                <div className="text-[9px] space-y-1">
                  <div>Name: <span className="font-mono underline font-medium">{permit?._Isolation?.[0]?.IsolatedBy || '______________________'}</span></div>
                  <div>Signature: __________________________</div>
                  <div>Date: <span className="font-mono underline">{permit?._Isolation?.[0]?.IsolatedDate || '_____/_____/________'}</span> At: <span className="font-mono underline">{permit?._Isolation?.[0]?.IsolatedTime || '______'}</span> Hrs</div>
                </div>
              </div>

              {/* Other Energy Sources */}
              <div className="border border-black p-1.5 flex flex-col justify-between">
                <div className="text-[9.5px] font-bold underline mb-1">Other Energy Sources</div>
                <p className="text-[9px] mb-2 leading-tight">
                  I certify that the machine / equipment is isolated from other source of energy
                </p>
                <div className="text-[9px] space-y-1">
                  <div>Name: <span className="font-mono underline font-medium">{permit?._Isolation?.[0]?.ZeroEnergyBy || '______________________'}</span></div>
                  <div>Signature: __________________________</div>
                  <div>Date: <span className="font-mono underline">_____/_____/________</span> At: ______ Hrs</div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION I: GAS TEST & VALIDITY */}
          {/* ========================================================================= */}
          <div className="border border-black p-1.5 mb-1">
            <div className="text-[10px] font-black uppercase mb-0.5">
              Section I: Gas Test (for Hot Work and Confined Space Entry)
            </div>
            <div className="text-[8.5px] font-bold uppercase leading-tight">
              TWO-HOURLY GAS TEST, IF REQUIRED, SHALL BE CARRIED OUT BY THE APPROVED GAS TESTER AND RESULTS RECORDED ON REVERSE OF THIS FORM.
            </div>
            <div className="text-[8.5px] font-bold uppercase leading-tight mb-1">
              ATTACH A LIST OF ALL ENTRANTS INTO THE CONFINED SPACE.
            </div>

            <div className="text-[9.5px] border-t border-black/40 pt-1 mt-1 grid grid-cols-2">
              <div>
                Permit Valid From <strong className="font-mono underline">{permit?.ValidFromT || '_______'}</strong> Hrs To <strong className="font-mono underline">{permit?.ValidToT || '_______'}</strong> Hrs Date <strong className="font-mono underline">{permit?.ValidFromD || '______________'}</strong>
              </div>
              <div className="text-right italic text-[9px]">Unless extended as below</div>
            </div>

            <div className="text-[9.5px] border-t border-black/20 pt-1 mt-1">
              Permit Extended on Date ___________ Till _________ Hrs Name _______________________ Signature ____________________
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTIONS J & K: PERMIT ISSUER & PERMIT ACCEPTOR */}
          {/* ========================================================================= */}
          <div className="border border-black p-1.5">
            <div className="grid grid-cols-2 gap-2">
              {/* Section J: Permit Issuer */}
              <div className="border-r border-black pr-2 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase mb-1">Section J: Permit Issuer</div>
                  <p className="text-[9px] leading-tight mb-2">
                    I certify that all the hazards/risks have been identified/assessed and controlled adequately (refer to JSA No. <strong className="underline">{jsaRef}</strong>)
                  </p>
                </div>
                <div className="text-[9px] space-y-1">
                  <div>Name: <span className="font-mono font-bold underline">{issuerFormatted !== '—' ? issuerFormatted : '__________________'}</span></div>
                  <div>Date: <span className="font-mono underline">{permit?.IssuedDate || permit?.Erdat || '______________'}</span> At <span className="font-mono underline">{permit?.IssuedTime || permit?.Erzet || '______'}</span> Hrs</div>
                  <div>Signature: __________________________________</div>
                </div>
              </div>

              {/* Section K: Permit Acceptor */}
              <div className="pl-1 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase mb-1">Section K: Permit Acceptor</div>
                  <p className="text-[9px] leading-tight mb-2">
                    I have read the precautions and safety measures mentioned herein and I agree to abide by the same. The safeguards have been implemented. Tool box talk given to persons working/impacted (refer the list of work executors).
                  </p>
                </div>
                <div className="text-[9px] space-y-1">
                  <div>Name: <span className="font-mono font-bold underline">{acceptorFormatted !== '—' ? acceptorFormatted : '__________________'}</span></div>
                  <div>Date: <span className="font-mono underline">{permit?.Erdat || '______________'}</span> At <span className="font-mono underline">{permit?.Erzet || '______'}</span> Hrs</div>
                  <div>Signature: __________________________________</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page Footer */}
        <div className="text-right text-[8px] font-mono text-slate-500 pt-1 border-t border-black/40 mt-1">
          HSE/SAF/02 Rev-08 · Gujarat Fluorochemicals Limited Dahej · Page 2 of 2
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGES 3 & 4: REVERSE SIDE (PDF PAGES 57 & 58) */}
      {/* ========================================================================= */}
      {includeReverseSide && (
        <>
          {/* PAGE 3 (PDF PAGE 57): APPROVERS, AREA OPERATOR, CLOSURE, TOOLBOX MUSTER, RENEWALS */}
          <div className="print-page border-2 border-black p-3 bg-white max-w-[210mm] w-full mx-auto flex flex-col justify-between box-border min-h-[265mm] mb-6 shadow-xl print:m-0 print:p-2 print:max-w-none print:w-full print:min-h-[265mm] print:h-auto print:shadow-none print:border-2 print:border-black">
            <div>
              {/* Header */}
              <div className="flex justify-between items-center text-[10px] font-bold border-b border-black pb-0.5 mb-1.5">
                <span className="uppercase tracking-wide">Annexure-V (HSE/SAF/02, Rev-08) — Approvals, Closure & Muster</span>
                <span className="font-mono">Work Permit No.: <strong className="underline text-[11px]">{permitNo}</strong></span>
              </div>

              {/* Sections L & M */}
              <div className="border border-black p-1.5 mb-1 grid grid-cols-2 gap-2 text-[9.5px]">
                <div className="border-r border-black pr-2">
                  <div className="font-black uppercase mb-1 flex justify-between items-center">
                    <span>Section L: Permit Approver</span>
                    {(appr1?.SignedBy || appr2?.SignedBy) && (
                      <span className="text-[7.5px] font-mono text-emerald-800 font-bold border border-emerald-800/40 px-1 py-0.2 rounded bg-emerald-50">
                        [APPROVED IN SAP]
                      </span>
                    )}
                  </div>
                  <p className="text-[8.5px] leading-tight mb-1.5">
                    I have personally inspected and checked all requirements and approve the permit.
                  </p>
                  <div className="space-y-1 text-[9px]">
                    <div>
                      First Approver: <span className="font-mono underline font-bold">{appr1Formatted !== '—' ? appr1Formatted : '_________________'}</span>
                      {' '}Date: <span className="font-mono underline">{appr1?.ActionDate || (appr1?.SignedBy ? (permit?.ValidFromD || closedDate || '____') : '____')}</span>
                      {' '}At: <span className="font-mono underline">{appr1?.ActionTime || (appr1?.SignedBy ? (permit?.ValidFromT || closedTime || '____') : '____')}</span>
                      {' '}Sign: <span className="font-mono font-bold text-[8px] text-emerald-800">{appr1?.SignedBy ? '[APPROVED]' : '______'}</span>
                    </div>
                    <div>
                      Second Approver: <span className="font-mono underline font-bold">{appr2Formatted !== '—' ? appr2Formatted : '_________________'}</span>
                      {' '}Date: <span className="font-mono underline">{appr2?.ActionDate || (appr2?.SignedBy ? (permit?.ValidFromD || closedDate || '____') : '____')}</span>
                      {' '}At: <span className="font-mono underline">{appr2?.ActionTime || (appr2?.SignedBy ? (permit?.ValidFromT || closedTime || '____') : '____')}</span>
                      {' '}Sign: <span className="font-mono font-bold text-[8px] text-emerald-800">{appr2?.SignedBy ? '[APPROVED]' : '______'}</span>
                    </div>
                  </div>
                </div>

                <div className="pl-1">
                  <div className="font-black uppercase mb-1 flex justify-between items-center">
                    <span>Section M: Area Operator</span>
                    {isAreaCleared && (
                      <span className="text-[7.5px] font-mono text-emerald-800 font-bold border border-emerald-800/40 px-1 py-0.2 rounded bg-emerald-50">
                        [CLEARED IN SAP]
                      </span>
                    )}
                  </div>
                  <p className="text-[8.5px] leading-tight mb-1.5">
                    I have been communicated and understood the work to be executed in the area, precautions and safety measures to be taken as mentioned herein.
                  </p>
                  <div className="space-y-1 text-[9px]">
                    <div>
                      <span className="font-semibold mr-1">Name:</span>
                      <span className="font-mono font-bold underline">
                        {areaOpFormatted !== '—' ? areaOpFormatted : '______________________'}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold mr-1">Date:</span>
                      <span className="font-mono underline">
                        {areaOpDate || '________'}
                      </span>
                      <span className="font-semibold mx-1">At:</span>
                      <span className="font-mono underline">
                        {areaOpTime || '________'}
                      </span>
                      <span className="font-semibold mx-1">Hrs</span>
                      <span className="font-semibold mx-1">Signature:</span>
                      <span className="font-mono underline font-bold text-[8px] text-emerald-800">
                        {isAreaCleared && areaOperatorName ? '[DIGITALLY CLEARED]' : '_________________'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section N: Closure & Handover */}
              <div className="border border-black p-1.5 mb-1 text-[9.5px]">
                <div className="font-black uppercase mb-1 flex justify-between items-center">
                  <span>Section N: Permit Closure/Cancellation</span>
                  {isClosed && (
                    <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold border font-mono ${isCancelled ? 'bg-rose-100 text-rose-800 border-rose-400' : 'bg-slate-200 text-black border-black'}`}>
                      {isCancelled ? '[STATUS: CANCELLED]' : '[STATUS: CLOSED / COMPLETE]'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="space-y-1">
                    <CheckSquare checked={isClosed && !isCancelled} label="Job Completed & Housekeeping restored" />
                    <CheckSquare checked={false} label="Job to be Completed. Please Issue a new Permit" />
                    <CheckSquare checked={isCancelled} label="Permit is Cancelled and Closed" extraText={isCancelled && cancelReason ? `Due to: ${cancelReason}` : "Due to: _________________________"} />
                  </div>
                  <table className="w-full border-collapse border border-black text-[8.5px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-black">
                        <th className="p-0.5 border-r border-black text-left">Authority</th>
                        <th className="p-0.5 border-r border-black text-left">Name</th>
                        <th className="p-0.5 border-r border-black text-left">Signature</th>
                        <th className="p-0.5 border-r border-black">Date</th>
                        <th className="p-0.5">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="p-0.5 border-r border-black font-semibold">Power restored by</td>
                        <td className="p-0.5 border-r border-black font-mono text-[8px] leading-tight break-words">{powerRestoredFormatted}</td>
                        <td className="p-0.5 border-r border-black font-mono">{powerRestoredSignature}</td>
                        <td className="p-0.5 border-r border-black font-mono text-center">{powerRestoredDate}</td>
                        <td className="p-0.5 font-mono text-center">{powerRestoredTime}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-0.5 border-r border-black font-semibold">Acceptor</td>
                        <td className="p-0.5 border-r border-black font-mono text-[8px] leading-tight break-words">{acceptorCloseFormatted}</td>
                        <td className="p-0.5 border-r border-black font-mono">{isAcceptorClosed ? '[DIGITALLY SIGNED]' : ''}</td>
                        <td className="p-0.5 border-r border-black font-mono text-center">{acceptorDate}</td>
                        <td className="p-0.5 font-mono text-center">{acceptorTime}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-0.5 border-r border-black font-semibold">Area Operator</td>
                        <td className="p-0.5 border-r border-black font-mono text-[8px] leading-tight break-words">{areaOpCloseFormatted}</td>
                        <td className="p-0.5 border-r border-black font-mono">{isAreaOpClosed ? '[SITE CHECKED]' : ''}</td>
                        <td className="p-0.5 border-r border-black font-mono text-center">{areaOpCloseDate}</td>
                        <td className="p-0.5 font-mono text-center">{areaOpCloseTime}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-0.5 border-r border-black font-semibold">Issuer</td>
                        <td className="p-0.5 border-r border-black font-mono text-[8px] leading-tight break-words">{issuerCloseFormatted}</td>
                        <td className="p-0.5 border-r border-black font-mono">{isClosed ? '[SAP AUTHORIZED]' : ''}</td>
                        <td className="p-0.5 border-r border-black font-mono text-center">{issuerDate}</td>
                        <td className="p-0.5 font-mono text-center">{issuerTime}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="text-[8px] text-red-600 font-bold uppercase leading-tight border-t border-black/30 pt-1">
                  IMPORTANT: THE PERMIT IS AUTOMATICALLY SUSPENDED IN THE EVENT OF PLANT-WIDE EMERGENCY OR IF THERE ARE CHANGES IN WORK SITE CONDITIONS MAKING IT UNSAFE TO CONTINUE WORK.
                </div>
              </div>

              {/* Tool Box With WORKER LIST */}
              <div className="border border-black p-1.5 mb-1">
                <div className="text-[10px] font-black uppercase mb-1 text-center">Tool Box With WORKER LIST</div>
                <table className="w-full border-collapse border border-black text-[9px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-black text-[8.5px]">
                      <th className="p-1 border-r border-black text-left w-[22%]">NAME</th>
                      <th className="p-1 border-r border-black text-left w-[15%]">AGENCY</th>
                      <th className="p-1 border-r border-black text-center w-[13%]">Signature</th>
                      <th className="p-1 border-r border-black text-left w-[22%]">NAME</th>
                      <th className="p-1 border-r border-black text-left w-[15%]">AGENCY</th>
                      <th className="p-1 text-center w-[13%]">Signature</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_, idx) => {
                      const w1 = (permit?._Worker || [])[idx * 2];
                      const w2 = (permit?._Worker || [])[idx * 2 + 1];
                      return (
                        <tr key={idx} className="border-b border-black">
                          <td className="p-1 border-r border-black font-mono">{w1?.WorkerName || '—'}</td>
                          <td className="p-1 border-r border-black font-mono">{w1?.ContractorName || w1?.WorkerTypeCode || '—'}</td>
                          <td className="p-1 border-r border-black font-mono text-center">{w1 ? (isClosed ? '✓' : '') : ''}</td>
                          <td className="p-1 border-r border-black font-mono">{w2?.WorkerName || '—'}</td>
                          <td className="p-1 border-r border-black font-mono">{w2?.ContractorName || w2?.WorkerTypeCode || '—'}</td>
                          <td className="p-1 font-mono text-center">{w2 ? (isClosed ? '✓' : '') : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(permit?._Worker?.length || 0) > 12 && (
                  <div className="text-[8px] italic text-slate-700 mt-1 flex justify-between items-center bg-slate-50 p-1 border border-black/30">
                    <span>Showing primary 12 of {permit._Worker.length} workers registered for this permit.</span>
                    <span className="font-bold underline">See attached Annexure-V-A Extended Crew Muster Sheet for remaining {permit._Worker.length - 12} workers.</span>
                  </div>
                )}
              </div>

              {/* PERMIT RENEWAL RECORD */}
              <div className="border border-black p-1.5">
                <div className="text-[10px] font-black uppercase mb-1 text-center">PERMIT RENEWAL RECORD</div>
                <table className="w-full border-collapse border border-black text-[8.5px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-black">
                      <th className="p-1 border-r border-black">Date</th>
                      <th className="p-1 border-r border-black">Issuer</th>
                      <th className="p-1 border-r border-black">Accepter</th>
                      <th className="p-1 border-r border-black">Area Operator</th>
                      <th className="p-1 border-r border-black">NDO/SSM (After 22:00)</th>
                      <th className="p-1">Approver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 4 }).map((_, idx) => {
                      const ren = permit?._ShiftRenewal?.[idx];
                      return (
                        <tr key={idx} className="border-b border-black h-5">
                          <td className="p-1 border-r border-black font-mono text-center">{ren?.NewValidToD || ''}</td>
                          <td className="p-1 border-r border-black font-mono">{ren?.RequestedBy || ''}</td>
                          <td className="p-1 border-r border-black font-mono">{ren?.AccepterName || ''}</td>
                          <td className="p-1 border-r border-black font-mono">{ren?.AreaOperatorName || ''}</td>
                          <td className="p-1 border-r border-black font-mono">{ren?.NdoName || ''}</td>
                          <td className="p-1 font-mono">{ren?.ApprovedBy || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-right text-[8px] font-mono text-slate-500 pt-1 border-t border-black/40 mt-1">
              HSE/SAF/02 Rev-08 · Gujarat Fluorochemicals Limited Dahej · Page 3 of 4
            </div>
          </div>

          {/* PAGE 4 (PDF PAGE 58): TEMPORARY TRIAL, GAS TEST LOG, CONFINED SPACE ENTRY */}
          <div className="print-page border-2 border-black p-3 bg-white max-w-[210mm] w-full mx-auto flex flex-col justify-between box-border min-h-[265mm] mb-6 shadow-xl print:m-0 print:p-2 print:max-w-none print:w-full print:min-h-[265mm] print:h-auto print:shadow-none print:border-2 print:border-black">
            <div>
              {/* Header */}
              <div className="flex justify-between items-center text-[10px] font-bold border-b border-black pb-0.5 mb-1.5">
                <span className="uppercase tracking-wide">Annexure-V (HSE/SAF/02, Rev-08) — Gas Tests & Confined Space Log</span>
                <span className="font-mono">Work Permit No.: <strong className="underline text-[11px]">{permitNo}</strong></span>
              </div>

              {/* Temporary Trial Table */}
              <div className="border border-black p-1.5 mb-1 text-[9.5px]">
                <div className="font-black uppercase mb-1 text-center">TEMPORARY ELECTRICAL LOTO LIFTING FOR EQUIPMENT TRIAL</div>
                <table className="w-full border-collapse border border-black text-[8.5px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-black">
                      <th className="p-1 border-r border-black w-24">Date</th>
                      <th className="p-1 border-r border-black">Issuer Name, Sign & time</th>
                      <th className="p-1 border-r border-black">Accepter Name, Sign & time</th>
                      <th className="p-1">Area Operator Name, Sign & time</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="p-1 border-r border-black font-mono">Date: ________</td>
                      <td className="p-1 border-r border-black font-mono"></td>
                      <td className="p-1 border-r border-black font-mono"></td>
                      <td className="p-1 font-mono"></td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-1 border-r border-black font-mono">Date: ________</td>
                      <td className="p-1 border-r border-black font-mono"></td>
                      <td className="p-1 border-r border-black font-mono"></td>
                      <td className="p-1 font-mono"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Gas Test Record */}
              <div className="border border-black p-1.5 mb-1 text-[9.5px]">
                <div className="font-black uppercase mb-0.5 text-center">GAS TEST RECORD</div>
                <div className="grid grid-cols-2 text-[9px] mb-1 pb-1 border-b border-black/40">
                  <div>GAS METER TYPE: <span className="font-mono underline">{permit?._GasTest?.[0]?.MeterType || '______________________'}</span></div>
                  <div>DATE OF LAST CALIBRATION: <span className="font-mono underline">{permit?._GasTest?.[0]?.CalibDate || '______________________'}</span></div>
                </div>

                <div className="text-[9px] font-bold mb-0.5">AUTHORIZED GAS TESTERS</div>
                <table className="w-full border-collapse border border-black text-[8.5px] mb-2">
                  <thead>
                    <tr className="bg-slate-100 border-b border-black">
                      <th className="p-0.5 border-r border-black text-left">NAME</th>
                      <th className="p-0.5 border-r border-black text-left">FUNCTION</th>
                      <th className="p-0.5 text-left">SIGNATURE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="p-0.5 border-r border-black font-mono">{permit?._GasTest?.[0]?.TestedBy ? (formatAuthority(permit._GasTest[0].TestedBy, permit._GasTest[0]?.TesterName) !== '—' ? formatAuthority(permit._GasTest[0].TestedBy, permit._GasTest[0]?.TesterName) : permit._GasTest[0].TestedBy) : '—'}</td>
                      <td className="p-0.5 border-r border-black">Gas Tester</td>
                      <td className="p-0.5 font-mono"></td>
                    </tr>
                  </tbody>
                </table>

                {/* Gas Readings Table */}
                <table className="w-full border-collapse border border-black text-[8px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-black">
                      <th className="p-0.5 border-r border-black">DATE</th>
                      <th className="p-0.5 border-r border-black">TIME (hrs)</th>
                      <th className="p-0.5 border-r border-black">%LEL</th>
                      <th className="p-0.5 border-r border-black">O2 (%)</th>
                      <th className="p-0.5 border-r border-black">CO2 (ppm)</th>
                      <th className="p-0.5 border-r border-black">H2S (ppm)</th>
                      <th className="p-0.5 border-r border-black">LOCATION</th>
                      <th className="p-0.5 border-r border-black">TESTED BY</th>
                      <th className="p-0.5">SIGNATURE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.max(6, Math.min(8, (permit?._GasTest?.length || 0) + 2)) }).map((_, idx) => {
                      const g = permit?._GasTest?.[idx];
                      return (
                        <tr key={idx} className="border-b border-black">
                          <td className="p-0.5 border-r border-black font-mono text-center">{g?.TestDate || '—'}</td>
                          <td className="p-0.5 border-r border-black font-mono text-center">{g?.TestTime || '—'}</td>
                          <td className="p-0.5 border-r border-black font-mono text-center">{g?.LelPct !== undefined ? `${g.LelPct}%` : '—'}</td>
                          <td className="p-0.5 border-r border-black font-mono text-center">{g?.O2Pct !== undefined ? `${g.O2Pct}%` : '—'}</td>
                          <td className="p-0.5 border-r border-black font-mono text-center">{g?.CoVal !== undefined ? g.CoVal : '—'}</td>
                          <td className="p-0.5 border-r border-black font-mono text-center">{g?.H2sVal !== undefined ? g.H2sVal : '—'}</td>
                          <td className="p-0.5 border-r border-black font-mono">{g?.TestLocation || '—'}</td>
                          <td className="p-0.5 border-r border-black font-mono">{g?.TestedBy || '—'}</td>
                          <td className="p-0.5 font-mono text-center">{g?.TestedBy ? '✓' : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Confined Space Entrance Record */}
              <div className="border border-black p-1.5 text-[9.5px]">
                <div className="font-black uppercase mb-0.5 text-center">CONFINED SPACE ENTRANCE RECORD</div>
                <div className="grid grid-cols-2 text-[9px] mb-1">
                  <div>Equipment Tag No: <span className="font-mono underline font-medium">{permit?.Equnr || '______________'}</span></div>
                  <div>Name of Equipment: <span className="font-mono underline font-medium">{permit?.JobDesc?.slice(0, 30) || '______________'}</span></div>
                </div>

                <table className="w-full border-collapse border border-black text-[8px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-black">
                      <th className="p-0.5 border-r border-black w-8">Sr no.</th>
                      <th className="p-0.5 border-r border-black">Name</th>
                      <th className="p-0.5 border-r border-black">Time in</th>
                      <th className="p-0.5 border-r border-black">Signature</th>
                      <th className="p-0.5 border-r border-black">Time Out</th>
                      <th className="p-0.5">Signature</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map(sr => (
                      <tr key={sr} className="border-b border-black">
                        <td className="p-0.5 border-r border-black text-center font-bold">{sr}</td>
                        <td className="p-0.5 border-r border-black font-mono"></td>
                        <td className="p-0.5 border-r border-black font-mono"></td>
                        <td className="p-0.5 border-r border-black font-mono"></td>
                        <td className="p-0.5 border-r border-black font-mono"></td>
                        <td className="p-0.5 font-mono"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-[7.5px] italic mt-1 text-slate-700">
                  Note: The permit issuer shall assess the type of confined space and decide the permitted stay time accordingly.
                </div>
              </div>
            </div>

            <div className="text-right text-[8px] font-mono text-slate-500 pt-1 border-t border-black/40 mt-1">
              HSE/SAF/02 Rev-08 · Gujarat Fluorochemicals Limited Dahej · Page 4 of 4
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PAGE 5 (ANNEXURE-V-A): EXTENDED CREW MUSTER CONTINUATION SHEET */}
          {/* ========================================================================= */}
          {(permit?._Worker?.length || 0) > 12 && (
            <div className="print-page border-2 border-black p-3 bg-white max-w-[210mm] w-full mx-auto flex flex-col justify-between box-border min-h-[265mm] mb-6 shadow-xl print:m-0 print:p-2 print:max-w-none print:w-full print:min-h-[265mm] print:h-auto print:shadow-none print:border-2 print:border-black">
              <div>
                {/* Header */}
                <div className="flex justify-between items-center text-[10px] font-bold border-b border-black pb-0.5 mb-2">
                  <span className="uppercase tracking-wide">
                    Annexure-V-A (HSE/SAF/02, Rev-08) — Extended Crew Muster Continuation Sheet
                  </span>
                  <span className="font-mono">
                    Work Permit No.: <strong className="underline text-[11px]">{permitNo}</strong>
                  </span>
                </div>

                <div className="border border-black p-1.5 mb-2 text-[9.5px] bg-slate-50">
                  <div className="grid grid-cols-3 gap-2">
                    <div><span className="font-bold">Plant / Unit: </span><span className="font-mono">{permit?.Werks || '1002'}</span></div>
                    <div><span className="font-bold">Area / Location: </span><span>{permit?.AreaLoc || '—'}</span></div>
                    <div><span className="font-bold">Total Crew Strength: </span><span className="font-bold font-mono">{permit?._Worker?.length || 0} Workers</span></div>
                  </div>
                </div>

                <div className="border border-black p-1.5 mb-2">
                  <div className="text-[10px] font-black uppercase mb-1 text-center">
                    Extended Worker Attendance & Toolbox Muster Roster
                  </div>
                  <table className="w-full border-collapse border border-black text-[9px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-black text-[8.5px]">
                        <th className="p-1 border-r border-black text-center w-8">#</th>
                        <th className="p-1 border-r border-black text-left w-[35%]">WORKER NAME</th>
                        <th className="p-1 border-r border-black text-left w-[25%]">AGENCY / CONTRACTOR</th>
                        <th className="p-1 border-r border-black text-left w-[15%]">TRADE / TYPE</th>
                        <th className="p-1 text-center w-[15%]">SIGNATURE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permit._Worker.slice(12).map((worker: any, wIdx: number) => (
                        <tr key={wIdx} className="border-b border-black/50">
                          <td className="p-1 border-r border-black font-mono text-center font-bold">{13 + wIdx}</td>
                          <td className="p-1 border-r border-black font-mono font-medium">{worker.WorkerName || '—'}</td>
                          <td className="p-1 border-r border-black font-mono">{worker.ContractorName || '—'}</td>
                          <td className="p-1 border-r border-black font-mono">{worker.WorkerTypeCode || 'CONT'}</td>
                          <td className="p-1 font-mono text-center">{isClosed ? '✓' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="text-right text-[8px] font-mono text-slate-500 pt-1 border-t border-black/40 mt-1">
                HSE/SAF/02 Rev-08 · Annexure-V-A Crew Muster Continuation · Gujarat Fluorochemicals Limited Dahej
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
