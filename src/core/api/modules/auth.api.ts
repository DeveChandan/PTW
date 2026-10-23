import odataClient from '../odataClient';
import { ODATA_ENTITIES } from '../odataEndpoints';
import { ODataCollectionResponse } from '../../types/odata.types';
import { SapUserInfoRecord } from '../../auth/sapAuthContext';

export interface SapStartupInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  client?: string;
  language?: string;
}

/**
 * Module API: SAP Authentication, Identity & User Roles
 */
export const authApi = {
  /**
   * Attempts to discover the currently logged-in user from SAP NetWeaver's
   * standard startup and user services (/sap/bc/ui2/start_up or /sap/bc/ui2/user)
   * using the active browser session cookies.
   */
  async fetchStartupUser(client: string = '200'): Promise<SapStartupInfo | null> {
    const endpoints = [
      `/sap/bc/ui2/start_up?sap-client=${encodeURIComponent(client)}`,
      `/sap/bc/ui2/start_up`,
      `/sap/bc/ui2/user?sap-client=${encodeURIComponent(client)}`,
      `/sap/bc/ui2/user`
    ];

    for (const ep of endpoints) {
      try {
        const response = await odataClient.getRoot(ep, {
          withCredentials: true,
          timeout: 4000,
          headers: {
            'Accept': 'application/json',
            'sap-client': client
          }
        });

        const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
        // Reject HTML login pages returned with 200 OK
        if (contentType.includes('text/html') || response.headers?.['sap-authenticated'] === 'pending') {
          continue;
        }

        const data = response.data;
        if (!data || typeof data !== 'object') continue;

        const rawId =
          data.id ||
          data.userId ||
          data.userName ||
          data.user?.id ||
          data.user?.name ||
          data.d?.id ||
          data.d?.userId;

        if (typeof rawId === 'string' && rawId.trim()) {
          const id = rawId.trim().toUpperCase();
          return {
            id,
            firstName: data.firstName || data.user?.firstName || undefined,
            lastName: data.lastName || data.user?.lastName || undefined,
            fullName:
              data.fullName ||
              data.user?.fullName ||
              [data.firstName, data.lastName].filter(Boolean).join(' ') ||
              undefined,
            email: data.email || data.user?.email || undefined,
            client: data.client || data.sapClient || client,
            language: data.language || data.sapLanguage || undefined
          };
        }
      } catch {
        // Probe next endpoint
      }
    }

    return null;
  },

  /**
   * Fetches user profile, assigned plant, and SAP authorizations from the OData V4 userinfo entity set
   */
  async fetchUserInfo(userId: string, client: string = '200'): Promise<SapUserInfoRecord[]> {
    // Axios merges these with the active client's defaults; embedding a query
    // string in the URL would append a second sap-client parameter.
    const response = await odataClient.get<ODataCollectionResponse<SapUserInfoRecord>>(ODATA_ENTITIES.USER_INFO, {
      params: {
        $filter: `UserId eq '${userId.trim().toUpperCase().replace(/'/g, "''")}'`,
        'sap-client': client,
      },
    });
    return response.data?.value || [];
  },

  /**
   * Fetches assigned user roles directly from the SAP UserRole entity set
   * Service endpoint: /sap/opu/odata4/sap/zptw_mamagement_srv/srvd_a2x/sap/zptw_services/0001/UserRole
   */
  async fetchUserRoles(userId: string, client: string = '200'): Promise<Array<{
    SAP_USER: string;
    PTW_ROLE: string;
    ACTIVE: boolean;
  }>> {
    const cleanId = userId.trim().toUpperCase();
    try {
      const response = await odataClient.get<ODataCollectionResponse<{
        SAP_USER: string;
        PTW_ROLE: string;
        ACTIVE: boolean;
      }>>(ODATA_ENTITIES.USER_ROLE, {
        params: {
          $filter: `SAP_USER eq '${cleanId.replace(/'/g, "''")}'`,
          'sap-client': client,
        },
        timeout: 5000,
      });
      return response.data?.value || [];
    } catch {
      return [];
    }
  },

  /**
   * Triggers SAP ICF session termination
   */
  async triggerIcfLogoff(): Promise<void> {
    await odataClient.triggerIcfLogoff();
  },

  /**
   * Invalidate local basic auth headers and CSRF tokens
   */
  clearSession(): void {
    odataClient.clearCredentials();
  }
};

export default authApi;

