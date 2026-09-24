/**
 * Permit To Work (PTW) Domain Entity Interfaces
 * Reflects SAP CDS / RAP Service Definition:
 * com.sap.gateway.srvd_a2x.zptw_services.v0001
 */

export type PermitTypeCode = 
  | 'HOT'   // Hot Work (Welding, Cutting, Grinding)
  | 'COLD'  // Cold Work (Maintenance, Painting)
  | 'CONF'  // Confined Space Entry
  | 'ELEC'  // High Voltage / Electrical Isolation
  | 'HGHT'; // Work at Height (> 2 meters)

export type PermitStatusCode = 
  | 'CRTD'  // Created / Draft
  | 'DRAF'  // Draft
  | 'SUBM'  // Submitted for Review
  | 'HSE_A' // Safety Officer Approved
  | 'AREA_A'// Area Owner Approved
  | 'APPR'  // Approved & Authorized
  | 'ISSD'  // Issued
  | 'ACTV'  // Active in Field
  | 'SUSP'  // Suspended (Safety Stop)
  | 'CANC'  // Cancelled
  | 'CLOS'; // Closed / Archival

export type IndicatorYN = 'Y' | 'N';

export type RiskLevelCode = 'LOW' | 'MED' | 'HIGH' | 'CRIT';

/**
 * SAP Message structure returned in collections & headers
 */
export interface SapMessageItem {
  code: string;
  message: string;
  target?: string;
  additionalTargets?: string[];
  transition?: boolean;
  numericSeverity?: number;
  longtextUrl?: string;
}

// --------------------------------------------------------------------------
// 1. Exact Metadata Entities
// --------------------------------------------------------------------------

/**
 * Primary PTW Header: PermitInfoType
 */
export interface PermitInfoRecord {
  Permit_No: string; // Key, MaxLength 10
  PermitType: string; // MaxLength 32 (HOT, COLD, etc.)
  FormRev?: string; // Form Revision, e.g. "1"

  // Maintenance Order & Notification Linkage
  Aufnr: string; // Order Number, MaxLength 12
  Qmnum: string; // Notification Number, MaxLength 12
  Auart: string; // Order/Doc Type (PM01, etc.), MaxLength 4

  PersonResp: string; // Maintenance Person Responsible, MaxLength 12
  PlannerGroup: string; // Maintenance Planner Group, MaxLength 3

  PmBasicStartD: string | null; // Maintenance Order Basic Start Date (YYYY-MM-DD)
  PmBasicFinishD: string | null; // Maintenance Order Basic Finish Date (YYYY-MM-DD)
  PmFinalDueD: string | null; // Maintenance Order Final Due Date (YYYY-MM-DD)

  Revision: string; // Maintenance Revision, MaxLength 8
  Priority: string; // Maintenance Priority (01, 02, etc.), MaxLength 2
  Assembly: string; // Maintenance Assembly, MaxLength 18

  Equnr: string; // Equipment Number, MaxLength 18
  Tplnr: string; // Functional Location, MaxLength 30

  Werks: string; // Plant, MaxLength 4
  Arbpl: string; // Work Center, MaxLength 8

  AreaLoc: string; // PTW Area Location, MaxLength 40
  JobDesc: string; // PTW Job Description, MaxLength 255
  ExecAgency: string; // Execution Agency (CONT / EMP), MaxLength 4
  ExecDept: string; // Execution Department, MaxLength 40

  SupvName: string; // Supervisor Name, MaxLength 60
  SupvPhone: string; // Supervisor Phone, MaxLength 16
  SafetyOfficer: string; // Safety Officer Name, MaxLength 60

  Shift: string; // Work Shift (GENERAL, NIGHT, etc.), MaxLength 10
  PersonsQty: number; // Authorized Personnel Quantity (Edm.Decimal 5)

  ValidFromD: string | null; // Valid From Date (YYYY-MM-DD)
  ValidFromT: string; // Valid From Time (HH:mm:ss)
  ValidToD: string | null; // Valid To Date (YYYY-MM-DD)
  ValidToT: string; // Valid To Time (HH:mm:ss)

