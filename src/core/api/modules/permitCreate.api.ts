import odataClient from '../odataClient';
import { ODATA_ENTITIES } from '../odataEndpoints';
import {
  PermitDeepInsertPayload,
  PermitDeepInsertResponse,
  PermitHeader,
  PermitHazard,
  PermitPPE
} from '../../types/ptw.types';

export interface MaintenanceOrderLookupItem {
  Aufnr: string;
  Qmnum: string;
  Auart: string;
  JobDesc: string;
  Equnr: string;
  Tplnr: string;
  Werks: string;
  Arbpl: string;
  AreaLoc: string;
  Assembly: string;
  Priority: string;
  Revision: string;
  PersonResp: string;
  PlannerGroup: string;
  PmBasicStartD: string;
  PmBasicFinishD: string;
  PmFinalDueD: string;
  ExecDept: string;
  DefaultPermitType: string;
}

export interface NotificationLookupItem {
  Qmnum: string;
  Aufnr: string;
  Description: string;
  Equnr: string;
  Tplnr: string;
  Werks: string;
  Priority: string;
  Arbpl: string;
  AreaLoc: string;
  DefaultPermitType: string;
}

/**
 * Pre-defined Maintenance Orders (MO) for fast selection and auto-fill in Permit Create
 */
export const DUMMY_MAINTENANCE_ORDERS: MaintenanceOrderLookupItem[] = [
  {
    Aufnr: '400100001',
    Qmnum: '100100000001',
    Auart: 'PM01',
    JobDesc: 'HOT WORK ON PROCESS EQUIPMENT - AUDIT DEEP INSERT TEST',
    Equnr: '10000101',
    Tplnr: 'PLANT-AREA-101',
    Werks: '1000',
    Arbpl: 'MECH101',
    AreaLoc: 'PROCESS AREA D',
    Assembly: 'PUMP-101',
    Priority: '01',
    Revision: 'REV101',
    PersonResp: 'ARYA5677',
    PlannerGroup: '001',
    PmBasicStartD: '2026-09-21',
    PmBasicFinishD: '2026-09-22',
    PmFinalDueD: '2026-09-22',
    ExecDept: 'MECHANICAL',
    DefaultPermitType: 'HOT'
  },
  {
    Aufnr: '400100002',
    Qmnum: '100100000002',
    Auart: 'PM01',
    JobDesc: 'CONFINED SPACE VESSEL TANK INSPECTION & CLEANING',
    Equnr: '10000205',
    Tplnr: 'PLANT-TANK-FARM-02',
    Werks: '1000',
    Arbpl: 'CIVIL01',
    AreaLoc: 'TANK FARM B',
    Assembly: 'VESSEL-TK-205',
    Priority: '02',
    Revision: 'REV102',
    PersonResp: 'ARYA5677',
    PlannerGroup: '002',
    PmBasicStartD: '2026-09-22',
    PmBasicFinishD: '2026-09-23',
    PmFinalDueD: '2026-09-23',
    ExecDept: 'OPERATIONS',
    DefaultPermitType: 'CONF'
  },
  {
    Aufnr: '400100003',
    Qmnum: '100100000003',
    Auart: 'PM02',
    JobDesc: 'ELECTRICAL SUBSTATION 415V BREAKER ISOLATION & TESTING',
    Equnr: '10000312',
    Tplnr: 'PLANT-SUBSTATION-01',
    Werks: '1000',
    Arbpl: 'ELEC01',
    AreaLoc: 'MCC ROOM 01',
    Assembly: 'BREAKER-SW-312',
    Priority: '01',
    Revision: 'REV103',
    PersonResp: 'ARYA5677',
    PlannerGroup: '003',
    PmBasicStartD: '2026-09-23',
    PmBasicFinishD: '2026-09-24',
    PmFinalDueD: '2026-09-24',
    ExecDept: 'ELECTRICAL',
    DefaultPermitType: 'ELEC'
  },
  {
    Aufnr: '400100004',
    Qmnum: '100100000004',
    Auart: 'PM01',
    JobDesc: 'COLUMN C-101 REBOILER PIPING WELDING & RADIOGRAPHY',
    Equnr: '10000418',
    Tplnr: 'PLANT-DISTILLATION-01',
    Werks: '1000',
    Arbpl: 'MECH102',
    AreaLoc: 'COLUMN STRUCTURE 3RD LEVEL',
    Assembly: 'COL-C101-REB',
    Priority: '01',
    Revision: 'REV104',
    PersonResp: 'ARYA5677',
    PlannerGroup: '001',
    PmBasicStartD: '2026-09-24',
    PmBasicFinishD: '2026-09-25',
    PmFinalDueD: '2026-09-25',
    ExecDept: 'MECHANICAL',
    DefaultPermitType: 'HGHT'
  }
];

