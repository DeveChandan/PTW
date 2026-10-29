export type ConfigType = 
  | 'PPE' 
  | 'SHIFT' 
  | 'PERMIT_TYPE' 
  | 'WORKER_TYPE' 
  | 'DEPARTMENT'
  | 'PLANT'
  | 'ISOLATION_TYPE'
  | 'ISOLATED_STATE'
  | 'ISOL_METHOD'
  | 'DEISOLATED_STATE'
  | 'PTW_ADMIN'
  | 'PTW_ACCEPTOR_ROLE'
  | 'PTW_APPROVAL_ROLE'
  | 'PTW_AREA_ROLE'
  | 'PTW_GASTESTER_ROLE'
  | 'PTW_HOLDER_ROLE'
  | 'PTW_ISOLATION_ROLE'
  | 'PTW_ISSUER_ROLE'
  | 'PTW_SAFETY_ROLE';

export interface SapConfigRecord {
  Config_Type: ConfigType | string;
  Config_Code: string;
  Config_Desc: string;
  Parent_Code: string;
  Active: string; // 'X' or ''
}

export interface SapConfigResponse {
  '@odata.context'?: string;
  '@odata.metadataEtag'?: string;
  value: SapConfigRecord[];
}