  GasTestFreqHr: string; // Gas Test Frequency in Hours (01, 02, etc.), MaxLength 2
  Status: string; // Permit Lifecycle Status (CRTD, SUBM, APPR, etc.), MaxLength 4

  RefPermitNo: string; // Reference Permit Number, MaxLength 10

  LotoRequired: IndicatorYN | string; // LOTO Required ('Y'/'N'), MaxLength 1
  LotoCertNo: string; // LOTO Certificate Number, MaxLength 20

  IsolationRequired: IndicatorYN | string; // Isolation Required ('Y'/'N'), MaxLength 1
  IsolationRefType: string; // Isolation Reference Type (EQUIP, etc.), MaxLength 6
  IsolationNo: string; // Isolation Certificate Number, MaxLength 20
  IsolationStatus: string; // Isolation Status, MaxLength 4

  PermitIssuer: string; // Permit Issuer, MaxLength 40
  SuspendReason: string; // Suspension Reason, MaxLength 255
  CancelReason: string; // Cancellation Reason, MaxLength 255

  Ernam: string; // Created By, MaxLength 12
  Erdat: string | null; // Created On (YYYY-MM-DD)
  Erzet: string; // Entry Time (HH:mm:ss)

  CreatorComment: string; // Creator Comment, MaxLength 255

  VerifiedBy: string; // Verified By, MaxLength 64
  VerifiedDate: string | null; // Verified Date (YYYY-MM-DD)
  VerifiedTime: string; // Verified Time (HH:mm:ss)
  VerifierComment: string; // Verifier Comment, MaxLength 255

  ApprovedBy: string; // Approved By, MaxLength 64
  ApprovedDate: string | null; // Approved Date (YYYY-MM-DD)
  ApprovedTime: string; // Approved Time (HH:mm:ss)
  ApproverComment: string; // Approver Comment, MaxLength 255

  IssuedBy: string; // Issued By, MaxLength 64
  IssuedDate: string | null; // Issued Date (YYYY-MM-DD)
  IssuedTime: string; // Issued Time (HH:mm:ss)
  IssuerComment: string; // Issuer Comment, MaxLength 255

  Aenam: string; // Changed By, MaxLength 12
  Aedat: string | null; // Changed On (YYYY-MM-DD)
  Aezet: string; // Changed Time (HH:mm:ss)

  LastChangedAt: string | null; // UTC Timestamp

  SAP__Messages?: SapMessageItem[];
}

/**
 * WorkerType
 */
export interface WorkerRecord {
  PermitNo: string; // Key, MaxLength 10
  ItemNo: string; // Key, MaxLength 4 (DigitSequence: "1", "2")
  WorkerTypeCode: string; // EMP / CONT, MaxLength 10
  WorkerName: string; // Worker Name, MaxLength 64
  PhoneNo: string; // Phone, MaxLength 20
  ContractorId: string; // Contractor ID, MaxLength 20
  ContractorName: string; // Contractor Name, MaxLength 64
  EmpId: string; // Employee ID, MaxLength 20
  Shift: string; // Shift, MaxLength 10
  SAP__Messages?: SapMessageItem[];
}

/**
 * PPEType
 */
export interface PPERecord {
  PermitNo: string; // Key, MaxLength 10
  ItemNo: string; // Key, MaxLength 4
  PpeCode: string; // PPE Code (HELMET99, GLOVE99, etc.), MaxLength 10
  PpeDesc: string; // PPE Description, MaxLength 255
  IsRequired: IndicatorYN | string; // 'Y' / 'N'
  IsAvailable: IndicatorYN | string; // 'Y' / 'N'
  IsIssued: IndicatorYN | string; // 'Y' / 'N'
  CheckedBy: string; // User Name, MaxLength 12
  CheckedAt: string | null; // UTC Timestamp
  Remarks: string; // Remarks, MaxLength 255
  SAP__Messages?: SapMessageItem[];
}

/**
 * SafetyType (Safety Checklist)
 */