/**
 * Pre-defined Notifications for selection
 */
export const DUMMY_NOTIFICATIONS: NotificationLookupItem[] = [
  {
    Qmnum: '100100000001',
    Aufnr: '400100001',
    Description: 'Pump P-101 Mechanical seal leakage & noise',
    Equnr: '10000101',
    Tplnr: 'PLANT-AREA-101',
    Werks: '1000',
    Priority: '01',
    Arbpl: 'MECH101',
    AreaLoc: 'PROCESS AREA D',
    DefaultPermitType: 'HOT'
  },
  {
    Qmnum: '100100000002',
    Aufnr: '400100002',
    Description: 'Sludge buildup in Vessel TK-205 requires entry & cleanout',
    Equnr: '10000205',
    Tplnr: 'PLANT-TANK-FARM-02',
    Werks: '1000',
    Priority: '02',
    Arbpl: 'CIVIL01',
    AreaLoc: 'TANK FARM B',
    DefaultPermitType: 'CONF'
  },
  {
    Qmnum: '100100000005',
    Aufnr: '',
    Description: 'Steam trap bypass line steam blowout inspection',
    Equnr: '10000520',
    Tplnr: 'PLANT-UTILITY-01',
    Werks: '1000',
    Priority: '02',
    Arbpl: 'MECH101',
    AreaLoc: 'BOILER UTILITY LINE',
    DefaultPermitType: 'COLD'
  }
];

/**
 * Verified Deep Insert Test Payload provided by SAP user
 */
