export interface SapIsolationItem {
  IsolationNo?: string;
  ItemNo?: string;
  ReferenceType: string; // 'EQUI' | 'FLOC' | string
  ReferenceId: string; // e.g. '10000001'
  IsolationPoint: string; // Physical point e.g. 'P-101 INLET'
  IsolType: string; // 'MECH' | 'ELEC' | 'INST' | 'PNEU' | 'HYD'
  IsolMethod: string; // 'VALVE' | 'BREAKER' | 'BLIND' | 'LOCK' | 'FUSE'
  IsolatedState: string; // 'CLOSED' | 'OPEN' | 'RACKED_OUT' | 'BLINDED' | 'TAGGED'
  DeIsolatedState?: string;
  LockTagNo: string; // Lock / Tag Number e.g. 'LT-0001'
  IsIsolated?: string; // 'X' | 'Y' | 'N' | ''
  IsolatedBy?: string;
  IsolatedAt?: string | null;
  ZeroEnergyConf?: string; // 'X' | 'Y' | 'N' | ''
  ZeroEnergyBy?: string;
  ZeroEnergyAt?: string | null;
  IsNormalized?: string; // 'X' | 'Y' | 'N' | ''
  NormalizedBy?: string;
  NormalizedAt?: string | null;
  IsolationSeq?: number;
  NormalizationSeq?: number;
  NormalizationReason?: string;
  Remarks: string;
  SAP__Messages?: any[];
}

/**
 * Normalizes SAP boolean indicator flags ('X', 'Y', '1', 'TRUE' vs '', ' ', 'N', null)
 */
export const isSapFlagTrue = (flag?: string | boolean | null): boolean => {
  if (flag === true) return true;
  if (!flag || typeof flag !== 'string') return false;
  const s = flag.trim().toUpperCase();
  return s === 'X' || s === 'Y' || s === 'TRUE' || s === '1';
};

/**
 * Checks whether an isolation point is normalized / restored
 * Supports SAP standard 'X', 'Y', NormalizedAt timestamp, or positive NormalizationSeq
 */
export const isPointNormalized = (item?: Partial<SapIsolationItem> | null): boolean => {
  if (!item) return false;
  if (isSapFlagTrue(item.IsNormalized)) return true;
  if (Boolean(item.NormalizedAt) || Boolean(item.NormalizedBy?.trim())) return true;
  if (typeof item.NormalizationSeq === 'number' && item.NormalizationSeq > 0) return true;
  return false;
};

/**
 * Checks whether an isolation point has physical isolation confirmed
 * Supports SAP standard 'X', 'Y', or IsolatedAt timestamp
 */
export const isPointIsolated = (item?: Partial<SapIsolationItem> | null): boolean => {
  if (!item) return false;
  if (isSapFlagTrue(item.IsIsolated)) return true;
  if (Boolean(item.IsolatedAt) || Boolean(item.IsolatedBy?.trim())) return true;
  return false;
};

/**
 * Checks whether an isolation point has zero-energy confirmed
 * Supports SAP standard 'X', 'Y', or ZeroEnergyAt timestamp
 */
export const isPointZeroEnergy = (item?: Partial<SapIsolationItem> | null): boolean => {
  if (!item) return false;
  if (isSapFlagTrue(item.ZeroEnergyConf)) return true;
  if (Boolean(item.ZeroEnergyAt) || Boolean(item.ZeroEnergyBy?.trim())) return true;
  return false;
};

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
  description?: string;
  IsTemplate?: 'X' | ' ' | string; // 'X' when isolation certificate is marked/saved as reusable template
  isTemplate?: boolean;
  SAP__Messages?: any[];
  _Item: SapIsolationItem[];
}

export interface SapIsolationResponse {
  '@odata.context'?: string;
  '@odata.metadataEtag'?: string;
  value: SapIsolationHeader[];
}
