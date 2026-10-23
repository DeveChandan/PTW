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

const {
  getRiskMatrixCell,
  SEVERITY_CRITERIA_ROWS,
  LIKELIHOOD_COLS,
  deduceMatrixCoordinates,
  extractHazardRisk,
  getMaxHazardRisk
} = compiled.exports;

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
    assert.equal(cell.sapRiskLevel, String(score), `SAP level for (${sev},${lik})`);
    assert.equal(cell.riskBandCode, 'CRIT', `Risk band code for (${sev},${lik})`);
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
    assert.equal(cell.sapRiskLevel, String(score), `SAP level for (${sev},${lik})`);
    assert.equal(cell.riskBandCode, 'HIGH', `Risk band code for (${sev},${lik})`);
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
    assert.equal(cell.sapRiskLevel, String(score), `SAP level for (${sev},${lik})`);
    assert.equal(cell.riskBandCode, 'MED', `Risk band code for (${sev},${lik})`);
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
    assert.equal(cell.sapRiskLevel, String(score), `SAP level for (${sev},${lik})`);
    assert.equal(cell.riskBandCode, 'LOW', `Risk band code for (${sev},${lik})`);
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

test('deduceMatrixCoordinates accurately breaks down scores into 5x5 Severity and Likelihood', () => {
  assert.deepEqual(deduceMatrixCoordinates(25), { s: 5, l: 5 });
  assert.deepEqual(deduceMatrixCoordinates(20), { s: 5, l: 4 });
  assert.deepEqual(deduceMatrixCoordinates(16), { s: 4, l: 4 });
  assert.deepEqual(deduceMatrixCoordinates(15), { s: 5, l: 3 });
  assert.deepEqual(deduceMatrixCoordinates(12), { s: 4, l: 3 });
  assert.deepEqual(deduceMatrixCoordinates(10), { s: 5, l: 2 });
  assert.deepEqual(deduceMatrixCoordinates(9), { s: 3, l: 3 });
  assert.deepEqual(deduceMatrixCoordinates(8), { s: 4, l: 2 });
  assert.deepEqual(deduceMatrixCoordinates(6), { s: 3, l: 2 });
  assert.deepEqual(deduceMatrixCoordinates(5), { s: 5, l: 1 });
  assert.deepEqual(deduceMatrixCoordinates(4), { s: 2, l: 2 });
  assert.deepEqual(deduceMatrixCoordinates(3), { s: 3, l: 1 });
  assert.deepEqual(deduceMatrixCoordinates(2), { s: 2, l: 1 });
  assert.deepEqual(deduceMatrixCoordinates(1), { s: 1, l: 1 });
});

test('extractHazardRisk dynamically extracts S, L, score, and matrix band from Remarks or RiskLevel', () => {
  // 1. From Remarks containing [5x5 S=4, L=4, Score=16...]
  const h1 = {
    HazardDesc: 'TOXIC VAPOR EXPOSURE',
    RiskLevel: '16',
    Remarks: '[5x5 S=4, L=4, Score=16: HIGH RISK] MANDATORY CONTROL VERIFICATION'
  };
  const r1 = extractHazardRisk(h1);
  assert.equal(r1.s, 4);
  assert.equal(r1.l, 4);
  assert.equal(r1.score, 16);
  assert.equal(r1.band, 'RED');
  assert.equal(r1.hexColor, '#FF0000');

  // 2. From Remarks with different coordinates: S=3, L=3 -> Score 9 (YELLOW)
  const h2 = {
    HazardDesc: 'HIGH PRESSURE LEAK',
    RiskLevel: '9',
    Remarks: '[5x5 S=3, L=3, Score=9: HIGH RISK] MANDATORY CONTROL VERIFICATION'
  };
  const r2 = extractHazardRisk(h2);
  assert.equal(r2.s, 3);
  assert.equal(r2.l, 3);
  assert.equal(r2.score, 9);
  assert.equal(r2.band, 'YELLOW');
  assert.equal(r2.hexColor, '#FFD966');

  // 3. From numeric RiskLevel alone: '4' -> S=2, L=2 (CYAN)
  const h3 = {
    HazardDesc: 'NOISE EXPOSURE',
    RiskLevel: '4',
    Remarks: 'Routine plant inspection'
  };
  const r3 = extractHazardRisk(h3);
  assert.equal(r3.s, 2);
  assert.equal(r3.l, 2);
  assert.equal(r3.score, 4);
  assert.equal(r3.band, 'CYAN');
  assert.equal(r3.hexColor, '#66FFFF');

  // 4. From textual legacy RiskLevel 'CRIT' -> Score 25 (RED)
  const h4 = {
    HazardDesc: 'CONFINED SPACE ASPHYXIATION',
    RiskLevel: 'CRIT',
    Remarks: ''
  };
  const r4 = extractHazardRisk(h4);
  assert.equal(r4.s, 5);
  assert.equal(r4.l, 5);
  assert.equal(r4.score, 25);
  assert.equal(r4.band, 'RED');
});

test('getMaxHazardRisk dynamically returns highest risk from filled-up hazards', () => {
  const hazards = [
    { HazardDesc: 'Slip & Trip', RiskLevel: '2', Remarks: '[5x5 S=2, L=1, Score=2: LOW RISK]' },
    { HazardDesc: 'Flash Fire', RiskLevel: '16', Remarks: '[5x5 S=4, L=4, Score=16: CRITICAL RISK]' },
    { HazardDesc: 'Chemical Splash', RiskLevel: '9', Remarks: '[5x5 S=3, L=3, Score=9: HIGH RISK]' }
  ];

  const max = getMaxHazardRisk(hazards);
  assert.ok(max);
  assert.equal(max.score, 16);
  assert.equal(max.s, 4);
  assert.equal(max.l, 4);
  assert.equal(max.band, 'RED');

  // If hazards only have moderate risks
  const moderateHazards = [
    { HazardDesc: 'Dust inhalation', RiskLevel: '4', Remarks: '[5x5 S=2, L=2, Score=4: MODERATE RISK]' },
    { HazardDesc: 'Minor heat', RiskLevel: '2', Remarks: '[5x5 S=2, L=1, Score=2: LOW RISK]' }
  ];
  const modMax = getMaxHazardRisk(moderateHazards);
  assert.ok(modMax);
  assert.equal(modMax.score, 4);
  assert.equal(modMax.s, 2);
  assert.equal(modMax.l, 2);
  assert.equal(modMax.band, 'CYAN');
});