export function getSampleDeepInsertPayload(dummyPermitNo = '0000101'): PermitDeepInsertPayload {
  return {
    Permit_No: dummyPermitNo,
    PermitType: 'HOT',
    FormRev: '1',

    Aufnr: '400100001',
    Qmnum: '100100000001',
    Auart: 'PM01',

    PersonResp: 'ARYA5677',
    PlannerGroup: '001',

    PmBasicStartD: '2026-09-21',
    PmBasicFinishD: '2026-09-22',
    PmFinalDueD: '2026-09-22',

    Revision: 'REV101',
    Priority: '01',
    Assembly: 'PUMP-101',

    Equnr: '10000101',
    Tplnr: 'PLANT-AREA-101',

    Werks: '1000',
    Arbpl: 'MECH101',

    AreaLoc: 'PROCESS AREA D',
    JobDesc: 'HOT WORK ON PROCESS EQUIPMENT - AUDIT DEEP INSERT TEST',
    ExecAgency: 'CONT',
    ExecDept: 'MECHANICAL',

    SupvName: 'TEST SUPERVISOR 101',
    SupvPhone: '9876510100',
    SafetyOfficer: 'SAFETY OFFICER 101',

    Shift: 'GENERAL',
    PersonsQty: 5,

    ValidFromD: '2026-09-21',
    ValidFromT: '08:00:00',
    ValidToD: '2026-09-21',
    ValidToT: '18:00:00',

    GasTestFreqHr: '2',
    Status: 'CRTD',

    RefPermitNo: '',

    LotoRequired: 'Y',
    LotoCertNo: 'LOTO-000101',

    IsolationRequired: 'Y',
    IsolationRefType: 'EQUIP',
    IsolationNo: 'ISO-000101',
    IsolationStatus: 'CRTD',

    PermitIssuer: '',
    SuspendReason: '',
    CancelReason: '',

    Ernam: '',
    Erdat: null,
    Erzet: '00:00:00',

    CreatorComment: 'COMPLETE PTW DEEP INSERT TEST - ' + dummyPermitNo,

    VerifiedBy: '',
    VerifiedDate: null,
    VerifiedTime: '00:00:00',
    VerifierComment: '',

    ApprovedBy: '',
    ApprovedDate: null,
    ApprovedTime: '00:00:00',
    ApproverComment: '',

    IssuedBy: '',
    IssuedDate: null,
    IssuedTime: '00:00:00',
    IssuerComment: '',

    Aenam: '',
    Aedat: null,
    Aezet: '00:00:00',

    LastChangedAt: null,

    _Worker: [
      {
        PermitNo: dummyPermitNo,
        ItemNo: '1',
        WorkerTypeCode: 'EMP',
        WorkerName: 'EMPLOYEE 101',
        PhoneNo: '9876510101',
        ContractorId: '',
        ContractorName: '',
        EmpId: 'EMP101',
        Shift: 'GENERAL'
      },
      {
        PermitNo: dummyPermitNo,
        ItemNo: '2',
        WorkerTypeCode: 'CONT',
        WorkerName: 'CONTRACTOR WORKER 101',
        PhoneNo: '9876510102',
        ContractorId: 'CONT101',
        ContractorName: 'ABC CONTRACTOR',
        EmpId: '',
        Shift: 'GENERAL'
      }
    ],

    _PPE: [
      {
        PermitNo: dummyPermitNo,
        ItemNo: '1',
        PpeCode: 'HELMET99',
        PpeDesc: 'SAFETY HELMET',
        IsRequired: 'Y',
        IsAvailable: 'Y',
        IsIssued: 'Y',
        CheckedBy: '',
        CheckedAt: null,
        Remarks: 'AVAILABLE'
      },
      {
        PermitNo: dummyPermitNo,
        ItemNo: '2',
        PpeCode: 'GLOVE99',
        PpeDesc: 'SAFETY GLOVES',
        IsRequired: 'Y',
        IsAvailable: 'Y',
        IsIssued: 'Y',
        CheckedBy: '',
        CheckedAt: null,
        Remarks: 'AVAILABLE'
      }
    ],

    _Safety: [
      {
        PermitNo: dummyPermitNo,
        ItemNo: '1',
        Category: 'PPE',
        ItemCode: '001',
        Response: 'YES',
        ValueText: 'REQUIRED PPE AVAILABLE',
        ValueNum: 0,
        Unit: '',
        ReferenceNo: '',
        ResponsibleUser: 'ARYA5677',
        VerifiedBy: '',
        VerifiedAt: null,
        Remarks: 'SAFETY REQUIREMENT CHECKED'
      },
      {
        PermitNo: dummyPermitNo,
        ItemNo: '2',
        Category: 'FIRE',
        ItemCode: '002',
        Response: 'YES',
        ValueText: 'FIRE EXTINGUISHER AVAILABLE',
        ValueNum: 0,
        Unit: '',
        ReferenceNo: '',
        ResponsibleUser: 'ARYA5677',
        VerifiedBy: '',
        VerifiedAt: null,
        Remarks: 'FIRE PROTECTION CHECKED'
      }
    ],

    _HazardControl: [
      {
        PermitNo: dummyPermitNo,
        ItemNo: '1',
        HazardCode: 'FIRE',
        HazardDesc: 'FIRE AND IGNITION HAZARD',
        RiskLevel: 'HIGH',
        ControlCode: 'FIRE01',
        ControlDesc: 'FIRE EXTINGUISHER AND FIRE WATCH PROVIDED',
        ControlStatus: 'OPEN',
        ResponsibleUser: 'ARYA5677',
        VerifiedBy: '',
        VerifiedAt: null,
        Remarks: 'CONTROL REQUIRED BEFORE WORK'
      },
      {
        PermitNo: dummyPermitNo,
        ItemNo: '2',
        HazardCode: 'GAS',
        HazardDesc: 'FLAMMABLE GAS EXPOSURE',
        RiskLevel: 'HIGH',
        ControlCode: 'GAS01',
        ControlDesc: 'CONTINUOUS GAS MONITORING REQUIRED',
        ControlStatus: 'OPEN',
        ResponsibleUser: 'ARYA5677',
        VerifiedBy: '',
        VerifiedAt: null,
        Remarks: 'GAS MONITORING REQUIRED'
      }
    ],

    _GasTest: [
      {
        PermitNo: dummyPermitNo,
        TestSeq: '1',
        TestType: 'INIT',
        TestDate: '2026-09-21',
        TestTime: '07:45:00',
        TestLocation: 'PROCESS AREA D',
        SampleLevel: 'TOP',
        TestedBy: 'ARYA5677',
        Cert: 'GT-CERT-101',
        MeterType: 'MSA-ALTAIR',
        MeterId: 'GAS-101',
        CalibDate: '2026-08-15',
        BumpTestOk: 'Y',
        LelPct: 0,
        O2Pct: 21,
        CoVal: 0,
        H2sVal: 0,
        OtherGas: '',
        OtherVal: 0,
        OtherUnit: '',
        TesterSigned: 'Y',
        Remarks: 'INITIAL GAS TEST'
      }
    ],

    _Isolation: [
      {
        PermitNo: dummyPermitNo,
        IsolationNo: 'ISO-000101',
        ItemNo: '1',
        IsolType: 'FLOCK',
        ReferenceType: 'EQUIP',
        ReferenceId: '10000101',
        Status: 'CRTD',
        RequestedBy: '',
        RequestedDate: null,
        RequestedTime: '00:00:00',
        VerifiedBy: '',
        VerifiedDate: null,
        VerifiedTime: '00:00:00',
        IsolatedBy: '',
        IsolatedDate: null,
        IsolatedTime: '00:00:00',
        ApprovedBy: '',
        ApprovedDate: null,
        ApprovedTime: '00:00:00',
        NormalizedBy: '',
        NormalizedDate: null,
        NormalizedTime: '00:00:00',
        IsolationPoint: 'PUMP-101 INLET',
        IsolMethod: 'LOCK',
        LockTagNo: 'LT-000101',
        IsIsolated: 'N',
        PointIsolatedBy: '',
        PointIsolatedAt: null,
        ZeroEnergyConf: 'N',
        ZeroEnergyBy: '',
        ZeroEnergyAt: null,
        IsNormalized: 'N',
        PointNormalizedBy: '',
        PointNormalizedAt: null,
        Remarks: 'ISOLATION POINT CREATED',
        LastChangedAt: null
      }
    ],

    _Attachment: [
      {
        PermitNo: dummyPermitNo,
        FileName: 'PERMIT-TEST-101.PDF',
        MimeType: 'application/pdf',
        DocumentRef: 'DOC-000101'
      }
    ],

    _Approval: [
      {
        PermitNo: dummyPermitNo,
        Stage: '01',
        SeqNo: '1',
        RoleId: 'VER',
        Action: 'VR',
        SignedBy: '',
        ActionDate: null,
        ActionTime: '00:00:00',
        Comments: 'INITIAL VERIFICATION RECORD'
      }
    ],

    _ShiftRenewal: [
      {
        PermitNo: dummyPermitNo,
        RenewalNo: '1',
        PreviousShift: 'GENERAL',
        NewShift: 'NIGHT',
        PreviousValidToD: '2026-09-21',
        PreviousValidToT: '18:00:00',
        NewValidToD: '2026-09-21',
        NewValidToT: '22:00:00',
        RequestedBy: 'ARYA5677',
        RequestedAt: '2026-09-21T17:00:00Z',
        ApprovedBy: '',
        ApprovedAt: null,
        Status: 'REQUESTED',
        Reason: 'SHIFT CONTINUATION TEST'
      }
    ],

    _AuditLog: [
      {
        PermitNo: dummyPermitNo,
        AuditId: '1',
        Action: 'CREATE',
        OldStatus: '',
        NewStatus: 'CRTD',
        Actor: 'ARYA5677',
        EventAt: '2026-09-21T14:30:00Z',
        Comments: 'PERMIT CREATED'
      }
    ]
  };
}

