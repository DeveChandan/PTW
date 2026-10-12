import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
  stdin: {
    contents: `export * from './src/features/permits/RiskMatrix5x5Section';`,
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
new Function('require', 'module', 'exports', result.outputFiles[0].text)(
  createRequire(import.meta.url),
  compiled,
  compiled.exports
);

const { getRiskMatrixCell, SEVERITY_CRITERIA_ROWS, LIKELIHOOD_COLS } = compiled.exports;

test('5x5 Matrix correctly maps all 25 cells to exact corporate risk bands and scores', () => {
  // Red cells (Scores 15, 16, 20, 25) -> Critical Risk (#FF0000, black text)
  const redCoordinates = [
    [5, 3, 15],
    [5, 4, 20],
    [5, 5, 25],
    [4, 4, 16],
    [4, 5, 20],
    [3, 5, 15]
  ];
  for (const [sev, lik, score] of redCoordinates) {
    const cell = getRiskMatrixCell(sev, lik);
    assert.equal(cell.score, score, `Score for (${sev},${lik})`);
    assert.equal(cell.band, 'RED', `Band for (${sev},${lik})`);
    assert.equal(cell.sapRiskLevel, 'CRIT', `SAP level for (${sev},${lik})`);
    assert.equal(cell.hexColor, '#FF0000', `Hex color for (${sev},${lik})`);
    assert.equal(cell.textClass, 'text-black', `Text color for (${sev},${lik})`);
  }

  // Yellow cells (Scores 9, 10, 12) -> High Risk (#FFD966, black text)
  const yellowCoordinates = [
    [5, 2, 10],
    [4, 3, 12],
    [3, 3, 9],
    [3, 4, 12],
    [2, 5, 10]
  ];
  for (const [sev, lik, score] of yellowCoordinates) {
    const cell = getRiskMatrixCell(sev, lik);
    assert.equal(cell.score, score, `Score for (${sev},${lik})`);
    assert.equal(cell.band, 'YELLOW', `Band for (${sev},${lik})`);
    assert.equal(cell.sapRiskLevel, 'HIGH', `SAP level for (${sev},${lik})`);
    assert.equal(cell.hexColor, '#FFD966', `Hex color for (${sev},${lik})`);
    assert.equal(cell.textClass, 'text-black', `Text color for (${sev},${lik})`);
  }

  // Cyan cells (Scores 4, 5, 6, 8) -> Moderate Risk (#66FFFF, black text)
  const cyanCoordinates = [
    [5, 1, 5],
    [4, 1, 4],
    [4, 2, 8],
    [3, 2, 6],
    [2, 2, 4],
    [2, 3, 6],
    [2, 4, 8],
    [1, 4, 4],
    [1, 5, 5]
  ];
  for (const [sev, lik, score] of cyanCoordinates) {
    const cell = getRiskMatrixCell(sev, lik);
    assert.equal(cell.score, score, `Score for (${sev},${lik})`);
    assert.equal(cell.band, 'CYAN', `Band for (${sev},${lik})`);
    assert.equal(cell.sapRiskLevel, 'MED', `SAP level for (${sev},${lik})`);
    assert.equal(cell.hexColor, '#66FFFF', `Hex color for (${sev},${lik})`);
    assert.equal(cell.textClass, 'text-black', `Text color for (${sev},${lik})`);
  }

  // Green cells (Scores 1, 2, 3) -> Low Risk (#CCFF99, black text)
  const greenCoordinates = [
    [3, 1, 3],
    [2, 1, 2],
    [1, 1, 1],
    [1, 2, 2],
    [1, 3, 3]
  ];
  for (const [sev, lik, score] of greenCoordinates) {
    const cell = getRiskMatrixCell(sev, lik);
    assert.equal(cell.score, score, `Score for (${sev},${lik})`);
    assert.equal(cell.band, 'GREEN', `Band for (${sev},${lik})`);
    assert.equal(cell.sapRiskLevel, 'LOW', `SAP level for (${sev},${lik})`);
    assert.equal(cell.hexColor, '#CCFF99', `Hex color for (${sev},${lik})`);
    assert.equal(cell.textClass, 'text-black', `Text color for (${sev},${lik})`);
  }
});

test('Severity criteria table contains exact corporate HSE pillars for ratings 5 to 1', () => {
  assert.equal(SEVERITY_CRITERIA_ROWS.length, 5);

  const row5 = SEVERITY_CRITERIA_ROWS.find(r => r.rating === 5);
  assert.ok(row5);
  assert.match(row5.people, /Multiple Fatality/i);
  assert.match(row5.asset, /500 Lakh/i);
  assert.match(row5.environment, /Severe Impact/i);
  assert.match(row5.reputation, /irreversibly damaged/i);

  const row4 = SEVERITY_CRITERIA_ROWS.find(r => r.rating === 4);
  assert.ok(row4);
  assert.match(row4.people, /Single Fatality/i);
  assert.match(row4.asset, /100 - 500 Lakh/i);
  assert.match(row4.environment, /Measurable Ecological/i);

  const row3 = SEVERITY_CRITERIA_ROWS.find(r => r.rating === 3);
  assert.ok(row3);
  assert.match(row3.people, /Lost workday case/i);
  assert.match(row3.asset, /50 - 100 Lakh/i);

  const row2 = SEVERITY_CRITERIA_ROWS.find(r => r.rating === 2);
  assert.ok(row2);
  assert.match(row2.people, /Medical Treatment Case/i);
  assert.match(row2.asset, /10 - 50 Lakh/i);

  const row1 = SEVERITY_CRITERIA_ROWS.find(r => r.rating === 1);
  assert.ok(row1);
  assert.match(row1.people, /Minor/i);
  assert.match(row1.asset, /< Rs 10 lakh/i);
});

test('Likelihood probability scale matches 1 to 5 frequency categories', () => {
  assert.equal(LIKELIHOOD_COLS.length, 5);

  assert.equal(LIKELIHOOD_COLS[0].rating, 1);
  assert.equal(LIKELIHOOD_COLS[0].qualitative, 'Very Unlikely');
  assert.match(LIKELIHOOD_COLS[0].frequency, /1-in 10000\/yr/i);

  assert.equal(LIKELIHOOD_COLS[1].rating, 2);
  assert.equal(LIKELIHOOD_COLS[1].qualitative, 'Unlikely');
  assert.match(LIKELIHOOD_COLS[1].frequency, /1-in 1000\/yr/i);

  assert.equal(LIKELIHOOD_COLS[2].rating, 3);
  assert.equal(LIKELIHOOD_COLS[2].qualitative, 'Possible');
  assert.match(LIKELIHOOD_COLS[2].frequency, /1-in 100\/yr/i);

  assert.equal(LIKELIHOOD_COLS[3].rating, 4);
  assert.equal(LIKELIHOOD_COLS[3].qualitative, 'Likely');
  assert.match(LIKELIHOOD_COLS[3].frequency, /1-in 10\/yr/i);

  assert.equal(LIKELIHOOD_COLS[4].rating, 5);
  assert.equal(LIKELIHOOD_COLS[4].qualitative, 'Very Likely');
  assert.match(LIKELIHOOD_COLS[4].frequency, /Once a yr or More/i);
});
