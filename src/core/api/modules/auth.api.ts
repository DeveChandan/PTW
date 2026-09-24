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
    const filter = encodeURIComponent(`UserId eq '${userId.trim().toUpperCase()}'`);
    const endpoint = `${ODATA_ENTITIES.USER_INFO}?$filter=${filter}&sap-client=${client}`;
    const response = await odataClient.get<ODataCollectionResponse<SapUserInfoRecord>>(endpoint);
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
