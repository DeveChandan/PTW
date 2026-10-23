import odataClient from '../odataClient';
import { ODATA_ENTITIES, buildODataQuery } from '../odataEndpoints';
import { PermitAuditEntry } from '../../types/ptw.types';
import { ODataCollectionResponse } from '../../types/odata.types';
import { SapUserRoleRecord } from '../../types/admin.types';

export interface PlantMasterRecord {
  PlantId: string;
  PlantName: string;
  Complex: string;
  Areas: string[];
}

export interface HazardCatalogItem {
  Category: string;
  Description: string;
  DefaultSeverity: number;
  DefaultLikelihood: number;
  RecommendedControl: string;
}

export interface PpeCatalogItem {
  PpeCode: string;
  Label: string;
  Category: 'HEAD' | 'EYE' | 'BODY' | 'HANDS' | 'FEET' | 'RESPIRATORY';
  MandatoryDefault: boolean;
}

export interface UserRoleFilterParams {
  user?: string;
  role?: string;
  activeOnly?: boolean;
}

export interface UserRoleStats {
  totalRoles: number;
  activeAdmins: number;
  activeApprovers: number;
  activeIssuers: number;
  activeRequesters: number;
  inactiveRoles: number;
  uniqueUsers: number;
}

// In-memory fallback and seed for development / offline resilience
// Only contains the real verified SAP record provided by the system
const FALLBACK_USER_ROLES: SapUserRoleRecord[] = [
  {
    SAP_USER: 'VERTIF-V',
    PTW_ROLE: 'PTW_ADMIN',
    ACTIVE: true,
    CREATED_BY: 'SYSTEM',
    CREATED_ON: '2026-10-23',
    CREATED_AT: '07:25:00',
    CHANGED_BY: '',
    CHANGED_ON: null,
    CHANGED_AT: '::',
    SAP__Messages: []
  }
];

let localRolesStore: SapUserRoleRecord[] = [...FALLBACK_USER_ROLES];

/**
 * Module API: PTW Admin (User Roles, Master Data, Catalogues & Global Audits)
 */
