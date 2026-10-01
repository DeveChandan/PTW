import { ODataQueryParams } from '../types/odata.types';

/**
 * SAP OData V4 Service Entity Sets and Actions
 * Service Namespace: com.sap.gateway.srvd_a2x.zptw_services.v0001
 * Service root: /sap/opu/odata4/sap/zptw_mamagement_srv/srvd_a2x/sap/zptw_services/0001/
 */
export const ODATA_ENTITIES = {
  // Main PTW Header EntitySet
  PERMIT_INFO: 'PermitInfo',
  PERMITS: 'PermitInfo', // backward compatibility alias

  // Child EntitySets
  WORKER: 'Worker',
  PPE: 'PPE',
  SAFETY: 'Safety',
  HAZARD_CONTROL: 'HazardControl',
  GAS_TEST: 'GasTest',
  ISOLATION: 'Isolation',
  ATTACHMENT: 'Attachment',
  APPROVAL: 'Approval',
  SHIFT_RENEWAL: 'ShiftRenewal',
  AUDIT_LOG: 'AuditLog',

  // Authentication & System
  USER_INFO: 'userinfo',
  CONFIG: 'Config',
  CHECKLIST: 'Checklist',

  // Backward compatibility aliases
  HAZARDS: 'HazardControl',
  APPROVALS: 'Approval',
  ISOLATIONS: 'Isolation',
  GAS_TESTS: 'GasTest',
  AUDIT_ENTRIES: 'AuditLog',
  PLANTS: 'PlantMaster',
  EQUIPMENT: 'EquipmentMaster',
} as const;

/**
 * Deep Insert Navigation Collection Property Names (exact match with SAP metadata)
 */
export const ODATA_NAV_PROPERTIES = {
  WORKER: '_Worker',
  PPE: '_PPE',
  SAFETY: '_Safety',
  HAZARD_CONTROL: '_HazardControl',
  GAS_TEST: '_GasTest',
  ISOLATION: '_Isolation',
  ATTACHMENT: '_Attachment',
  APPROVAL: '_Approval',
  SHIFT_RENEWAL: '_ShiftRenewal',
  AUDIT_LOG: '_AuditLog',
} as const;

/**
 * Utility helper to build standard SAP OData V4 query strings
 */
export function buildODataQuery(params?: ODataQueryParams): string {
  if (!params) return '';

  const searchParams = new URLSearchParams();

  if (params.$select && params.$select.length > 0) {
    searchParams.set('$select', params.$select.join(','));
  }

  if (params.$expand && params.$expand.length > 0) {
    searchParams.set('$expand', params.$expand.join(','));
  }

  if (params.$filter) {
    searchParams.set('$filter', params.$filter);
  }

  if (params.$orderby) {
    searchParams.set('$orderby', params.$orderby);
  }

  if (typeof params.$top === 'number') {
    searchParams.set('$top', params.$top.toString());
  }

  if (typeof params.$skip === 'number') {
    searchParams.set('$skip', params.$skip.toString());
  }

  if (params.$count) {
    searchParams.set('$count', 'true');
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}
