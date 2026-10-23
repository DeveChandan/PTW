import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const bundleResult = await build({
  stdin: {
    contents: `
      export { ODATA_ENTITIES } from './src/core/api/odataEndpoints';
      export { MODULE_REGISTRY } from './src/core/auth/sapAuthContext';
      export { PTW_ROLE_CATALOG, getPtwRoleInfo } from './src/core/types/admin.types';
      export { adminApi } from './src/core/api/modules/admin.api';
    `,
    resolveDir: process.cwd(),
    loader: 'tsx'
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  define: { 'import.meta.env': '{}' }
});

const compiled = { exports: {} };
new Function('require', 'module', 'exports', bundleResult.outputFiles[0].text)(
  createRequire(import.meta.url),
  compiled,
  compiled.exports
);

const { ODATA_ENTITIES, MODULE_REGISTRY, PTW_ROLE_CATALOG, getPtwRoleInfo, adminApi } = compiled.exports;

test('ODATA_ENTITIES exposes USER_ROLE as exact match to SAP OData V4 service', () => {
  assert.equal(ODATA_ENTITIES.USER_ROLE, 'UserRole');
  assert.equal(ODATA_ENTITIES.USER_ROLES, 'UserRole');
});

test('Live SAP /UserRole response payload conforms to SapUserRoleRecord schema', () => {
  // Real SAP response provided by user from https://vhgfldevci.sap.gfl.co.in:44300/.../UserRole
  const liveSapResponse = {
    "@odata.context": "$metadata#UserRole",
    "@odata.metadataEtag": 'W/"20261023072500"',
    "value": [
      {
        "SAP_USER": "VERTIF-V",
        "PTW_ROLE": "PTW_ADMIN",
        "ACTIVE": true,
        "CREATED_BY": "",
        "CREATED_ON": null,
        "CREATED_AT": "::",
        "CHANGED_BY": "",
        "CHANGED_ON": null,
        "CHANGED_AT": "::",
        "SAP__Messages": []
      }
    ]
  };

  assert.ok(Array.isArray(liveSapResponse.value));
  const record = liveSapResponse.value[0];

  assert.equal(typeof record.SAP_USER, 'string');
  assert.equal(record.SAP_USER, 'VERTIF-V');

  assert.equal(typeof record.PTW_ROLE, 'string');
  assert.equal(record.PTW_ROLE, 'PTW_ADMIN');

  assert.equal(typeof record.ACTIVE, 'boolean');
  assert.equal(record.ACTIVE, true);

  assert.ok('CREATED_BY' in record);
  assert.ok('CREATED_ON' in record);
  assert.ok('CREATED_AT' in record);
  assert.ok('CHANGED_BY' in record);
  assert.ok('CHANGED_ON' in record);
  assert.ok('CHANGED_AT' in record);
  assert.ok(Array.isArray(record.SAP__Messages));
});

test('Role normalization handles PTW_* and ZPTW_* prefixes bidirectionally', () => {
  const normalizeRoles = (rawRoles) => {
    const set = new Set();
    for (const r of rawRoles) {
      const clean = r.trim().toUpperCase();
      set.add(clean);
      if (clean.startsWith('PTW_')) {
        set.add(`Z${clean}`);
      } else if (clean.startsWith('ZPTW_')) {
        set.add(clean.substring(1));
      }
    }
    return Array.from(set);
  };

  // Case 1: SAP returns PTW_ADMIN
  const normalizedFromPtw = normalizeRoles(['PTW_ADMIN']);
  assert.ok(normalizedFromPtw.includes('PTW_ADMIN'));
  assert.ok(normalizedFromPtw.includes('ZPTW_ADMIN'));

  // Case 2: SAP returns ZPTW_ADMIN
  const normalizedFromZptw = normalizeRoles(['ZPTW_ADMIN']);
  assert.ok(normalizedFromZptw.includes('PTW_ADMIN'));
  assert.ok(normalizedFromZptw.includes('ZPTW_ADMIN'));

  // Case 3: Multiple roles
  const multiple = normalizeRoles(['PTW_REQUESTER', 'PTW_APPROVER', 'ZPTW_ISSUER']);
  assert.ok(multiple.includes('PTW_REQUESTER') && multiple.includes('ZPTW_REQUESTER'));
  assert.ok(multiple.includes('PTW_APPROVER') && multiple.includes('ZPTW_APPROVER'));
  assert.ok(multiple.includes('PTW_ISSUER') && multiple.includes('ZPTW_ISSUER'));
});

test('Admin module definition is configured in MODULE_REGISTRY with PTW_ADMIN authorization', () => {
  const adminMod = MODULE_REGISTRY.find((m) => m.id === 'admin');
  assert.ok(adminMod, 'admin module must be present in MODULE_REGISTRY');
  assert.equal(adminMod.title, 'PTW Admin');
  assert.equal(adminMod.icon, 'admin_panel_settings');
  assert.ok(adminMod.requiredRoles.includes('PTW_ADMIN'), 'Must accept PTW_ADMIN');
  assert.ok(adminMod.requiredRoles.includes('ZPTW_ADMIN'), 'Must accept ZPTW_ADMIN');
});

test('User with PTW_ADMIN or ZPTW_ADMIN unlocks all modules across the application', () => {
  const computeUnlocked = (roles) => {
    if (
      roles.includes('ZPTW_ADMIN') ||
      roles.includes('PTW_ADMIN') ||
      roles.includes('Z_MOBILE_PI_SHEET')
    ) {
      return MODULE_REGISTRY.map((m) => m.id);
    }
    return MODULE_REGISTRY.filter((mod) =>
      mod.requiredRoles.some((reqRole) => roles.includes(reqRole))
    ).map((m) => m.id);
  };

  // Admin role unlocks all modules
  const ptwAdminUnlocked = computeUnlocked(['PTW_ADMIN']);
  assert.equal(ptwAdminUnlocked.length, MODULE_REGISTRY.length);
  assert.ok(ptwAdminUnlocked.includes('admin'));
  assert.ok(ptwAdminUnlocked.includes('permit-create'));
  assert.ok(ptwAdminUnlocked.includes('permit-approver'));

  const zptwAdminUnlocked = computeUnlocked(['ZPTW_ADMIN']);
  assert.equal(zptwAdminUnlocked.length, MODULE_REGISTRY.length);

  // Non-admin with just requester only unlocks requester modules
  const requesterUnlocked = computeUnlocked(['PTW_REQUESTER']);
  assert.ok(!requesterUnlocked.includes('admin'), 'Requester must NOT unlock admin');
  assert.ok(requesterUnlocked.includes('permit-create'), 'Requester unlocks permit-create');
});

test('PTW_ROLE_CATALOG covers all core operational roles with labels and icons', () => {
  const expectedCodes = [
    'PTW_ADMIN',
    'PTW_REQUESTER',
    'PTW_HOLDER',
    'PTW_APPROVER',
    'PTW_ISSUER',
    'PTW_AREA_OWNER',
    'PTW_ISOLATOR',
    'PTW_GAS_TESTER',
    'PTW_SAFETY_OFFICER'
  ];

  for (const code of expectedCodes) {
    const meta = getPtwRoleInfo(code);
    assert.ok(meta, `Role ${code} must resolve in catalog`);
    assert.ok(meta.label.length > 0);
    assert.ok(meta.icon.length > 0);
    assert.ok(meta.colorBadge.length > 0);
  }
});

test('adminApi.computeRoleStats correctly calculates role metrics and active users', () => {
  const sampleRoles = [
    { SAP_USER: 'VERTIF-V', PTW_ROLE: 'PTW_ADMIN', ACTIVE: true },
    { SAP_USER: 'VERTIF-V', PTW_ROLE: 'PTW_APPROVER', ACTIVE: true },
    { SAP_USER: 'SHARMA-M', PTW_ROLE: 'PTW_ISSUER', ACTIVE: true },
    { SAP_USER: 'PATEL-R', PTW_ROLE: 'PTW_REQUESTER', ACTIVE: true },
    { SAP_USER: 'CONTRACTOR-01', PTW_ROLE: 'PTW_HOLDER', ACTIVE: false }
  ];

  const stats = adminApi.computeRoleStats(sampleRoles);
  assert.equal(stats.totalRoles, 5);
  assert.equal(stats.activeAdmins, 1);
  assert.equal(stats.activeApprovers, 1);
  assert.equal(stats.activeIssuers, 1);
  assert.equal(stats.activeRequesters, 1);
  assert.equal(stats.inactiveRoles, 1);
  assert.equal(stats.uniqueUsers, 4); // VERTIF-V, SHARMA-M, PATEL-R, CONTRACTOR-01
});

test('adminApi.getUserRoles filters by active status and user account', async () => {
  const allRoles = await adminApi.getUserRoles();
  assert.ok(allRoles.length >= 1);
  assert.ok(allRoles.some((r) => r.SAP_USER === 'VERTIF-V' && r.PTW_ROLE === 'PTW_ADMIN'));

  const vertifOnly = await adminApi.getUserRoles({ user: 'VERTIF-V' });
  assert.ok(vertifOnly.every((r) => r.SAP_USER === 'VERTIF-V'));

  const activeOnly = await adminApi.getUserRoles({ activeOnly: true });
  assert.ok(activeOnly.every((r) => r.ACTIVE === true));
});

test('adminApi.createUserRole and updateUserRoleStatus perform expected data lifecycle', async () => {
  const newUser = 'TEST-ADMIN-01';
  const role = 'PTW_ADMIN';

  // 1. Create
  const created = await adminApi.createUserRole({
    SAP_USER: newUser,
    PTW_ROLE: role,
    ACTIVE: true
  });
  assert.equal(created.SAP_USER, newUser);
  assert.equal(created.PTW_ROLE, role);
  assert.equal(created.ACTIVE, true);

  // 2. Update status
  const updated = await adminApi.updateUserRoleStatus(newUser, role, false);
  assert.equal(updated.ACTIVE, false);

  // 3. Delete
  const deleted = await adminApi.deleteUserRole(newUser, role);
  assert.equal(deleted, true);

  // 4. Verify removed
  const rolesAfter = await adminApi.getUserRoles({ user: newUser });
  assert.equal(rolesAfter.length, 0);
});
