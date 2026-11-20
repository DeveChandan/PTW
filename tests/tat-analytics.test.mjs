import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
  stdin: {
    contents: `
      export {
        parseSapDateTime,
        formatDurationMinutes,
        formatDurationSeconds,
        extractLocalTimeString,
        calculatePermitTat,
        calculateGranularPermitTat,
        calculateIsolationTat,
        convertSapToReportRecords,
        TAT_SLA_TARGETS
      } from './src/features/dashboard/reports/reportConstants';
      export {
        auditLogApi,
        isPermitAuditLog,
        isIsolationAuditLog,
        isIsolationItemAuditLog,
        isIsolationCertAuditLog
      } from './src/core/api/modules/auditLog.api';
      export { odataClient } from './src/core/api/odataClient';
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
new Function('require', 'module', 'exports', result.outputFiles[0].text)(
  createRequire(import.meta.url),
  compiled,
  compiled.exports
);

const {
  parseSapDateTime,
  formatDurationMinutes,
  formatDurationSeconds,
  extractLocalTimeString,
  calculatePermitTat,
  calculateGranularPermitTat,
  calculateIsolationTat,
  convertSapToReportRecords,
  TAT_SLA_TARGETS,
  auditLogApi,
  isPermitAuditLog,
  isIsolationAuditLog,
  isIsolationItemAuditLog,
  isIsolationCertAuditLog,
  odataClient
} = compiled.exports;

test('parseSapDateTime accurately parses SAP date and time in various formats', () => {
  // 1. Separate Edm.Date and Edm.TimeOfDay
  const d1 = parseSapDateTime('2026-11-16', '11:24:54');
  assert.ok(d1 instanceof Date);
  assert.equal(d1.getFullYear(), 2026);
  assert.equal(d1.getMonth(), 10); // November (0-indexed)
  assert.equal(d1.getDate(), 16);
  assert.equal(d1.getHours(), 11);
  assert.equal(d1.getMinutes(), 24);
  assert.equal(d1.getSeconds(), 54);

  // 2. Full ISO Timestamp with microseconds
  const d2 = parseSapDateTime('2026-11-16T12:11:24.647811Z');
  assert.ok(d2 instanceof Date);
  assert.equal(d2.toISOString(), '2026-11-16T12:11:24.647Z');

  // 3. Compact 6-digit time string (HHmmss)
  const d3 = parseSapDateTime('2026-11-16', '143000');
  assert.ok(d3 instanceof Date);
  assert.equal(d3.getHours(), 14);
  assert.equal(d3.getMinutes(), 30);

  // 4. Missing time defaults gracefully to 00:00:00
  const d4 = parseSapDateTime('2026-11-16');
  assert.ok(d4 instanceof Date);
  assert.equal(d4.getHours(), 0);
  assert.equal(d4.getMinutes(), 0);

  // 5. Invalid / null strings return null
  assert.equal(parseSapDateTime(null), null);
  assert.equal(parseSapDateTime(''), null);
});

test('formatDurationMinutes formats minute counts into clean human-readable durations', () => {
  assert.equal(formatDurationMinutes(undefined), '—');
  assert.equal(formatDurationMinutes(null), '—');
  assert.equal(formatDurationMinutes(-5), '—');
  assert.equal(formatDurationMinutes(0), '< 1 min');
  assert.equal(formatDurationMinutes(0.4), '< 1 min');
  assert.equal(formatDurationMinutes(18), '18m');
  assert.equal(formatDurationMinutes(59), '59m');
  assert.equal(formatDurationMinutes(60), '1h');
  assert.equal(formatDurationMinutes(90), '1h 30m');
  assert.equal(formatDurationMinutes(480), '8h');
  assert.equal(formatDurationMinutes(1440), '1d');
  assert.equal(formatDurationMinutes(1500), '1d 1h');
});

test('calculatePermitTat accurately computes step-by-step TAT for completed permit', () => {
  const mockPermit = {
    Permit_No: 'PTW0000100',
    PermitType: 'HOT',
    Status: 'CLSD',
    Ernam: 'VERTIF-V',
    Erdat: '2026-11-16',
    Erzet: '08:00:00', // Created at 08:00
    VerifiedDate: '2026-11-16',
    VerifiedTime: '08:18:00', // Verified after 18 mins (Creation TAT = 18m)
    ApprovedDate: '2026-11-16',
    ApprovedTime: '09:00:00', // Approved after 42 mins (Approval TAT = 42m)
    ValidFromD: '2026-11-16',
    ValidFromT: '09:00:00',
    ValidToD: '2026-11-16',
    ValidToT: '15:30:00', // Work execution = 6h 30m (390m)
    WorkCompleted: 'X',
    Aedat: '2026-11-16',
    Aezet: '15:55:00', // Closed after 25 mins (Closing TAT = 25m)
  };

  const tat = calculatePermitTat(mockPermit);

  assert.equal(tat.creationTatMin, 18);
  assert.equal(tat.creationTat, '18m');

  assert.equal(tat.approvalTatMin, 42);
  assert.equal(tat.approvalTat, '42m');

  assert.equal(tat.workTatMin, 390);
  assert.equal(tat.workTat, '6h 30m');

  assert.equal(tat.closingTatMin, 25);
  assert.equal(tat.closingTat, '25m');

  assert.equal(tat.totalTatMin, 18 + 42 + 390 + 25); // 475 mins = 7h 55m
  assert.equal(tat.totalTat, '7h 55m');

  assert.equal(tat.steps.length, 4);
  assert.equal(tat.bottleneckStepName, 'none');
  assert.equal(tat.overallPerformance, 'optimal');
});

test('calculatePermitTat identifies bottleneck when approval exceeds SLA benchmark', () => {
  const delayedPermit = {
    Permit_No: 'PTW0000101',
    PermitType: 'CSE',
    Status: 'APPR',
    Erdat: '2026-11-16',
    Erzet: '08:00:00',
    VerifiedDate: '2026-11-16',
    VerifiedTime: '08:15:00', // Creation = 15m (SLA <= 30m, OK)
    ApprovedDate: '2026-11-16',
    ApprovedTime: '11:45:00', // Approval took 3h 30m = 210m (SLA <= 120m, DELAY!)
    ValidFromD: '2026-11-16',
    ValidFromT: '11:45:00',
    ValidToD: '2026-11-16',
    ValidToT: '19:45:00',
  };

  const tat = calculatePermitTat(delayedPermit);

  assert.equal(tat.creationTatMin, 15);
  assert.equal(tat.approvalTatMin, 210);
  assert.equal(tat.approvalTat, '3h 30m');

  // Approval step flagged as bottleneck
  assert.equal(tat.bottleneckStepName, 'approval');
  assert.ok(tat.bottleneckReason?.includes('Multi-Tier Approvals exceeded target SLA'));
  assert.equal(tat.overallPerformance, 'critical'); // > 60m overrun
});

test('calculateIsolationTat computes zero-energy turnaround times', () => {
  const mockIso = {
    IsolationNo: 'ISO0000051',
    Status: 'NORM',
    RequestedDate: '2026-11-16',
    RequestedTime: '09:00:00',
    ApprovedDate: '2026-11-16',
    ApprovedTime: '09:20:00', // 20m verification
    NormalizedDate: '2026-11-16',
    NormalizedTime: '14:20:00',
    _Item: [
      {
        ItemNo: '1',
        IsolatedAt: '2026-11-16T09:30:00Z',
        NormalizedAt: '2026-11-16T14:00:00Z',
      }
    ]
  };

  const tat = calculateIsolationTat(mockIso);
  assert.ok(tat.creationTatMin >= 0);
  assert.ok(tat.approvalTatMin >= 0);
  assert.ok(tat.workTatMin >= 0);
  assert.equal(tat.steps.length, 4);
});

test('convertSapToReportRecords enriches permits and isolations with full TAT metrics', () => {
  const sapPermits = [
    {
      Permit_No: 'PTW0000099',
      PermitType: 'HOT',
      Status: 'ACTV',
      Erdat: '2026-11-16',
      Erzet: '07:30:00',
      ApprovedDate: '2026-11-16',
      ApprovedTime: '08:15:00',
      ValidFromD: '2026-11-16',
      ValidFromT: '08:30:00',
      ValidToD: '2026-11-16',
      ValidToT: '16:30:00',
      ExecDept: 'Mechanical Maintenance',
      AreaLoc: 'Chlor-Alkali Tank Farm',
      Werks: '1001',
      Tplnr: 'FL-01-CA',
      Auart: 'PM01',
      Aufnr: '4000123',
      Ktext: 'Overhaul Tank Pump P-101',
      Qmart: 'M2',
      Qmnum: '1000987',
      Qmtxt: 'Vibration detected',
      Equnr: 'EQ-9988',
    }
  ];

  const records = convertSapToReportRecords(sapPermits, []);

  assert.equal(records.length, 1);
  const r = records[0];
  assert.equal(r.permitNo, 'PTW0000099');
  assert.equal(r.werks, '1001');
  assert.equal(r.tplnr, 'FL-01-CA');
  assert.equal(r.auart, 'PM01');
  assert.equal(r.aufnr, '4000123');
  assert.equal(r.ktext, 'Overhaul Tank Pump P-101');
  assert.equal(r.qmart, 'M2');
  assert.equal(r.qmnum, '1000987');
  assert.equal(r.qmtxt, 'Vibration detected');
  assert.equal(r.equnr, 'EQ-9988');
  assert.ok(r.tat);
  assert.ok(typeof r.creationTat === 'string');
  assert.ok(typeof r.approvalTat === 'string');
  assert.ok(typeof r.workTat === 'string');
  assert.ok(typeof r.closingTat === 'string');
  assert.ok(typeof r.totalTat === 'string');
  assert.ok(typeof r.creationTatMin === 'number');
  assert.ok(typeof r.approvalTatMin === 'number');
  assert.ok(typeof r.totalTatMin === 'number');
  assert.equal(r.rawPermit?.Permit_No, 'PTW0000099');
  assert.ok(r.granularTat);
  assert.equal(r.granularTat.permitNo, 'PTW0000099');
});

test('formatDurationSeconds formats seconds and minutes correctly', () => {
  assert.equal(formatDurationSeconds(31, true), '31 seconds');
  assert.equal(formatDurationSeconds(31, false), '31s');
  assert.equal(formatDurationSeconds(10, true), '10 seconds');
  assert.equal(formatDurationSeconds(6, true), '6 seconds');
  assert.equal(formatDurationSeconds(11, true), '11 seconds');
  assert.equal(formatDurationSeconds(9, true), '9 seconds');
  assert.equal(formatDurationSeconds(67, true), '1 minute 7 seconds');
  assert.equal(formatDurationSeconds(67, false), '1m 7s');
});

test('calculateGranularPermitTat calculates exact sub-minute intervals from live SAP AuditLog matching user screen (31s, 10s, 6s, 11s, 9s -> 1m 7s)', () => {
  const auditPermit = {
    Permit_No: 'PTW0000106',
    PermitType: 'HOT',
    Status: 'ACTV',
    _AuditLog: [
      {
        Action: 'CREATE',
        EventAt: '2026-11-16T12:11:24.647811Z', // 17:41:24 IST
        StatusNew: 'INTD',
        Actor: 'VERTIF-V'
      },
      {
        Action: 'GAS_CREATE',
        EventAt: '2026-11-16T12:11:55.072938Z', // 17:41:55 IST
        StatusNew: 'CRTD',
        Actor: 'VERTIF-V'
      },
      {
        Action: 'APPR1',
        EventAt: '2026-11-16T12:12:05.241808Z', // 17:42:05 IST
        StatusNew: 'CRTD',
        Actor: 'VERTIF-V'
      },
      {
        Action: 'APPR2',
        EventAt: '2026-11-16T12:12:11.712324Z', // 17:42:11 IST
        StatusNew: 'APPR',
        Actor: 'VERTIF-V'
      },
      {
        Action: 'ACCEPTOR_APPROVE',
        EventAt: '2026-11-16T12:12:22.879234Z', // 17:42:22 IST
        StatusNew: 'ACCP',
        Actor: 'VERTIF-V'
      },
      {
        Action: 'AREA_OPERATOR_COMPLETE',
        EventAt: '2026-11-16T12:12:31.261689Z', // 17:42:31 IST
        StatusNew: 'ACTV',
        Actor: 'VERTIF-V'
      }
    ]
  };

  const tat = calculateGranularPermitTat(auditPermit);

  assert.equal(tat.permitNo, 'PTW0000106');
  assert.equal(tat.tat1Sec, 31);
  assert.equal(tat.tat1Formatted, '31 seconds');
  assert.equal(tat.tat1Rating, '🟢 Excellent');

  assert.equal(tat.tat2Sec, 10);
  assert.equal(tat.tat2Formatted, '10 seconds');
  assert.equal(tat.tat2Rating, '🟢 Excellent');

  assert.equal(tat.tat3Sec, 6);
  assert.equal(tat.tat3Formatted, '6 seconds');
  assert.equal(tat.tat3Rating, '🟢 Excellent');

  assert.equal(tat.tat4Sec, 11);
  assert.equal(tat.tat4Formatted, '11 seconds');
  assert.equal(tat.tat4Rating, '🟢 Excellent');

  assert.equal(tat.tat5Sec, 9);
  assert.equal(tat.tat5Formatted, '9 seconds');
  assert.equal(tat.tat5Rating, '🟢 Excellent');

  // Total Issuance TAT = 31 + 10 + 6 + 11 + 9 = 67 seconds = 1 minute 7 seconds
  assert.equal(tat.issuanceTatSec, 67);
  assert.equal(tat.issuanceTatFormatted, '1 minute 7 seconds');
  assert.equal(tat.issuanceRating, '🟢 Optimal');

  assert.equal(tat.steps.length, 5);
  assert.equal(tat.steps[0].durationFormatted, '31 seconds');
  assert.equal(tat.steps[1].durationFormatted, '10 seconds');
  assert.equal(tat.steps[2].durationFormatted, '6 seconds');
  assert.equal(tat.steps[3].durationFormatted, '11 seconds');
  assert.equal(tat.steps[4].durationFormatted, '9 seconds');
});

test('calculateGranularPermitTat accurately computes all 4 permit closing steps (C1, C2, C3, C4) and total closing TAT', () => {
  const closedPermit = {
    Permit_No: 'PTW0000108',
    PermitType: 'COLD',
    Status: 'CLSD',
    ValidToD: '2026-11-16',
    ValidToT: '18:15:00', // Work execution ends at 18:15:00
    _AuditLog: [
      {
        Action: 'CREATE',
        EventAt: '2026-11-16T12:00:00Z',
        StatusNew: 'INTD',
        Actor: 'ISSUER-1'
      },
      {
        Action: 'AREA_OPERATOR_COMPLETE',
        EventAt: '2026-11-16T12:05:00Z',
        StatusNew: 'ACTV',
        Actor: 'AREAOP-1'
      },
      // Closing Step C1: Work completed confirmed by Acceptor (+24s)
      {
        Action: 'WORK_COMPLETE',
        EventAt: '2026-11-16T12:45:24Z', // 18:15:24 IST -> 24 seconds from 18:15:00
        StatusNew: 'ACTV',
        Actor: 'ACCEPTOR-1'
      },
      // Closing Step C2: Acceptor closure sign-off (+25s)
      {
        Action: 'ACCL',
        EventAt: '2026-11-16T12:45:49Z', // 18:15:49 IST -> 25 seconds from 18:15:24
        StatusNew: 'ACCL',
        Actor: 'ACCEPTOR-1'
      },
      // Closing Step C3: Area Operator site inspection & de-isolation clearance (+40s)
      {
        Action: 'AROP',
        EventAt: '2026-11-16T12:46:29Z', // 18:16:29 IST -> 40 seconds from 18:15:49
        StatusNew: 'AROP',
        Actor: 'AREAOP-1'
      },
      // Closing Step C4: Final Issuer authorization & archival (+30s)
      {
        Action: 'CLOSE',
        EventAt: '2026-11-16T12:46:59Z', // 18:16:59 IST -> 30 seconds from 18:16:29
        StatusNew: 'CLSD',
        Actor: 'ISSUER-1'
      }
    ]
  };

  const tat = calculateGranularPermitTat(closedPermit);

  assert.equal(tat.permitNo, 'PTW0000108');
  assert.equal(tat.status, 'CLSD');

  // Step C1: Work Completion Confirmation
  assert.equal(tat.tatC1Sec, 24);
  assert.equal(tat.tatC1Formatted, '24 seconds');
  assert.equal(tat.tatC1Rating, '🟢 Excellent');

  // Step C2: Acceptor Handover (ACCL)
  assert.equal(tat.tatC2Sec, 25);
  assert.equal(tat.tatC2Formatted, '25 seconds');
  assert.equal(tat.tatC2Rating, '🟢 Excellent');

  // Step C3: Area Operator Site Clearance (AROP)
  assert.equal(tat.tatC3Sec, 40);
  assert.equal(tat.tatC3Formatted, '40 seconds');
  assert.equal(tat.tatC3Rating, '🟢 Excellent');

  // Step C4: Issuer Final Closure & Archival (CLSD)
  assert.equal(tat.tatC4Sec, 30);
  assert.equal(tat.tatC4Formatted, '30 seconds');
  assert.equal(tat.tatC4Rating, '🟢 Excellent');

  // Total Closing TAT = 24 + 25 + 40 + 30 = 119 seconds = 1 minute 59 seconds
  assert.equal(tat.closingTatSec, 119);
  assert.equal(tat.closingTatFormatted, '1 minute 59 seconds');
  assert.equal(tat.closingRating, '🟢 Optimal');

  // Verify Closing Steps array
  assert.equal(tat.closingSteps.length, 4);
  assert.equal(tat.closingSteps[0].id, 'tat_c1_work_complete');
  assert.equal(tat.closingSteps[0].durationFormatted, '24 seconds');
  assert.equal(tat.closingSteps[1].id, 'tat_c2_accl');
  assert.equal(tat.closingSteps[1].durationFormatted, '25 seconds');
  assert.equal(tat.closingSteps[2].id, 'tat_c3_arop');
  assert.equal(tat.closingSteps[2].durationFormatted, '40 seconds');
  assert.equal(tat.closingSteps[3].id, 'tat_c4_clsd');
  assert.equal(tat.closingSteps[3].durationFormatted, '30 seconds');

  // Full lifecycle contains 5 issuance + 4 closing = 9 steps
  assert.equal(tat.allLifecycleSteps.length, 9);
});

test('auditLogApi caches results to optimize API calls and prevent redundant network traffic', async () => {
  auditLogApi.clearCache();

  // First call caches empty or live result
  const res1 = await auditLogApi.getAuditLogs('PTW0000999');
  assert.ok(Array.isArray(res1));

  // Second call returns immediately from in-memory cache without repeating HTTP calls
  const res2 = await auditLogApi.getAuditLogs('PTW0000999');
  assert.equal(res1, res2, 'Second call must return strictly identical cached reference');

  // Clear cache and verify fresh state
  auditLogApi.clearCache();
});

test('calculateGranularPermitTat supports updated ZPTW_AUDIT_LOG actions (ACCEPTOR_CLOSE, AREA_OPERATOR_CLOSE, ISSUER_CLOSE)', () => {
  const permitWithUpdatedActions = {
    Permit_No: 'PTW0000104',
    PermitType: 'HOT',
    Status: 'CLSD',
    ValidToD: '2026-11-17',
    ValidToT: '10:00:00',
    _AuditLog: [
      {
        AuditId: '025C0C2FEE661FE1B4D6795455BDE994',
        ObjectType: 'PERMIT',
        ObjectId: 'PTW0000104',
        PermitNo: 'PTW0000104',
        Action: 'CREATE',
        NewStatus: 'INTD',
        Actor: 'USER_ISSU',
        EventAt: '2026-11-17T04:00:00Z',
        Comments: 'Permit created'
      },
      {
        AuditId: '025C0C2FEE661FE1B4D6795455BDE995',
        ObjectType: 'PERMIT',
        ObjectId: 'PTW0000104',
        PermitNo: 'PTW0000104',
        Action: 'WORK_COMPLETE',
        NewStatus: 'ACTV',
        Actor: 'USER_ACCP',
        EventAt: '2026-11-17T04:30:20Z',
        Comments: 'Work completed and site cleaned'
      },
      {
        AuditId: '025C0C2FEE661FE1B4D6795455BDE996',
        ObjectType: 'PERMIT',
        ObjectId: 'PTW0000104',
        PermitNo: 'PTW0000104',
        Action: 'ACCEPTOR_CLOSE',
        NewStatus: 'ACCL',
        Actor: 'USER_ACCP',
        EventAt: '2026-11-17T04:30:50Z',
        Comments: 'Acceptor closure completed'
      },
      {
        AuditId: '025C0C2FEE661FE1B4D6795455BDE997',
        ObjectType: 'PERMIT',
        ObjectId: 'PTW0000104',
        PermitNo: 'PTW0000104',
        Action: 'AREA_OPERATOR_CLOSE',
        NewStatus: 'AROP',
        Actor: 'USER_AREA',
        EventAt: '2026-11-17T04:31:35Z',
        Comments: 'Area checked and restored'
      },
      {
        AuditId: '025C0C2FEE661FE1B4D6795455BDE998',
        ObjectType: 'PERMIT',
        ObjectId: 'PTW0000104',
        PermitNo: 'PTW0000104',
        Action: 'ISSUER_CLOSE',
        NewStatus: 'CLSD',
        Actor: 'USER_ISSU',
        EventAt: '2026-11-17T04:32:05Z',
        Comments: 'Permit formally closed'
      }
    ]
  };

  const tat = calculateGranularPermitTat(permitWithUpdatedActions);
  assert.equal(tat.permitNo, 'PTW0000104');
  assert.equal(tat.tatC2Sec, 30); // from 04:30:20 to 04:30:50 = 30 seconds
  assert.equal(tat.tatC3Sec, 45); // from 04:30:50 to 04:31:35 = 45 seconds
  assert.equal(tat.tatC4Sec, 30); // from 04:31:35 to 04:32:05 = 30 seconds
  assert.equal(tat.closingTatSec, 125); // 20 + 30 + 45 + 30 = 125s
});

test('auditLogApi supports getAuditLogsByObject for isolation entities', async () => {
  auditLogApi.clearCache();
  const res = await auditLogApi.getAuditLogsByObject('ISO0000051', 'ISOLATION');
  assert.ok(Array.isArray(res));
  auditLogApi.clearCache();
});

test('auditLogApi.getAuditLogsForIsolation fetches, deduplicates, correlates permit events and caches isolation audit records', async () => {
  auditLogApi.clearCache();
  const originalGet = odataClient.get;
  const capturedEndpoints = [];

  try {
    odataClient.get = async (endpoint) => {
      capturedEndpoints.push(decodeURIComponent(endpoint));
      if (endpoint.includes('ISO0000051')) {
        return {
          data: {
            value: [
              {
                AuditId: 'AUD_ISO_01',
                ObjectType: 'ISOLATION',
                ObjectId: 'ISO0000051',
                PermitNo: 'PTW0000104',
                Action: 'CREATE',
                NewStatus: 'CRTD',
                Actor: 'USER_ISSU',
                EventAt: '2026-11-17T10:00:00.000Z',
                Comments: 'Isolation certificate created'
              },
              {
                AuditId: 'AUD_ISO_02',
                ObjectType: 'ISOLATION',
                ObjectId: 'ISO0000051',
                PermitNo: 'PTW0000104',
                Action: 'APPROVE',
                NewStatus: 'ISOL',
                Actor: 'USER_APPR3',
                EventAt: '2026-11-17T11:00:00.000Z',
                Comments: 'Isolation approved'
              },
              {
                AuditId: 'AUD_ISO_03',
                ObjectType: 'ISOL_ITEM',
                ObjectId: 'ISO0000051/1',
                PermitNo: 'PTW0000104',
                Action: 'NORMALIZE_ITEM',
                NewStatus: '',
                Actor: 'USER_ISSU',
                EventAt: '2026-11-17T15:00:00.000Z',
                Comments: 'Item 1 restored to NORMAL; normalization sequence 1'
              }
            ]
          }
        };
      }
      return { data: { value: [] } };
    };

    const logs = await auditLogApi.getAuditLogsForIsolation('ISO0000051', 'PTW0000104');
    assert.equal(logs.length, 3);
    // Verified newest first sorting (EventAt: 15:00 > 11:00 > 10:00)
    assert.equal(logs[0].AuditId, 'AUD_ISO_03');
    assert.equal(logs[0].ObjectType, 'ISOL_ITEM');
    assert.equal(logs[0].ObjectId, 'ISO0000051/1');
    assert.equal(logs[1].AuditId, 'AUD_ISO_02');
    assert.equal(logs[1].Action, 'APPROVE');
    assert.equal(logs[2].AuditId, 'AUD_ISO_01');
    assert.equal(logs[2].Action, 'CREATE');

    // Caching check: second call with forceRefresh = false should return cached data with 0 extra calls
    const initialCallCount = capturedEndpoints.length;
    const cachedLogs = await auditLogApi.getAuditLogsForIsolation('ISO0000051', 'PTW0000104', undefined, false);
    assert.equal(capturedEndpoints.length, initialCallCount, 'Cache hit must not perform new network calls');
    assert.equal(cachedLogs.length, 3);

    // Force refresh check: should query again
    await auditLogApi.getAuditLogsForIsolation('ISO0000051', 'PTW0000104', undefined, true);
    assert.ok(capturedEndpoints.length > initialCallCount, 'forceRefresh must query SAP Gateway');
  } finally {
    odataClient.get = originalGet;
    auditLogApi.clearCache();
  }
});

test('Audit log classification accurately separates Permit No vs Isolation No vs Isolation No+Item No', () => {
  const permitEvent = {
    AuditId: 'A1',
    ObjectType: 'PERMIT',
    ObjectId: 'PTW0000104',
    PermitNo: 'PTW0000104',
    Action: 'CREATE'
  };

  const isoCertEvent = {
    AuditId: 'A2',
    ObjectType: 'ISOLATION',
    ObjectId: 'ISO0000051',
    PermitNo: 'PTW0000104',
    Action: 'APPROVE'
  };

  const isoItemEvent = {
    AuditId: 'A3',
    ObjectType: 'ISOL_ITEM',
    ObjectId: 'ISO0000051/1',
    PermitNo: 'PTW0000104',
    Action: 'NORMALIZE_ITEM'
  };

  // 1. Permit Event check
  assert.equal(isPermitAuditLog(permitEvent, 'PTW0000104'), true);
  assert.equal(isIsolationAuditLog(permitEvent), false);
  assert.equal(isIsolationCertAuditLog(permitEvent), false);
  assert.equal(isIsolationItemAuditLog(permitEvent), false);

  // 2. Isolation Certificate Event check
  assert.equal(isPermitAuditLog(isoCertEvent, 'PTW0000104'), false);
  assert.equal(isIsolationAuditLog(isoCertEvent), true);
  assert.equal(isIsolationCertAuditLog(isoCertEvent), true);
  assert.equal(isIsolationItemAuditLog(isoCertEvent), false);

  // 3. Isolation Point / Item Event check
  assert.equal(isPermitAuditLog(isoItemEvent, 'PTW0000104'), false);
  assert.equal(isIsolationAuditLog(isoItemEvent), true);
  assert.equal(isIsolationCertAuditLog(isoItemEvent), false);
  assert.equal(isIsolationItemAuditLog(isoItemEvent), true);

  // 4. Dataset filtering simulation: 11 mixed records matching user sample
  const mixedLog = [
    { AuditId: 'P1', ObjectType: 'PERMIT', ObjectId: 'PTW0000104', Action: 'CREATE' },
    { AuditId: 'P2', ObjectType: 'PERMIT', ObjectId: 'PTW0000104', Action: 'WORK_COMPLETE' },
    { AuditId: 'P3', ObjectType: 'PERMIT', ObjectId: 'PTW0000104', Action: 'ACCEPTOR_CLOSE' },
    { AuditId: 'P4', ObjectType: 'PERMIT', ObjectId: 'PTW0000104', Action: 'AREA_OPERATOR_CLOSE' },
    { AuditId: 'P5', ObjectType: 'PERMIT', ObjectId: 'PTW0000104', Action: 'ISSUER_CLOSE' },
    { AuditId: 'I1', ObjectType: 'ISOLATION', ObjectId: 'ISO0000051', Action: 'CREATE' },
    { AuditId: 'I2', ObjectType: 'ISOLATION', ObjectId: 'ISO0000051', Action: 'APPROVE' },
    { AuditId: 'I3', ObjectType: 'ISOL_ITEM', ObjectId: 'ISO0000051/3', Action: 'NORMALIZE_ITEM' },
    { AuditId: 'I4', ObjectType: 'ISOL_ITEM', ObjectId: 'ISO0000051/2', Action: 'NORMALIZE_ITEM' },
    { AuditId: 'I5', ObjectType: 'ISOL_ITEM', ObjectId: 'ISO0000051/1', Action: 'NORMALIZE_ITEM' },
    { AuditId: 'I6', ObjectType: 'ISOLATION', ObjectId: 'ISO0000051', Action: 'NORMALIZE' }
  ];

  const permits = mixedLog.filter((l) => isPermitAuditLog(l, 'PTW0000104'));
  const isolations = mixedLog.filter((l) => isIsolationAuditLog(l));
  const isoCerts = isolations.filter((l) => isIsolationCertAuditLog(l));
  const isoItems = isolations.filter((l) => isIsolationItemAuditLog(l));

  assert.equal(permits.length, 5, 'Exact 5 permit events separated');
  assert.equal(isolations.length, 6, 'Exact 6 isolation events separated');
  assert.equal(isoCerts.length, 3, 'Exact 3 isolation certificate events separated');
  assert.equal(isoItems.length, 3, 'Exact 3 isolation item normalization events separated');
});
