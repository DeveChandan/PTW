/**
 * SAP OData V4 Standard Envelopes & Types
 */

export interface ODataCollectionResponse<T> {
  '@odata.context'?: string;
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
  value: T[];
}

export interface ODataSingleResponse<T> {
  '@odata.context'?: string;
  '@odata.etag'?: string;
  value?: T;
}

export interface ODataErrorDetail {
  code: string;
  message: string;
  target?: string;
}

export interface ODataErrorResponse {
  error: {
    code: string;
    message: string;
    target?: string;
    details?: ODataErrorDetail[];
    innererror?: {
      application?: {
        component_id?: string;
        service_namespace?: string;
        service_id?: string;
        service_version?: string;
      };
      transactionid?: string;
      timestamp?: string;
      Error_Resolution?: {
        SAP_Transaction?: string;
        SAP_Note?: string;
      };
      errordetails?: ODataErrorDetail[];
    };
  };
}

export interface ODataQueryParams {
  $select?: string[];
  $expand?: string[];
  $filter?: string;
  $orderby?: string;
  $top?: number;
  $skip?: number;
  $count?: boolean;
}
