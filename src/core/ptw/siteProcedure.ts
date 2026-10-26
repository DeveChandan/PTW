import type { PermitDeepInsertPayload, SafetyRecord } from '../types/ptw.types';

export const PROCEDURE = { id: 'HSE/SAF/P/01', revision: '03', date: '2026-04-01', form: 'HSE/SAF/02 Rev-08' };
export const PERMIT_CATEGORIES = [
  { code: 'COLD', sapCode: 'COLD', label: 'Cold work', icon: 'ac_unit', desc: 'Maintenance and non-hot work' },
  { code: 'HOT', sapCode: 'HOT', label: 'Hot work', icon: 'local_fire_department', desc: 'Welding, cutting and ignition sources' },
  { code: 'CONF', sapCode: 'CSE', label: 'Confined space Entry', icon: 'door_sliding', desc: 'Vessel, tank and restricted entry' },
  { code: 'EXCV', sapCode: 'EXCV', label: 'Excavation', icon: 'construction', desc: 'Underground services and entry clearance' },
  { code: 'HGHT', sapCode: 'W@H', label: 'Work at height', icon: 'height', desc: 'At and above 1.8 m; assess protection' },
  { code: 'LINE', sapCode: 'LBRK', label: 'Line breaking', icon: 'plumbing', desc: 'Opening hazardous lines or equipment' },
  { code: 'RIGG', sapCode: 'RIG', label: 'Rigging', icon: 'forklift', desc: 'Approved lifting and rigging plan' },
  { code: 'RAD', sapCode: 'RAD', label: 'Radiography', icon: 'warning', desc: 'Radiation controls and supporting permits' },
  { code: 'HYPN', sapCode: 'HYD_PNEU', label: 'Hydraulic / pneumatic', icon: 'compress', desc: 'Stored energy and mechanical restraint' },
  { code: 'ELEC', sapCode: 'ELEC', label: 'Electrical', icon: 'bolt', desc: 'Separate electrical work requirements' },
  { code: 'OTHER', sapCode: 'OTHER', label: 'Other work', icon: 'more_horiz', desc: 'Describe scope and required controls' },
] as const;

export const isSupportedCategory = (type: string): boolean =>
  PERMIT_CATEGORIES.some(category => category.code === type || category.sapCode === type);

export const NATURE_OF_WORK = ['Welding / gas cutting', 'Hot tapping', 'Opening line / equipment', 'Excavation', 'Civil work', 'Insulation', 'Material handling', 'Painting', 'Electrical systems', 'Fire network', 'Mechanical lockout', 'Fragile roof', 'Road closure', 'Hydro-jetting', 'Instrumentation', 'Radiation sources', 'Grinding / drilling / cutting', 'Online sealing', 'Other'];
export const TOOLS = ['Welding machine', 'Gas cylinders / cutting set', 'Man lift', 'Non-sparking tools', 'Mobile crane / winch', 'Crane / Farana / HEMM', 'Lifting tools and tackles', 'Portable electric tools', 'Scaffold', 'Ladders', 'Grinding / cutting / drilling set', 'Civil hand tools', 'Hydraulic tools', 'Pneumatic tools', 'Lifeline', 'Mechanical hand tools', 'Electrical insulated tools', 'Other'];

export const NATURE_CODE_MAP: Record<string, string> = {
  'Welding / gas cutting': 'WELD',
  'Hot tapping': 'HOT_TAP',
  'Opening line / equipment': 'OPEN_LINE',
  'Excavation': 'EXCV',
  'Civil work': 'CIVIL',
  'Insulation': 'INSUL',
  'Material handling': 'MAT_HDL',
  'Painting': 'PAINT',
  'Electrical systems': 'ELEC_SYS',
  'Fire network': 'FIRE_NET',
  'Mechanical lockout': 'MECH_LO',
  'Fragile roof': 'FRAG_ROOF',
  'Road closure': 'ROAD_CLS',
  'Hydro-jetting': 'HYDRO_JET',
  'Instrumentation': 'INST',
  'Radiation sources': 'RAD_SRC',
  'Grinding / drilling / cutting': 'GRIND_CUT',
  'Online sealing': 'ONL_SEAL',
  'Other': 'OTHER'
};

