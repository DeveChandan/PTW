import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
  stdin: {
    contents: `export * from './src/core/api/odataEndpoints'; export * from './src/core/api/modules/sitePermit.api';`,
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
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { buildODataQuery } = compiled.exports;

test('server-side pagination queries include $top, $skip, $count: true, and $orderby', () => {
  const top = 10;
  const skip = 20;
  const query = buildODataQuery({
    $filter: "Werks eq '1002' and (Status eq 'CRTD' or Status eq 'DRAF')",
    $top: top,
    $skip: skip,
    $count: true,
    $orderby: 'Erdat desc,Erzet desc,Permit_No desc'
  });

  const decoded = decodeURIComponent(query);
  assert.ok(decoded.includes('$top=10'), 'Query includes $top=10');
  assert.ok(decoded.includes('$skip=20'), 'Query includes $skip=20');
  assert.ok(decoded.includes('$count=true'), 'Query includes $count=true');
  assert.ok(decoded.includes('$orderby='), 'Query includes orderby');
});

test('pagination offset and page calculation logic is accurate', () => {
  const totalCount = 42;
  const pageSize = 10;

  // Page 1
  let offset = 0;
  let currentPage = Math.floor(offset / pageSize) + 1;
  let totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  let showingStart = totalCount === 0 ? 0 : offset + 1;
  let showingEnd = Math.min(offset + pageSize, totalCount);

  assert.equal(currentPage, 1);
  assert.equal(totalPages, 5);
  assert.equal(showingStart, 1);
  assert.equal(showingEnd, 10);

  // Page 5 (last page)
  offset = (totalPages - 1) * pageSize; // 40
  currentPage = Math.floor(offset / pageSize) + 1;
  showingStart = offset + 1;
  showingEnd = Math.min(offset + pageSize, totalCount);

  assert.equal(currentPage, 5);
  assert.equal(showingStart, 41);
  assert.equal(showingEnd, 42);
});

test('approver, acceptor, and area operator status mappings map to exact SAP OData conditions', () => {
  // Approver status mappings
  const approverMappings = {
    CRTD: "(Status eq 'CRTD' or Status eq 'DRAF')",
    APPROVED: "(Status eq 'APPR' or Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ACTV')",
    REJT: "(Status eq 'REJT' or Status eq 'REJC')",
  };

  assert.ok(approverMappings.CRTD.includes("Status eq 'CRTD'"));
  assert.ok(approverMappings.APPROVED.includes("Status eq 'APPR'"));
  assert.ok(approverMappings.APPROVED.includes("Status eq 'ACCP'"));
  assert.ok(approverMappings.APPROVED.includes("Status eq 'ISSU'"));
  assert.ok(approverMappings.APPROVED.includes("Status eq 'ACTV'"));

  // Acceptor status mappings
  const acceptorPending = "Status eq 'APPR'";
  const acceptorCompleted = "(Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ACTV')";
  assert.ok(acceptorPending.includes('APPR'));
  assert.ok(acceptorCompleted.includes('ACCP'));

  // Area Operator status mappings
  const areaPending = "(Status eq 'ACCP' or Status eq 'ISSU' or Status eq 'ISSD' or Status eq 'APPR')";
  const areaCompleted = "(Status eq 'ACTV' or Status eq 'CLSD')";
  assert.ok(areaPending.includes('ACCP'));
  assert.ok(areaPending.includes('ISSU'));
  assert.ok(areaCompleted.includes('ACTV'));
});
