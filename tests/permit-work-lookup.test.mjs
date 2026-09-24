import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

// Bundle the TypeScript API with the project's existing tooling; no test dependency required.
const bundled = await build({
  stdin: {
    contents: `export * from './src/core/api/modules/permitWorkLookup.api'; export { odataClient } from './src/core/api/odataClient';`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  define: { 'import.meta.env': '{}' },
});
const compiled = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { buildWorkFilter, validateWorkSearch, referenceId, permitWorkLookupApi, odataClient } = compiled.exports;
const base = { source: 'order', fromDate: '2026-09-01', toDate: '2026-09-24', orderType: '' };

test('rejects missing, invalid and reversed dates; permits an inclusive single day', () => {
  for (const change of [{ fromDate: '' }, { fromDate: '2026-02-30' }, { fromDate: '2026-09-25' }, { toDate: 'bad' }]) {
    assert.ok(validateWorkSearch({ ...base, ...change }));
  }
  assert.equal(validateWorkSearch({ ...base, fromDate: base.toDate }), null);
});

test('order lookup uses the full allowlist and inclusive date bounds', () => {
  const filter = buildWorkFilter(base, 'WorkDate');
  assert.match(filter, /WorkDate ge 2026-09-01 and WorkDate le 2026-09-24/);
  for (const type of ['PM01', 'PM03', 'PM05', 'PM06', 'PM07', 'PM08']) assert.ok(filter.includes(`Auart eq '${type}'`));
  assert.ok(!filter.includes('PM02'));
  assert.ok(filter.includes('IsShutdown eq false'));
});

test('selected order type narrows results and rejects arbitrary filter input', () => {
  assert.match(buildWorkFilter({ ...base, orderType: 'PM05' }, 'WorkDate'), /\(Auart eq 'PM05'\)/);
  assert.throws(() => buildWorkFilter({ ...base, orderType: "PM01' or true" }, 'WorkDate'));
  assert.throws(() => buildWorkFilter(base, 'WorkDate or true'));
});

test('notification and shutdown sources send distinct backend conditions', () => {
  const notifications = buildWorkFilter({ ...base, source: 'notification' }, 'WorkDate');
  assert.ok(notifications.includes("Qmart eq 'M2'"));
  assert.ok(notifications.includes("Auart eq 'PM02'"));
  assert.ok(notifications.includes("Qmnum ne ''"));
  const shutdown = buildWorkFilter({ ...base, source: 'shutdown' }, 'WorkDate', 'IsShutdown eq true');
  assert.ok(shutdown.includes('(IsShutdown eq true)'));
  assert.ok(!shutdown.includes('Auart'));
  assert.throws(() => buildWorkFilter({ ...base, source: 'shutdown' }, 'WorkDate'));
});

test('PMIntegration request carries filters, selected client and cancellation signal', async () => {
  const original = odataClient.get;
  const controller = new AbortController();
  const fixture = { PermitNo: 'PTW000001', Status: 'DUMM', Qmnum: '10000123', Aufnr: '40001234', Auart: 'PM01', Tplnr: 'PLANT-AREA-001', Equnr: '10001234', Werks: '1000', Arbpl: 'MECH-001' };
  odataClient.get = async (entity, config) => {
    assert.equal(entity, 'PMIntegration');
    assert.equal(config.params['sap-client'], '300');
    assert.equal(config.signal, controller.signal);
    assert.equal(config.params.$filter, buildWorkFilter(base, 'WorkDate'));
    return { data: { value: [fixture] } };
  };
  try { assert.deepEqual(await permitWorkLookupApi.search(base, controller.signal, '300'), [fixture]); }
  finally { odataClient.get = original; }
});

test('backend errors, malformed results and incomplete pages never become sample success', async () => {
  const original = odataClient.get;
  try {
    odataClient.get = async () => { throw new Error('SAP unavailable'); };
    await assert.rejects(permitWorkLookupApi.search(base), /SAP unavailable/);
    for (const data of [{}, { value: [{}] }, { value: [null] }, { value: [{ Aufnr: 123 }] }]) {
      odataClient.get = async () => ({ data });
      await assert.rejects(permitWorkLookupApi.search(base), /unexpected/);
    }
    odataClient.get = async () => ({ data: { value: [], '@odata.nextLink': 'next' } });
    await assert.rejects(permitWorkLookupApi.search(base), /Narrow the date range/);
    odataClient.get = async () => ({ data: { value: [] } });
    assert.deepEqual(await permitWorkLookupApi.search(base), []);
  } finally { odataClient.get = original; }
});

test('reference IDs follow the source and support the supplied shutdown response shape', () => {
  const row = { PermitNo: 'P1', Qmnum: 'N1', Aufnr: 'O1' };
  assert.equal(referenceId('notification', row), 'N1');
  assert.equal(referenceId('order', row), 'O1');
  assert.equal(referenceId('shutdown', row), 'O1');
  assert.equal(referenceId('shutdown', { PermitNo: 'P1' }), 'P1');
});
