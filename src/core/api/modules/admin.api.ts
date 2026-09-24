import odataClient from '../odataClient';
import { ODATA_ENTITIES, buildODataQuery } from '../odataEndpoints';
import { PermitAuditEntry } from '../../types/ptw.types';
import { ODataCollectionResponse } from '../../types/odata.types';

export interface PlantMasterRecord {
  PlantId: string;
  PlantName: string;
  Complex: string;
  Areas: string[];
}

export interface HazardCatalogItem {
  Category: string;
  Description: string;
  DefaultSeverity: number;
  DefaultLikelihood: number;
  RecommendedControl: string;
}

export interface PpeCatalogItem {
  PpeCode: string;
  Label: string;
  Category: 'HEAD' | 'EYE' | 'BODY' | 'HANDS' | 'FEET' | 'RESPIRATORY';
  MandatoryDefault: boolean;
}

/**
 * Module API: PTW Admin (Master Data, Catalogues & Global Audits)
 */
export const adminApi = {
  /**
   * Retrieves plant locations and chemical processing units (e.g. Dahej Complex Fluo-1)
   */
  async getPlantMasterData(): Promise<PlantMasterRecord[]> {
    try {
      const response = await odataClient.get<ODataCollectionResponse<PlantMasterRecord>>(
        ODATA_ENTITIES.PLANTS
      );
      if (response.data?.value && response.data.value.length > 0) {
        return response.data.value;
      }
    } catch {
      // Fallback master records for GFL chemical plant complexes
    }

    return [
      {
        PlantId: '1000',
        PlantName: 'Dahej Chemical Complex (Fluo-1)',
        Complex: 'GFL Dahej',
        Areas: ['AREA-01-HCFC', 'AREA-02-TFE', 'AREA-03-PTFE', 'AREA-04-CAUSTIC', 'AREA-05-STORAGE'],
      },
      {
        PlantId: '1100',
        PlantName: 'Ranjitnagar Fluorochemicals Unit',
        Complex: 'GFL Ranjitnagar',
        Areas: ['SEC-A-DISTILLATION', 'SEC-B-REACTION', 'SEC-C-RECOVERY'],
      },
    ];
  },

  /**
   * Retrieves standardized hazard catalog items based on chemical risk engineering standards
   */
  async getHazardCatalog(): Promise<HazardCatalogItem[]> {
    return [
      {
        Category: 'CHEMICAL',
        Description: 'Exposure to Hydrofluoric Acid (HF) / Anhydrous Chlorine Gas',
        DefaultSeverity: 5,
        DefaultLikelihood: 3,
        RecommendedControl: 'Full chemical splash suit, SCBA respirator, HF neutralizer on standby',
      },
      {
        Category: 'THERMAL',
        Description: 'Steam line burn / Hot work ignition of flammable vapors',
        DefaultSeverity: 4,
        DefaultLikelihood: 3,
        RecommendedControl: 'Atmospheric LEL continuous sniffer, fire blanket, pressurized fire hose',
      },
      {
        Category: 'ELECTRICAL',
        Description: 'High voltage flashover (>440V switchgear)',
        DefaultSeverity: 5,
        DefaultLikelihood: 2,
        RecommendedControl: 'Zero-energy lock box verification, earth ground stick applied',
      },
      {
        Category: 'MECHANICAL',
        Description: 'High-pressure line rupture during flange unbolting',
        DefaultSeverity: 4,
        DefaultLikelihood: 3,
        RecommendedControl: 'Double block and bleed isolation, pressure release verification',
      },
      {
        Category: 'HEIGHT',
        Description: 'Fall from reactor dome scaffold (>2 meters)',
        DefaultSeverity: 4,
        DefaultLikelihood: 2,
        RecommendedControl: 'Full body safety harness with double lanyard attached to static line',
      },
    ];
  },

  /**
   * Retrieves standard PPE requirements matrix
   */
  async getPpeCatalog(): Promise<PpeCatalogItem[]> {
    return [
      { PpeCode: 'HARD_HAT', Label: 'Industrial Safety Helmet', Category: 'HEAD', MandatoryDefault: true },
      { PpeCode: 'SAFETY_GLASSES', Label: 'Impact Safety Goggles', Category: 'EYE', MandatoryDefault: true },
      { PpeCode: 'EAR_DEFENDER', Label: 'Ear Muff / Plugs (>85 dBA)', Category: 'HEAD', MandatoryDefault: false },
      { PpeCode: 'STEEL_TOE_BOOTS', Label: 'Chemical-Resistant Steel Toe Boots', Category: 'FEET', MandatoryDefault: true },
      { PpeCode: 'GLOVES', Label: 'Heavy-Duty Nitrile / Butyl Gloves', Category: 'HANDS', MandatoryDefault: true },
      { PpeCode: 'RESPIRATOR', Label: 'Full-Face Cartridge / SCBA Respirator', Category: 'RESPIRATORY', MandatoryDefault: false },
      { PpeCode: 'SAFETY_HARNESS', Label: 'Full-Body Fall Arrest Harness', Category: 'BODY', MandatoryDefault: false },
      { PpeCode: 'ARC_FLASH_SUIT', Label: 'Arc Flash Shield & Suit (Cal/cm²)', Category: 'BODY', MandatoryDefault: false },
    ];
  },

  /**
   * Global audit trails across all plant permits for EHS regulatory compliance (OSHA PSM / ISO 45001)
   */
  async getGlobalAuditLogs(top: number = 50, skip: number = 0): Promise<PermitAuditEntry[]> {
    const query = buildODataQuery({
      $orderby: 'Timestamp desc',
      $top: top,
      $skip: skip,
    });
    const endpoint = `${ODATA_ENTITIES.AUDIT_ENTRIES}${query}`;
    const response = await odataClient.get<ODataCollectionResponse<PermitAuditEntry>>(endpoint);
    return response.data?.value || [];
  },
};

export default adminApi;
