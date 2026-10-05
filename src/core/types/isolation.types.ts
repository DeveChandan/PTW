export interface SapIsolationItem {
  IsolationNo?: string;
  ItemNo: string;
  ReferenceType: string; // 'EQUI' | 'FLOC' | string
  ReferenceId: string; // e.g. '10000001'
  IsolationPoint: string; // Physical point e.g. 'P-101 INLET'
  IsolType: string; // 'MECH' | 'ELEC' | 'INST' | 'PNEU' | 'HYD'
  IsolMethod: string; // 'VALVE' | 'BREAKER' | 'BLIND' | 'LOCK' | 'FUSE'
  IsolatedState: string; // 'CLOSED' | 'OPEN' | 'RACKED_OUT' | 'BLINDED' | 'TAGGED'
  DeIsolatedState?: string;
  LockTagNo: string; // Lock / Tag Number e.g. 'LT-0001'
  IsIsolated?: string; // 'Y' | 'N' | ''
  IsolatedBy?: string;
  IsolatedAt?: string | null;
  ZeroEnergyConf?: string; // 'Y' | 'N' | ''
  ZeroEnergyBy?: string;
  ZeroEnergyAt?: string | null;
  IsNormalized?: string; // 'Y' | 'N' | ''
  NormalizedBy?: string;
  NormalizedAt?: string | null;
  Remarks: string;
  SAP__Messages?: any[];
}

export interface SapIsolationHeader {
  '@odata.etag'?: string;
  IsolationNo: string; // Certificate ID e.g. 'ISO0000012'
  PermitNo: string; // Linked Permit No e.g. 'PTW0000002' or ''
  Status: 'CRTD' | 'ISOL' | 'NORM' | string;
  RequestedBy: string;
  RequestedDate: string;
  RequestedTime: string;
  VerifiedBy: string;
  VerifiedDate: string | null;
  VerifiedTime: string;
  ApprovedBy: string;
  ApprovedDate: string | null;
  ApprovedTime: string;
  NormalizedBy: string;
  NormalizedDate: string | null;
  NormalizedTime: string;
  Remarks: string;
  LastChangedAt: string | null;
  SAP__Messages?: any[];
  _Item: SapIsolationItem[];
}

export interface SapIsolationResponse {
  '@odata.context'?: string;
  '@odata.metadataEtag'?: string;
  value: SapIsolationHeader[];
}
