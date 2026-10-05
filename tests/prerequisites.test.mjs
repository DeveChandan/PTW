import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({ stdin: { contents: `export * from './src/core/ptw/prerequisites'; export * from './src/core/api/modules/prerequisite.api'; export * from './src/core/api/modules/permitCreate.validation'; export * from './src/core/api/modules/permitCreate.api'; export { odataClient } from './src/core/api/odataClient';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs', define: { 'import.meta.env': '{}' } });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { initialPermitStatus, prerequisiteStatus, gasRequirementRow, readGasRequirement, prerequisiteApi, validatePrerequisiteRequest, PrerequisiteUnconfirmedError, preparePermitCreate, permitCreateApi, PermitCreateUnconfirmedError, odataClient } = compiled.exports;
const permit = () => ({ Permit_No: '0000000001', Status: 'INTD', IsolationRequired: 'Y', '@odata.etag': 'W/"1"', _Safety: [gasRequirementRow('Y')], _Isolation: [], _GasTest: [], _Approval: [] });
const request = () => ({ RequestId: '12345678-1234-1234-1234-123456789012', Kind: 'ISOLATION', Decision: 'SAVE', Comments: 'Recorded by module user', IsolationPoints: [{ IsolationPoint: 'Valve V1', IsolType: 'MECH', IsolMethod: 'Lock', LockTagNo: 'L1', IsIsolated: true, ZeroEnergyConf: true }] });
const create = () => ({ ExecDept: 'Maintenance', IsolationRequired: 'N', GasTestRequired: 'N', PermitType: 'COLD', Werks: '1000', Aufnr: '1', JobDesc: 'Inspect', SupvName: 'Supervisor', ValidFromD: '2099-01-01', ValidFromT: '08:00', ValidToD: '2099-01-01', ValidToT: '16:00', PersonsQty: 1, _Worker: [{ WorkerName: 'Worker', WorkerTypeCode: 'EMP', EmpId: '1' }], _HazardControl: [{ HazardDesc: 'Energy', ControlDesc: 'Control' }] });

test('creation status and approval matrix require ALL required checks, not either check', () => {
  for (const isolation of ['Y', 'N']) for (const gas of ['Y', 'N']) {
    assert.equal(initialPermitStatus(isolation, gas), isolation === 'N' && gas === 'N' ? 'CRTD' : 'INTD');
    for (const iApproved of [false, true]) for (const gApproved of [false, true]) {
      assert.equal(prerequisiteStatus(isolation, gas, iApproved, gApproved), (isolation === 'N' || iApproved) && (gas === 'N' || gApproved) ? 'CRTD' : 'INTD');
    }
    const body = preparePermitCreate({ ...create(), IsolationRequired: isolation, GasTestRequired: gas, GasTestFreqHr: '2' });
    assert.equal(body.Status, initialPermitStatus(isolation, gas));
    assert.equal(body.IsolationRequired, isolation === 'Y' ? 'X' : ' ');
    assert.equal(readGasRequirement(body), gas);
    assert.equal(body.GasTestRequired, undefined);
  }
  // Verify direct ABAP flags 'X' and ' '
  const bodyX = preparePermitCreate({ ...create(), IsolationRequired: 'X', GasTestRequired: 'N' });
  assert.equal(bodyX.IsolationRequired, 'X');
  assert.equal(bodyX.Status, 'INTD');
  const bodyBlank = preparePermitCreate({ ...create(), IsolationRequired: ' ', GasTestRequired: 'N' });
  assert.equal(bodyBlank.IsolationRequired, ' ');
  assert.equal(bodyBlank.Status, 'CRTD');
});
test('required choices and department cannot default silently; unknown stored gas flag stays unknown', () => {
  for (const change of [{ ExecDept: ' ' }, { IsolationRequired: '' }, { GasTestRequired: undefined }, { GasTestRequired: 'YES' }]) assert.throws(() => preparePermitCreate({ ...create(), ...change }));
  assert.equal(readGasRequirement({}), '');
  assert.equal(readGasRequirement({ _Safety: [gasRequirementRow('Y'), gasRequirementRow('N')] }), '');
  const body = preparePermitCreate({ ...create(), _Safety: [gasRequirementRow('Y'), gasRequirementRow('Y')], _Isolation: [{ IsIsolated: 'Y' }] });
  assert.equal(body._Isolation, undefined);
  assert.equal(body._Safety.length, 1);
  assert.equal(readGasRequirement(body), 'N');
});
test('prerequisite updates reject wrong lifecycle, missing version, missing requirement or evidence', () => {
  for (const status of ['CRTD', 'ACTV', 'CLOS', 'SUSP']) assert.throws(() => validatePrerequisiteRequest({ ...permit(), Status: status }, request()), /INTD/);
  for (const version of ['', '*']) assert.throws(() => validatePrerequisiteRequest({ ...permit(), '@odata.etag': version }, request()), /ETag/);
  assert.throws(() => validatePrerequisiteRequest({ ...permit(), IsolationRequired: 'N' }, request()), /required/);
  assert.throws(() => validatePrerequisiteRequest(permit(), { ...request(), IsolationPoints: [] }), /point/);
  assert.throws(() => validatePrerequisiteRequest(permit(), { ...request(), Decision: 'APPROVE' }), /separately/);
  assert.throws(() => validatePrerequisiteRequest(permit(), { ...request(), Comments: '' }), /comment/);
});
test('gas evidence cannot omit readings, instrument, policy or use future timestamps', () => {
  const gas = { RequestId: request().RequestId, Kind: 'GAS', Decision: 'SAVE', Comments: 'Tested', GasTest: { TestAt: '2026-01-01T10:00:00+05:30', TestLocation: 'Tank top', MeterId: 'M1', PolicyRef: 'HSE-1', BumpTestOk: true, O2Pct: '20.9', LelPct: '0', CoPpm: '0', H2sPpm: '0' } };
  assert.doesNotThrow(() => validatePrerequisiteRequest(permit(), gas));
  for (const change of [{ TestAt: '2099-01-01' }, { MeterId: '' }, { PolicyRef: '' }, { O2Pct: '' }, { O2Pct: '101' }, { LelPct: '-1' }, { CoPpm: 'NaN' }]) assert.throws(() => validatePrerequisiteRequest(permit(), { ...gas, GasTest: { ...gas.GasTest, ...change } }));
});
test('action is opt-in, sends ETag and no forged identity/status; unknown results never retry', async () => {
  const original = odataClient.post;
  let calls = 0;
  try {
    odataClient.post = async (url, body, config) => {
      calls++;
      assert.equal(url, "PermitInfo('0000000001')/test.workflow.UpdatePrerequisite");
      assert.equal(config.headers['If-Match'], 'W/"1"');
      assert.equal(body.Status, undefined); assert.equal(body.ApprovedBy, undefined);
      return { data: { ...permit(), '@odata.etag': 'W/"2"' } };
    };
    await assert.rejects(() => prerequisiteApi.update(permit(), request()), /not configured/);
    assert.equal(calls, 0);
    assert.equal((await prerequisiteApi.update(permit(), request(), 'test.workflow.UpdatePrerequisite')).Status, 'INTD');
    assert.equal(calls, 1);
    odataClient.post = async () => { calls++; throw new Error('timeout'); };
    await assert.rejects(() => prerequisiteApi.update(permit(), request(), 'test.workflow.UpdatePrerequisite'), PrerequisiteUnconfirmedError);
    assert.equal(calls, 2);
    odataClient.post = async () => ({ data: { ...permit(), Status: 'CRTD', '@odata.etag': 'W/"2"' } });
    await assert.rejects(() => prerequisiteApi.update(permit(), request(), 'test.workflow.UpdatePrerequisite'), PrerequisiteUnconfirmedError);
    odataClient.post = async () => ({ data: permit() });
    await assert.rejects(() => prerequisiteApi.update(permit(), request(), 'test.workflow.UpdatePrerequisite'), PrerequisiteUnconfirmedError);
    odataClient.post = async () => { throw Object.assign(new Error('stale version'), { response: { status: 412 } }); };
    await assert.rejects(() => prerequisiteApi.update(permit(), request(), 'test.workflow.UpdatePrerequisite'), /stale version/);
  } finally { odataClient.post = original; }
});
test('creation with pending prerequisite cannot treat backend CRTD as success', async () => {
  const original = odataClient.post;
  try {
    odataClient.post = async () => ({ data: { Permit_No: '0000000001', Status: 'CRTD' } });
    await assert.rejects(() => permitCreateApi.createPermitDeepInsert({ ...create(), IsolationRequired: 'Y' }), PermitCreateUnconfirmedError);
  } finally { odataClient.post = original; }
});
