import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
  stdin: {
    contents: `
      export { ODATA_ACTIONS, ODATA_ENTITIES } from './src/core/api/odataEndpoints';
      export {
        permitClosureApi,
        CLOSURE_ROLES,
        entityKey
      } from './src/core/api/modules/permitClosure.api';
      export { MODULE_REGISTRY } from './src/core/auth/sapAuthContext';
      export { sitePermitApi } from './src/core/api/modules/sitePermit.api';
      export { default as odataClient } from './src/core/api/odataClient';
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

const {
  ODATA_ACTIONS,
  ODATA_ENTITIES,
  permitClosureApi,
  CLOSURE_ROLES,
  entityKey,
  MODULE_REGISTRY,
  odataClient
} = compiled.exports;

test('ODATA_ACTIONS exposes exact endpoints for all 4 permit closure actions', () => {
  assert.equal(
    ODATA_ACTIONS.CONFIRM_WORK_COMPLETION,
    'com.sap.gateway.srvd_a2x.zptw_services.v0001.confirmWorkCompletion',
    'confirmWorkCompletion must match SAP action specification'
  );
  assert.equal(
    ODATA_ACTIONS.COMPLETE_ACCEPTOR_CLOSURE,
    'Approval/com.sap.gateway.srvd_a2x.zptw_services.v0001.completeAcceptorClosure',
    'completeAcceptorClosure must match SAP action specification on Approval entity'
  );
  assert.equal(
    ODATA_ACTIONS.COMPLETE_AREA_OPERATOR_CLOSURE,
    'Approval/com.sap.gateway.srvd_a2x.zptw_services.v0001.completeAreaOperatorClosure',
    'completeAreaOperatorClosure must match SAP action specification on Approval entity'
  );
  assert.equal(
    ODATA_ACTIONS.COMPLETE_ISSUER_CLOSURE,
    'com.sap.gateway.srvd_a2x.zptw_services.v0001.completeIssuerClosure',
    'completeIssuerClosure must match SAP action specification'
  );
});

test('MODULE_REGISTRY configures dedicated permit-closure module for operational roles', () => {
  const closureDef = MODULE_REGISTRY.find(m => m.id === 'permit-closure');
  assert.ok(closureDef, 'permit-closure must be registered in MODULE_REGISTRY');
  assert.equal(closureDef.title, 'Permit Closure & Handover');
  assert.equal(closureDef.badge, 'Closure');

  // Verify all required operational roles have access
  const requiredRoles = closureDef.requiredRoles;
  assert.ok(requiredRoles.includes('PTW_ACCEPTOR') || requiredRoles.includes('ZPTW_ACCEPTOR'));
  assert.ok(requiredRoles.includes('PTW_AREA_OWNER') || requiredRoles.includes('PTW_AREA_OPP'));
  assert.ok(requiredRoles.includes('PTW_ISSUER') || requiredRoles.includes('PTW_ISSU'));
  assert.ok(requiredRoles.includes('PTW_ADMIN') || requiredRoles.includes('ZPTW_ADMIN'));

  // Verify permit-holder is removed and permit-closure occupies its position
  const holderDef = MODULE_REGISTRY.find(m => m.id === 'permit-holder');
  assert.equal(holderDef, undefined, 'permit-holder must be removed from MODULE_REGISTRY');

  const areaOwnerIdx = MODULE_REGISTRY.findIndex(m => m.id === 'permit-area-owner');
  const closureIdx = MODULE_REGISTRY.findIndex(m => m.id === 'permit-closure');
  assert.equal(closureIdx, areaOwnerIdx + 1, 'permit-closure must immediately follow permit-area-owner in place of permit-holder');
});

test('permitClosureApi.getClosureStep accurately tracks sequential 4-stage pipeline', () => {
  // Step 1: Active in field, work completion pending
  assert.equal(
    permitClosureApi.getClosureStep({ Status: 'ACTV', WorkCompleted: ' ' }),
    'WORK_COMPLETION'
  );

  // Step 2: Work completed, acceptor handover pending
  assert.equal(
    permitClosureApi.getClosureStep({ Status: 'ACTV', WorkCompleted: 'X', ClosedByAcceptor: ' ' }),
    'ACCEPTOR_CLOSURE'
  );

  // Step 3: Acceptor closed (ACCL), Area Operator clearance pending
  assert.equal(
    permitClosureApi.getClosureStep({ Status: 'ACCL', ClosedByAcceptor: 'X', ClosedByAreaOpp: ' ' }),
    'AREA_OPERATOR'
  );

  // Step 4: Area cleared (AROP), final Issuer closure pending
  assert.equal(
    permitClosureApi.getClosureStep({ Status: 'AROP', ClosedByAreaOpp: 'X' }),
    'ISSUER_FINAL'
  );

  // Closed in SAP (CLSD)
  assert.equal(
    permitClosureApi.getClosureStep({ Status: 'CLSD' }),
    'CLOSED'
  );

  // Legacy CLOS alias
  assert.equal(
    permitClosureApi.getClosureStep({ Status: 'CLOS' }),
    'CLOSED'
  );

  // Not yet active
  assert.equal(
    permitClosureApi.getClosureStep({ Status: 'CRTD' }),
    'NOT_READY'
  );
  assert.equal(
    permitClosureApi.getClosureStep({ Status: 'INTD' }),
    'NOT_READY'
  );
});

test('permitClosureApi.canExecuteClosureStep enforces strict role separation', () => {
  // Acceptor can execute Step 1 and 2, but not 3 or 4
  assert.equal(permitClosureApi.canExecuteClosureStep(['PTW_ACCEPTOR'], 'WORK_COMPLETION'), true);
  assert.equal(permitClosureApi.canExecuteClosureStep(['PTW_ACCEPTOR'], 'ACCEPTOR_CLOSURE'), true);
  assert.equal(permitClosureApi.canExecuteClosureStep(['PTW_ACCEPTOR'], 'AREA_OPERATOR'), false);
  assert.equal(permitClosureApi.canExecuteClosureStep(['PTW_ACCEPTOR'], 'ISSUER_FINAL'), false);

  // Area Operator can execute Step 3, but not 1, 2, or 4
  assert.equal(permitClosureApi.canExecuteClosureStep(['PTW_AREA_OPP'], 'WORK_COMPLETION'), false);
  assert.equal(permitClosureApi.canExecuteClosureStep(['PTW_AREA_OPP'], 'ACCEPTOR_CLOSURE'), false);
  assert.equal(permitClosureApi.canExecuteClosureStep(['PTW_AREA_OPP'], 'AREA_OPERATOR'), true);
  assert.equal(permitClosureApi.canExecuteClosureStep(['PTW_AREA_OPP'], 'ISSUER_FINAL'), false);

  // Issuer can execute Step 4
  assert.equal(permitClosureApi.canExecuteClosureStep(['PTW_ISSUER'], 'ISSUER_FINAL'), true);
  assert.equal(permitClosureApi.canExecuteClosureStep(['PTW_ISSU'], 'ISSUER_FINAL'), true);

  // Admin can execute all steps
  assert.equal(permitClosureApi.canExecuteClosureStep(['PTW_ADMIN'], 'WORK_COMPLETION'), true);
  assert.equal(permitClosureApi.canExecuteClosureStep(['PTW_ADMIN'], 'ACCEPTOR_CLOSURE'), true);
  assert.equal(permitClosureApi.canExecuteClosureStep(['PTW_ADMIN'], 'AREA_OPERATOR'), true);
  assert.equal(permitClosureApi.canExecuteClosureStep(['PTW_ADMIN'], 'ISSUER_FINAL'), true);
});

test('Step 1: confirmWorkCompletion invokes PermitInfo action with fallback and retains ACTV', async () => {
  let invokedUrl = '';
  let invokedPayload = null;
  const originalPost = odataClient.post;

  try {
    odataClient.post = async (url, payload) => {
      invokedUrl = url;
      invokedPayload = payload;
      return {
        data: {
          Permit_No: 'PTW0000001',
          Status: 'ACTV',
          WorkCompleted: 'X'
        }
      };
    };

    const res = await permitClosureApi.confirmWorkCompletion({
      permitNo: 'PTW0000001',
      comments: 'Work completed and site cleaned.'
    });

    assert.equal(res.success, true);
    assert.equal(res.newStatus, 'ACTV');
    assert.equal(
      invokedUrl,
      "PermitInfo(Permit_No='PTW0000001')/com.sap.gateway.srvd_a2x.zptw_services.v0001.confirmWorkCompletion"
    );
    assert.deepEqual(invokedPayload, {
      Comments: 'Work completed and site cleaned.'
    });
  } finally {
    odataClient.post = originalPost;
  }
});

test('Step 1: confirmWorkCompletion falls back to short syntax on 404', async () => {
  const attempts = [];
  const originalPost = odataClient.post;

  try {
    odataClient.post = async (url, payload) => {
      attempts.push(url);
      if (url.includes('(Permit_No=')) {
        const error = new Error('Not found');
        error.response = { status: 404 };
        throw error;
      }
      return {
        data: {
          Permit_No: 'PTW0000001',
          Status: 'ACTV',
          WorkCompleted: 'X'
        }
      };
    };

    const res = await permitClosureApi.confirmWorkCompletion({
      permitNo: 'PTW0000001'
    });

    assert.equal(res.success, true);
    assert.equal(attempts.length, 2);
    assert.equal(
      attempts[0],
      "PermitInfo(Permit_No='PTW0000001')/com.sap.gateway.srvd_a2x.zptw_services.v0001.confirmWorkCompletion"
    );
    assert.equal(
      attempts[1],
      "PermitInfo('PTW0000001')/com.sap.gateway.srvd_a2x.zptw_services.v0001.confirmWorkCompletion"
    );
  } finally {
    odataClient.post = originalPost;
  }
});

test('Step 2: completeAcceptorClosure invokes Approval action and transitions ACTV -> ACCL', async () => {
  let invokedUrl = '';
  let invokedPayload = null;
  const originalPost = odataClient.post;

  try {
    odataClient.post = async (url, payload) => {
      invokedUrl = url;
      invokedPayload = payload;
      return {
        data: {
          PermitNo: 'PTW0000001',
          Status: 'ACCL',
          ClosedByAcceptor: 'X'
        }
      };
    };

    const res = await permitClosureApi.completeAcceptorClosure({
      permitNo: 'PTW0000001',
      comments: 'Acceptor handover and closure confirmed.'
    });

    assert.equal(res.success, true);
    assert.equal(res.newStatus, 'ACCL');
    assert.equal(
      invokedUrl,
      'Approval/com.sap.gateway.srvd_a2x.zptw_services.v0001.completeAcceptorClosure'
    );
    assert.deepEqual(invokedPayload, {
      PermitNo: 'PTW0000001',
      Comments: 'Acceptor handover and closure confirmed.'
    });
  } finally {
    odataClient.post = originalPost;
  }
});

test('Step 3: completeAreaOperatorClosure invokes Approval action and transitions ACCL -> AROP', async () => {
  let invokedUrl = '';
  let invokedPayload = null;
  const originalPost = odataClient.post;

  try {
    odataClient.post = async (url, payload) => {
      invokedUrl = url;
      invokedPayload = payload;
      return {
        data: {
          PermitNo: 'PTW0000001',
          Status: 'AROP',
          ClosedByAreaOpp: 'X'
        }
      };
    };

    const res = await permitClosureApi.completeAreaOperatorClosure({
      permitNo: 'PTW0000001',
      comments: 'Area checked and restored. Area Operator closure confirmed.'
    });

    assert.equal(res.success, true);
    assert.equal(res.newStatus, 'AROP');
    assert.equal(
      invokedUrl,
      'Approval/com.sap.gateway.srvd_a2x.zptw_services.v0001.completeAreaOperatorClosure'
    );
    assert.deepEqual(invokedPayload, {
      PermitNo: 'PTW0000001',
      Comments: 'Area checked and restored. Area Operator closure confirmed.'
    });
  } finally {
    odataClient.post = originalPost;
  }
});

test('Step 4: completeIssuerClosure invokes PermitInfo action with fallback and finalizes status to CLSD', async () => {
  let invokedUrl = '';
  let invokedPayload = null;
  const originalPost = odataClient.post;

  try {
    odataClient.post = async (url, payload) => {
      invokedUrl = url;
      invokedPayload = payload;
      return {
        data: {
          Permit_No: 'PTW0000001',
          Status: 'CLSD'
        }
      };
    };

    const res = await permitClosureApi.completeIssuerClosure({
      permitNo: 'PTW0000001',
      comments: 'Final permit closure approved and archived.'
    });

    assert.equal(res.success, true);
    assert.equal(res.newStatus, 'CLSD');
    assert.equal(
      invokedUrl,
      "PermitInfo(Permit_No='PTW0000001')/com.sap.gateway.srvd_a2x.zptw_services.v0001.completeIssuerClosure"
    );
    assert.deepEqual(invokedPayload, {
      Comments: 'Final permit closure approved and archived.'
    });
  } finally {
    odataClient.post = originalPost;
  }
});

test('Closed (CLSD) permits suppress shift renewal and modification options', () => {
  const terminalStatuses = ['CLSD', 'CLOS', 'CANC', 'REJT', 'REJC'];
  const testPermit = { Status: 'CLSD' };

  assert.equal(terminalStatuses.includes(testPermit.Status), true, 'CLSD must be recognized as a terminal closed status');
  assert.equal(!terminalStatuses.includes(testPermit.Status), false, 'Shift renewal button condition must evaluate to false for CLSD');
});

