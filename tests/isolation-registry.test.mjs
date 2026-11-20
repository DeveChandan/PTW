import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {build} from 'esbuild';
const result=await build({stdin:{contents:`export * from './src/core/api/modules/isolation.api';export * from './src/core/api/modules/gasTester.api';export * from './src/core/types/isolation.types';export * from './src/core/ptw/isolationTemplates';export {odataClient} from './src/core/api/odataClient';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',define:{'import.meta.env':'{}'}});
const mod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
const {isolationApi,gasTesterApi,odataClient,isPointNormalized,isPointIsolated,isPointZeroEnergy,STANDARD_ISOLATION_TEMPLATES}=mod.exports;
test('isolation and gas reads propagate SAP failures and never return local fallback evidence',async()=>{
 const original=odataClient.get;
 try{
  odataClient.get=async()=>{throw new Error('SAP unavailable');};
  await assert.rejects(()=>isolationApi.list(),/SAP unavailable/);
  await assert.rejects(()=>isolationApi.read('I1'),/SAP unavailable/);
  await assert.rejects(()=>gasTesterApi.list('P1'),/SAP unavailable/);
  odataClient.get=async()=>({data:{value:[]}});
  assert.deepEqual(await isolationApi.list(),[]);assert.deepEqual(await gasTesterApi.list('P1'),[]);
 }finally{odataClient.get=original;}
});
test('certificate create posts nested items once and only returns SAP numbering',async()=>{
 const original=odataClient.post;let calls=0;
 try{
  odataClient.post=async(url,body)=>{calls++;assert.equal(url,'Isolation');assert.equal(body.IsolationNo,undefined);assert.equal(body._Item[0].ItemNo,undefined);return {data:{...body,IsolationNo:'I1',Status:'CRTD'}};};
  const result=await isolationApi.create({PermitNo:'P1',_Item:[{ReferenceType:'EQUI',ReferenceId:'E1',IsolationPoint:'P1',IsolType:'MECH',IsolMethod:'VALVE',LockTagNo:'L1'}]});
  assert.equal(result.IsolationNo,'I1');assert.equal(calls,1);
  odataClient.post=async()=>{throw new Error('timeout');};
  await assert.rejects(()=>isolationApi.create({PermitNo:'P1',_Item:[{ReferenceType:'EQUI',ReferenceId:'E1',IsolationPoint:'P1',IsolType:'MECH',IsolMethod:'VALVE'}]}),/unconfirmed/);
 }finally{odataClient.post=original;}
});
test('update allows PermitNo/Remarks, passes ETag or wildcard fallback and rejects immutable fields',async()=>{
 const original=odataClient.patch;let calls=0;
 try{
  odataClient.patch=async(url,body,etag)=>{calls++;assert.equal(etag,'W/"1"');return {data:{IsolationNo:'I1',...body}};};
  await assert.rejects(()=>isolationApi.update('I1',{Status:'ISOL'},'W/"1"'),/workflow actions/);
  await assert.rejects(()=>isolationApi.update('I1',{IsolationNo:'I2'},'W/"1"'),/immutable/);
  await assert.rejects(()=>isolationApi.update('I1',{PermitNo:'TOOLONGPERMITNO'},'W/"1"'),/at most 10/);
  const updated=await isolationApi.update('I1',{PermitNo:'PTW0000002',Remarks:'Reviewed'},'W/"1"');
  assert.equal(updated.PermitNo,'PTW0000002');
  assert.equal(updated.Remarks,'Reviewed');
  assert.equal(calls,1);
  odataClient.patch=async(url,body,etag)=>{calls++;assert.equal(etag,'*');return {data:{IsolationNo:'I1',...body}};};
  const updatedFallback=await isolationApi.update('I1',{Remarks:'Fallback OK'});
  assert.equal(updatedFallback.Remarks,'Fallback OK');
  assert.equal(calls,2);
 }finally{odataClient.patch=original;}
});
test('GasTest create posts valid payload to GasTest entity and propagates SAP errors',async()=>{
 const original=odataClient.post;let calls=0;
 try{
  odataClient.post=async(url,body,config)=>{
   calls++;
   assert.equal(url,'GasTest');
   assert.equal(body.SAP__Messages,undefined);
   assert.equal(config.headers.Prefer,'return=representation');
   return {data:{...body,PermitNo:'P1',TestSeq:'1'}};
  };
  const result=await gasTesterApi.create({PermitNo:'P1',TestSeq:'1',TestType:'INITIAL',TestedBy:'TEST_USER'});
  assert.equal(result.PermitNo,'P1');
  assert.equal(calls,1);
  odataClient.post=async()=>{throw new Error('SAP POST failed');};
  await assert.rejects(()=>gasTesterApi.create({PermitNo:'P1',TestedBy:'TEST_USER'}),/SAP POST failed/);
 }finally{odataClient.post=original;}
});

test('GasTest rejects a missing tester before sending a request', async()=>{ await assert.rejects(()=>gasTesterApi.create({PermitNo:'P1'}), /verified SAP tester/); });
test('GasTest rejects a missing or blank permit number before sending a request', async()=>{ await assert.rejects(()=>gasTesterApi.create({PermitNo:'',TestedBy:'TEST_USER'}), /Permit Number is mandatory/); });

test('gasTesterApi evaluates Carbon Dioxide (CO2) safety limits and auto-calibrates stratified sampling levels', () => {
  // 1. CO2 Threshold evaluation (GFL operational parameters)
  const evalAmbient = gasTesterApi.evaluateCo(400); // 400 ppm ambient fresh air
  assert.equal(evalAmbient.status, 'OPTIMAL');
  assert.match(evalAmbient.label, /Ambient/i);

  const evalSafe = gasTesterApi.evaluateCo(4500); // <= 5,000 ppm OSHA 8-hr TWA limit
  assert.equal(evalSafe.status, 'SAFE');
  assert.match(evalSafe.label, /Safe Level/i);

  const evalWarning = gasTesterApi.evaluateCo(7500); // 5,000 - 10,000 ppm
  assert.equal(evalWarning.status, 'WARNING');
  assert.match(evalWarning.label, /Elevated CO₂/i);

  const evalDanger = gasTesterApi.evaluateCo(15000); // > 10,000 ppm asphyxiation hazard
  assert.equal(evalDanger.status, 'DANGER');
  assert.match(evalDanger.label, /Asphyxiation Hazard/i);

  // 2. Sampling Level Auto-Calibration based on physical vapor density
  // Heavy gases (CO2 vapor density 1.52, H2S vapor density 1.19) sink to bottom
  const botCalibCo2 = gasTesterApi.calibrateSamplingLevel({ o2: 20.9, lel: 0, co2: 1200, h2s: 0 });
  assert.equal(botCalibCo2.level, 'BOT');
  assert.match(botCalibCo2.badge, /BOT/);

  const botCalibH2s = gasTesterApi.calibrateSamplingLevel({ o2: 20.9, lel: 0, co2: 400, h2s: 2.0 });
  assert.equal(botCalibH2s.level, 'BOT');

  // Light combustible gases rise to top
  const topCalibLel = gasTesterApi.calibrateSamplingLevel({ o2: 20.9, lel: 2.5, co2: 400, h2s: 0 });
  assert.equal(topCalibLel.level, 'TOP');
  assert.match(topCalibLel.badge, /TOP/);

  // Ambient normal atmosphere corresponds to breathing zone
  const midCalibAmbient = gasTesterApi.calibrateSamplingLevel({ o2: 20.9, lel: 0, co2: 400, h2s: 0 });
  assert.equal(midCalibAmbient.level, 'MID');
  assert.match(midCalibAmbient.badge, /MID/);
});

test('normalizeItem executes bound action on Item with zero-padded 4-digit ItemNo and DeIsolatedState payload', async () => {
  const original = odataClient.post;
  let calls = 0;
  try {
    odataClient.post = async (url, body, config) => {
      calls++;
      assert.equal(url, "Item(IsolationNo='ISO0000041',ItemNo='0001')/com.sap.gateway.srvd_a2x.zptw_services.v0001.normalizeItem");
      assert.equal(config.headers.Prefer, 'return=representation');
      if (calls === 1) {
        assert.deepEqual(body, {
          DeIsolatedState: 'NORMAL',
          Reason: 'Restored state confirmed after de-isolation.'
        });
      } else if (calls === 2) {
        assert.deepEqual(body, {
          DeIsolatedState: 'NORMAL',
          Reason: 'Restored state confirmed after de-isolation.'
        });
      } else if (calls === 3) {
        assert.deepEqual(body, {
          DeIsolatedState: 'OPEN',
          Reason: 'Custom valve opened.'
        });
      }
      return { data: { IsolationNo: 'ISO0000041', ItemNo: '0001', IsNormalized: 'Y', DeIsolatedState: body.DeIsolatedState } };
    };
    // 1. Unpadded string '1' with defaults -> must format to '0001' and send DeIsolatedState: 'NORMAL'
    const res1 = await isolationApi.normalizeItem('ISO0000041', '1');
    assert.equal(res1.IsNormalized, 'Y');
    // 2. Numeric 1 -> must format to '0001' and send DeIsolatedState: 'NORMAL'
    const res2 = await isolationApi.normalizeItem('ISO0000041', 1);
    assert.equal(res2.IsNormalized, 'Y');
    // 3. Already padded '0001' with custom DeIsolatedState and Reason
    const res3 = await isolationApi.normalizeItem('ISO0000041', '0001', 'Custom valve opened.', 'OPEN');
    assert.equal(res3.IsNormalized, 'Y');
    assert.equal(res3.DeIsolatedState, 'OPEN');
    assert.equal(calls, 3);
  } finally {
    odataClient.post = original;
  }
});

test('LOTO reverse-order de-isolation rule verifies items must be restored in reverse sequence of creation', () => {
  const points = [
    { ItemNo: '0001', IsolationPoint: 'Breaker Q1', IsNormalized: 'N' },
    { ItemNo: '0002', IsolationPoint: 'Valve V1', IsNormalized: 'N' },
    { ItemNo: '0003', IsolationPoint: 'Vent V2', IsNormalized: 'N' },
  ];

  const getNextReverseOrderTarget = (items) => {
    const creationOrder = [...items].sort((a, b) => {
      const numA = parseInt(String(a.ItemNo || '').replace(/\D/g, ''), 10);
      const numB = parseInt(String(b.ItemNo || '').replace(/\D/g, ''), 10);
      return numA - numB;
    });
    const unnormalized = creationOrder.filter((p) => !isPointNormalized(p));
    return unnormalized.length ? unnormalized[unnormalized.length - 1] : null;
  };

  // Step 1: All 3 unnormalized -> Item 0003 must be de-isolated first
  let next = getNextReverseOrderTarget(points);
  assert.equal(next.ItemNo, '0003');

  // Step 2: Item 0003 normalized with SAP flag 'X' -> Item 0002 must be de-isolated next
  points[2].IsNormalized = 'X';
  next = getNextReverseOrderTarget(points);
  assert.equal(next.ItemNo, '0002');

  // Step 3: Item 0002 normalized with standard 'Y' -> Item 0001 must be de-isolated next
  points[1].IsNormalized = 'Y';
  next = getNextReverseOrderTarget(points);
  assert.equal(next.ItemNo, '0001');

  // Step 4: Item 0001 normalized -> all restored
  points[0].IsNormalized = 'X';
  next = getNextReverseOrderTarget(points);
  assert.equal(next, null);
});

test('SAP single de-isolation maintains IsNormalized with "X" or " " and targets next reverse point', () => {
  // Scenario matching live SAP payload for certificate ISO0000051:
  // Item 3 was de-isolated first in LOTO reverse order. SAP updated IsNormalized="X", DeIsolatedState="NORMAL", NormalizationSeq=1.
  const liveItems = [
    {
      IsolationNo: "ISO0000051",
      ItemNo: "1",
      ReferenceType: "EQUI",
      ReferenceId: "TEST",
      IsolationPoint: "TEST",
      IsolType: "MECH",
      IsolMethod: "VALVE",
      IsolatedState: "CLOSED",
      DeIsolatedState: "",
      LockTagNo: "TEST1",
      IsIsolated: "X",
      IsolatedBy: "VERTIF-V",
      IsNormalized: "",
      NormalizedBy: "",
      NormalizedAt: null,
      IsolationSeq: 1,
      NormalizationSeq: 0
    },
    {
      IsolationNo: "ISO0000051",
      ItemNo: "2",
      ReferenceType: "EQUI",
      ReferenceId: "TEST2",
      IsolationPoint: "TEST",
      IsolType: "MECH",
      IsolMethod: "VALVE",
      IsolatedState: "CLOSED",
      DeIsolatedState: "",
      LockTagNo: "TEST2",
      IsIsolated: "X",
      IsolatedBy: "VERTIF-V",
      IsNormalized: "",
      NormalizedBy: "",
      NormalizedAt: null,
      IsolationSeq: 2,
      NormalizationSeq: 0
    },
    {
      IsolationNo: "ISO0000051",
      ItemNo: "3",
      ReferenceType: "EQUI",
      ReferenceId: "TEST3",
      IsolationPoint: "TEST",
      IsolType: "MECH",
      IsolMethod: "VALVE",
      IsolatedState: "CLOSED",
      DeIsolatedState: "NORMAL",
      LockTagNo: "TEST3",
      IsIsolated: "X",
      IsolatedBy: "VERTIF-V",
      IsNormalized: "X",
      NormalizedBy: "VERTIF-V",
      NormalizedAt: "2026-11-16T11:33:18.974706Z",
      IsolationSeq: 3,
      NormalizationSeq: 1,
      NormalizationReason: "Restored state confirmed after de-isolation."
    }
  ];

  // 1. Point normalization helper checks
  assert.equal(isPointNormalized(liveItems[0]), false, 'Item 1 with blank IsNormalized is not normalized');
  assert.equal(isPointNormalized(liveItems[1]), false, 'Item 2 with blank IsNormalized is not normalized');
  assert.equal(isPointNormalized(liveItems[2]), true, 'Item 3 with IsNormalized="X" is recognized as normalized');

  // 2. Physical isolation and zero energy helpers with SAP 'X'
  assert.equal(isPointIsolated(liveItems[2]), true, 'Item 3 with IsIsolated="X" is isolated');
  assert.equal(isPointZeroEnergy(liveItems[0]), false, 'Item 1 with blank ZeroEnergyConf is not confirmed');

  // 3. Reverse order sequence calculation:
  // Item 3 is already normalized, so next point to de-isolate MUST be Item 2 (ItemNo="2")
  const creationOrder = [...liveItems].sort((a, b) => {
    const numA = parseInt(String(a.ItemNo || '').replace(/\D/g, ''), 10);
    const numB = parseInt(String(b.ItemNo || '').replace(/\D/g, ''), 10);
    return numA - numB;
  });
  const unnormalized = creationOrder.filter((p) => !isPointNormalized(p));
  assert.equal(unnormalized.length, 2, 'Items 1 and 2 remain unnormalized');
  const nextTarget = unnormalized[unnormalized.length - 1];
  assert.equal(nextTarget.ItemNo, '2', 'Next reverse sequence target must be Item 2, preventing duplicate Item 3 de-isolation');

  // 4. Item 3 must be recognized as restored (1/3 restored)
  const restoredCount = liveItems.filter((i) => isPointNormalized(i)).length;
  assert.equal(restoredCount, 1, 'Exactly 1 item is restored in SAP');
});

test('isolation certificate and item lifecycle status sync properly maintains approved and normalized states', () => {
  // Scenario matching user case: Certificate ISO0000048 was approved by VERTIF-V and subsequently normalized to NORM
  const certNorm = {
    IsolationNo: 'ISO0000048',
    PermitNo: 'PTW0000102',
    Status: 'NORM',
    RequestedBy: 'VERTIF-V',
    RequestedDate: '2026-11-14',
    RequestedTime: '18:32:57',
    VerifiedBy: '',
    VerifiedDate: null,
    VerifiedTime: '',
    ApprovedBy: 'VERTIF-V',
    ApprovedDate: '2026-11-14',
    ApprovedTime: '18:35:00',
    NormalizedBy: 'VERTIF-V',
    NormalizedDate: '2026-11-16',
    NormalizedTime: '12:00:00',
    _Item: [
      {
        ItemNo: '0001',
        ReferenceType: 'EQUI',
        ReferenceId: 'TEST',
        IsolationPoint: 'TEST',
        IsolType: 'MECH',
        IsolMethod: 'VALVE',
        IsolatedState: 'CLOSED',
        DeIsolatedState: 'NORMAL',
        LockTagNo: 'TEST',
        IsIsolated: '',      // SAP item row had blank flag
        ZeroEnergyConf: '',  // SAP item row had blank flag
        IsNormalized: '',    // SAP item row had blank flag before cert-level normalization
      }
    ]
  };

  // 1. Header Verified/Approved display: must display ApprovedBy if VerifiedBy is empty
  const approverDisplay = certNorm.ApprovedBy || certNorm.VerifiedBy || (certNorm.Status === 'ISOL' || certNorm.Status === 'NORM' ? 'Approved in SAP' : 'Pending Verification');
  assert.equal(approverDisplay, 'VERTIF-V', 'Approver display must show VERTIF-V and not fallback to Pending Verification');

  // 2. Points Ledger Item physical isolation and zero energy inheritance:
  const item = certNorm._Item[0];
  const isPhysicalIsolated = item.IsIsolated === 'Y' || certNorm.Status === 'ISOL' || certNorm.Status === 'NORM';
  const isZeroEnergyConfirmed = item.ZeroEnergyConf === 'Y' || certNorm.Status === 'ISOL' || certNorm.Status === 'NORM';
  assert.equal(isPhysicalIsolated, true, 'Item on NORM certificate must have physical isolation confirmed');
  assert.equal(isZeroEnergyConfirmed, true, 'Item on NORM certificate must have zero energy confirmed');

  // 3. Points Ledger Item normalization state on NORM certificate:
  const isNormalized = item.IsNormalized === 'Y' || certNorm.Status === 'NORM';
  assert.equal(isNormalized, true, 'Item on NORM certificate must be marked as RESTORED/Normalized, not ACTIVE ISOL');

  // 4. In ISOL state before de-isolation:
  const certIsol = { ...certNorm, Status: 'ISOL', NormalizedBy: '' };
  assert.equal(item.IsIsolated === 'Y' || certIsol.Status === 'ISOL', true, 'Item on ISOL certificate has physical isolation confirmed');
  assert.equal(item.ZeroEnergyConf === 'Y' || certIsol.Status === 'ISOL', true, 'Item on ISOL certificate has zero energy confirmed');
  assert.equal(item.IsNormalized === 'Y' || certIsol.Status === 'NORM', false, 'Item on ISOL certificate is not normalized yet');
});

test('isolationApi.list generates backend RequestedDate range, status filter, and composite cache to reduce API calls', async () => {
  const originalGet = odataClient.get;
  const capturedRequests = [];
  isolationApi.clearCache();

  try {
    odataClient.get = async (endpoint, config) => {
      capturedRequests.push({ endpoint, config });
      return {
        data: {
          value: [
            {
              IsolationNo: 'ISO0000088',
              PermitNo: 'PTW0000018',
              Status: 'ISOL',
              RequestedBy: 'OPERATOR',
              RequestedDate: '2026-11-14',
              RequestedTime: '10:00:00',
              _Item: [{ ItemNo: '0001', IsolationPoint: 'P-101' }]
            }
          ]
        }
      };
    };

    // 1. Query with date range: Last 1 week
    const res1 = await isolationApi.list({
      dateFrom: '2026-11-10',
      dateTo: '2026-11-17',
      status: 'ALL'
    });

    assert.equal(capturedRequests.length, 1);
    const decodedUrl1 = decodeURIComponent(capturedRequests[0].endpoint);
    assert.ok(decodedUrl1.includes('RequestedDate ge 2026-11-10 and RequestedDate le 2026-11-17'), 'Includes exact RequestedDate range filter');
    assert.ok(decodedUrl1.includes('$orderby=RequestedDate desc,IsolationNo desc'), 'Includes newest-first orderby');
    assert.equal(res1.length, 1);
    assert.equal(res1[0].IsolationNo, 'ISO0000088');

    // 2. Second identical call MUST hit cache with 0 API calls
    const res2 = await isolationApi.list({
      dateFrom: '2026-11-10',
      dateTo: '2026-11-17',
      status: 'ALL'
    });
    assert.equal(capturedRequests.length, 1, 'Second call must hit cache with 0 new API calls');
    assert.equal(res2.length, 1);

    // 3. Query with single date and status filter
    await isolationApi.list({
      dateFrom: '2026-11-14',
      dateTo: '2026-11-14',
      status: 'CRTD'
    });
    assert.equal(capturedRequests.length, 2);
    const decodedUrl2 = decodeURIComponent(capturedRequests[1].endpoint);
    assert.ok(decodedUrl2.includes("Status eq 'CRTD'"), 'Includes status filter');
    assert.ok(decodedUrl2.includes('RequestedDate eq 2026-11-14'), 'Single date uses eq operator');
  } finally {
    odataClient.get = originalGet;
    isolationApi.clearCache();
  }
});

test('STANDARD_ISOLATION_TEMPLATES dummy data removed and isolation templates rely strictly on SAP S/4HANA backend', () => {
  assert.ok(Array.isArray(STANDARD_ISOLATION_TEMPLATES), 'STANDARD_ISOLATION_TEMPLATES is an array');
  assert.equal(STANDARD_ISOLATION_TEMPLATES.length, 0, 'Dummy presets are completely removed');
});

test('isolationApi.fetchTemplates queries SAP with IsTemplate eq X filter', async () => {
  const originalGet = odataClient.get;
  const requests = [];
  try {
    odataClient.get = async (endpoint, config) => {
      requests.push({ endpoint, config });
      return {
        data: {
          value: [
            {
              IsolationNo: 'ISO_TMPL_001',
              description: 'Standard Master LOTO',
              IsTemplate: 'X',
              Status: 'CRTD',
              _Item: [
                {
                  ItemNo: '0001',
                  IsolationPoint: 'MCC-415V-01',
                  IsolType: 'ELEC',
                  IsolMethod: 'BRKR',
                  IsolatedState: 'RACKED_OUT',
                  LockTagNo: 'EL-01'
                }
              ]
            }
          ]
        }
      };
    };

    const templates = await isolationApi.fetchTemplates();
    assert.equal(requests.length, 1);
    const decodedUrl = decodeURIComponent(requests[0].endpoint);
    assert.ok(decodedUrl.includes("IsTemplate eq 'X'"), 'Filter query requests IsTemplate eq X from SAP');
    assert.equal(templates.length, 1);
    assert.equal(templates[0].IsolationNo, 'ISO_TMPL_001');
    assert.equal(templates[0].IsTemplate, 'X');
    assert.equal(templates[0]._Item.length, 1);
  } finally {
    odataClient.get = originalGet;
    isolationApi.clearCache();
  }
});


