import { odataClient } from '../odataClient';
import { ConfigType, SapConfigRecord, SapConfigResponse } from '../../types/config.types';

/**
 * Offline / Fallback Seed Data supplied by SAP backend configuration
 * Used when disconnected from VPN or when SAP Gateway is unreachable.
 */
const FALLBACK_CONFIG_DATA: Record<ConfigType, SapConfigRecord[]> = {
  PPE: [
    { Config_Type: 'PPE', Config_Code: 'ARCFLHV', Config_Desc: 'ARC FLASH SUIT WITH HOOD (HV) 40CAL/CM²', Parent_Code: 'ELECTRICAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'ARCFLLV', Config_Desc: 'ARC FLASH SUIT WITH HOOD (LV) 8CAL/CM²', Parent_Code: 'ELECTRICAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'CHEMGLOV', Config_Desc: 'CHEMICAL RESISTANT GLOVES', Parent_Code: 'LINE_BRK', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'CHEMGOGG', Config_Desc: 'CHEMICAL SPLASH GOGGLES', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'CHEMSUIT', Config_Desc: 'CHEMICAL-RESISTANT SUIT', Parent_Code: 'LINE_BRK', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'COTGLOVE', Config_Desc: 'COTTON GLOVES (WITH OR W/O PVC DOTS)', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'CUTGLOVE', Config_Desc: 'CUT RESISTANCE GLOVES', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'DIELSHOE', Config_Desc: 'DI-ELECTRIC RUBBER SHOES', Parent_Code: 'ELECTRICAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'DUSTMASK', Config_Desc: 'DUST MASK', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'FACESHLD', Config_Desc: 'FACE SHIELD', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'FLAMESUIT', Config_Desc: 'FLAME-RESISTANT SUIT', Parent_Code: 'LINE_BRK', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'FRCLOTH', Config_Desc: 'FIRE-RETARDANT CLOTHING', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'FULLBODY', Config_Desc: 'FULL BODY PROTECTION (JACKET/APRON RUBBER, NEOPRENE-SUITS)', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'FULLRESP', Config_Desc: 'FULL-FACE (AIR PURIFYING VIA CARTRIDGE)', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'GUMBOOTS', Config_Desc: 'GUM BOOTS', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'HALFRESP', Config_Desc: 'HALF-FACE (MOUTH, NOSE)', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'HEARPROT', Config_Desc: 'HEARING PROTECTION', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'HEATGLOV', Config_Desc: 'HEAT RESISTANT GLOVES', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'HVGLOVE', Config_Desc: 'HIGH VOLTAGE GLOVES', Parent_Code: 'ELECTRICAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'LEATHGLV', Config_Desc: 'LEATHER GLOVES', Parent_Code: 'LINE_BRK', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'LVGLOVE', Config_Desc: 'LOW VOLTAGE GLOVES (1.1KV)', Parent_Code: 'ELECTRICAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'NITGLOVE', Config_Desc: 'NITRILE GLOVES', Parent_Code: 'LINE_BRK', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'SAFHARN', Config_Desc: 'FALL PROTECTION - SA', Parent_Code: 'ELECTRICAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'SAFHELM', Config_Desc: 'SAFETY HELMET', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'SAFSHOES', Config_Desc: 'SAFETY SHOES', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'SCBA', Config_Desc: 'SELF-CONTAINED BREATHING APPARATUS', Parent_Code: 'LINE_BRK', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'SGLASSES', Config_Desc: 'SAFETY GLASSES', Parent_Code: 'GENERAL', Active: 'X' },
    { Config_Type: 'PPE', Config_Code: 'WELDGOGG', Config_Desc: 'WELDING OR CUTTING GOGGLES', Parent_Code: 'GENERAL', Active: 'X' }
  ],
  SHIFT: [
    { Config_Type: 'SHIFT', Config_Code: 'A', Config_Desc: 'SHIFT A', Parent_Code: '', Active: 'X' },
    { Config_Type: 'SHIFT', Config_Code: 'B', Config_Desc: 'SHIFT B', Parent_Code: '', Active: 'X' },
    { Config_Type: 'SHIFT', Config_Code: 'C', Config_Desc: 'SHIFT C', Parent_Code: '', Active: 'X' },
    { Config_Type: 'SHIFT', Config_Code: 'EXTENDED DAY', Config_Desc: 'EXTENDED DAY', Parent_Code: '', Active: 'X' },
    { Config_Type: 'SHIFT', Config_Code: 'EXTENDED NIGHT', Config_Desc: 'EXTENDED NIGHT', Parent_Code: '', Active: 'X' },
    { Config_Type: 'SHIFT', Config_Code: 'G', Config_Desc: 'SHIFT GENERAL', Parent_Code: '', Active: 'X' }
  ],
  PERMIT_TYPE: [
    { Config_Type: 'PERMIT_TYPE', Config_Code: 'COLD', Config_Desc: 'COLD WORK', Parent_Code: '', Active: 'X' },
    { Config_Type: 'PERMIT_TYPE', Config_Code: 'CSE', Config_Desc: 'CONFINED SPACE ENTRY', Parent_Code: '', Active: 'X' },
    { Config_Type: 'PERMIT_TYPE', Config_Code: 'EXCV', Config_Desc: 'EXCAVATION', Parent_Code: '', Active: 'X' },
    { Config_Type: 'PERMIT_TYPE', Config_Code: 'HOT', Config_Desc: 'HOT WORK', Parent_Code: '', Active: 'X' },
    { Config_Type: 'PERMIT_TYPE', Config_Code: 'HYD_PNEU', Config_Desc: 'HYDRAULIC & PNEUMATIC SYSTEM', Parent_Code: '', Active: 'X' },
    { Config_Type: 'PERMIT_TYPE', Config_Code: 'LBRK', Config_Desc: 'LINE BREAK', Parent_Code: '', Active: 'X' },
    { Config_Type: 'PERMIT_TYPE', Config_Code: 'RAD', Config_Desc: 'RADIOGRAPHY', Parent_Code: '', Active: 'X' },
    { Config_Type: 'PERMIT_TYPE', Config_Code: 'RIG', Config_Desc: 'RIGGING', Parent_Code: '', Active: 'X' },
    { Config_Type: 'PERMIT_TYPE', Config_Code: 'W@H', Config_Desc: 'WORK AT HEIGHT', Parent_Code: '', Active: 'X' },
    { Config_Type: 'PERMIT_TYPE', Config_Code: 'ELEC', Config_Desc: 'ELECTRICAL', Parent_Code: '', Active: 'X' }
  ],
  WORKER_TYPE: [
    { Config_Type: 'WORKER_TYPE', Config_Code: 'CONT', Config_Desc: 'CONTRACTOR', Parent_Code: '', Active: 'X' },
    { Config_Type: 'WORKER_TYPE', Config_Code: 'EMP', Config_Desc: 'EMPLOYEE', Parent_Code: '', Active: 'X' }
  ]
};