export const TOOL_CODE_MAP: Record<string, string> = {
  'Welding machine': 'WELD_MCH',
  'Gas cylinders / cutting set': 'GAS_CYL',
  'Man lift': 'MAN_LIFT',
  'Non-sparking tools': 'NON_SPARK',
  'Mobile crane / winch': 'CRANE_WIN',
  'Crane / Farana / HEMM': 'FARANA',
  'Lifting tools and tackles': 'LIFT_TKL',
  'Portable electric tools': 'PORT_ELEC',
  'Scaffold': 'SCAFFOLD',
  'Ladders': 'LADDER',
  'Grinding / cutting / drilling set': 'GRIND_SET',
  'Civil hand tools': 'CIVIL_TLS',
  'Hydraulic tools': 'HYD_TLS',
  'Pneumatic tools': 'PNEU_TLS',
  'Lifeline': 'LIFELINE',
  'Mechanical hand tools': 'MECH_TLS',
  'Electrical insulated tools': 'ELEC_TLS',
  'Other': 'OTHER'
};

export function toNatwCode(desc: string): string {
  if (!desc) return '';
  const trimmed = desc.trim();
  if (NATURE_CODE_MAP[trimmed]) return NATURE_CODE_MAP[trimmed];
  if (trimmed.toLowerCase().startsWith('other')) return 'OTHER';
  const clean = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 10);
  return clean || 'NATW';
}

export function toEquipCode(desc: string): string {
  if (!desc) return '';
  const trimmed = desc.trim();
  if (TOOL_CODE_MAP[trimmed]) return TOOL_CODE_MAP[trimmed];
  if (trimmed.toLowerCase().startsWith('other')) return 'OTHER';
  const clean = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 10);
  return clean || 'EQUIP';
}

