import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
  stdin: {
    contents: `
      export * from './src/core/types/checklist.types';
      export * from './src/core/api/modules/checklist.api';
      export * from './src/core/ptw/siteProcedure';
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
  checklistApi,
  toSapChecklistPermitType,
  FALLBACK_CHECKLISTS
} = compiled.exports;

test('toSapChecklistPermitType maps UI permit codes to SAP OData codes', () => {
  assert.equal(toSapChecklistPermitType('HGHT'), 'W@H');
  assert.equal(toSapChecklistPermitType('W@H'), 'W@H');
  assert.equal(toSapChecklistPermitType('CONF'), 'CSE');
  assert.equal(toSapChecklistPermitType('CSE'), 'CSE');
  assert.equal(toSapChecklistPermitType('COLD'), 'COLD');
  assert.equal(toSapChecklistPermitType('HOT'), 'HOT');
  assert.equal(toSapChecklistPermitType('EXCV'), 'EXCV');
  assert.equal(toSapChecklistPermitType('LINE'), 'LBRK');
  assert.equal(toSapChecklistPermitType('RIGG'), 'RIG');
  assert.equal(toSapChecklistPermitType('ELEC'), 'ELEC');
  assert.equal(toSapChecklistPermitType(''), '');
});

test('checklistApi provides 18 compliance questions for Work at Height (W@H)', async () => {
  const items = await checklistApi.fetchChecklist('W@H');
  assert.equal(items.length, 18);
  assert.equal(items[0].QuestionaireId, '1');
  assert.equal(items[0].PermitType, 'W@H');
  assert.equal(items[0].Type, 'CHECKLIST');
  assert.equal(items[0].Category, 'GENERAL');
  assert.ok(items[0].Question.includes('1.8 METERS'));

  // Ladder category items
  const ladderItems = items.filter(i => i.Category === 'LADDER');
  assert.equal(ladderItems.length, 4);

  // Scaffolding category items
  const scaffoldItems = items.filter(i => i.Category === 'SCAFFOLDIN');
  assert.equal(scaffoldItems.length, 5);
});

test('checklistApi provides 23 compliance questions for Confined Space Entry (CSE)', async () => {
  const items = await checklistApi.fetchChecklist('CSE');
  assert.equal(items.length, 23);
  assert.equal(items[0].QuestionaireId, '20');
  assert.equal(items[0].PermitType, 'CSE');
  assert.equal(items[0].Category, 'ISOLATION');
  assert.ok(items[0].Question.includes('ELECTRICAL ISOLATION'));

  // Specific categories
  const categories = [...new Set(items.map(i => i.Category))];
  assert.ok(categories.includes('ISOLATION'));
  assert.ok(categories.includes('PREPARATION'));
  assert.ok(categories.includes('VENTILATION'));
  assert.ok(categories.includes('ELECTRICAL'));
  assert.ok(categories.includes('EARTHING'));
  assert.ok(categories.includes('GAS TESTING'));
  assert.ok(categories.includes('RESCUE'));
});

test('checklistApi works transparently with UI codes like HGHT and CONF', async () => {
  const hghtItems = await checklistApi.fetchChecklist('HGHT');
  assert.equal(hghtItems.length, 18);

  const confItems = await checklistApi.fetchChecklist('CONF');
  assert.equal(confItems.length, 23);
});

test('checklistApi returns empty array for permit types without questionnaires', async () => {
  const coldItems = await checklistApi.fetchChecklist('UNKNOWN_TYPE');
  assert.equal(coldItems.length, 0);
});
