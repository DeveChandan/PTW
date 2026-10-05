import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
  stdin: { contents: `export * from './src/core/ptw/siteProcedure'; export * from './src/core/api/modules/permitCreate.validation'; export * from './src/core/api/modules/sitePermit.api'; export * from './src/core/api/modules/gasTester.api'; export { odataClient } from './src/core/api/odataClient';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', define: { 'import.meta.env': '{}' },
});
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { emptySitePlan, sitePlanRows, preparePermitCreate, preparationsFor, PERMIT_CATEGORIES, approvalGuidance, sitePermitApi, gasTesterApi, odataClient } = compiled.exports;
const completePlan = () => ({ ...emptySitePlan(), nature: ['Welding / gas cutting'], tools: ['Welding machine'], fields: { JSA1: 'JSA-001', JSA2: 'Issuer, acceptor and contractor visited site', SHFT: '2099-01-01T16:00', ISSR: 'ISSUER', ACCP: 'ACCEPTOR', OPER: 'OPERATOR', OTHR: 'Special work scope' } });
function payload(primary = 'HOT', plan = completePlan()) {
  return { PermitType: primary, Werks: '1000', JobDesc: 'Maintain equipment', SupvName: 'Supervisor', Aufnr: '000000000123', Qmnum: '', AreaLoc: 'Area A', ExecDept: 'Maintenance',
    ValidFromD: '2099-01-01', ValidFromT: '08:00', ValidToD: '2099-01-01', ValidToT: '16:00', GasTestRequired: 'Y', GasTestFreqHr: '2', PersonsQty: 1, IsolationRequired: 'Y',
    _Worker: [{ WorkerName: 'Worker', WorkerTypeCode: 'EMP', EmpId: 'W1' }], _HazardControl: [{ HazardDesc: 'Stored energy', ControlDesc: 'Isolate' }],
    _Isolation: [], _Safety: sitePlanRows(primary, plan) };
}

test('every procedure category and combined work fits the SAP creation schema without fabricated signatures', () => {
  for (const category of PERMIT_CATEGORIES) {
    const plan = completePlan(); plan.additionalTypes = ['HOT', 'CONF', 'EXCV', 'HGHT', 'LINE', 'RIGG', 'RAD', 'HYPN', 'ELEC', 'OTHER'];
    const body = preparePermitCreate(payload(category.code, plan));
    assert.equal(body.Status, 'INTD');
    assert.ok(body._Safety.some(row => row.ItemCode === 'DOCV'));
    assert.equal(body._Safety.find(row => row.ItemCode === 'JSA1').ReferenceNo, 'JSA-001');
    assert.ok(body._Safety.some(row => row.ItemCode === 'FC02'));
    assert.ok(body._Safety.every(row => row.VerifiedBy === '' && row.VerifiedAt === null));
    assert.equal(new Set(body._Safety.map(row => row.ItemNo)).size, body._Safety.length);
    for (const key of ['_Approval', '_GasTest', '_ShiftRenewal', '_AuditLog']) assert.ok(!(key in body));
  }
});

test('initial site validity checks eight-hour and actual shift boundaries, including midnight', () => {
  assert.doesNotThrow(() => preparePermitCreate(payload()));
  assert.throws(() => preparePermitCreate({ ...payload(), ValidToT: '16:01' }), /eight hours/);
  const early = completePlan(); early.fields.SHFT = '2099-01-01T15:45';
  assert.throws(() => preparePermitCreate(payload('HOT', early)), /shift end/);
  const overnight = completePlan(); overnight.fields.SHFT = '2099-01-02T06:00';
  assert.doesNotThrow(() => preparePermitCreate({ ...payload('HOT', overnight), ValidFromT: '22:00', ValidToD: '2099-01-02', ValidToT: '06:00' }));
  overnight.fields.SHFT = '2099-02-30T06:00';
  assert.throws(() => preparePermitCreate(payload('HOT', overnight)), /valid site times/);
});

test('combined activities cannot bypass gas interval or isolation planning checks', () => {
  const plan = completePlan(); plan.additionalTypes = ['CONF'];
  assert.throws(() => preparePermitCreate({ ...payload('COLD', plan), GasTestFreqHr: '8' }), /two hours/);
  assert.throws(() => preparePermitCreate({ ...payload('CONF'), IsolationRequired: 'N' }), /positive isolation/);
  assert.equal(preparePermitCreate({ ...payload(), _Isolation: [] }).Status, 'INTD');
});

test('issuer separation, JSA reference, mandatory scope and NA reasons are checked', () => {
  const plan = completePlan(); plan.fields.ACCP = 'issuer';
  assert.throws(() => preparePermitCreate(payload('HOT', plan)), /different people/);
  plan.fields.ACCP = 'OTHER'; plan.fields.JSA1 = '';
  assert.throws(() => preparePermitCreate(payload('HOT', plan)), /JSA document/);
  plan.fields.JSA1 = 'J1'; plan.checks.F004 = { response: 'NA', remarks: '' };
  assert.throws(() => preparePermitCreate(payload('HOT', plan)), /not applicable/);
  plan.checks.F004.remarks = 'No process equipment opened';
  assert.doesNotThrow(() => preparePermitCreate(payload('HOT', plan)));
  assert.throws(() => preparePermitCreate({ ...payload(), AreaLoc: '' }), /work area/);
});

test('changing category excludes obsolete conditional data but preserves shared preparation', () => {
  const plan = completePlan(); plan.fields.STBY = 'Standby A'; plan.checks.FC02 = { response: 'YES', remarks: 'Entry plan ready' };
  assert.ok(sitePlanRows('CONF', plan).some(row => row.ItemCode === 'STBY'));
  assert.ok(!sitePlanRows('COLD', plan).some(row => row.ItemCode === 'STBY' || row.ItemCode === 'FC02'));
  assert.ok(preparationsFor(['COLD']).some(row => row.code === 'F001'));
});

test('new general safety category fits SAP and retains reported evidence', () => {
  const p = payload(); p._Safety.push({ Category: 'GEN', ItemCode: 'S001', ValueText: 'Additional preparation', Response: 'NO', Remarks: 'Pending' });
  assert.equal(preparePermitCreate(p)._Safety.find(row => row.ItemCode === 'S001').Category, 'GEN');
});

test('approval planning respects time boundaries and exposes unresolved routes', () => {
  assert.match(approvalGuidance(['CONF'], '22:59')[0], /Approvers I and II/);
  assert.match(approvalGuidance(['CONF'], '23:00')[0], /Approver III/);
  assert.match(approvalGuidance(['HOT'], '08:59')[0], /Approver II/);
  assert.match(approvalGuidance(['HOT'], '09:00')[0], /Approvers I and II/);
  assert.match(approvalGuidance(['RAD'], '17:30')[0], /Approvers I and II/);
  assert.match(approvalGuidance(['LINE'], '12:00')[0], /conflict/);
  assert.match(approvalGuidance(['HOT'], 'bad')[0], /start time/);
});

test('gas evaluation never silently chooses disputed thresholds or accepts invalid readings', () => {
  const reading = { oxygenPct: 20.9, flammableLelPct: 0, h2sPpm: 0, coPpm: 0 };
  assert.equal(gasTesterApi.validateLimits(reading).safe, false);
  const limits = { minOxygen: 19.5, maxOxygen: 23.5, maxFlammableLel: 0, maxH2sPpm: 0, maxCoPpm: 0 };
  assert.equal(gasTesterApi.validateLimits(reading, limits).safe, true);
  for (const value of [NaN, Infinity, -1, undefined]) assert.equal(gasTesterApi.validateLimits({ ...reading, coPpm: value }, limits).safe, false);
  assert.equal(gasTesterApi.validateLimits({ ...reading, flammableLelPct: 1 }, limits).safe, false);
  assert.equal(gasTesterApi.validateLimits(reading, { ...limits, minOxygen: 30 }).safe, false);
  assert.equal(gasTesterApi.validateLimits({}, limits).safe, false);
});

test('calibration errors, absent flags, wrong device and expiry never produce calibrated=true', async () => {
  const original = odataClient.get;
  try {
    odataClient.get = async () => { throw new Error('Unavailable'); };
    assert.deepEqual(await gasTesterApi.getDeviceCalibration('M1'), { deviceId: 'M1', validUntil: '', isCalibrated: false });
    for (const data of [{}, { DeviceId: 'M1', IsCalibrated: true, ValidUntil: '2000-01-01' }, { DeviceId: 'M2', IsCalibrated: true, ValidUntil: '2099-01-01' }]) {
      odataClient.get = async () => ({ data }); assert.equal((await gasTesterApi.getDeviceCalibration('M1')).isCalibrated, false);
    }
    odataClient.get = async () => ({ data: { DeviceId: 'M1', IsCalibrated: true, ValidUntil: '2099-01-01' } });
    assert.equal((await gasTesterApi.getDeviceCalibration('M1')).isCalibrated, true);
  } finally { odataClient.get = original; }
});

test('SAP record read uses metadata field names and escapes OData literals', async () => {
  const original = odataClient.get; const calls = [];
  try {
    odataClient.get = async url => { calls.push(url); return { data: { value: [], Permit_No: 'P1' } }; };
    await sitePermitApi.list('1000', "O'Brien", 25);
    const url = new URL(calls[0], 'http://local/');
    assert.match(url.searchParams.get('$filter'), /Werks eq '1000'/);
    assert.match(url.searchParams.get('$filter'), /O''Brien/);
    assert.equal(url.searchParams.get('$skip'), '25');
    await sitePermitApi.read("P'1");
    assert.match(decodeURIComponent(calls[1]), /PermitInfo\('P''1'\)/);
    assert.ok(!new URL(calls[1], 'http://local/').searchParams.get('$expand').includes('_GasTest'));
    assert.ok(new URL(calls[1], 'http://local/').searchParams.get('$expand').includes('_Isolation($expand=_Item)'));
    assert.equal(calls[2], 'GasTest');
    assert.doesNotMatch(calls[1], /GasTests|Hazards|PpeItems/);
    odataClient.get = async () => ({ data: {} });
    await assert.rejects(sitePermitApi.list('', ''), /permit list/);
    await assert.rejects(sitePermitApi.read('P1'), /requested permit/);
  } finally { odataClient.get = original; }
});

test('legacy gas writes cannot silently persist a manufactured pass flag', async () => {
  await assert.rejects(gasTesterApi.recordTest({}), /SAP workflow action/);
});