export interface SafetyRecord {
  PermitNo: string; // Key, MaxLength 10
  ItemNo: string; // Key, MaxLength 4
  Category: string; // PPE, FIRE, ENVR, ELEC, MaxLength 6
  ItemCode: string; // Item Code, MaxLength 4
  Response: string; // YES / NO / NA, MaxLength 3
  ValueText: string; // Safety Evidence Text, MaxLength 100
  ValueNum: number; // Measured Value (Edm.Decimal 8)
  Unit: string; // Unit, MaxLength 6
  ReferenceNo: string; // Reference Number, MaxLength 30
  ResponsibleUser: string; // User Name, MaxLength 12
  VerifiedBy: string; // User Name, MaxLength 12
  VerifiedAt: string | null; // UTC Timestamp
  Remarks: string; // Inspection Remarks, MaxLength 255
  SAP__Messages?: SapMessageItem[];
}

/**
 * HazardControlType
 */
export interface HazardControlRecord {
  PermitNo: string; // Key, MaxLength 10
  ItemNo: string; // Key, MaxLength 4
  HazardCode: string; // Hazard Code (FIRE, GAS, ELEC, etc.), MaxLength 10
  HazardDesc: string; // Hazard Description, MaxLength 255
  RiskLevel: string; // LOW, MED, HIGH, CRIT, MaxLength 10
  ControlCode: string; // Control Code (FIRE01, GAS01, etc.), MaxLength 10
  ControlDesc: string; // Control Description, MaxLength 255
  ControlStatus: string; // OPEN, CLOSED, DONE, MaxLength 10
  ResponsibleUser: string; // User Name, MaxLength 12
  VerifiedBy: string; // User Name, MaxLength 12
  VerifiedAt: string | null; // UTC Timestamp
  Remarks: string; // Hazard Control Remarks, MaxLength 255
  SAP__Messages?: SapMessageItem[];
}

/**
 * GasTestType
 */
export interface GasTestRecord {
  PermitNo: string; // Key, MaxLength 10
  TestSeq: string; // Key, MaxLength 4 (DigitSequence: "1", "2")
  TestType: string; // INIT, RETEST, CONT, MaxLength 4
  TestDate: string | null; // Test Date (YYYY-MM-DD)
  TestTime: string; // Test Time (HH:mm:ss)
  TestLocation: string; // Location, MaxLength 60
  SampleLevel: string; // TOP, MID, BOT, MaxLength 10
  TestedBy: string; // User Name, MaxLength 12
  Cert: string; // Certification Number, MaxLength 30
  MeterType: string; // Gas Meter Type, MaxLength 30
  MeterId: string; // Gas Meter ID, MaxLength 30
  CalibDate: string | null; // Calibration Date (YYYY-MM-DD)
  BumpTestOk: IndicatorYN | string; // 'Y' / 'N'
  LelPct: number; // Lower Explosive Limit Percentage (Edm.Decimal 5,2)
  O2Pct: number; // Oxygen Percentage (Edm.Decimal 5,2)
  CoVal: number; // Carbon Monoxide Value (Edm.Decimal 8,2)
  H2sVal: number; // Hydrogen Sulfide Value (Edm.Decimal 8,2)
  OtherGas: string; // Other Gas Name, MaxLength 20
  OtherVal: number; // Other Gas Measured Value (Edm.Decimal 8,2)
  OtherUnit: string; // Other Gas Measurement Unit, MaxLength 6
  TesterSigned: IndicatorYN | string; // Tester Signature Confirmation 'Y' / 'N'
  Remarks: string; // Remarks, MaxLength 255
  SAP__Messages?: SapMessageItem[];
}

/**
 * IsolationType
 */
