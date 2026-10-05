import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
  stdin: {
    contents: `
      export * from './src/core/types/isolation.types';
      export * from './src/core/api/modules/isolation.api';
      export * from './src/core/api/modules/config.api';
      export { odataClient } from './src/core/api/odataClient';
    `,
    resolveDir: process.cwd(),
    loader: 'ts'
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  define: { 'import.meta.env': '{}' }
});

const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(
  createRequire(import.meta.url),
  compiled,
  compiled.exports
);

const { isolationApi, configApi, odataClient, FALLBACK_ISOLATION_DATA } = compiled.exports;

test('FALLBACK_ISOLATION_DATA contains valid SAP S/4HANA isolation certificates', () => {
  assert.equal(FALLBACK_ISOLATION_DATA.length >= 2, true);
  const iso12 = FALLBACK_ISOLATION_DATA.find(i => i.IsolationNo === 'ISO0000012');
  assert.ok(iso12, 'ISO0000012 must exist');
  assert.equal(iso12.Status, 'CRTD');
  assert.equal(iso12._Item.length, 1);
  assert.equal(iso12._Item[0].IsolationPoint, 'P-101 INLET');
  assert.equal(iso12._Item[0].IsolType, 'MECH');
  assert.equal(iso12._Item[0].IsolMethod, 'VALVE');
  assert.equal(iso12._Item[0].LockTagNo, 'LT-0001');

  const iso13 = FALLBACK_ISOLATION_DATA.find(i => i.IsolationNo === 'ISO0000013');
  assert.ok(iso13, 'ISO0000013 must exist');
  assert.equal(iso13.PermitNo, 'PTW0000002');
  assert.equal(iso13._Item[0].IsolationPoint, 'P-909 INLET');
  assert.equal(iso13._Item[0].LockTagNo, 'LT-0009');
});

test('isolationApi.list returns all isolation certificates with child _Item collections', async () => {
  const list = await isolationApi.list();
  assert.equal(Array.isArray(list), true);
  assert.equal(list.length >= 2, true);
  for (const cert of list) {
    assert.ok(cert.IsolationNo.startsWith('ISO'));
    assert.ok(Array.isArray(cert._Item));
  }
});

test('isolationApi.read retrieves single certificate by IsolationNo', async () => {
  const item = await isolationApi.read('ISO0000012');
  assert.ok(item);
  assert.equal(item.IsolationNo, 'ISO0000012');
  assert.equal(item._Item[0].IsolationPoint, 'P-101 INLET');

  const nonexistent = await isolationApi.read('ISO9999999');
  assert.equal(nonexistent, null);
});

test('isolationApi.create successfully posts to SAP endpoint and returns newly registered certificate', async () => {
  const originalPost = odataClient.post;
  let postCount = 0;
  odataClient.post = async (url, payload, config) => {
    postCount++;
    assert.equal(url, 'Isolation');
    assert.equal(config.headers.Prefer, 'return=representation');
    return {
      data: {
        ...payload,
        IsolationNo: 'ISO0000014',
        Status: 'CRTD',
        _Item: (payload._Item || []).map((it, idx) => ({
          ...it,
          IsolationNo: 'ISO0000014',
          ItemNo: String(idx)
        }))
      }
    };
  };

  try {
    const newCert = await isolationApi.create({
      PermitNo: 'PTW0000099',
      Remarks: 'Motor test lock',
      RequestedBy: 'TEST-USER',
      _Item: [
        {
          ReferenceType: 'EQUI',
          ReferenceId: '20000001',
          IsolationPoint: 'MCC-01 BREAKER 4B',
          IsolType: 'ELEC',
          IsolMethod: 'BREAKER',
          IsolatedState: 'RACKED_OUT',
          LockTagNo: 'LT-ELEC-99',
          Remarks: 'Racked out and tagged'
        }
      ]
    });

    assert.ok(newCert);
    assert.equal(newCert.IsolationNo, 'ISO0000014');
    assert.equal(newCert.PermitNo, 'PTW0000099');
    assert.equal(newCert.Status, 'CRTD');
    assert.equal(newCert._Item.length, 1);
    assert.equal(newCert._Item[0].IsolationPoint, 'MCC-01 BREAKER 4B');
    assert.equal(postCount, 1);

    const readBack = await isolationApi.read('ISO0000014');
    assert.ok(readBack);
    assert.equal(readBack.IsolationNo, 'ISO0000014');
  } finally {
    odataClient.post = originalPost;
  }
});

