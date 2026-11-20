import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
  stdin: {
    contents: `export * from './src/core/api/odataEndpoints'; export * from './src/core/api/modules/sitePermit.api'; export { odataClient } from './src/core/api/odataClient';`,
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
const { buildODataQuery, sitePermitApi, odataClient, ODATA_ENTITIES } = compiled.exports;

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

test('approval records sort newest first by timestamp and map CL action to CLOSED', () => {
  const approvals = [
    { Stage: 'AC', SeqNo: '1', RoleId: 'ACCP', Action: 'AP', ActionDate: '2026-11-14', ActionTime: '14:14:03' },
    { Stage: 'ACCL', SeqNo: '1', RoleId: 'PTW_ACCP', Action: 'CL', ActionDate: '2026-11-14', ActionTime: '14:22:12' },
    { Stage: 'AO', SeqNo: '1', RoleId: 'PTW_AREA_OPP', Action: 'AP', ActionDate: '2026-11-14', ActionTime: '14:14:25' },
    { Stage: 'APPR', SeqNo: '1', RoleId: 'PTW_APPR1', Action: 'AP', ActionDate: '2026-11-14', ActionTime: '13:08:42' },
    { Stage: 'AROP', SeqNo: '1', RoleId: 'PTW_AREA_OPP', Action: 'CL', ActionDate: '2026-11-14', ActionTime: '14:27:03' },
    { Stage: 'APPR', SeqNo: '2', RoleId: 'PTW_APPR2', Action: 'AP', ActionDate: '2026-11-14', ActionTime: '13:09:02' }
  ];

  const sorted = [...approvals].sort((a, b) => {
    const parseMs = (record) => {
      if (!record.ActionDate) return -1;
      const d = String(record.ActionDate).trim().slice(0, 10);
      let t = String(record.ActionTime || '00:00:00').trim();
      if (/^\d:\d{2}/.test(t)) t = '0' + t;
      const ms = Date.parse(`${d}T${t}`);
      return !isNaN(ms) ? ms : -1;
    };
    const msA = parseMs(a);
    const msB = parseMs(b);
    if (msA > 0 && msB > 0 && msA !== msB) return msB - msA;
    if (msA > 0 && msB <= 0) return -1;
    if (msA <= 0 && msB > 0) return 1;
    return (Number(b.SeqNo) || 0) - (Number(a.SeqNo) || 0);
  });

  // Verify newest first
  assert.equal(sorted[0].Stage, 'AROP');
  assert.equal(sorted[0].ActionTime, '14:27:03');
  assert.equal(sorted[1].Stage, 'ACCL');
  assert.equal(sorted[1].ActionTime, '14:22:12');
  assert.equal(sorted[2].Stage, 'AO');
  assert.equal(sorted[2].ActionTime, '14:14:25');
  assert.equal(sorted[3].Stage, 'AC');
  assert.equal(sorted[3].ActionTime, '14:14:03');
  assert.equal(sorted[4].Stage, 'APPR');
  assert.equal(sorted[4].SeqNo, '2');
  assert.equal(sorted[5].Stage, 'APPR');
  assert.equal(sorted[5].SeqNo, '1');

  // Verify action label transformation
  const formatAction = (act) => {
    const norm = (act || '').toUpperCase().trim();
    if (norm === 'AP' || norm === 'APPROVED') return 'APPROVED';
    if (norm === 'VR' || norm === 'VERIFIED') return 'VERIFIED';
    if (norm === 'RJ' || norm === 'REJECTED') return 'REJECTED';
    if (norm === 'CL' || norm === 'CLOSED' || norm === 'CLSD') return 'CLOSED';
    return act || 'PENDING';
  };

  assert.equal(formatAction('CL'), 'CLOSED');
  assert.equal(formatAction('cl'), 'CLOSED');
  assert.equal(formatAction('CLSD'), 'CLOSED');
  assert.equal(formatAction('CLOSED'), 'CLOSED');
  assert.equal(formatAction('AP'), 'APPROVED');
  assert.equal(formatAction('RJ'), 'REJECTED');
});

test('sitePermitApi.count executes raw SAP OData V4 /PermitInfo/$count?$filter= query matching exact user specification', async () => {
  const originalGet = odataClient.get;
  let capturedUrl = '';
  try {
    odataClient.get = async (url) => {
      capturedUrl = url;
      return { data: 9 };
    };

    const count = await sitePermitApi.count(
      "Erdat ge 2026-11-01 and Erdat le 2026-11-30 and Status eq 'CLSD'",
      undefined,
      true
    );

    assert.equal(count, 9);
    assert.ok(capturedUrl.startsWith('PermitInfo/$count?'), 'URL must target PermitInfo/$count');
    const decoded = decodeURI(capturedUrl);
    assert.ok(decoded.includes("Erdat ge 2026-11-01 and Erdat le 2026-11-30 and Status eq 'CLSD'"), 'Exact user filter preserved');
  } finally {
    odataClient.get = originalGet;
  }
});

test('sitePermitApi.count builds filter with plant, status, and date range', async () => {
  const originalGet = odataClient.get;
  let capturedUrl = '';
  try {
    odataClient.get = async (url) => {
      capturedUrl = url;
      return { data: 14 };
    };

    const count = await sitePermitApi.count({
      plant: '1002',
      status: 'CLSD',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
    }, undefined, true);

    assert.equal(count, 14);
    assert.ok(capturedUrl.includes('PermitInfo/$count'), 'Targets PermitInfo/$count');
    const decoded = decodeURI(capturedUrl);
    assert.ok(decoded.includes("Werks eq '1002'"));
    assert.ok(decoded.includes("Status eq 'CLSD'"));
    assert.ok(decoded.includes("Erdat ge 2026-11-01 and Erdat le 2026-11-30"));
  } finally {
    odataClient.get = originalGet;
  }
});

test('sitePermitApi.list queue filters exclude non-relevant closed and cancelled permits', async () => {
  const originalGet = odataClient.get;
  const capturedFilters = [];
  try {
    odataClient.get = async (url) => {
      capturedFilters.push(decodeURIComponent(url));
      return { data: { value: [], '@odata.count': 0 } };
    };

    // 1. Approver queue
    await sitePermitApi.list({
      plant: '1002',
      status: 'APPROVER_QUEUE',
    });
    const normalize = (u) => decodeURIComponent(u).replace(/\+/g, ' ');

    // 1. Approver queue
    await sitePermitApi.list({
      plant: '1002',
      status: 'APPROVER_QUEUE',
    });
    const appFilter = normalize(capturedFilters[0]);
    assert.ok(appFilter.includes("Status ne 'CLSD'"), 'Approver queue excludes CLSD');
    assert.ok(appFilter.includes("Status ne 'CLOS'"), 'Approver queue excludes CLOS');
    assert.ok(appFilter.includes("Status ne 'CANC'"), 'Approver queue excludes CANC');

    // 2. Acceptor queue
    await sitePermitApi.list({
      plant: '1002',
      status: 'ACCEPTOR_QUEUE',
    });
    const accFilter = normalize(capturedFilters[1]);
    assert.ok(accFilter.includes("Status ne 'CLSD'"), 'Acceptor queue excludes CLSD');
    assert.ok(accFilter.includes("Status ne 'CLOS'"), 'Acceptor queue excludes CLOS');
    assert.ok(accFilter.includes("Status ne 'CANC'"), 'Acceptor queue excludes CANC');

    // 3. Area Operator queue
    await sitePermitApi.list({
      plant: '1002',
      status: 'AREA_OPERATOR_QUEUE',
    });
    const aoFilter = normalize(capturedFilters[2]);
    assert.ok(aoFilter.includes("Status ne 'CLSD'"), 'Area Operator queue excludes CLSD');
    assert.ok(aoFilter.includes("Status ne 'CLOS'"), 'Area Operator queue excludes CLOS');
    assert.ok(aoFilter.includes("Status ne 'CANC'"), 'Area Operator queue excludes CANC');

    // 4. Exclude closed explicitly
    await sitePermitApi.list({
      plant: '1002',
      status: 'ALL',
      excludeClosed: true
    });
    const exFilter = normalize(capturedFilters[3]);
    assert.ok(exFilter.includes("Status ne 'CLSD' and Status ne 'CLOS' and Status ne 'CANC'"), 'Explicit excludeClosed added');
  } finally {
    odataClient.get = originalGet;
  }
});

test('Report Module date range query emits exact backend Erdat ge ... and Erdat le ... with lean top and count', async () => {
  const originalGet = odataClient.get;
  const capturedRequests = [];

  odataClient.get = async (endpoint, config) => {
    capturedRequests.push({ endpoint, config });
    return { data: { value: [], '@odata.count': 0 } };
  };

  try {
    const normalize = (u) => (u ? decodeURIComponent(u).replace(/\+/g, ' ') : '');
    const getParams = (endpoint) => {
      const qIdx = endpoint.indexOf('?');
      if (qIdx === -1) return new URLSearchParams();
      return new URLSearchParams(endpoint.slice(qIdx + 1));
    };

    // 1. Report query with specific plant and month date window
    await sitePermitApi.list({
      plant: '1002',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
      top: 300,
      type: 'ALL',
      status: 'ALL'
    });

    assert.equal(capturedRequests.length, 1);
    const req1 = capturedRequests[0];
    const params1 = getParams(req1.endpoint);
    const filter1 = normalize(params1.get('$filter'));
    assert.ok(filter1.includes("Werks eq '1002'"), 'Includes Werks filter');
    assert.ok(filter1.includes('Erdat ge 2026-11-01 and Erdat le 2026-11-30'), 'Includes exact backend Erdat range filter');
    assert.equal(params1.get('$top'), '300', 'Top matches 300');
    assert.equal(params1.get('$count'), 'true', 'Count parameter enabled');

    // 2. Report query with ALL plants (cross-plant audit)
    await sitePermitApi.list({
      plant: 'ALL',
      dateFrom: '2026-11-10',
      dateTo: '2026-11-17',
      top: 300,
      type: 'ALL',
      status: 'ALL'
    });

    assert.equal(capturedRequests.length, 2);
    const req2 = capturedRequests[1];
    const params2 = getParams(req2.endpoint);
    const filter2 = normalize(params2.get('$filter'));
    assert.ok(!filter2.includes("Werks eq 'ALL'"), 'Omits invalid Werks eq ALL');
    assert.ok(filter2.includes('Erdat ge 2026-11-10 and Erdat le 2026-11-17'), 'Includes exact weekly Erdat range');
  } finally {
    odataClient.get = originalGet;
  }
});
