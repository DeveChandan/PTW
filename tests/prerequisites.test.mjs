import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({ stdin: { contents: `export * from './src/core/ptw/prerequisites'; export * from './src/core/api/modules/backendWorkflow.api'; export * from './src/core/api/modules/isolation.validation'; export * from './src/core/api/modules/permitCreate.validation'; export * from './src/core/api/modules/permitCreate.api'; export { odataClient } from './src/core/api/odataClient';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs', define: { 'import.meta.env': '{}' } });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { initialPermitStatus, prerequisiteStatus, gasRequirementRow, readGasRequirement, backendWorkflowApi, WorkflowUnconfirmedError, prepareIsolationCreate, preparePermitCreate, permitCreateApi, PermitCreateUnconfirmedError, odataClient } = compiled.exports;
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
  const body = preparePermitCreate({ ...create(), _Safety: [gasRequirementRow('Y'), gasRequirementRow('Y')], _Isolation: [] });
  assert.equal(body._Isolation, undefined);
  assert.equal(body._Safety.length, 1);
  assert.equal(readGasRequirement(body), 'N');
});
test('create omits computed quantity, rejects contradictory LOTO and defers isolation points', () => {
  assert.equal(preparePermitCreate(create()).PersonsQty, undefined);
  assert.throws(() => preparePermitCreate({...create(),LotoRequired:'Y'}), /LOTO requires isolation/);
  assert.equal(preparePermitCreate({...create(),LotoRequired:'Y',IsolationRequired:'Y'}).Status,'INTD');
  assert.equal(preparePermitCreate({...create(),LotoRequired:'Y',IsolationRequired:'X'}).Status,'INTD');
  assert.throws(() => preparePermitCreate({...create(),LotoRequired:'Y',IsolationRequired:' '}), /LOTO requires isolation/);
  assert.throws(() => preparePermitCreate({...create(),IsolationRequired:'Y',_Isolation:[{IsolationPoint:'P1'}]}), /isolation module/);
});
test('certificate creation serializes nested items and omits computed keys and signatures', () => {
  const body=prepareIsolationCreate({PermitNo:'P1',Status:'APPR',RequestedBy:'FORGED',IsolationNo:'FORGED',_Item:[{ItemNo:'99',IsolationNo:'FORGED',ReferenceType:'EQUI',ReferenceId:'E1',IsolationPoint:'P1',IsolType:'MECH',IsolMethod:'VALVE',IsolatedState:'CLOSED',LockTagNo:'L1',IsIsolated:'Y',ZeroEnergyBy:'FORGED',ZeroEnergyConf:'Y'}]});
  assert.equal(body.Status,undefined);assert.equal(body.IsolationNo,undefined);assert.equal(body.RequestedBy,undefined);
  assert.equal(body._Item[0].ItemNo,undefined);assert.equal(body._Item[0].IsolationNo,undefined);
  assert.equal(body._Item[0].IsIsolated,'N');assert.equal(body._Item[0].ZeroEnergyConf,'N');assert.equal(body._Item[0].ZeroEnergyBy,'');
  assert.throws(()=>prepareIsolationCreate({PermitNo:'P1',_Item:[]}),/point/);
});
test('declared bound actions send empty bodies, correct binding and ETag; uncertain writes never retry', async () => {
  const original=odataClient.post;let calls=0;
  try {
    odataClient.post=async(url,body,config)=>{calls++;assert.deepEqual(body,{});assert.equal(config.headers['If-Match'],'W/"1"');return {data:url.startsWith('Isolation')?{IsolationNo:'I1',Status:'ISOL'}:{Permit_No:'0000000001',Status:'INTD'}};};
    for(const action of ['completeIsolation','approveIsolation','normalizeIsolation']) {
      odataClient.post=async(url,body,config)=>{calls++;assert.equal(url,"Isolation('I1')/com.sap.gateway.srvd_a2x.zptw_services.v0001."+action);assert.deepEqual(body,{});assert.equal(config.headers['If-Match'],'W/"1"');return {data:{IsolationNo:'I1',Status:'ISOL'}};};
      await backendWorkflowApi.isolation({IsolationNo:'I1','@odata.etag':'W/"1"'},action);
    }
    odataClient.post=async(url,body)=>{calls++;assert.equal(url,"PermitInfo('0000000001')/com.sap.gateway.srvd_a2x.zptw_services.v0001.finalizeGasTest");assert.deepEqual(body,{});return {data:{Permit_No:'0000000001',Status:'INTD'}};};
    await backendWorkflowApi.finalizeGas(permit());assert.equal(calls,4);
    for(const version of ['', '*'])await assert.rejects(()=>backendWorkflowApi.finalizeGas({...permit(),'@odata.etag':version}),/ETag/);
    assert.equal(calls,4);
    odataClient.post=async()=>{calls++;throw new Error('timeout');};
    await assert.rejects(()=>backendWorkflowApi.finalizeGas(permit()),WorkflowUnconfirmedError);assert.equal(calls,5);
    odataClient.post=async()=>({data:{Permit_No:'OTHER',Status:'INTD'}});
    await assert.rejects(()=>backendWorkflowApi.finalizeGas(permit()),WorkflowUnconfirmedError);
    odataClient.post=async()=>{throw Object.assign(new Error('stale'),{response:{status:412}});};
    await assert.rejects(()=>backendWorkflowApi.finalizeGas(permit()),/record changed/);
  }finally{odataClient.post=original;}
});

test('creation with pending prerequisite cannot treat backend CRTD as success', async () => {
  const original = odataClient.post;
  try {
    odataClient.post = async () => ({ data: { Permit_No: '0000000001', Status: 'CRTD' } });
    await assert.rejects(() => permitCreateApi.createPermitDeepInsert({ ...create(), IsolationRequired: 'Y' }), PermitCreateUnconfirmedError);
  } finally { odataClient.post = original; }
});