export interface Preparation { code: string; label: string; applies?: string[]; page: number }
export const PREPARATIONS: Preparation[] = [
  { code: 'F001', label: 'Joint site visit and signed JSA', page: 12 },
  { code: 'F002', label: 'Affected persons and simultaneous operations reviewed', page: 34 },
  { code: 'F003', label: 'Job-specific PPE and emergency arrangements identified', page: 13 },
  { code: 'F004', label: 'Equipment depressurized, drained and decontaminated', page: 13 },
  { code: 'F005', label: 'Isolation / blinding and stored-energy controls planned', page: 13 },
  { code: 'F006', label: 'Area barricading and access controls', page: 56 },
  { code: 'F007', label: 'Toolbox talk and worker attendance plan', page: 35 },
  { code: 'F008', label: 'Supporting checklists and drawings identified', page: 34 },
  { code: 'FH01', label: 'Hot-work compliance checklist and spark protection', applies: ['HOT'], page: 22 },
  { code: 'FH02', label: 'Fire extinguisher / hose / fire blanket provisions', applies: ['HOT'], page: 56 },
  { code: 'FH03', label: 'Named fire watch and 30-minute post-work watch', applies: ['HOT'], page: 9 },
  { code: 'FC01', label: 'Confined-space checklist and isolation drawing', applies: ['CONF', 'CSE'], page: 23 },
  { code: 'FC02', label: 'Named standby, communication and entry / exit register', applies: ['CONF', 'CSE'], page: 24 },
  { code: 'FC03', label: 'Rescue arrangements and applicable rescue plan', applies: ['CONF', 'CSE'], page: 24 },
  { code: 'FC04', label: 'Medical fitness checked within six months', applies: ['CONF', 'CSE', 'HGHT', 'W@H'], page: 24 },
  { code: 'FC05', label: '24 V flameproof lighting and electrical protection', applies: ['CONF', 'CSE'], page: 23 },
  { code: 'FW01', label: 'Height-work checklist, scaffold / ladder inspection', applies: ['HGHT', 'W@H'], page: 21 },
  { code: 'FW02', label: 'Fall protection and fragile-surface controls', applies: ['HGHT', 'W@H'], page: 21 },
  { code: 'FX01', label: 'Underground utility departmental clearances', applies: ['EXCV'], page: 29 },
  { code: 'FX02', label: 'Depth, excavation method and confined-space need assessed', applies: ['EXCV'], page: 29 },
  { code: 'FL01', label: 'Line-break planning sheet and chemical hazards', applies: ['LINE', 'LBRK'], page: 27 },
  { code: 'FL02', label: 'First break witnessed by operator / process engineer', applies: ['LINE', 'LBRK'], page: 27 },
  { code: 'FR01', label: 'Rigging plan and load-dependent approval references', applies: ['RIGG', 'RIG'], page: 31 },
  { code: 'FR02', label: 'Crane, slings, hooks and lifting equipment certification', applies: ['RIGG', 'RIG'], page: 31 },
  { code: 'FD01', label: 'Radiation permit, hot-work permit and area notification', applies: ['RAD'], page: 30 },
  { code: 'FD02', label: 'Dosimeter, TLD badge, survey meter and exclusion zone', applies: ['RAD'], page: 30 },
  { code: 'FE01', label: 'Electrical work checklist and district countersignature', applies: ['ELEC'], page: 19 },
  { code: 'FP01', label: 'Hydraulic / pneumatic pressure released and parts supported', applies: ['HYPN', 'HYD_PNEU'], page: 32 },
];
export const PLAN_FIELDS = [
  { code: 'JSA1', label: 'Signed JSA document reference', required: true, reference: true },
  { code: 'JSA2', label: 'JSA team / joint site visit notes', required: true },
  { code: 'SHFT', label: 'Planned shift end (site time)', required: true, datetime: true },
  { code: 'ISSR', label: 'Proposed issuer SAP user ID', required: true, user: true },
  { code: 'ACCP', label: 'Proposed acceptor SAP user ID', required: true, user: true },
  { code: 'OPER', label: 'Proposed area operator SAP user ID', required: true, user: true },
  { code: 'AP01', label: 'Proposed Approver I SAP user ID', user: true },
  { code: 'AP02', label: 'Proposed Approver II SAP user ID', user: true },
  { code: 'AP03', label: 'Proposed Approver III SAP user ID', user: true },
  { code: 'DIST', label: 'Affected safety district / countersignature reference' },
  { code: 'FWNM', label: 'Fire watch person name (FireWatchName)', applies: ['HOT'], required: true },
  { code: 'FWCT', label: 'Fire watch contact phone (FireWatchContact)', applies: ['HOT'], phone: true, required: true },
  { code: 'SBNM', label: 'Standby person name (StandByName)', applies: ['CONF', 'CSE'], required: true },
  { code: 'SBCT', label: 'Standby person contact phone (StandByContact)', applies: ['CONF', 'CSE'], phone: true, required: true },
  { code: 'RESC', label: 'Rescue plan / arrangements reference (RiggingPlanRescuePlan)', applies: ['CONF', 'CSE'], reference: true, required: true },
  { code: 'DRAW', label: 'Isolation drawing reference', applies: ['CONF', 'CSE', 'LINE', 'LBRK'], reference: true },
  { code: 'RIGP', label: 'Rigging plan and approval reference (RiggingPlanRescuePlan)', applies: ['RIGG', 'RIG'], reference: true, required: true },
  { code: 'LOAD', label: 'Lifting load in metric tonnes', applies: ['RIGG', 'RIG'] },
  { code: 'DEPT', label: 'Excavation depth in metres', applies: ['EXCV'] },
  { code: 'CHEM', label: 'Chemicals / contents of line or equipment (ChemicalContent)', applies: ['LINE', 'LBRK', 'CONF', 'CSE'] },
  { code: 'RADP', label: 'Supporting radiation permit reference', applies: ['RAD'], reference: true },
  { code: 'OTHR', label: 'Other work scope and controls', applies: ['OTHER'], required: true },
  { code: 'NOTE', label: 'Other tools / nature of work and preparation notes' },
] as const;

export interface PlanCheck { response: '' | 'YES' | 'NO' | 'NA'; remarks: string }
export interface SitePlan {
  additionalTypes: string[];
  nature: string[];
  tools: string[];
  fields: Record<string, string>;
  checks: Record<string, PlanCheck>;
}
export const emptySitePlan = (): SitePlan => ({ additionalTypes: [], nature: [], tools: [], fields: {}, checks: {} });
export const selectedTypes = (primary: string, plan: SitePlan) => [...new Set([primary, ...plan.additionalTypes].filter(Boolean))];
export const preparationsFor = (types: string[]) => PREPARATIONS.filter(item => !item.applies || item.applies.some(type => types.includes(type)));
export const fieldsFor = (types: string[]) => PLAN_FIELDS.filter(item => !('applies' in item) || item.applies.some(type => types.includes(type)));
export const requiresGasPlan = (types: string[]) => types.some(type => ['HOT', 'CONF', 'CSE'].includes(type));

export function toSapPermitType(type: string): string {
  if (!type) return '';
  const trimmed = type.trim();
  const match = PERMIT_CATEGORIES.find(
    c => c.code.toUpperCase() === trimmed.toUpperCase() || c.sapCode.toUpperCase() === trimmed.toUpperCase()
  );
  return match ? match.sapCode : trimmed;
}

