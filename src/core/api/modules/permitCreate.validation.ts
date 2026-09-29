import { initialPermitStatus, gasRequirementRow } from '../../ptw/prerequisites';
import schema from '../permitCreateSchema.json';
import { validateSitePermit } from '../../ptw/siteProcedure';
import { PermitDeepInsertPayload } from '../../types/ptw.types';

interface Property { type: string; maxLength: string | null; precision: string | null; scale: string | null; nullable: boolean }
const entities = schema as Record<string, Record<string, Property>>;
const children: Record<string, string> = { _Worker: 'WorkerType', _PPE: 'PPEType', _Safety: 'SafetyType', _HazardControl: 'HazardControlType', _Isolation: 'IsolationType' };
const serverFields = new Set(['Permit_No', 'PermitNo', 'SAP__Messages', 'Ernam', 'Erdat', 'Erzet', 'Aenam', 'Aedat', 'Aezet', 'LastChangedAt']);

function serialize(entity: string, value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, property] of Object.entries(entities[entity])) {
    if (serverFields.has(key) || value[key] === undefined) continue;
    let field = value[key];
    if (property.type === 'Edm.Date' && field === '') field = null;
    if (field === null) {
      if (!property.nullable) throw new Error(`${key} cannot be empty.`);
    } else if (property.type === 'Edm.String') {
      if (typeof field !== 'string') throw new Error(`${key} must be text.`);
      if (property.maxLength && field.length > Number(property.maxLength)) throw new Error(`${key} must be at most ${property.maxLength} characters.`);
    } else if (property.type === 'Edm.Decimal') {
      const numeric = Number(field);
      if (!Number.isFinite(numeric) || numeric < 0 || (Number(property.scale || 0) === 0 && !Number.isInteger(numeric))) throw new Error(`${key} must be a valid nonnegative number.`);
      if (property.precision && numeric >= 10 ** (Number(property.precision) - Number(property.scale || 0))) throw new Error(`${key} exceeds the SAP numeric limit.`);
      field = numeric;
    } else if (property.type === 'Edm.Date') {
      if (typeof field !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(field) || !Number.isFinite(Date.parse(field)) || new Date(field).toISOString().slice(0, 10) !== field) throw new Error(`${key} must be a valid date.`);
    } else if (property.type === 'Edm.TimeOfDay') {
      if (typeof field !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(field)) throw new Error(`${key} must be a valid time.`);
      if (field.length === 5) field += ':00';
    }
    result[key] = field;
  }
  return result;
}

export function preparePermitCreate(payload: PermitDeepInsertPayload): Record<string, unknown> {
  const required = ['ExecDept', 'PermitType', 'Werks', 'JobDesc', 'SupvName', 'ValidFromD', 'ValidFromT', 'ValidToD', 'ValidToT'] as const;
  for (const key of required) if (!payload[key]?.trim()) throw new Error(`Complete ${key} before creating the permit.`);
  if (!payload.Aufnr && !payload.Qmnum) throw new Error('Select a real SAP order or notification.');
  const start = new Date(`${payload.ValidFromD}T${payload.ValidFromT}+05:30`);
  const end = new Date(`${payload.ValidToD}T${payload.ValidToT}+05:30`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new Error('Permit end date/time must be after its start.');
  if (end.getTime() <= Date.now()) throw new Error('The permit validity period has already ended.');
  if (!payload._Worker?.length || payload.PersonsQty !== payload._Worker.length) throw new Error('Add the actual crew and make the crew quantity match the worker list.');
  if (!payload._HazardControl?.length) throw new Error('Add the work hazards and required controls.');
  const status = initialPermitStatus(payload.IsolationRequired, payload.GasTestRequired || '');
  if (payload.GasTestRequired === 'Y' && !['1', '2'].includes(payload.GasTestFreqHr)) throw new Error('Plan gas retesting at intervals of no more than two hours.');
  validateSitePermit(payload);
  payload = { ...payload, ExecDept: payload.ExecDept.trim(), GasTestFreqHr: payload.GasTestRequired === 'Y' ? payload.GasTestFreqHr : '',
    IsolationStatus: payload.IsolationRequired === 'Y' ? 'INTD' : '',
    _Isolation: payload.IsolationRequired === 'Y' ? payload._Isolation : [],
    _Safety: [...(payload._Safety || []).filter(row => !(row.Category === 'PTW' && row.ItemCode === 'GREQ')), gasRequirementRow(payload.GasTestRequired || '')] };
  const body = serialize('PermitInfoType', payload as unknown as Record<string, unknown>);
  body.Status = status;
  for (const [navigation, entity] of Object.entries(children)) {
    const rows = (payload as unknown as Record<string, unknown>)[navigation];
    if (!Array.isArray(rows) || !rows.length) continue;
    const keys = new Set<string>();
    body[navigation] = rows.map((row, index) => {
      if (!row || typeof row !== 'object') throw new Error(`${navigation} contains an invalid row.`);
      const source = { ...row, ItemNo: String(index + 1) };
      if (navigation === '_Worker' && (!source.WorkerName?.trim() || (source.WorkerTypeCode === 'EMP' && !source.EmpId?.trim()) || (source.WorkerTypeCode === 'CONT' && !source.ContractorName?.trim()))) throw new Error('Each worker needs a name and employee ID or contractor company.');
      if (navigation === '_HazardControl' && (!source.HazardDesc?.trim() || !source.ControlDesc?.trim())) throw new Error('Each hazard needs a description and control.');
      if (navigation === '_PPE' && (!source.PpeCode?.trim() || !source.PpeDesc?.trim())) throw new Error('Each PPE item needs its real code and description.');
      if (navigation === '_Safety' && (!source.ItemCode?.trim() || !source.ValueText?.trim())) throw new Error('Each safety check needs a code and description.');
      const key = String(source.ItemNo);
      if (keys.has(key)) throw new Error(`Duplicate ${navigation} item.`);
      keys.add(key);
      return serialize(entity, source);
    });
  }
  // No browser-generated number, attachments, approvals, audit entries, renewals or gas signatures.
  return body;
}
