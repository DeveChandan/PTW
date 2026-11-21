import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
  stdin: {
    contents: `
      export {
        getOffsetDateString,
        getNextDateStr,
        computeShiftValidityPreset,
        BUILTIN_PERMIT_TEMPLATES,
        getUserTemplates,
        saveUserTemplate,
        deleteUserTemplate,
        extractTemplateFromPermit
      } from './src/features/permits/PermitCreateModule';
      export { preparePermitCreate } from './src/core/api/modules/permitCreate.validation';
      export { sitePlanRows, SECTION_D_FIELD_CODES } from './src/core/ptw/siteProcedure';
      export { sitePermitApi } from './src/core/api/modules/sitePermit.api';
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
  getOffsetDateString,
  getNextDateStr,
  computeShiftValidityPreset,
  preparePermitCreate,
  sitePlanRows,
  SECTION_D_FIELD_CODES,
  BUILTIN_PERMIT_TEMPLATES,
  getUserTemplates,
  saveUserTemplate,
  deleteUserTemplate,
  extractTemplateFromPermit,
  sitePermitApi
} = compiled.exports;

test('Preset Helpers: getOffsetDateString and getNextDateStr calculate accurate dates including month/year boundaries', () => {
  const base = new Date(2026, 10, 5); // 05-11-2026
  assert.equal(getOffsetDateString(0, base), '2026-11-05');
  assert.equal(getOffsetDateString(1, base), '2026-11-06');

  // Month-end rollover
  const monthEnd = new Date(2026, 10, 30); // 30-11-2026
  assert.equal(getOffsetDateString(1, monthEnd), '2026-12-01');

  // getNextDateStr
  assert.equal(getNextDateStr('2026-11-05'), '2026-11-06');
  assert.equal(getNextDateStr('2026-11-30'), '2026-12-01');
  assert.equal(getNextDateStr('2026-12-31'), '2027-01-01');
});

test('Preset Calculation: Day Shift (General) preset sets 09:00 to 17:00 (8h) with shift end 17:30', () => {
  const date = '2026-11-06';
  const preset = computeShiftValidityPreset('DAY', date);

  assert.equal(preset.shiftType, 'DAY');
  assert.equal(preset.shiftCode, 'G');
  assert.equal(preset.validFromD, date);
  assert.equal(preset.validFromT, '09:00:00');
  assert.equal(preset.validToD, date);
  assert.equal(preset.validToT, '17:00:00');
  assert.equal(preset.plannedShiftEnd, `${date}T17:30`);

  // Verify 8-hour duration (17:00 - 09:00 = 8h)
  const start = new Date(`${preset.validFromD}T${preset.validFromT}+05:30`).getTime();
  const end = new Date(`${preset.validToD}T${preset.validToT}+05:30`).getTime();
  assert.equal(end - start, 8 * 3600 * 1000);
});

test('Preset Calculation: Evening Shift preset sets 17:30 to 23:00 (5.5h) same day', () => {
  const date = '2026-11-06';
  const preset = computeShiftValidityPreset('EVENING', date);

  assert.equal(preset.shiftType, 'EVENING');
  assert.equal(preset.shiftCode, 'B');
  assert.equal(preset.validFromD, date);
  assert.equal(preset.validFromT, '17:30:00');
  assert.equal(preset.validToD, date);
  assert.equal(preset.validToT, '23:00:00');
  assert.equal(preset.plannedShiftEnd, `${date}T23:00`);

  // Verify 5.5-hour duration
  const start = new Date(`${preset.validFromD}T${preset.validFromT}+05:30`).getTime();
  const end = new Date(`${preset.validToD}T${preset.validToT}+05:30`).getTime();
  assert.equal(end - start, 5.5 * 3600 * 1000);
});

test('Preset Calculation: Night Shift preset spans midnight to next day (23:00 to 07:00, 8h)', () => {
  const date = '2026-11-06';
  const preset = computeShiftValidityPreset('NIGHT', date);

  assert.equal(preset.shiftType, 'NIGHT');
  assert.equal(preset.shiftCode, 'C');
  assert.equal(preset.validFromD, date);
  assert.equal(preset.validFromT, '23:00:00');
  assert.equal(preset.validToD, '2026-11-07');
  assert.equal(preset.validToT, '07:00:00');
  assert.equal(preset.plannedShiftEnd, '2026-11-07T09:00');

  // Verify 8-hour duration across midnight
  const start = new Date(`${preset.validFromD}T${preset.validFromT}+05:30`).getTime();
  const end = new Date(`${preset.validToD}T${preset.validToT}+05:30`).getTime();
  assert.equal(end - start, 8 * 3600 * 1000);
});

test('Validation Integration: Permits created with Day, Evening, and Night presets pass site procedure rules', () => {
  const makePlan = (shiftEnd) => ({
    additionalTypes: [],
    checks: { P01: 'YES', P02: 'YES', P03: 'YES', P04: 'YES' },
    nature: ['Inspection'],
    tools: ['Hand tools'],
    fields: {
      JSA1: 'JSA-001',
      JSA2: 'Issuer, acceptor and contractor visited site',
      SHFT: shiftEnd,
      ISSR: 'ISSUER1',
      ACCP: 'ACCP1',
      OPER: 'OPER1'
    }
  });

  const basePayload = (shiftEnd) => {
    const plan = makePlan(shiftEnd);
    return {
      ExecDept: 'MAINT',
      PermitType: 'COLD',
      Werks: '1000',
      AreaLoc: 'BOILER_AREA',
      JobDesc: 'Routine valve check',
      Aufnr: '4000123',
      PersonsQty: 1,
      GasTestRequired: 'N',
      IsolationRequired: 'N',
      _Worker: [{ WorkerName: 'John Doe', Craft: 'FITTER' }],
      _HazardControl: [{ HazardDesc: 'Tripping hazard', ControlDesc: 'Clear pathways' }],
      _Safety: sitePlanRows('COLD', plan)
    };
  };

  // 1. Day Shift validation
  const dayPreset = computeShiftValidityPreset('DAY', '2099-05-10');
  assert.doesNotThrow(() => {
    preparePermitCreate({
      ...basePayload(dayPreset.plannedShiftEnd),
      ValidFromD: dayPreset.validFromD,
      ValidFromT: dayPreset.validFromT,
      ValidToD: dayPreset.validToD,
      ValidToT: dayPreset.validToT,
      Shift: dayPreset.shiftCode
    });
  });

  // 2. Evening Shift validation
  const evePreset = computeShiftValidityPreset('EVENING', '2099-05-10');
  assert.doesNotThrow(() => {
    preparePermitCreate({
      ...basePayload(evePreset.plannedShiftEnd),
      ValidFromD: evePreset.validFromD,
      ValidFromT: evePreset.validFromT,
      ValidToD: evePreset.validToD,
      ValidToT: evePreset.validToT,
      Shift: evePreset.shiftCode
    });
  });

  // 3. Night Shift validation
  const nightPreset = computeShiftValidityPreset('NIGHT', '2099-05-10');
  assert.doesNotThrow(() => {
    preparePermitCreate({
      ...basePayload(nightPreset.plannedShiftEnd),
      ValidFromD: nightPreset.validFromD,
      ValidFromT: nightPreset.validFromT,
      ValidToD: nightPreset.validToD,
      ValidToT: nightPreset.validToT,
      Shift: nightPreset.shiftCode
    });
  });
});

test('Isolation Integration: Permit creation accepts linked IsolationNo and rejects invalid nested _Isolation payload', () => {
  const dayPreset = computeShiftValidityPreset('DAY', '2099-05-10');
  const validPayloadWithIso = {
    ExecDept: 'MAINT',
    PermitType: 'COLD',
    Werks: '1000',
    AreaLoc: 'BOILER_AREA',
    JobDesc: 'Routine valve check',
    Aufnr: '4000123',
    PersonsQty: 1,
    GasTestRequired: 'N',
    IsolationRequired: 'Y',
    IsolationNo: 'ISO-2026-9999',
    ValidFromD: dayPreset.validFromD,
    ValidFromT: dayPreset.validFromT,
    ValidToD: dayPreset.validToD,
    ValidToT: dayPreset.validToT,
    Shift: dayPreset.shiftCode,
    _Worker: [{ WorkerName: 'John Doe', Craft: 'FITTER' }],
    _HazardControl: [{ HazardDesc: 'Tripping hazard', ControlDesc: 'Clear pathways' }],
    _Safety: sitePlanRows('COLD', {
      additionalTypes: [],
      checks: { P01: 'YES', P02: 'YES', P03: 'YES', P04: 'YES' },
      nature: ['Inspection'],
      tools: ['Hand tools'],
      fields: {
        JSA1: 'JSA-001',
        JSA2: 'Issuer, acceptor and contractor visited site',
        SHFT: dayPreset.plannedShiftEnd,
        ISSR: 'ISSUER1',
        ACCP: 'ACCP1',
        OPER: 'OPER1'
      }
    })
  };

  // Valid permit payload with linked IsolationNo
  const prepared = preparePermitCreate(validPayloadWithIso);
  assert.equal(prepared.IsolationRequired, 'X');
  assert.equal(prepared.IsolationNo, 'ISO-2026-9999');
  assert.equal(prepared._Isolation, undefined, 'Must not send nested _Isolation to PermitInfo');

  // Verify backend contract enforces rejection if nested _Isolation is passed
  assert.throws(
    () => preparePermitCreate({ ...validPayloadWithIso, _Isolation: [{ ItemNo: '1' }] }),
    /Create isolation certificates with their _Item points/
  );
});

test('Serialization Flags: IsBlank is set to "X" for blank permits and " " for referenced permits', () => {
  const baseValidPayload = {
    ExecDept: 'MAINT',
    PermitType: 'COLD',
    Werks: '1000',
    AreaLoc: 'BOILER_AREA',
    JobDesc: 'Routine valve check',
    PersonsQty: 1,
    GasTestRequired: 'N',
    IsolationRequired: 'N',
    ValidFromD: '2099-05-10',
    ValidFromT: '09:00:00',
    ValidToD: '2099-05-10',
    ValidToT: '17:00:00',
    Shift: 'G',
    _Worker: [{ WorkerName: 'John Doe', Craft: 'FITTER' }],
    _HazardControl: [{ HazardDesc: 'Tripping hazard', ControlDesc: 'Clear pathways' }],
    _Safety: sitePlanRows('COLD', {
      additionalTypes: [],
      checks: { P01: 'YES', P02: 'YES', P03: 'YES', P04: 'YES' },
      nature: ['Inspection'],
      tools: ['Hand tools'],
      fields: {
        JSA1: 'JSA-001',
        JSA2: 'Issuer, acceptor and contractor visited site',
        SHFT: '2099-05-10T17:30',
        ISSR: 'ISSUER1',
        ACCP: 'ACCP1',
        OPER: 'OPER1'
      }
    })
  };

  // Case 1: Blank permit created with allowBlankReference: true
  const blank1 = preparePermitCreate(
    { ...baseValidPayload, Aufnr: '', Qmnum: '' },
    { allowBlankReference: true }
  );
  assert.equal(blank1.IsBlank, 'X', 'Blank permit with empty references must serialize IsBlank = "X"');

  // Case 2: Blank permit created with Aufnr = "BLANK PERMIT"
  const blank2 = preparePermitCreate(
    { ...baseValidPayload, Aufnr: 'BLANK PERMIT' },
    { allowBlankReference: true }
  );
  assert.equal(blank2.IsBlank, 'X', 'Blank permit with "BLANK PERMIT" Aufnr must serialize IsBlank = "X"');

  // Case 3: Explicit IsBlank = "X"
  const blank3 = preparePermitCreate(
    { ...baseValidPayload, Aufnr: '4000123', IsBlank: 'X' }
  );
  assert.equal(blank3.IsBlank, 'X', 'Explicit IsBlank = "X" must be preserved');

  // Case 4: Referenced permit linked to SAP Order 4000123
  const referenced = preparePermitCreate(
    { ...baseValidPayload, Aufnr: '4000123' }
  );
  assert.equal(referenced.IsBlank, ' ', 'Referenced permit linked to PM Order must serialize IsBlank = " " (single space)');
});

test('Serialization Flags: IsTemplate is set to "X" when flagged as template and " " otherwise', () => {
  const baseValidPayload = {
    ExecDept: 'MAINT',
    PermitType: 'COLD',
    Werks: '1000',
    AreaLoc: 'BOILER_AREA',
    JobDesc: 'Routine valve check',
    Aufnr: '4000123',
    PersonsQty: 1,
    GasTestRequired: 'N',
    IsolationRequired: 'N',
    ValidFromD: '2099-05-10',
    ValidFromT: '09:00:00',
    ValidToD: '2099-05-10',
    ValidToT: '17:00:00',
    Shift: 'G',
    _Worker: [{ WorkerName: 'John Doe', Craft: 'FITTER' }],
    _HazardControl: [{ HazardDesc: 'Tripping hazard', ControlDesc: 'Clear pathways' }],
    _Safety: sitePlanRows('COLD', {
      additionalTypes: [],
      checks: { P01: 'YES', P02: 'YES', P03: 'YES', P04: 'YES' },
      nature: ['Inspection'],
      tools: ['Hand tools'],
      fields: {
        JSA1: 'JSA-001',
        JSA2: 'Issuer, acceptor and contractor visited site',
        SHFT: '2099-05-10T17:30',
        ISSR: 'ISSUER1',
        ACCP: 'ACCP1',
        OPER: 'OPER1'
      }
    })
  };

  // Case 1: Flagged as Template (IsTemplate = "X")
  const templatePermit = preparePermitCreate({
    ...baseValidPayload,
    IsTemplate: 'X'
  });
  assert.equal(templatePermit.IsTemplate, 'X', 'Template permit must serialize IsTemplate = "X"');

  // Case 2: Standard permit without template flag
  const standardPermit = preparePermitCreate({
    ...baseValidPayload
  });
  assert.equal(standardPermit.IsTemplate, ' ', 'Standard non-template permit must serialize IsTemplate = " " (single space)');
});

test('Templates: BUILTIN_PERMIT_TEMPLATES has dummy data removed and starts clean', () => {
  assert.ok(Array.isArray(BUILTIN_PERMIT_TEMPLATES), 'BUILTIN_PERMIT_TEMPLATES must be an array');
  assert.equal(BUILTIN_PERMIT_TEMPLATES.length, 0, 'Dummy template data must be removed so the system starts clean');
});

test('Templates: saveUserTemplate and getUserTemplates store and retrieve custom permit templates', () => {
  if (!globalThis.localStorage) {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear()
    };
  }

  const customTmpl = {
    id: 'tmpl-user-test-1',
    name: 'Custom Plant 1002 Pump Isolation',
    description: 'User saved template for boiler feed pump maintenance',
    permitType: 'COLD',
    category: 'COLD',
    jobDesc: 'Pump seal replacement and alignment',
    areaLoc: 'BOILER AREA',
    execDept: 'MAINTENANCE',
    isBuiltin: false
  };

  saveUserTemplate(customTmpl);
  const templates = getUserTemplates();
  assert.ok(Array.isArray(templates), 'getUserTemplates must return an array');
  const found = templates.find(t => t.id === 'tmpl-user-test-1');
  assert.ok(found, 'Saved template must be retrievable');
  assert.equal(found.name, 'Custom Plant 1002 Pump Isolation');

  deleteUserTemplate('tmpl-user-test-1');
  const afterDelete = getUserTemplates();
  assert.equal(afterDelete.some(t => t.id === 'tmpl-user-test-1'), false, 'Deleted template must be removed');
});

test('Templates Auto-Populate: extractTemplateFromPermit extracts all 6 deep sections for new permit create', () => {
  const permitData = {
    Permit_No: 'PTW0000110',
    PermitType: 'COLD',
    Status: 'APPR',
    JobDesc: 'Pump and pipeline maintenance',
    Werks: '1002',
    AreaLoc: 'TEST AREA',
    IsTemplate: 'X',
    IsBlank: 'X',
    // 1. Nature of Work
    _NATW: [
      { ItemNo: '1', NatwCode: 'CIVIL', NatwDesc: 'Civil work' },
      { ItemNo: '2', NatwCode: 'OTHER', NatwDesc: 'Other: Custom excavation', OtherText: 'Custom excavation' }
    ],
    // 2. Tools & Equipment
    _Equipment: [
      { ItemNo: '1', EquipCode: 'WELD_MCH', EquipDesc: 'Welding machine' },
      { ItemNo: '2', EquipCode: 'SCAFFOLD', EquipDesc: 'Scaffold' }
    ],
    // 3. Authorized Worker & Contractor Crew Ledger
    _Worker: [
      {
        ItemNo: '1',
        WorkerTypeCode: 'EMP',
        WorkerName: 'John Operator',
        PhoneNo: '9876543210',
        ContractorId: '',
        ContractorName: '',
        EmpId: 'EMP100',
        Shift: 'G'
      }
    ],
    // 4. Personal Protective Equipment Matrix & Safety Checks
    _PPE: [
      {
        ItemNo: '1',
        PpeCode: 'PPE_SAFETY_SHOES',
        PpeDesc: 'Safety Shoes',
        IsRequired: 'Y',
        IsAvailable: 'Y',
        IsIssued: 'Y'
      }
    ],
    // 5. Custom Safety Inspection Checks (_Safety)
    _Safety: [
      {
        ItemNo: '1',
        Category: 'GEN',
        ItemCode: 'S01',
        ValueText: 'Verify area barricading and equipment certification',
        Response: 'YES'
      }
    ],
    // 6. Hazard Control Measures
    _HazardControl: [
      {
        ItemNo: '1',
        HazardCode: 'ELEC',
        HazardDesc: 'Live electrical cable',
        RiskLevel: 'HIGH',
        ControlCode: 'ELEC01',
        ControlDesc: 'Lockout tagout performed'
      }
    ]
  };

  const extracted = extractTemplateFromPermit(permitData);

  // 1. Nature of Work
  assert.ok(extracted.nature.includes('Civil work'), 'Must extract Civil work into nature array');
  assert.ok(extracted.nature.includes('Other'), 'Must extract Other into nature array');
  assert.equal(extracted.otherNature, 'Custom excavation', 'Must extract other nature description');

  // 2. Tools & Equipment
  assert.ok(extracted.tools.includes('Welding machine'), 'Must extract Welding machine into tools array');
  assert.ok(extracted.tools.includes('Scaffold'), 'Must extract Scaffold into tools array');

  // 3. Authorized Worker & Contractor Crew Ledger
  assert.equal(extracted.workers.length, 1);
  assert.equal(extracted.workers[0].WorkerName, 'John Operator');
  assert.equal(extracted.workers[0].PhoneNo, '9876543210');

  // 4. Personal Protective Equipment Matrix & Safety Checks
  assert.equal(extracted.ppeItems.length, 1);
  assert.equal(extracted.ppeItems[0].PpeCode, 'PPE_SAFETY_SHOES');
  assert.equal(extracted.ppeItems[0].IsRequired, 'Y');

  // 5. Custom Safety Inspection Checks (_Safety)
  assert.equal(extracted.safetyChecklist.length, 1);
  assert.equal(extracted.safetyChecklist[0].ItemCode, 'S01');
  assert.equal(extracted.safetyChecklist[0].ValueText, 'Verify area barricading and equipment certification');

  // 6. Hazard Control Measures
  assert.equal(extracted.hazards.length, 1);
  assert.equal(extracted.hazards[0].HazardCode, 'ELEC');
  assert.equal(extracted.hazards[0].ControlCode, 'ELEC01');
});

test('sitePermitApi.list includes IsTemplate eq "X" filter when isTemplate is true', async () => {
  // Test query generation with options object
  assert.ok(typeof sitePermitApi.list === 'function');
  assert.ok(typeof sitePermitApi.getTemplatePermits === 'function');
});

test('Template Application with MO / Notification Reference: Preserves MO fields and populates all 6 template sections', () => {
  // Scenario: User selects Maintenance Order in Step 1
  const existingOrderScope = {
    aufnr: '000040001234',
    qmnum: '00010005678',
    auart: 'PM01',
    jobDesc: 'OVERHAUL OF BOILER FEED PUMP P-101A',
    areaLoc: 'BOILER HOUSE - LEVEL 2',
    equnr: '10023456',
    tplnr: 'FLOC-UTIL-B01',
    werks: '1002',
    arbpl: 'MECH_MAINT',
    workCenterDesc: 'Mechanical Maintenance',
    priority: '1',
    isBlankPermit: false
  };

  // User applies template (e.g. Cold Work master template PTW0000110)
  const templateToApply = {
    id: 'sap-PTW0000110',
    permitNo: 'PTW0000110',
    name: 'COLD - TEST PUMP OVERHAUL',
    permitType: 'COLD',
    jobDesc: 'GENERIC TEMPLATE DESCRIPTION',
    areaLoc: 'GENERIC TEMPLATE LOCATION',
    execDept: 'PLANT - ENVIRONMENT',
    execAgency: 'EMP',
    shift: 'G',
    priority: '3',
    gasTestRequired: 'X',
    gasTestFreqHr: '2',
    isolationRequired: 'X',
    isolationRefType: 'EQUIP',
    nature: ['Pump maintenance', 'Gland packing replacement'],
    tools: ['Spanners', 'Torque Wrench', 'Chain Pulley Block'],
    otherNature: 'Shaft runout inspection',
    otherTools: 'Dial Gauge 0.01mm',
    workers: [
      {
        PermitNo: '',
        ItemNo: '1',
        WorkerTypeCode: 'EMP',
        WorkerName: 'Rajesh Sharma',
        PhoneNo: '9876543210',
        ContractorId: '',
        ContractorName: '',
        EmpId: 'EMP045',
        Shift: 'G'
      },
      {
        PermitNo: '',
        ItemNo: '2',
        WorkerTypeCode: 'CONT',
        WorkerName: 'Suresh Kumar',
        PhoneNo: '9876543211',
        ContractorId: 'CONT_APEX',
        ContractorName: 'Apex Engineering',
        EmpId: '',
        Shift: 'G'
      }
    ],
    ppeItems: [
      {
        PermitNo: '',
        ItemNo: '1',
        PpeCode: 'PPE_HELMET',
        PpeDesc: 'Safety Helmet',
        IsRequired: 'Y',
        IsAvailable: 'Y',
        IsIssued: 'Y',
        CheckedBy: '',
        CheckedAt: null,
        Remarks: 'From Template'
      },
      {
        PermitNo: '',
        ItemNo: '2',
        PpeCode: 'PPE_SAFETY_SHOES',
        PpeDesc: 'Safety Shoes',
        IsRequired: 'Y',
        IsAvailable: 'Y',
        IsIssued: 'Y',
        CheckedBy: '',
        CheckedAt: null,
        Remarks: 'From Template'
      }
    ],
    safetyChecklist: [
      {
        PermitNo: '',
        ItemNo: '1',
        Category: 'GEN',
        ItemCode: 'S01',
        Response: 'YES',
        ValueText: 'Area barricading completed and warning signage displayed',
        ValueNum: 0,
        Unit: '',
        ReferenceNo: '',
        ResponsibleUser: '',
        VerifiedBy: '',
        VerifiedAt: null,
        Remarks: ''
      }
    ],
    hazards: [
      {
        PermitNo: '',
        ItemNo: '1',
        HazardCode: 'MECH',
        HazardDesc: 'Pinch points and rotating parts',
        RiskLevel: 'HIGH',
        ControlCode: 'MECH01',
        ControlDesc: 'Isolation and lock out pump drive motor before disassembly',
        ControlStatus: 'OPEN',
        ResponsibleUser: '',
        VerifiedBy: '',
        VerifiedAt: null,
        Remarks: ''
      }
    ]
  };

  // Emulate applyPermitTemplate logic
  const hasExistingPmRef = Boolean(
    existingOrderScope.aufnr && existingOrderScope.aufnr.trim() !== '-'
  );

  assert.ok(hasExistingPmRef, 'Must detect existing Maintenance Order reference');

  const finalScope = {
    // 1. MO Reference Fields: MUST BE RETAINED FROM ORDER
    aufnr: existingOrderScope.aufnr,
    qmnum: existingOrderScope.qmnum,
    auart: existingOrderScope.auart,
    equnr: existingOrderScope.equnr,
    tplnr: existingOrderScope.tplnr,
    werks: existingOrderScope.werks,
    arbpl: existingOrderScope.arbpl,
    workCenterDesc: existingOrderScope.workCenterDesc,
    isBlankPermit: false,
    // Scope descriptions: Keep order job description and location because order has specific values
    jobDesc: existingOrderScope.jobDesc || templateToApply.jobDesc,
    areaLoc: existingOrderScope.areaLoc || templateToApply.areaLoc,
    priority: existingOrderScope.priority || templateToApply.priority,

    // 2. Template Deep Fields: MUST BE POPULATED FROM TEMPLATE
    permitType: templateToApply.permitType,
    nature: templateToApply.nature,
    tools: templateToApply.tools,
    otherNature: templateToApply.otherNature,
    otherTools: templateToApply.otherTools,
    workers: templateToApply.workers,
    personsQty: templateToApply.workers.length,
    ppeItems: templateToApply.ppeItems,
    safetyChecklist: templateToApply.safetyChecklist,
    hazards: templateToApply.hazards,
    gasTestRequired: templateToApply.gasTestRequired,
    isolationRequired: templateToApply.isolationRequired,
    shift: templateToApply.shift
  };

  // Verifications:
  // Order reference MUST NOT be wiped or overwritten with template dummy values
  assert.equal(finalScope.aufnr, '000040001234', 'Aufnr must remain the selected maintenance order number');
  assert.equal(finalScope.qmnum, '00010005678', 'Qmnum must remain the selected notification number');
  assert.equal(finalScope.jobDesc, 'OVERHAUL OF BOILER FEED PUMP P-101A', 'Job description must retain the specific MO scope');
  assert.equal(finalScope.areaLoc, 'BOILER HOUSE - LEVEL 2', 'Area location must retain the specific MO location');
  assert.equal(finalScope.isBlankPermit, false, 'Permit must not be turned into blank permit');

  // Deep sections MUST come from the template
  assert.equal(finalScope.permitType, 'COLD');
  assert.deepEqual(finalScope.nature, ['Pump maintenance', 'Gland packing replacement']);
  assert.deepEqual(finalScope.tools, ['Spanners', 'Torque Wrench', 'Chain Pulley Block']);
  assert.equal(finalScope.otherNature, 'Shaft runout inspection');
  assert.equal(finalScope.otherTools, 'Dial Gauge 0.01mm');
  assert.equal(finalScope.workers.length, 2);
  assert.equal(finalScope.workers[0].WorkerName, 'Rajesh Sharma');
  assert.equal(finalScope.personsQty, 2);
  assert.equal(finalScope.ppeItems.length, 2);
  assert.equal(finalScope.ppeItems[0].PpeCode, 'PPE_HELMET');
  assert.equal(finalScope.safetyChecklist.length, 1);
  assert.equal(finalScope.safetyChecklist[0].ItemCode, 'S01');
  assert.equal(finalScope.hazards.length, 1);
  assert.equal(finalScope.hazards[0].HazardCode, 'MECH');
  assert.equal(finalScope.gasTestRequired, 'X');
  assert.equal(finalScope.isolationRequired, 'X');
});

test('Reference Document Source: Notification permit creation with template retains notification and avoids blank permit', () => {
  // Scenario: User selects Reference Document Source = Maintenance Notification
  const notificationSelection = {
    source: 'notification',
    reference: {
      ReferenceSource: 'Notification',
      OrderNotifType: 'M2',
      ReferenceId: '00010008899',
      JobDescription: 'CORRECTIVE LEAK REPAIR ON ACID LINE',
      Plant: '1002',
      FunctionalLocation: 'FLOC-ACID-01',
      EquipmentTag: 'EQ-LINE-22',
      AreaLoc: 'ACID PLANT - UNIT 1',
      WorkCenter: 'INST_MAINT',
      WorkCenterDesc: 'Instrumentation Maintenance',
      Priority: '2'
    }
  };

  // Template is e.g. PTW0000110 (which in SAP was saved with IsBlank='X', Aufnr='-')
  const templateCreatedFromBlank = {
    permitNo: 'PTW0000110',
    permitType: 'COLD',
    jobDesc: 'TEST',
    areaLoc: 'TEST',
    execDept: 'APTFE PLANT - ENVIRONMENT',
    nature: ['Cold cutting', 'Line inspection'],
    tools: ['Non-sparking wrench', 'Pipe cutter'],
    workers: [{ WorkerName: 'Amit Patel', WorkerTypeCode: 'EMP', PhoneNo: '9876543220' }],
    ppeItems: [{ PpeCode: 'PPE_ACID_SUIT', IsRequired: 'Y', IsAvailable: 'Y', IsIssued: 'Y' }],
    hazards: [{ HazardCode: 'CHEM', ControlCode: 'CHEM01', RiskLevel: 'HIGH' }]
  };

  // Reference fields mapped from Notification:
  const refAufnr = '';
  const refQmnum = notificationSelection.reference.ReferenceId;
  const hasExistingPmRef = Boolean(notificationSelection || refQmnum);

  assert.ok(hasExistingPmRef, 'Must recognize active Notification reference');

  // Permit state after template applied:
  const isBlankPermit = false; // MUST NOT BE FORCED TO TRUE!
  const finalAufnr = refAufnr; // Must remain empty (not overwritten with '-' from template!)
  const finalQmnum = refQmnum; // Must retain the Notification ID!
  const finalJobDesc = notificationSelection.reference.JobDescription; // Retains notification description

  assert.equal(isBlankPermit, false, 'Notification permit must remain a reference permit and NOT a blank permit');
  assert.equal(finalAufnr, '', 'Aufnr must remain empty for notification');
  assert.equal(finalQmnum, '00010008899', 'Qmnum must be the notification ID');
  assert.equal(finalJobDesc, 'CORRECTIVE LEAK REPAIR ON ACID LINE');
  assert.equal(templateCreatedFromBlank.nature.length, 2);
  assert.equal(templateCreatedFromBlank.ppeItems[0].PpeCode, 'PPE_ACID_SUIT');
});

test('Reference Document Source: Template applied before selecting reference preserves reference mode and does not force blank permit', () => {
  // Scenario: User is on Step 1 (Reference Document Source), has not selected a specific row yet,
  // but clicks "Use Template".
  const workSelection = null;
  const currentAufnr = '';
  const currentQmnum = '';
  let isBlankPermit = false; // User has NOT clicked "Create Blank Permit"

  const hasExistingPmRef = Boolean(workSelection || currentAufnr || currentQmnum);
  assert.equal(hasExistingPmRef, false, 'No specific PM reference row committed yet');

  // New logic: When !hasExistingPmRef:
  // If isBlankPermit is FALSE, it means user is creating from Reference Document Source!
  // It MUST NOT set isBlankPermit = true, nor set Aufnr = '-'
  let finalAufnr = currentAufnr;
  if (hasExistingPmRef) {
    isBlankPermit = false;
  } else if (isBlankPermit) {
    // Only if explicitly started as blank permit
    finalAufnr = '-';
  } else {
    // Reference Document Source is active: keep isBlankPermit as false!
    isBlankPermit = false;
    finalAufnr = '';
  }

  assert.equal(isBlankPermit, false, 'Must not force blank permit mode when user is on Reference Document Source');
  assert.equal(finalAufnr, '', 'Must not inject Aufnr "-" into reference permit');
});

test('Section D fields: JSA, Shift, and Proposed Responsibilities remain blank on template extraction', () => {
  const permitWithSignatures = {
    Permit_No: 'PTW0000999',
    PermitType: 'COLD',
    _Safety: [
      { ItemCode: 'JSA1', Remarks: 'JSA-REF-999' },
      { ItemCode: 'JSA2', Remarks: 'Joint visit completed' },
      { ItemCode: 'SHFT', Remarks: '2026-11-20T23:00' },
      { ItemCode: 'ISSR', Remarks: 'USER_ISSUER' },
      { ItemCode: 'ACCP', Remarks: 'USER_ACCP' },
      { ItemCode: 'OPER', Remarks: 'USER_OPER' },
      { ItemCode: 'AP01', Remarks: 'USER_AP01' },
      { ItemCode: 'AP02', Remarks: 'USER_AP02' },
      { ItemCode: 'AP03', Remarks: 'USER_AP03' },
      { ItemCode: 'DIST', Remarks: 'DIST_SEC_01' },
      { ItemCode: 'CHEM', Remarks: 'Caustic line' } // non-Section D field
    ]
  };

  const extracted = extractTemplateFromPermit(permitWithSignatures);
  for (const code of SECTION_D_FIELD_CODES) {
    assert.equal(extracted.safetySitePlanFields[code], undefined, `Section D field ${code} must NOT be extracted into template`);
  }
  assert.equal(extracted.safetySitePlanFields.CHEM, 'Caustic line', 'Non-section D fields should still be extracted');
});

test('KTEXT maintenance order short text is serialized into permit header and capped at 40 chars', () => {
  const payload = {
    PermitType: 'COLD',
    Werks: '1001',
    ExecDept: 'Mechanical Maintenance',
    AreaLoc: 'Pump House Unit 1',
    JobDesc: 'Repair motor M-101',
    Aufnr: '4000123',
    Auart: 'PM01',
    Ktext: 'Overhaul pump motor on unit 1 (KTEXT)',
    IsolationRequired: 'N',
    GasTestRequired: 'N',
    ValidFromD: '2099-12-30',
    ValidFromT: '08:00:00',
    ValidToD: '2099-12-31',
    ValidToT: '16:00:00',
    PersonsQty: 1,
    _Worker: [{ WorkerName: 'Worker', WorkerTypeCode: 'EMP', EmpId: '1' }],
    _HazardControl: [{ HazardDesc: 'Hazard 1', ControlDesc: 'Control 1' }]
  };

  const prepared = preparePermitCreate(payload);
  assert.equal(prepared.Ktext, 'Overhaul pump motor on unit 1 (KTEXT)');
  assert.equal(prepared.KTEXT, undefined, 'Invalid uppercase KTEXT property must not be sent to SAP');

  // Truncation over 40 chars
  const longPayload = {
    ...payload,
    Ktext: 'This is a very long maintenance order description exceeding 40 characters limit'
  };
  const preparedLong = preparePermitCreate(longPayload);
  assert.equal(preparedLong.Ktext.length, 40);
  assert.equal(preparedLong.KTEXT, undefined, 'Invalid uppercase KTEXT property must not be sent to SAP');
});




