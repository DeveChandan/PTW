import type { PermitDeepInsertPayload, SafetyRecord } from '../types/ptw.types';

export type Requirement = 'Y' | 'N' | 'X' | ' ' | '';
export function initialPermitStatus(isolation: string, gas: string): 'INTD' | 'CRTD' {
  if (!['Y', 'N', 'X', ' '].includes(isolation) || !['Y', 'N'].includes(gas)) throw new Error('Select Yes or No for isolation and gas testing.');
  const isIsoYes = isolation === 'Y' || isolation === 'X';
  return isIsoYes || gas === 'Y' ? 'INTD' : 'CRTD';
}

// The SAP header has no GasTestRequired property. Persist the choice in Safety.
export function gasRequirementRow(required: string): SafetyRecord {
  if (!['Y', 'N'].includes(required)) throw new Error('Select Yes or No for gas testing.');
  return { PermitNo: '', ItemNo: '', Category: 'PTW', ItemCode: 'GREQ', Response: required === 'Y' ? 'YES' : 'NO',
    ValueText: 'Gas testing required', ValueNum: 0, Unit: '', ReferenceNo: '', ResponsibleUser: '', VerifiedBy: '', VerifiedAt: null, Remarks: '' };
}
export function readGasRequirement(permit: Pick<PermitDeepInsertPayload, '_Safety'>): Requirement {
  const rows = permit._Safety?.filter(row => row.Category === 'PTW' && row.ItemCode === 'GREQ') || [];
  if (rows.length !== 1) return '';
  return rows[0].Response === 'YES' ? 'Y' : rows[0].Response === 'NO' ? 'N' : '';
}

/** Backend contract reference; signatures/evidence must be validated by SAP first. */
export function prerequisiteStatus(isolation: string, gas: string, isolationApproved: boolean, gasApproved: boolean): 'INTD' | 'CRTD' {
  initialPermitStatus(isolation, gas);
  const isIsoYes = isolation === 'Y' || isolation === 'X';
  return (isIsoYes && !isolationApproved) || (gas === 'Y' && !gasApproved) ? 'INTD' : 'CRTD';
}
