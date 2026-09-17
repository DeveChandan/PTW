/**
 * Permit To Work (PTW) Domain Entity Interfaces
 * Reflects SAP CDS / RAP Business Object Definition
 */

export type PermitType = 
  | 'HOT'   // Hot Work (Welding, Cutting, Grinding)
  | 'COLD'  // Cold Work (Maintenance, Painting)
  | 'CONF'  // Confined Space Entry
  | 'ELEC'  // High Voltage / Electrical Isolation
  | 'HGHT'; // Work at Height (> 2 meters)

export type PermitStatus = 
  | 'DRAF'  // Draft
  | 'SUBM'  // Submitted for Review
  | 'HSE_A' // Safety Officer Approved
  | 'AREA_A'// Area Owner Approved
  | 'APPR'  // Approved & Authorized
  | 'ACTV'  // Active in Field
  | 'SUSP'  // Suspended (Safety Stop)
  | 'CLOS'; // Closed / Archival

export type RiskLevel = 'LOW' | 'MED' | 'HIGH' | 'CRIT';

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
  ValidFrom: string; // ISO 8601 or EDM.DateTimeOffset
  ValidTo: string;
  ContractorCompany?: string;
  NumberOfWorkers: number;
  CreatedBy: string;
  CreatedAt: string;
  LastChangedAt?: string;
  '@odata.etag'?: string;

  // Navigations
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
  Severity: number; // 1 to 5
  Likelihood: number; // 1 to 5
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
  SignatureToken?: string; // Base64 signature image or crypto hash
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
  OxygenPct: number;       // Safe bounds: 19.5% - 23.5%
  FlammableLelPct: number; // Max safe: < 10%
  H2sPpm: number;          // Max safe: < 10 PPM
  CoPpm: number;           // Max safe: < 25 PPM
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
