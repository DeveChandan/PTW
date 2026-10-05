export type ConfigType = 
  | 'PPE' 
  | 'SHIFT' 
  | 'PERMIT_TYPE' 
  | 'WORKER_TYPE' 
  | 'DEPARTMENT'
  | 'ISOLATION_TYPE'
  | 'ISOLATED_STATE'
  | 'ISOL_METHOD'
  | 'DEISOLATED_STATE';

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
