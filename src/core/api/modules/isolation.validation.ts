import type { SapIsolationHeader } from '../../types/isolation.types';
import schema from '../permitCreateSchema.json';

export function prepareIsolationCreate(payload: Partial<SapIsolationHeader>): Record<string, unknown> {
  if (typeof payload.PermitNo !== 'string' || payload.PermitNo.length > 10) throw new Error('Permit number must be at most 10 characters.');
  if (!payload._Item?.length) throw new Error('Add at least one isolation point.');
  const body: Record<string, unknown> = { PermitNo: payload.PermitNo.trim(), Remarks: payload.Remarks?.trim() || '' };
  if (String(body.Remarks).length > 255) throw new Error('Remarks must be at most 255 characters.');
  body._Item = payload._Item.map(point => {
    const row: Record<string, unknown> = {};
    for (const key of ['ReferenceType', 'ReferenceId', 'IsolationPoint', 'IsolType', 'IsolMethod', 'IsolatedState', 'DeIsolatedState', 'LockTagNo', 'Remarks'] as const) {
      const value = point[key] || '';
      const limit = Number(schema.ItemType[key].maxLength);
      if (typeof value !== 'string' || value.length > limit) throw new Error(`${key} must be text of up to ${limit} characters.`);
      row[key] = value.trim();
    }
    if (!row.IsolationPoint || !row.ReferenceType || !row.ReferenceId || !row.IsolType || !row.IsolMethod) throw new Error('Complete each point, reference, type and method.');
    // Creation proposes points. Certification and actors are assigned through SAP actions.
    return { ...row, IsIsolated: 'N', IsolatedBy: '', IsolatedAt: null, ZeroEnergyConf: 'N', ZeroEnergyBy: '', ZeroEnergyAt: null,
      IsNormalized: 'N', NormalizedBy: '', NormalizedAt: null };
  });
  return body;
}
