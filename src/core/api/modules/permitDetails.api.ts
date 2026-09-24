import odataClient from '../odataClient';
import { ODATA_ENTITIES, buildODataQuery } from '../odataEndpoints';
import { PermitHeader, PermitAuditEntry, PermitStatus, PermitType } from '../../types/ptw.types';
import { ODataCollectionResponse, ODataQueryParams } from '../../types/odata.types';

export interface PermitFilterOptions {
  status?: PermitStatus;
  plant?: string;
  area?: string;
  type?: PermitType;
  search?: string;
  top?: number;
  skip?: number;
  orderBy?: string;
}

/**
 * Module API: Permit Details & Operational Overview
 */
export const permitDetailsApi = {
  /**
   * Retrieves single permit by PermitId with optional association expansion
   */
  async getPermitById(permitId: string, expandAll: boolean = true): Promise<PermitHeader> {
    const expandClause = expandAll
      ? ['Hazards', 'PpeItems', 'Approvals', 'Isolations', 'GasTests']
      : undefined;

    const query = buildODataQuery({ $expand: expandClause });
    const endpoint = `${ODATA_ENTITIES.PERMITS}('${permitId}')${query}`;
    const response = await odataClient.get<PermitHeader>(endpoint);
    return response.data;
  },

  /**
   * Queries list of permits with flexible filters and pagination
   */
  async getPermitsList(options?: PermitFilterOptions): Promise<ODataCollectionResponse<PermitHeader>> {
    const filters: string[] = [];

    if (options?.status) {
      filters.push(`Status eq '${options.status}'`);
    }
    if (options?.plant) {
      filters.push(`Plant eq '${options.plant}'`);
    }
    if (options?.area) {
      filters.push(`Area eq '${options.area}'`);
    }
    if (options?.type) {
      filters.push(`PermitType eq '${options.type}'`);
    }
    if (options?.search) {
      const escaped = options.search.replace(/'/g, "''");
      filters.push(`(contains(Title, '${escaped}') or contains(PermitId, '${escaped}'))`);
    }

    const queryParams: ODataQueryParams = {
      $filter: filters.length > 0 ? filters.join(' and ') : undefined,
      $orderby: options?.orderBy || 'CreatedAt desc',
      $top: options?.top || 20,
      $skip: options?.skip || 0,
      $count: true,
    };

    const query = buildODataQuery(queryParams);
    const endpoint = `${ODATA_ENTITIES.PERMITS}${query}`;
    const response = await odataClient.get<ODataCollectionResponse<PermitHeader>>(endpoint);
    return response.data;
  },

  /**
   * Fetches historical lifecycle changes and audit events for a permit
   */
  async getAuditTrail(permitId: string): Promise<PermitAuditEntry[]> {
    const filter = encodeURIComponent(`PermitId eq '${permitId}'`);
    const endpoint = `${ODATA_ENTITIES.AUDIT_ENTRIES}?$filter=${filter}&$orderby=Timestamp desc`;
    const response = await odataClient.get<ODataCollectionResponse<PermitAuditEntry>>(endpoint);
    return response.data?.value || [];
  },

  /**
   * Helper returning printable formal PTW PDF stream link
   */
  getPrintUrl(permitId: string): string {
    return `/sap/opu/odata4/sap/zptw_mamagement_srv/srvd_a2x/sap/zptw_services/0001/${ODATA_ENTITIES.PERMITS}('${permitId}')/PdfContent`;
  },
};

export default permitDetailsApi;