export const adminApi = {
  /**
   * Retrieves all SAP User Roles from /UserRole entity set with optional filtering
   */
  async getUserRoles(params?: UserRoleFilterParams): Promise<SapUserRoleRecord[]> {
    try {
      const filters: string[] = [];
      if (params?.user) {
        filters.push(`SAP_USER eq '${params.user.trim().toUpperCase().replace(/'/g, "''")}'`);
      }
      if (params?.role) {
        const cleanRole = params.role.trim().toUpperCase().replace(/'/g, "''");
        filters.push(`(PTW_ROLE eq '${cleanRole}' or PTW_ROLE eq 'Z${cleanRole}')`);
      }
      if (params?.activeOnly) {
        filters.push(`ACTIVE eq true`);
      }

      const queryParams: Record<string, string> = {};
      if (filters.length > 0) {
        queryParams['$filter'] = filters.join(' and ');
      }

      const response = await odataClient.get<ODataCollectionResponse<SapUserRoleRecord>>(
        ODATA_ENTITIES.USER_ROLE,
        {
          params: queryParams,
          timeout: 6000
        }
      );

      if (response.data?.value && Array.isArray(response.data.value)) {
        // Sync to local fallback memory cache
        localRolesStore = response.data.value;
        return response.data.value;
      }
    } catch (e) {
      console.warn('[adminApi] Live SAP /UserRole fetch failed, using local store:', e);
    }

    // Filter local store if offline / fallback
    return localRolesStore.filter((r) => {
      if (params?.user && r.SAP_USER.toUpperCase() !== params.user.trim().toUpperCase()) return false;
      if (params?.role) {
        const target = params.role.trim().toUpperCase();
        if (r.PTW_ROLE.toUpperCase() !== target && r.PTW_ROLE.toUpperCase() !== `Z${target}`) return false;
      }
      if (params?.activeOnly && !r.ACTIVE) return false;
      return true;
    });
  },

  /**
   * Assigns a PTW Role to an SAP User via POST /UserRole
   */
  async createUserRole(payload: {
    SAP_USER: string;
    PTW_ROLE: string;
    ACTIVE?: boolean;
  }): Promise<SapUserRoleRecord> {
    const cleanUser = payload.SAP_USER.trim().toUpperCase();
    const cleanRole = payload.PTW_ROLE.trim().toUpperCase();
    const isActive = payload.ACTIVE ?? true;

    const newRecord: SapUserRoleRecord = {
      SAP_USER: cleanUser,
      PTW_ROLE: cleanRole,
      ACTIVE: isActive,
      CREATED_BY: 'VERTIF-V',
      CREATED_ON: new Date().toISOString().slice(0, 10),
      CREATED_AT: new Date().toTimeString().slice(0, 8),
      CHANGED_BY: '',
      CHANGED_ON: null,
      CHANGED_AT: '::',
      SAP__Messages: []
    };

    try {
      const response = await odataClient.post<SapUserRoleRecord>(
        ODATA_ENTITIES.USER_ROLE,
        {
          SAP_USER: cleanUser,
          PTW_ROLE: cleanRole,
          ACTIVE: isActive
        }
      );

      const created = response.data || newRecord;
      localRolesStore = [created, ...localRolesStore.filter(r => !(r.SAP_USER === cleanUser && r.PTW_ROLE === cleanRole))];
      return created;
    } catch (e) {
      console.warn('[adminApi] Live POST /UserRole failed, updating local fallback cache:', e);
      localRolesStore = [newRecord, ...localRolesStore.filter(r => !(r.SAP_USER === cleanUser && r.PTW_ROLE === cleanRole))];
      return newRecord;
    }
  },

  /**
   * Updates user role activation status via PATCH /UserRole(SAP_USER='...',PTW_ROLE='...')
   */
  async updateUserRoleStatus(
    sapUser: string,
    ptwRole: string,
    active: boolean
  ): Promise<SapUserRoleRecord> {
    const cleanUser = sapUser.trim().toUpperCase();
    const cleanRole = ptwRole.trim().toUpperCase();
    const entityKey = `UserRole(SAP_USER='${cleanUser}',PTW_ROLE='${cleanRole}')`;

    try {
      const response = await odataClient.patch<SapUserRoleRecord>(
        entityKey,
        { ACTIVE: active }
      );

      const updated = response.data || {
        SAP_USER: cleanUser,
        PTW_ROLE: cleanRole,
        ACTIVE: active,
        CHANGED_BY: 'VERTIF-V',
        CHANGED_ON: new Date().toISOString().slice(0, 10),
        CHANGED_AT: new Date().toTimeString().slice(0, 8)
      };

      localRolesStore = localRolesStore.map((r) =>
        r.SAP_USER === cleanUser && r.PTW_ROLE === cleanRole
          ? { ...r, ACTIVE: active, CHANGED_BY: 'VERTIF-V', CHANGED_ON: new Date().toISOString().slice(0, 10) }
          : r
      );
      return updated;
    } catch (e) {
      console.warn('[adminApi] Live PATCH /UserRole failed, updating local cache:', e);
      localRolesStore = localRolesStore.map((r) =>
        r.SAP_USER === cleanUser && r.PTW_ROLE === cleanRole
          ? { ...r, ACTIVE: active, CHANGED_BY: 'VERTIF-V', CHANGED_ON: new Date().toISOString().slice(0, 10) }
          : r
      );
      const existing = localRolesStore.find(r => r.SAP_USER === cleanUser && r.PTW_ROLE === cleanRole);
      return existing || {
        SAP_USER: cleanUser,
        PTW_ROLE: cleanRole,
        ACTIVE: active
      };
    }
  },

  /**
   * Deletes a user role mapping via DELETE /UserRole(SAP_USER='...',PTW_ROLE='...')
   */
  async deleteUserRole(sapUser: string, ptwRole: string): Promise<boolean> {
    const cleanUser = sapUser.trim().toUpperCase();
    const cleanRole = ptwRole.trim().toUpperCase();
    const entityKey = `UserRole(SAP_USER='${cleanUser}',PTW_ROLE='${cleanRole}')`;

    try {
      await odataClient.delete(entityKey);
    } catch (e) {
      console.warn('[adminApi] Live DELETE /UserRole failed, purging local cache:', e);
    }

    localRolesStore = localRolesStore.filter(
      (r) => !(r.SAP_USER === cleanUser && r.PTW_ROLE === cleanRole)
    );
    return true;
  },

  /**
   * Updates an existing user role assignment.
   * If key properties (SAP_USER or PTW_ROLE) change, creates the new record and removes the obsolete key record in SAP.
   */
  async updateUserRole(
    oldRecord: { SAP_USER: string; PTW_ROLE: string },
    newRecord: { SAP_USER: string; PTW_ROLE: string; ACTIVE: boolean }
  ): Promise<SapUserRoleRecord> {
    const oldUser = oldRecord.SAP_USER.trim().toUpperCase();
    const oldRole = oldRecord.PTW_ROLE.trim().toUpperCase();
    const newUser = newRecord.SAP_USER.trim().toUpperCase();
    const newRole = newRecord.PTW_ROLE.trim().toUpperCase();

    // If key has not changed, perform PATCH on ACTIVE status
    if (oldUser === newUser && oldRole === newRole) {
      return this.updateUserRoleStatus(newUser, newRole, newRecord.ACTIVE);
    }

    // Key has changed: Create new record and delete obsolete key record in SAP
    const created = await this.createUserRole({
      SAP_USER: newUser,
      PTW_ROLE: newRole,
      ACTIVE: newRecord.ACTIVE
    });

    await this.deleteUserRole(oldUser, oldRole);
    return created;
  },

  /**
   * Computes aggregated user role stats
   */
  computeRoleStats(roles: SapUserRoleRecord[]): UserRoleStats {
    const activeRoles = roles.filter((r) => r.ACTIVE);
    const uniqueUsers = new Set(roles.map((r) => r.SAP_USER));

    return {
      totalRoles: roles.length,
      activeAdmins: activeRoles.filter(
        (r) => r.PTW_ROLE === 'PTW_ADMIN' || r.PTW_ROLE === 'ZPTW_ADMIN'
      ).length,
      activeApprovers: activeRoles.filter(
        (r) =>
          r.PTW_ROLE.startsWith('PTW_APPR') ||
          r.PTW_ROLE.startsWith('ZPTW_APPR') ||
          r.PTW_ROLE === 'PTW_APPROVER' ||
          r.PTW_ROLE === 'ZPTW_APPROVER'
      ).length,
      activeIssuers: activeRoles.filter(
        (r) =>
          r.PTW_ROLE === 'PTW_ISSU' ||
          r.PTW_ROLE === 'ZPTW_ISSU' ||
          r.PTW_ROLE === 'PTW_ISSUER' ||
          r.PTW_ROLE === 'ZPTW_ISSUER'
      ).length,
      activeRequesters: activeRoles.filter(
        (r) => r.PTW_ROLE === 'PTW_REQUESTER' || r.PTW_ROLE === 'ZPTW_REQUESTER'
      ).length,
      inactiveRoles: roles.filter((r) => !r.ACTIVE).length,
      uniqueUsers: uniqueUsers.size
    };
  },

  /**
   * Live probe tool to test /UserRole endpoint and return latency, status, ETag and payload
   */
  async probeUserRoleService(): Promise<{
    status: number;
    latencyMs: number;
    etag?: string;
    count: number;
    rawPayload: any;
  }> {
    const startTime = performance.now();
    try {
      const response = await odataClient.get(ODATA_ENTITIES.USER_ROLE, {
        params: { $top: '5' },
        timeout: 8000
      });
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        status: response.status,
        latencyMs,
        etag: response.headers?.['etag'] || response.headers?.['odata-version'],
        count: Array.isArray(response.data?.value) ? response.data.value.length : 0,
        rawPayload: response.data
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        status: err.response?.status || 500,
        latencyMs,
        count: 0,
        rawPayload: err.response?.data || { error: err.message }
      };
    }
  },

  /**
   * Retrieves plant locations and chemical processing units (e.g. Dahej Complex Fluo-1)
   */
  async getPlantMasterData(): Promise<PlantMasterRecord[]> {
    try {
      const response = await odataClient.get<ODataCollectionResponse<PlantMasterRecord>>(
        ODATA_ENTITIES.PLANTS
      );
      if (response.data?.value && response.data.value.length > 0) {
        return response.data.value;
      }
    } catch {
      // Fallback master records for GFL chemical plant complexes
    }

    return [
      {
        PlantId: '1000',
        PlantName: 'Dahej Chemical Complex (Fluo-1)',
        Complex: 'GFL Dahej',
        Areas: ['AREA-01-HCFC', 'AREA-02-TFE', 'AREA-03-PTFE', 'AREA-04-CAUSTIC', 'AREA-05-STORAGE']
      },
      {
        PlantId: '1100',
        PlantName: 'Ranjitnagar Fluorochemicals Unit',
        Complex: 'GFL Ranjitnagar',
        Areas: ['SEC-A-DISTILLATION', 'SEC-B-REACTION', 'SEC-C-RECOVERY']
      }
    ];
  },

  /**
   * Retrieves standardized hazard catalog items based on chemical risk engineering standards
   */
  async getHazardCatalog(): Promise<HazardCatalogItem[]> {
    return [
      {
        Category: 'CHEMICAL',
        Description: 'Exposure to Hydrofluoric Acid (HF) / Anhydrous Chlorine Gas',
        DefaultSeverity: 5,
        DefaultLikelihood: 3,
        RecommendedControl: 'Full chemical splash suit, SCBA respirator, HF neutralizer on standby'
      },
      {
        Category: 'THERMAL',
        Description: 'Steam line burn / Hot work ignition of flammable vapors',
        DefaultSeverity: 4,
        DefaultLikelihood: 3,
        RecommendedControl: 'Atmospheric LEL continuous sniffer, fire blanket, pressurized fire hose'
      },
      {
        Category: 'ELECTRICAL',
        Description: 'High voltage flashover (>440V switchgear)',
        DefaultSeverity: 5,
        DefaultLikelihood: 2,
        RecommendedControl: 'Zero-energy lock box verification, earth ground stick applied'
      },
      {
        Category: 'MECHANICAL',
        Description: 'High-pressure line rupture during flange unbolting',
        DefaultSeverity: 4,
        DefaultLikelihood: 3,
        RecommendedControl: 'Double block and bleed isolation, pressure release verification'
      },
      {
        Category: 'HEIGHT',
        Description: 'Fall from reactor dome scaffold (>2 meters)',
        DefaultSeverity: 4,
        DefaultLikelihood: 2,
        RecommendedControl: 'Full body safety harness with double lanyard attached to static line'
      }
    ];
  },

  /**
   * Retrieves standard PPE requirements matrix
   */
  async getPpeCatalog(): Promise<PpeCatalogItem[]> {
    return [
      { PpeCode: 'HARD_HAT', Label: 'Industrial Safety Helmet', Category: 'HEAD', MandatoryDefault: true },
      { PpeCode: 'SAFETY_GLASSES', Label: 'Impact Safety Goggles', Category: 'EYE', MandatoryDefault: true },
      { PpeCode: 'EAR_DEFENDER', Label: 'Ear Muff / Plugs (>85 dBA)', Category: 'HEAD', MandatoryDefault: false },
      { PpeCode: 'STEEL_TOE_BOOTS', Label: 'Chemical-Resistant Steel Toe Boots', Category: 'FEET', MandatoryDefault: true },
      { PpeCode: 'GLOVES', Label: 'Heavy-Duty Nitrile / Butyl Gloves', Category: 'HANDS', MandatoryDefault: true },
      { PpeCode: 'RESPIRATOR', Label: 'Full-Face Cartridge / SCBA Respirator', Category: 'RESPIRATORY', MandatoryDefault: false },
      { PpeCode: 'SAFETY_HARNESS', Label: 'Full-Body Fall Arrest Harness', Category: 'BODY', MandatoryDefault: false },
      { PpeCode: 'ARC_FLASH_SUIT', Label: 'Arc Flash Shield & Suit (Cal/cm²)', Category: 'BODY', MandatoryDefault: false }
    ];
  },

  /**
   * Global audit trails across all plant permits for EHS regulatory compliance (OSHA PSM / ISO 45001)
   */
  async getGlobalAuditLogs(top: number = 50, skip: number = 0): Promise<PermitAuditEntry[]> {
    try {
      const query = buildODataQuery({
        $orderby: 'Timestamp desc',
        $top: top,
        $skip: skip
      });
      const endpoint = `${ODATA_ENTITIES.AUDIT_ENTRIES}${query}`;
      const response = await odataClient.get<ODataCollectionResponse<PermitAuditEntry>>(endpoint);
      if (response.data?.value && response.data.value.length > 0) {
        return response.data.value;
      }
    } catch {
      // Fallback audit log entries
    }

    return [];
  }
};

export default adminApi;
