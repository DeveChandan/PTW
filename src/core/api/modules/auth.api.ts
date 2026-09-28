import odataClient from '../odataClient';
import { ODATA_ENTITIES } from '../odataEndpoints';
import { ODataCollectionResponse } from '../../types/odata.types';
import { SapUserInfoRecord } from '../../auth/sapAuthContext';

/**
 * Module API: SAP Authentication, Identity & User Roles
 */
export const authApi = {
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