export interface IsolationRecord {
  PermitNo: string; // Key, MaxLength 10
  IsolationNo: string; // Key, MaxLength 20
  ItemNo: string; // Key, MaxLength 4
  IsolType: string; // FLOCK, VALVE, ELEC, BLIND, MaxLength 6
  ReferenceType: string; // EQUIP, FLOC, MaxLength 6
  ReferenceId: string; // Reference ID, MaxLength 30
  Status: string; // CRTD, ISOL, NORM, MaxLength 4
  RequestedBy: string;
  RequestedDate: string | null;
  RequestedTime: string;
  VerifiedBy: string;
  VerifiedDate: string | null;
  VerifiedTime: string;
  IsolatedBy: string;
  IsolatedDate: string | null;
  IsolatedTime: string;
  ApprovedBy: string;
  ApprovedDate: string | null;
  ApprovedTime: string;
  NormalizedBy: string;
  NormalizedDate: string | null;
  NormalizedTime: string;
  IsolationPoint: string; // Physical Isolation Point, MaxLength 60
  IsolMethod: string; // LOCK, TAG, MaxLength 10
  LockTagNo: string; // Lock / Tag Number, MaxLength 30
  IsIsolated: IndicatorYN | string; // 'Y' / 'N'
  PointIsolatedBy: string;
  PointIsolatedAt: string | null;
  ZeroEnergyConf: IndicatorYN | string; // 'Y' / 'N'
  ZeroEnergyBy: string;
  ZeroEnergyAt: string | null;
  IsNormalized: IndicatorYN | string; // 'Y' / 'N'
  PointNormalizedBy: string;
  PointNormalizedAt: string | null;
  Remarks: string; // Remarks, MaxLength 255
  LastChangedAt: string | null;
  SAP__Messages?: SapMessageItem[];
}

/**
 * AttachmentType
 */
export interface AttachmentRecord {
  PermitNo: string; // Key, MaxLength 10
  AttachmentId?: string; // Key, Computed in SAP, MaxLength 46
  FileName: string; // File Name, MaxLength 255
  MimeType: string; // MIME type, MaxLength 128
  DocumentRef: string; // Document Reference, MaxLength 100
  UploadedBy?: string; // User Name, MaxLength 12
  UploadedAt?: string | null; // UTC Timestamp
  SAP__Messages?: SapMessageItem[];
}

/**
 * ApprovalType
 */
export interface ApprovalRecord {
  PermitNo: string; // Key, MaxLength 10
  Stage: string; // Key, Stage ("01", "02"), MaxLength 6
  SeqNo: string; // Key, Sequence Number ("1", "2"), MaxLength 3
  RoleId: string; // Key, Role ("VER", "APP", "ISS"), MaxLength 6
  Action: string; // VR, AP, RJ, MaxLength 2
  SignedBy: string; // User Name, MaxLength 12
  ActionDate: string | null; // Date (YYYY-MM-DD)
  ActionTime: string; // Time (HH:mm:ss)
  Comments: string; // Comments, MaxLength 255
  SAP__Messages?: SapMessageItem[];
}

/**
 * ShiftRenewalType
 */
export interface ShiftRenewalRecord {
  PermitNo: string; // Key, MaxLength 10
  RenewalNo: string; // Key, MaxLength 4
  PreviousShift: string; // MaxLength 10
  NewShift: string; // MaxLength 10
  PreviousValidToD: string | null; // YYYY-MM-DD
  PreviousValidToT: string; // HH:mm:ss
  NewValidToD: string | null; // YYYY-MM-DD
  NewValidToT: string; // HH:mm:ss
  RequestedBy: string; // User Name, MaxLength 12
  RequestedAt: string | null; // UTC Timestamp
  ApprovedBy: string; // User Name, MaxLength 12
  ApprovedAt: string | null; // UTC Timestamp
  Status: string; // REQUESTED, APPROVED, MaxLength 10
  Reason: string; // Reason, MaxLength 255
  SAP__Messages?: SapMessageItem[];
}

/**
 * AuditLogType
 */
export interface AuditLogRecord {
  PermitNo: string; // Key, MaxLength 10
  AuditId: string; // Key, MaxLength 10
  Action: string; // CREATE, UPDATE, APPROVE, MaxLength 30
  OldStatus: string; // MaxLength 10
  NewStatus: string; // MaxLength 10
  Actor: string; // User Name, MaxLength 12
  EventAt: string | null; // UTC Timestamp
  Comments: string; // Comments, MaxLength 255
  SAP__Messages?: SapMessageItem[];
}

// --------------------------------------------------------------------------
// 2. Deep Insert Complete Payload & Response Schema
// --------------------------------------------------------------------------

/**
 * Complete Deep Insert POST Payload to EntitySet `PermitInfo`
 */