test('failed or rejected isolation create throws and never creates fake random certificates', async () => {
  const originalPost = odataClient.post;
  odataClient.post = async () => {
    throw Object.assign(new Error('SAP validation rejected request'), { response: { status: 400 } });
  };
  try {
    await assert.rejects(isolationApi.create({ PermitNo: 'INVALID' }), /SAP validation/);
  } finally {
    odataClient.post = originalPost;
  }
});

test('configApi provides valid isolation dropdown options for ISOLATION_TYPE, ISOLATED_STATE, ISOL_METHOD, and DEISOLATED_STATE', async () => {
  const isoTypes = await configApi.fetchIsolationTypeConfig();
  assert.equal(isoTypes.length, 3);
  assert.ok(isoTypes.some(t => t.Config_Code === 'ELEC' && t.Config_Desc === 'ELECTRICAL'));
  assert.ok(isoTypes.some(t => t.Config_Code === 'MECH' && t.Config_Desc === 'PROCESS/MECHANICAL'));
  assert.ok(isoTypes.some(t => t.Config_Code === 'INHOVR' && t.Config_Desc === 'INHIBITS AND OVERRIDES'));

  const isoStates = await configApi.fetchIsolatedStateConfig();
  assert.equal(isoStates.length, 19);
  assert.ok(isoStates.some(s => s.Config_Code === 'CLOSED'));
  assert.ok(isoStates.some(s => s.Config_Code === 'RACKED_OUT'));
  assert.ok(isoStates.some(s => s.Config_Code === 'LOCKED'));

  const isolMethods = await configApi.fetchIsolMethodConfig();
  assert.equal(isolMethods.length, 48);
  assert.ok(isolMethods.some(m => m.Config_Code === 'VALVE_CC'));
  assert.ok(isolMethods.some(m => m.Config_Code === 'CB_RIRO'));
  assert.ok(isolMethods.some(m => m.Config_Code === 'FUSE'));

  const deisoStates = await configApi.fetchDeisolatedStateConfig();
  assert.equal(deisoStates.length, 16);
  assert.ok(deisoStates.some(d => d.Config_Code === 'NORMAL'));
  assert.ok(deisoStates.some(d => d.Config_Code === 'RESTORED'));
  assert.ok(deisoStates.some(d => d.Config_Code === 'OPEN'));
});

test('isolationApi.update successfully updates or links PermitNo on an isolation certificate', async () => {
  const originalPatch = odataClient.patch;
  let patchCalls = [];
  odataClient.patch = async (url, payload, etag, config) => {
    patchCalls.push({ url, payload, etag, config });
    return {
      data: {
        IsolationNo: 'ISO0000012',
        PermitNo: payload.PermitNo,
        Remarks: payload.Remarks || 'Updated motor isolation',
        Status: 'CRTD'
      }
    };
  };

  try {
    const updated = await isolationApi.update('ISO0000012', {
      PermitNo: 'PTW0000015',
      Remarks: 'Updated motor isolation'
    });
    assert.equal(patchCalls.length, 1);
    assert.equal(patchCalls[0].url, "Isolation('ISO0000012')");
    assert.equal(patchCalls[0].payload.PermitNo, 'PTW0000015');
    assert.equal(updated.PermitNo, 'PTW0000015');
  } finally {
    odataClient.patch = originalPatch;
  }
});
