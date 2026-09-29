export type ConfigType = 'PPE' | 'SHIFT' | 'PERMIT_TYPE' | 'WORKER_TYPE';

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