export interface PermitDeepInsertPayload extends PermitInfoRecord {
  _Worker?: WorkerRecord[];
  _PPE?: PPERecord[];
  _Safety?: SafetyRecord[];
  _HazardControl?: HazardControlRecord[];
  _GasTest?: GasTestRecord[];
  _Isolation?: IsolationRecord[];
  _Attachment?: AttachmentRecord[];
  _Approval?: ApprovalRecord[];
  _ShiftRenewal?: ShiftRenewalRecord[];
  _AuditLog?: AuditLogRecord[];
}

/**
 * Response returned by SAP Gateway on Deep Insert
 */
export interface PermitDeepInsertResponse extends PermitDeepInsertPayload {
  '@odata.context'?: string;
  '@odata.metadataEtag'?: string;
  '@odata.etag'?: string;
  SAP__Messages?: SapMessageItem[];
}

// --------------------------------------------------------------------------
// 3. Backward Compatible Aliases for Existing App Components
// --------------------------------------------------------------------------
export type PermitType = PermitTypeCode;
export type PermitStatus = PermitStatusCode;
export type RiskLevel = RiskLevelCode;

export interface PermitHeader {
  PermitId: string;
  PermitType: PermitType;
  Title: string;
  Description: string;
  Plant: string;
  Area: string;
  EquipmentId?: string;
  EquipmentDescription?: string;
  Status: PermitStatus;
  RiskLevel: RiskLevel;
  RiskScore: number;
  ValidFrom: string;
  ValidTo: string;
  ContractorCompany?: string;
  NumberOfWorkers: number;
  CreatedBy: string;
  CreatedAt: string;
  LastChangedAt?: string;
  '@odata.etag'?: string;

  Hazards?: PermitHazard[];
  PpeItems?: PermitPPE[];
  Approvals?: PermitApproval[];
  Isolations?: PermitIsolation[];
  GasTests?: PermitGasTest[];
}

export interface PermitHazard {
  HazardId: string;
  PermitId: string;
  Category: 'MECHANICAL' | 'ELECTRICAL' | 'THERMAL' | 'CHEMICAL' | 'RADIATION' | 'HEIGHT';
  HazardDescription: string;
  Severity: number;
  Likelihood: number;
  ControlMeasure: string;
}

export interface PermitPPE {
  PpeId: string;
  PermitId: string;
  PpeCode: 'HARD_HAT' | 'SAFETY_GLASSES' | 'EAR_DEFENDER' | 'STEEL_TOE_BOOTS' | 'GLOVES' | 'RESPIRATOR' | 'SAFETY_HARNESS' | 'ARC_FLASH_SUIT';
  Required: boolean;
  Remarks?: string;
}

export interface PermitApproval {
  ApprovalStepId: string;
  PermitId: string;
  StepNumber: number;
  RoleRequired: 'APPLICANT' | 'SAFETY_OFFICER' | 'AREA_OWNER' | 'OPERATIONS_MGR';
  ApproverUserId?: string;
  ApproverName?: string;
  Status: 'PENDING' | 'APPROVED' | 'REJECTED';
  Comments?: string;
  SignatureToken?: string;
  ActionTimestamp?: string;
}

export interface PermitIsolation {
  IsolationId: string;
  PermitId: string;
  TagNumber: string;
  IsolationPoint: string;
  Type: 'ELECTRICAL' | 'MECHANICAL_VALVE' | 'BLIND_FLANGE' | 'CONTROL_LOGIC';
  Status: 'PLANNED' | 'LOCKED' | 'TAGGED' | 'DE_ISOLATED';
  IsolatedByUserId: string;
  IsolatedAt?: string;
  VerifiedByUserId?: string;
  VerifiedAt?: string;
}

export interface PermitGasTest {
  TestId: string;
  PermitId: string;
  TestTimestamp: string;
  OxygenPct: number;
  FlammableLelPct: number;
  H2sPpm: number;
  CoPpm: number;
  TestedByUserId: string;
  TesterNotes?: string;
  Passed: boolean;
}

export interface PermitAuditEntry {
  LogId: string;
  PermitId: string;
  ChangedBy: string;
  Timestamp: string;
  Action: string;
  OldStatus?: string;
  NewStatus?: string;
  Remarks?: string;
}