class ConfigApiService {
  private cache: Map<string, SapConfigRecord[]> = new Map();

  /**
   * Fetches configuration records directly from SAP S/4HANA OData V4 service.
   * Performs live HTTP GET: Config?$filter=Config_Type eq '{type}'
   * Falls back to offline payload if the server is unreachable.
   */
  public async fetchConfigByType(type: ConfigType, forceRefresh = false): Promise<SapConfigRecord[]> {
    if (!forceRefresh && this.cache.has(type)) {
      return this.cache.get(type)!;
    }

    try {
      // Live HTTP GET call to SAP Gateway endpoint
      const filter = encodeURIComponent(`Config_Type eq '${type}'`);
      const response = await odataClient.get<SapConfigResponse>(`Config?$filter=${filter}`);
      
      const records = response.data?.value || [];
      const activeRecords = records.filter(item => item.Active === 'X');

      if (activeRecords.length > 0) {
        this.cache.set(type, activeRecords);
        return activeRecords;
      }

      // If SAP returned empty array, use local fallback
      const fallback = FALLBACK_CONFIG_DATA[type] || [];
      this.cache.set(type, fallback);
      return fallback;
    } catch (error) {
      console.warn(`[ConfigApi] Live fetch for Config_Type='${type}' failed, using fallback data. Reason:`, error);
      const fallback = FALLBACK_CONFIG_DATA[type] || [];
      this.cache.set(type, fallback);
      return fallback;
    }
  }

  public async fetchPpeConfig(forceRefresh = false): Promise<SapConfigRecord[]> {
    return this.fetchConfigByType('PPE', forceRefresh);
  }

  public async fetchShiftConfig(forceRefresh = false): Promise<SapConfigRecord[]> {
    return this.fetchConfigByType('SHIFT', forceRefresh);
  }

  public async fetchPermitTypeConfig(forceRefresh = false): Promise<SapConfigRecord[]> {
    return this.fetchConfigByType('PERMIT_TYPE', forceRefresh);
  }

  public async fetchWorkerTypeConfig(forceRefresh = false): Promise<SapConfigRecord[]> {
    return this.fetchConfigByType('WORKER_TYPE', forceRefresh);
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const configApi = new ConfigApiService();
export default configApi;
