import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
  stdin: {
    contents: `export * from './src/core/ptw/jhaTemplates';`,
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
  JHA_TEMPLATES,
  GENERAL_SAFETY_GUIDELINES,
  detectBestJhaTemplate,
  getJhaTemplateById
} = compiled.exports;

test('JHA module registers all 6 corporate templates from HSE/SAF/F/05 standard', () => {
  assert.equal(JHA_TEMPLATES.length, 6, 'Exactly 6 templates registered');
  const templateIds = JHA_TEMPLATES.map(t => t.id);
  assert.deepEqual(templateIds, [
    'HOT_GROUND',
    'HOT_HEIGHT',
    'CSE_COLD',
    'LINE_BREAK',
    'WORK_HEIGHT',
    'HYDRO_JET'
  ]);

  for (const template of JHA_TEMPLATES) {
    assert.ok(template.id, 'Has valid id');
    assert.ok(template.title, 'Has title');
    assert.ok(template.subtitle, 'Has subtitle');
    assert.ok(template.categoryCode, 'Has categoryCode');
    assert.ok(Array.isArray(template.rows) && template.rows.length > 0, 'Has non-empty rows');
    assert.equal(template.generalGuidelines.length, 10, 'Includes all 10 corporate safety guidelines');
  }
});

test('Every JHA row has valid risk ratings, likelihood, severity, and mitigation measures', () => {
  for (const template of JHA_TEMPLATES) {
    for (const [idx, row] of template.rows.entries()) {
      assert.ok(row.activity, `Row ${idx + 1} in ${template.id} has activity`);
      assert.ok(row.hazard, `Row ${idx + 1} in ${template.id} has hazard`);
      assert.ok(row.consequence, `Row ${idx + 1} in ${template.id} has consequence`);

      // Initial risk
      assert.ok(row.initialRisk, `Row ${idx + 1} has initialRisk`);
      assert.ok(typeof row.initialRisk.score === 'number' && row.initialRisk.score > 0);
      assert.ok(['High', 'Medium', 'Low', 'Negligible'].includes(row.initialRisk.level));
      assert.ok(row.initialRisk.likelihood, 'Initial risk has likelihood');
      assert.ok(row.initialRisk.severity, 'Initial risk has severity');

      // Controls
      assert.ok(Array.isArray(row.mitigationMeasures) && row.mitigationMeasures.length > 0);

      // Residual risk
      assert.ok(row.residualRisk, `Row ${idx + 1} has residualRisk`);
      assert.ok(typeof row.residualRisk.score === 'number' && row.residualRisk.score > 0);
      assert.ok(['High', 'Medium', 'Low', 'Negligible'].includes(row.residualRisk.level));
      assert.ok(
        row.residualRisk.score <= row.initialRisk.score,
        `Residual risk score (${row.residualRisk.score}) <= Initial risk score (${row.initialRisk.score}) in ${template.id} row ${idx + 1}`
      );
    }
  }
});

test('detectBestJhaTemplate automatically resolves permits to the proper standard template', () => {
  // Hot work at height
  const hotHeight = detectBestJhaTemplate({
    PermitType: 'HOT',
    JobDesc: 'Pipeline welding work at height 12 meters',
    _WorkType: [{ WorkTypeCode: 'HOT' }, { WorkTypeCode: 'HGHT' }]
  });
  assert.equal(hotHeight.id, 'HOT_HEIGHT');

  // Hot work at ground level
  const hotGround = detectBestJhaTemplate({
    PermitType: 'HOT',
    JobDesc: 'Structural welding at workshop ground area'
  });
  assert.equal(hotGround.id, 'HOT_GROUND');

  // Confined Space Entry
  const cseCold = detectBestJhaTemplate({
    PermitType: 'CONF',
    JobDesc: 'Internal cleaning inside vessel D-201'
  });
  assert.equal(cseCold.id, 'CSE_COLD');

  const cseCold2 = detectBestJhaTemplate({
    PermitType: 'CSE',
    JobDesc: 'Column inspection'
  });
  assert.equal(cseCold2.id, 'CSE_COLD');

  // Line break
  const lineBreak = detectBestJhaTemplate({
    PermitType: 'LINE',
    JobDesc: 'Flange opening and line break on chemical discharge line'
  });
  assert.equal(lineBreak.id, 'LINE_BREAK');

  // Work at height
  const workHeight = detectBestJhaTemplate({
    PermitType: 'HGHT',
    JobDesc: 'Scaffolding erection and lighting replacement'
  });
  assert.equal(workHeight.id, 'WORK_HEIGHT');

  // Hydro jetting
  const hydroJet = detectBestJhaTemplate({
    PermitType: 'COLD',
    JobDesc: 'High pressure hydro jetting on exchanger bundle'
  });
  assert.equal(hydroJet.id, 'HYDRO_JET');

  // Fallback for empty or unknown
  const fallback = detectBestJhaTemplate(null);
  assert.equal(fallback.id, 'HOT_GROUND');
});

test('getJhaTemplateById returns target template or falls back safely', () => {
  assert.equal(getJhaTemplateById('HOT_HEIGHT').id, 'HOT_HEIGHT');
  assert.equal(getJhaTemplateById('CSE_COLD').id, 'CSE_COLD');
  assert.equal(getJhaTemplateById('NON_EXISTENT_ID').id, 'HOT_GROUND');
});

test('GENERAL_SAFETY_GUIDELINES contains 10 corporate HSE guidelines', () => {
  assert.equal(GENERAL_SAFETY_GUIDELINES.length, 10);
  assert.ok(GENERAL_SAFETY_GUIDELINES[0].includes('Permit to Work (PTW)'));
  assert.ok(GENERAL_SAFETY_GUIDELINES[9].includes('emergency (siren)'));
});
