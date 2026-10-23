import { SafetyDistrict, Avenue, Street } from '../../core/ptw/safetyDistricts';

export type CanvasTheme = 'cad' | 'dark';

export type SelectedEntityCategory = 'DISTRICT' | 'AVENUE' | 'STREET';

export interface SelectedEntity {
  category: SelectedEntityCategory;
  item: SafetyDistrict | Avenue | Street;
  pinCoords: { x: number; y: number };
}

export type InteractionMode = 'inspect' | 'pin';

export type DirectoryTab = 'sd' | 'avenues' | 'streets' | 'permits';

export type PermitWorkType = 'Hot Work' | 'Cold Work' | 'Confined Space' | 'Height / Crane' | 'Excavation / Road';

export interface ActivePermitPin {
  ptwNo: string;
  type: PermitWorkType;
  targetId: string;
  targetName: string;
  owner: string;
  contractor: string;
  desc: string;
  x: number;
  y: number;
}

export interface MapLayerVisibility {
  districts: boolean;
  hatches: boolean;
  avenues: boolean;
  streets: boolean;
  pins: boolean;
}