/** Planning guidance from p.18, never an authorization decision. */
export function approvalGuidance(types: string[], time: string): string[] {
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)) return ['Enter the planned start time to see the time-based approval guidance.'];
  const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const night = minutes >= 23 * 60 || minutes < 9 * 60;
  const evening = minutes >= 17 * 60 + 30;
  return types.map(type => {
    const name = PERMIT_CATEGORIES.find(item => item.code === type || item.sapCode === type)?.label || type;
    if (type === 'COLD') return `${name}: no Approver I/II signature in p.18; issuer, acceptor and operator duties still apply.`;
    if (type === 'CONF' || type === 'CSE') return `${name}: ${night ? 'Approver III; notify Dy Unit Head / Unit Head per p.9' : 'Approvers I and II'}. Non-working-day rules and gas limits require confirmation.`;
    if (type === 'HOT') return `${name}: ${night ? 'Approver II' : 'Approvers I and II'} (p.18). Record authorized substitution evidence where applicable.`;
    if (type === 'HGHT' || type === 'W@H') return `${name}: ${night ? 'Approver II' : 'Approver I'} (p.18).`;
    if (type === 'RIGG' || type === 'RIG') return `${name}: p.18 indicates ${night ? 'Approver II' : evening ? 'Approvers I and II' : 'Approver I'}; reconcile p.15 sequence and obtain load-dependent rigging-plan approvals.`;
    if (type === 'RAD') return `${name}: ${night ? 'Approver II' : evening ? 'Approvers I and II' : 'Approver I'} (p.18), plus supporting permits.`;
    if (type === 'LINE' || type === 'LBRK') return `${name}: chemical-dependent approval rules on pp.27–28 conflict with the general matrix. Confirm the required route.`;
    if (type === 'EXCV') return `${name}: confirm the depth-based route, utility clearances and whether confined-space entry is also required (pp.18, 29).`;
    return `${name}: confirm the applicable individual procedure and authorized permit matrix.`;
  });
}

// Planning records use the existing Safety navigation. They never assert a signature.
function row(code: string, label: string, remarks = '', response: SafetyRecord['Response'] = 'NA'): SafetyRecord {
  return { PermitNo: '', ItemNo: '', Category: 'PTW', ItemCode: code, Response: response, ValueText: label,
    ValueNum: 0, Unit: '', ReferenceNo: '', ResponsibleUser: '', VerifiedBy: '', VerifiedAt: null, Remarks: remarks };
}
export function sitePlanRows(primary: string, plan: SitePlan): SafetyRecord[] {
  const types = selectedTypes(primary, plan);
  const rows = [row('DOCV', 'Procedure and source form', `${PROCEDURE.id} Rev-${PROCEDURE.revision} ${PROCEDURE.date}; ${PROCEDURE.form}`)];
  types.forEach(type => rows.push(row('TYPE', 'Applicable work category', type)));
  plan.nature.forEach(value => {
    const detail = value === 'Other' && (plan.fields.OTHER_NATURE || '').trim() ? `Other: ${plan.fields.OTHER_NATURE.trim()}` : value;
    rows.push(row('NATR', 'Nature of work', detail));
  });
  plan.tools.forEach(value => {
    const detail = value === 'Other' && (plan.fields.OTHER_TOOLS || '').trim() ? `Other: ${plan.fields.OTHER_TOOLS.trim()}` : value;
    rows.push(row('TOOL', 'Tools and equipment', detail));
  });
  fieldsFor(types).forEach(field => {
    let value = (plan.fields[field.code] || '').trim();
    if (field.code === 'FWNM' && !value && plan.fields.FWAT) value = plan.fields.FWAT.trim();
    if (field.code === 'SBNM' && !value && plan.fields.STBY) value = plan.fields.STBY.trim();
    if (field.code === 'NOTE' && !value) {
      value = [
        plan.fields.OTHER_NATURE ? `Nature: ${plan.fields.OTHER_NATURE.trim()}` : '',
        plan.fields.OTHER_TOOLS ? `Tools: ${plan.fields.OTHER_TOOLS.trim()}` : ''
      ].filter(Boolean).join('; ');
    }
    const record = row(field.code, field.label, value);
    if ('reference' in field) record.ReferenceNo = value;
    rows.push(record);
  });

  // Ensure legacy FWAT and STBY rows exist in _Safety for Annexure-V printout compatibility when applicable
  const hasHot = types.some(t => t === 'HOT');
  const hasConf = types.some(t => t === 'CONF' || t === 'CSE');

  const fwName = (plan.fields.FWNM || plan.fields.FWAT || '').trim();
  const fwContact = (plan.fields.FWCT || '').trim();
  if (hasHot && fwName && !rows.some(r => r.ItemCode === 'FWAT')) {
    const fwatVal = fwContact && fwContact !== '0' ? `${fwName} (${fwContact})` : fwName;
    rows.push(row('FWAT', 'Fire watch name and contact', fwatVal));
  }
  const sbName = (plan.fields.SBNM || plan.fields.STBY || '').trim();
  const sbContact = (plan.fields.SBCT || '').trim();
  if (hasConf && sbName && !rows.some(r => r.ItemCode === 'STBY')) {
    const stbyVal = sbContact && sbContact !== '0' ? `${sbName} (${sbContact})` : sbName;
    rows.push(row('STBY', 'Standby person name and contact', stbyVal));
  }

  preparationsFor(types).forEach(item => {
    const check = plan.checks[item.code];
    rows.push(row(item.code, item.label, check?.remarks || '', check?.response || 'NO'));
  });
  return rows.map((record, index) => ({ ...record, ItemNo: String(index + 1) }));
}

