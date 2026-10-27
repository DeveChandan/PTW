import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const result = await build({
  entryPoints: ['src/core/auth/sapClient.ts'], bundle: true, write: false,
  platform: 'node', format: 'cjs',
  define: { 'import.meta.env': '{"VITE_SAP_CLIENT":"200"}' },
});

test('API requests omit client in automatic mode and clear a previous explicit client', async () => {
  const output = await build({
    entryPoints: ['src/core/api/odataClient.ts'], bundle: true, write: false,
    platform: 'node', format: 'cjs', packages: 'external',
    define: { 'import.meta.env': '{"VITE_SAP_CLIENT":"200"}' },
  });
  globalThis.window = { location: { search: '' } };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output.outputFiles[0].text)(
    createRequire(import.meta.url), module, module.exports,
  );
  const { odataClient } = module.exports;
  const requests = [];
  odataClient.instance.defaults.adapter = async config => {
    requests.push(config);
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  await odataClient.get('Config');
  odataClient.setClient('510');
  await odataClient.get('Config');
  odataClient.setClient('');
  await odataClient.get('Config');
  assert.equal(requests[0].headers.get('sap-client'), undefined);
  assert.equal(requests[0].params['sap-client'], undefined);
  assert.equal(requests[1].headers.get('sap-client'), '510');
  assert.equal(requests[1].params['sap-client'], '510');
  assert.equal(requests[2].headers.get('sap-client'), undefined);
  assert.equal(requests[2].params['sap-client'], undefined);
  assert.throws(() => odataClient.setClient('12'));
  delete globalThis.window;
});
const compiled = { exports: {} };
new Function('module', 'exports', result.outputFiles[0].text)(compiled, compiled.exports);
const { getDefaultSapClient, getRuntimeSapClient } = compiled.exports;

test('the same DEV build selects the QAS launch client without a user parameter', () => {
  globalThis.window = { location: { search: '?sap-client=300' } };
  assert.equal(getDefaultSapClient(), '300');
  assert.equal(getRuntimeSapClient(), '300');
});

test('launch client overrides injected client and preserves leading zeros', () => {
  globalThis.window = { location: { search: '?sap-client=010' }, SAP_CURRENT_CLIENT: '200' };
  assert.equal(getDefaultSapClient(), '010');
});

test('invalid or absent launch client uses injected client or automatic SAP selection', () => {
  globalThis.window = { location: { search: '?sap-client=wrong' }, SAP_CURRENT_CLIENT: '300' };
  assert.equal(getDefaultSapClient(), '300');
  globalThis.window = { location: { search: '' } };
  assert.equal(getRuntimeSapClient(), undefined);
  assert.equal(getDefaultSapClient(), '');
  delete globalThis.window;
});
