import odataClient from '../odataClient';
import { ODATA_ENTITIES } from '../odataEndpoints';
import type { PermitDeepInsertResponse } from '../../types/ptw.types';
import { readGasRequirement } from '../../ptw/prerequisites';

export type PrerequisiteKind = 'ISOLATION' | 'GAS';
export type PrerequisiteDecision = 'SAVE' | 'APPROVE' | 'REJECT';
export interface IsolationEvidence { IsolationPoint: string; IsolType: string; IsolMethod: string; LockTagNo: string; IsIsolated: boolean; ZeroEnergyConf: boolean }
export interface GasEvidence { TestAt: string; TestLocation: string; MeterId: string; PolicyRef: string; BumpTestOk: boolean; O2Pct: string; LelPct: string; CoPpm: string; H2sPpm: string }
export interface PrerequisiteRequest {
  RequestId: string; Kind: PrerequisiteKind; Decision: PrerequisiteDecision; Comments: string;
  IsolationPoints?: IsolationEvidence[]; GasTest?: GasEvidence;
}
export const prerequisiteAction = import.meta.env.VITE_PTW_PREREQUISITE_ACTION || '';
export class PrerequisiteUnconfirmedError extends Error {}

export function validatePrerequisiteRequest(permit: PermitDeepInsertResponse, request: PrerequisiteRequest): void {
  if (permit.Status !== 'INTD') throw new Error('Prerequisite updates are allowed only while the permit is INTD. Refresh the permit.');
  if (!['ISOLATION', 'GAS'].includes(request.Kind) || !['SAVE', 'APPROVE', 'REJECT'].includes(request.Decision)) throw new Error('Invalid prerequisite action.');
  if ((request.Kind === 'ISOLATION' ? permit.IsolationRequired : readGasRequirement(permit)) !== 'Y') throw new Error('This prerequisite is not recorded as required.');
  if (!permit['@odata.etag'] || permit['@odata.etag'] === '*') throw new Error('SAP must return a current permit ETag before an update.');
  if (!request.RequestId || request.RequestId.length > 36) throw new Error('A request ID is required.');
  if (!request.Comments.trim() || request.Comments.length > 255) throw new Error('Enter a comment of up to 255 characters.');
  if (request.Decision !== 'SAVE') {
    if (request.IsolationPoints || request.GasTest) throw new Error('Save evidence separately before reviewing it.');
    return;
  }
  if (request.Kind === 'ISOLATION') {
    if (request.GasTest || !request.IsolationPoints?.length) throw new Error('Add at least one isolation point.');
    for (const point of request.IsolationPoints) {
      for (const [key, limit] of [['IsolationPoint', 60], ['IsolType', 6], ['IsolMethod', 10], ['LockTagNo', 30]] as const) {
        if (!point[key].trim() || point[key].length > limit) throw new Error(`Complete ${key} (up to ${limit} characters).`);
      }
      if (typeof point.IsIsolated !== 'boolean' || typeof point.ZeroEnergyConf !== 'boolean') throw new Error('Isolation verification values must be boolean.');
    }
  } else {
    const gas = request.GasTest;
    if (request.IsolationPoints || !gas || ![gas.TestLocation, gas.MeterId, gas.PolicyRef].every(value => value.trim() && value.length <= 100)) throw new Error('Enter test location, meter and approved gas policy reference.');
    if (!Number.isFinite(Date.parse(gas.TestAt)) || Date.parse(gas.TestAt) > Date.now()) throw new Error('Enter an actual gas test time, not a future time.');
    for (const key of ['O2Pct', 'LelPct', 'CoPpm', 'H2sPpm'] as const) {
      if (!gas[key].trim() || !Number.isFinite(Number(gas[key])) || Number(gas[key]) < 0 || (['O2Pct', 'LelPct'].includes(key) && Number(gas[key]) > 100)) throw new Error('Enter all four valid gas readings; percentages must be between 0 and 100.');
    }
  }
}

export const prerequisiteApi = {
  async update(permit: PermitDeepInsertResponse, request: PrerequisiteRequest, action = prerequisiteAction): Promise<PermitDeepInsertResponse> {
    // No guessed endpoint: configure only after the backend team implements this contract.
    if (!/^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)+$/.test(action)) throw new Error('SAP prerequisite action is not configured. See the backend handoff contract.');
    validatePrerequisiteRequest(permit, request);
    const key = encodeURIComponent(permit.Permit_No.replace(/'/g, "''")).replace(/'/g, '%27');
    let response;
    try {
      response = await odataClient.post<PermitDeepInsertResponse>(`${ODATA_ENTITIES.PERMIT_INFO}('${key}')/${action}`, request, {
        headers: { 'If-Match': permit['@odata.etag'], Prefer: 'return=representation' },
      });
    } catch (reason: any) {
      if ((!reason.response && !reason.beforeSend) || reason.response?.status >= 500) throw new PrerequisiteUnconfirmedError(`Result unconfirmed. Check SAP audit for request ${request.RequestId} before retrying.`);
      throw reason;
    }
    const data = response.data;
    if (data && !data['@odata.etag']) data['@odata.etag'] = response.headers?.etag;
    if (!data || data.Permit_No !== permit.Permit_No || !['INTD', 'CRTD'].includes(data.Status) || !data['@odata.etag'] || data['@odata.etag'] === permit['@odata.etag'] || (request.Decision !== 'APPROVE' && data.Status !== 'INTD') || !Array.isArray(data._Safety) || !Array.isArray(data._Isolation) || !Array.isArray(data._GasTest) || !Array.isArray(data._Approval) || data.SAP__Messages?.some(message => (message.numericSeverity || 0) >= 4)) {
      throw new PrerequisiteUnconfirmedError(`SAP did not return a complete confirmed result. Check request ${request.RequestId} in SAP before retrying.`);
    }
    return data;
  },
};