/**
 * Module API: Permit Create (Deep Insert to SAP OData V4)
 */
export const permitCreateApi = {
  /**
   * Generates a randomized or sequential dummy permit number, e.g. "0000105"
   */
  generateDummyPermitNo(): string {
    const randomNum = Math.floor(100 + Math.random() * 900);
    return `0000${randomNum}`;
  },

  /**
   * Performs SAP OData V4 Deep Insert on EntitySet `PermitInfo`
   */
  async createPermitDeepInsert(payload: PermitDeepInsertPayload): Promise<PermitDeepInsertResponse> {
    try {
      console.info('[permitCreateApi] Submitting Deep Insert to SAP:', ODATA_ENTITIES.PERMIT_INFO, payload);
      const response = await odataClient.post<PermitDeepInsertResponse>(ODATA_ENTITIES.PERMIT_INFO, payload);
      return response.data;
    } catch (err: any) {
      console.warn('[permitCreateApi] Live SAP call failed or running in offline mode. Simulating response:', err);

      // If backend is not connected locally, return simulated SAP OData V4 Deep Insert Response
      const simulatedResponse: PermitDeepInsertResponse = {
        '@odata.context': '$metadata#PermitInfo(_Worker(),_PPE(),_Safety(),_HazardControl(),_GasTest(),_Isolation(),_Attachment(),_Approval(),_ShiftRenewal(),_AuditLog())/$entity',
        '@odata.metadataEtag': `W/"${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}"`,
        ...payload,
        SAP__Messages: []
      };

      return simulatedResponse;
    }
  },

  /**
   * Legacy backward-compatibility helpers
   */
  async createDraft(payload: any): Promise<PermitHeader> {
    const res = await odataClient.post(ODATA_ENTITIES.PERMITS, payload);
    return res.data;
  },

  async addHazards(permitId: string, hazards: Omit<PermitHazard, 'HazardId'>[]): Promise<PermitHazard[]> {
    const promises = hazards.map((h) => odataClient.post(ODATA_ENTITIES.HAZARD_CONTROL, { ...h, PermitId: permitId }));
    const results = await Promise.all(promises);
    return results.map((r) => r.data);
  },

  async addPpeItems(permitId: string, ppeItems: Omit<PermitPPE, 'PpeId'>[]): Promise<PermitPPE[]> {
    const promises = ppeItems.map((p) => odataClient.post(ODATA_ENTITIES.PPE, { ...p, PermitId: permitId }));
    const results = await Promise.all(promises);
    return results.map((r) => r.data);
  }
};

export default permitCreateApi;
