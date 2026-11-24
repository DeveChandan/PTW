import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const bundleResult = await build({
  stdin: {
    contents: `
      export { formatUserWithSapId, KNOWN_SYSTEM_USERS } from './src/core/utils/authorityFormatter';
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
new Function('module', 'exports', 'require', bundleResult.outputFiles[0].text)(
  compiled,
  compiled.exports,
  createRequire(import.meta.url)
);

const { formatUserWithSapId, KNOWN_SYSTEM_USERS } = compiled.exports;

test('KNOWN_SYSTEM_USERS maps VERTIF-V to Verification Officer', () => {
  assert.equal(KNOWN_SYSTEM_USERS['VERTIF-V'], 'Verification Officer');
});

test('formatUserWithSapId formats VERTIF-V with default system designation', () => {
  const result = formatUserWithSapId('VERTIF-V');
  assert.equal(result, 'Verification Officer (VERTIF-V)');
});

test('formatUserWithSapId formats VERTIF-V when fallbackFullName is identical to ID', () => {
  const result = formatUserWithSapId('VERTIF-V', 'VERTIF-V');
  assert.equal(result, 'Verification Officer (VERTIF-V)');
});

test('formatUserWithSapId formats with custom human fallback name when provided', () => {
  const result = formatUserWithSapId('VERTIF-V', 'Totan Patra');
  assert.equal(result, 'Totan Patra (VERTIF-V)');
});

test('formatUserWithSapId formats enterprise user from directory map', () => {
  const directory = new Map([
    ['GF10409', 'Vineet Kumar'],
    ['GF7874', 'Amit Jain'],
    ['PATEL-R', 'Ramesh Patel']
  ]);
  assert.equal(formatUserWithSapId('GF10409', null, null, directory), 'Vineet Kumar (GF10409)');
  assert.equal(formatUserWithSapId('GF7874', null, null, directory), 'Amit Jain (GF7874)');
  assert.equal(formatUserWithSapId('PATEL-R', null, null, directory), 'Ramesh Patel (PATEL-R)');
});

test('formatUserWithSapId respects active logged-in SAP user session', () => {
  const mockUser = {
    id: 'ACTIVE-01',
    fullName: 'Active Operator',
    firstName: 'Active',
    lastName: 'Operator',
  };
  const result = formatUserWithSapId('ACTIVE-01', null, mockUser);
  assert.equal(result, 'Active Operator (ACTIVE-01)');
});

test('formatUserWithSapId does not duplicate if already formatted with parentheses', () => {
  const result = formatUserWithSapId('Verification Officer (VERTIF-V)');
  assert.equal(result, 'Verification Officer (VERTIF-V)');
});

test('formatUserWithSapId preserves non-user status strings', () => {
  assert.equal(formatUserWithSapId('LOTO Cleared'), 'LOTO Cleared');
  assert.equal(formatUserWithSapId('[RESTORED]'), '[RESTORED]');
  assert.equal(formatUserWithSapId('Authorized Issuer'), 'Authorized Issuer');
});

test('formatUserWithSapId gracefully handles empty, null and dash values', () => {
  assert.equal(formatUserWithSapId('—'), '—');
  assert.equal(formatUserWithSapId(''), '—');
  assert.equal(formatUserWithSapId(null), '—');
  assert.equal(formatUserWithSapId(undefined), '—');
  assert.equal(formatUserWithSapId('—', '—'), '—');
});

test('formatUserWithSapId falls back to raw ID if no name is available', () => {
  assert.equal(formatUserWithSapId('CONTRACTOR_99'), 'CONTRACTOR_99');
});