function siteTime(date: string | null, time: string): number {
  // Dahej operates in IST; do not interpret plant times in the browser's timezone.
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)) return NaN;
  const parsed = Date.parse(`${date}T${time.length === 5 ? time + ':00' : time}+05:30`);
  return Number.isFinite(parsed) && new Date(parsed + 330 * 60000).toISOString().slice(0, 10) === date ? parsed : NaN;
}
export function validateSitePermit(payload: PermitDeepInsertPayload): void {
  const rows = payload._Safety?.filter(record => record.Category === 'PTW') || [];
  // Preserve the legacy request contract. The site form always sends DOCV.
  if (!rows.some(record => record.ItemCode === 'DOCV')) return;
  const value = (code: string) => rows.find(record => record.ItemCode === code)?.Remarks?.trim() || '';
  const types = [...new Set([payload.PermitType, ...rows.filter(record => record.ItemCode === 'TYPE').map(record => record.Remarks)])];
  if (types.some(type => !isSupportedCategory(type))) throw new Error('Select supported work categories.');

  // Validate required plan fields with fallbacks
  for (const field of fieldsFor(types)) {
    let val = value(field.code);
    if (field.code === 'FWNM' && !val) val = payload.FireWatchName || value('FWAT') || '';
    if (field.code === 'FWCT' && !val) val = (payload.FireWatchContact && payload.FireWatchContact !== '0' ? payload.FireWatchContact : '') || '';
    if (field.code === 'SBNM' && !val) val = payload.StandByName || value('STBY') || '';
    if (field.code === 'SBCT' && !val) val = (payload.StandByContact && payload.StandByContact !== '0' ? payload.StandByContact : '') || '';
    if (field.code === 'RESC' && !val) val = payload.RiggingPlanRescuePlan || '';
    if (field.code === 'RIGP' && !val) val = payload.RiggingPlanRescuePlan || '';
    if ('required' in field && field.required && !val) throw new Error(`Complete ${field.label}.`);
  }

  // Specific role and plan mandatory validations
  if (types.includes('HOT')) {
    const fw = payload.FireWatchName || value('FWNM') || value('FWAT');
    if (!fw) throw new Error('Fire watch person name (FireWatchName) is mandatory for Hot Work operations.');
    const fwContact = (payload.FireWatchContact || value('FWCT') || '').trim();
    if (!fwContact || fwContact === '0') throw new Error('Fire watch contact phone (FireWatchContact) is mandatory for Hot Work operations.');
    const digits = fwContact.replace(/\D/g, '');
    if (digits.length < 10) throw new Error(`Fire watch contact phone is incomplete (${digits.length}/10 digits). 10 digits required.`);
    if (digits.length > 15) throw new Error(`Fire watch contact phone exceeds maximum length (${digits.length} digits). Max 15 digits allowed.`);
  }
  if (types.includes('CONF') || types.includes('CSE')) {
    const sb = payload.StandByName || value('SBNM') || value('STBY');
    if (!sb) throw new Error('Standby person name (StandByName) is mandatory for Confined Space Entry.');
    const sbContact = (payload.StandByContact || value('SBCT') || '').trim();
    if (!sbContact || sbContact === '0') throw new Error('Standby person contact phone (StandByContact) is mandatory for Confined Space Entry.');
    const digits = sbContact.replace(/\D/g, '');
    if (digits.length < 10) throw new Error(`Standby person contact phone is incomplete (${digits.length}/10 digits). 10 digits required.`);
    if (digits.length > 15) throw new Error(`Standby person contact phone exceeds maximum length (${digits.length} digits). Max 15 digits allowed.`);
    const rescue = payload.RiggingPlanRescuePlan || value('RESC');
    if (!rescue) throw new Error('Rescue plan reference (RiggingPlanRescuePlan) is mandatory for Confined Space Entry.');
  }
  if (types.includes('RIGG') || types.includes('RIG')) {
    const rig = payload.RiggingPlanRescuePlan || value('RIGP');
    if (!rig) throw new Error('Rigging plan and approval reference (RiggingPlanRescuePlan) is mandatory for Rigging operations.');
  }

  if (!rows.some(record => record.ItemCode === 'NATR') || !rows.some(record => record.ItemCode === 'TOOL')) throw new Error('Select the nature of work and tools / equipment.');
  if ((rows.some(record => ['NATR', 'TOOL'].includes(record.ItemCode) && (record.Remarks === 'Other' || record.Remarks.startsWith('Other')))) && !value('NOTE')) throw new Error('Describe the other nature of work or tools in preparation notes.');
  if (value('ISSR').toUpperCase() === value('ACCP').toUpperCase()) throw new Error('Issuer and acceptor must be different people.');
  if (!payload.AreaLoc.trim() || !payload.ExecDept.trim()) throw new Error('Complete the work area and execution department.');
  const start = siteTime(payload.ValidFromD, payload.ValidFromT);
  const end = siteTime(payload.ValidToD, payload.ValidToT);
  const [shiftDate, shiftTime] = value('SHFT').split('T');
  const shiftEnd = siteTime(shiftDate, shiftTime || '');
  if (![start, end, shiftEnd].every(Number.isFinite) || end <= start || shiftEnd <= start) throw new Error('Enter valid site times and a shift end after work starts.');
  if (end > Math.min(start + 8 * 3600000, shiftEnd)) throw new Error('Initial validity must end within eight hours or at shift end, whichever is earlier. Request an authorized extension separately.');
  if (requiresGasPlan(types) && payload.GasTestRequired !== 'Y' && payload.GasTestRequired !== 'X') throw new Error('Hot work / confined-space planning requires gas testing. Select Yes.');
  if (requiresGasPlan(types) && !['1', '2'].includes(payload.GasTestFreqHr)) throw new Error('Plan gas retesting at intervals of no more than two hours for hot work / confined space.');
  if ((types.includes('CONF') || types.includes('CSE')) && payload.IsolationRequired !== 'Y' && payload.IsolationRequired !== 'X') throw new Error('Confined-space planning requires positive isolation. Add the isolation plan.');
  for (const item of preparationsFor(types)) {
    const check = rows.find(record => record.ItemCode === item.code);
    if (!check || !['YES', 'NO', 'NA'].includes(check.Response)) throw new Error(`Review preparation: ${item.label}.`);
    if (check.Response === 'NA' && !check.Remarks.trim()) throw new Error(`Explain why this preparation is not applicable: ${item.label}.`);
  }
}

export const DOCUMENT_DECISIONS = [
  'Gas limits differ on pages 11, 14 and 24. HSE must confirm the applicable acceptance table.',
  'K / L / M role labels differ between page 15 and the form on pages 56–57. Use role names.',
  'Night approval begins at 23:00 in the matrix; the renewal form says 22:00. Confirm the trigger.',
  'Rigging and line-breaking approval sequences need reconciliation with the time-based matrix.',
];
export const LIFECYCLE = [
  { title: 'Plan and assess', detail: 'Joint site visit, signed JSA, crew, tools, work categories and supporting documents.' },
  { title: 'Prepare and isolate', detail: 'Site preparations, departmental clearances, isolation certification and fresh gas tests.' },
  { title: 'Authorize and accept', detail: 'Issuer, applicable Approvers I / II / III, Acceptor and Area Operator follow the approved matrix.' },
  { title: 'Release and monitor', detail: 'Toolbox attendance, valid field copy, gas retests and ongoing condition checks.' },
  { title: 'Revalidate or suspend', detail: 'Shift or responsible-person changes require revalidation. Record stop reason and verify before restart.' },
  { title: 'Close and restore', detail: 'Acceptor → Area Operator → Issuer → power restoration where applicable; record joint inspection and key return.' },
];
