/**
 * Standard Isolation & LOTO Template Definitions
 * Type interfaces for reusable zero-energy isolation certificates in SAP S/4HANA.
 */

export interface StandardIsolationPoint {
  ReferenceType: 'EQUI' | 'FLOC' | string;
  ReferenceId?: string;
  IsolationPoint: string;
  IsolType: 'MECH' | 'ELEC' | 'INST' | 'PNEU' | 'HYDR' | string;
  IsolMethod: 'VALVE' | 'BRKR' | 'BLND' | 'FUSE' | 'DISC' | string;
  IsolatedState: 'CLOSED' | 'OPEN' | 'RACKED_OUT' | 'BLINDED' | 'LOCKED' | 'PULLED' | 'APPLIED' | string;
  DeIsolatedState?: string;
  LockTagNo: string;
  Remarks: string;
}

export interface StandardIsolationTemplate {
  id: string;
  title: string;
  description: string;
  remarks: string;
  category: string;
  source: 'SAP_BACKEND';
  isolationNo?: string;
  points: StandardIsolationPoint[];
}

/**
 * Standard templates list - only live templates from SAP S/4HANA backend are used.
 * Dummy/hardcoded presets have been completely removed.
 */
export const STANDARD_ISOLATION_TEMPLATES: StandardIsolationTemplate[] = [];
