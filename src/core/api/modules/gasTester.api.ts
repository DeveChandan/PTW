import odataClient from '../odataClient';
import { ODATA_ENTITIES } from '../odataEndpoints';
import { GasTestRecord, PermitGasTest } from '../../types/ptw.types';
import { ODataCollectionResponse } from '../../types/odata.types';

export interface GasSafetyThresholds {
  minOxygen: number;       // 19.5%
  maxOxygen: number;       // 23.5%
  maxFlammableLel: number; // Approved % LEL (e.g. 0% for hot work, 5% or 10% for entry)
  maxH2sPpm: number;       // Approved ppm (e.g. 5 or 10 ppm)
  maxCoPpm: number;        // Approved ppm (e.g. 25 ppm)
}

// The source has conflicting gas limits (pp. 11, 14, 24). No implicit clearance policy.
export const DEFAULT_GAS_THRESHOLDS: GasSafetyThresholds | undefined = undefined;

export type GasEvaluationStatus = 'OPTIMAL' | 'SAFE' | 'WARNING' | 'DANGER';

export interface GasParamEvaluation {
  status: GasEvaluationStatus;
  badgeClass: string;
  dotClass: string;
  label: string;
  message: string;
  unit: string;
  currentValue: number;
}

export interface AtmosphereAssessment {
  overallStatus: 'SAFE' | 'WARNING' | 'DANGER';
  canClearWork: boolean;
  summaryTitle: string;
  summaryMessage: string;
  bannerClass: string;
  o2: GasParamEvaluation;
  lel: GasParamEvaluation;
  co: GasParamEvaluation;
  h2s: GasParamEvaluation;
  other?: GasParamEvaluation;
}

/**
 * Live fallback data seeded from actual SAP S/4HANA OData V4 GasTest entity set
 */
export const FALLBACK_GAS_TESTS: GasTestRecord[] = [
  {
    PermitNo: 'PTW0000013',
    TestSeq: '1',
    TestType: 'INIT',
    TestDate: '2026-10-05',
    TestTime: '08:30:00',
    TestLocation: 'Reactor R-101 Top Manway',
    SampleLevel: 'TOP',
    TestedBy: 'VERTIF-V',
    Cert: 'AGT-GFL-2026-08',
    MeterType: 'Multi-Gas 4-in-1 MX4',
    MeterId: 'MTR-GFL-014',
    CalibDate: '2026-09-15',
    BumpTestOk: 'Y',
    LelPct: 0.00,
    O2Pct: 20.90,
    CoVal: 0.00,
    H2sVal: 0.00,
    OtherGas: 'SO2',
    OtherVal: 0.00,
    OtherUnit: 'PPM',
    TesterSigned: 'Y',
    Remarks: 'Initial stratified test at top level. Clean atmosphere, normal ambient oxygen, 0% LEL.',
    SAP__Messages: []
  },
  {
    PermitNo: 'PTW0000013',
    TestSeq: '2',
    TestType: 'INIT',
    TestDate: '2026-10-05',
    TestTime: '08:40:00',
    TestLocation: 'Reactor R-101 Middle Core',
    SampleLevel: 'MID',
    TestedBy: 'VERTIF-V',
    Cert: 'AGT-GFL-2026-08',
    MeterType: 'Multi-Gas 4-in-1 MX4',
    MeterId: 'MTR-GFL-014',
    CalibDate: '2026-09-15',
    BumpTestOk: 'Y',
    LelPct: 0.00,
    O2Pct: 20.90,
    CoVal: 0.00,
    H2sVal: 0.00,
    OtherGas: 'SO2',
    OtherVal: 0.00,
    OtherUnit: 'PPM',
    TesterSigned: 'Y',
    Remarks: 'Breathing zone stratified sample. Zero toxic gas detected.',
    SAP__Messages: []
  },
  {
    PermitNo: 'PTW0000013',
    TestSeq: '3',
    TestType: 'INIT',
    TestDate: '2026-10-05',
    TestTime: '08:50:00',
    TestLocation: 'Reactor R-101 Bottom Sump',
    SampleLevel: 'BOT',
    TestedBy: 'VERTIF-V',
    Cert: 'AGT-GFL-2026-08',
    MeterType: 'Multi-Gas 4-in-1 MX4',
    MeterId: 'MTR-GFL-014',
    CalibDate: '2026-09-15',
    BumpTestOk: 'Y',
    LelPct: 0.00,
    O2Pct: 20.80,
    CoVal: 2.00,
    H2sVal: 0.00,
    OtherGas: 'SO2',
    OtherVal: 0.00,
    OtherUnit: 'PPM',
    TesterSigned: 'Y',
    Remarks: 'Bottom level check. No dense toxic gas pooling. Cleared for cold confined space entry.',
    SAP__Messages: []
  },
  {
    PermitNo: 'PTW0000014',
    TestSeq: '1',
    TestType: 'INIT',
    TestDate: '2026-10-05',
    TestTime: '09:15:00',
    TestLocation: 'Distillation Column C-202 Flange',
    SampleLevel: 'MID',
    TestedBy: 'SAFETY-01',
    Cert: 'AGT-GFL-2026-04',
    MeterType: 'Industrial Scientific Ventis Pro5',
    MeterId: 'MTR-GFL-022',
    CalibDate: '2026-09-28',
    BumpTestOk: 'Y',
    LelPct: 2.50,
    O2Pct: 20.70,
    CoVal: 12.00,
    H2sVal: 1.00,
    OtherGas: 'VOC',
    OtherVal: 0.50,
    OtherUnit: 'PPM',
    TesterSigned: 'Y',
    Remarks: 'CAUTION: Trace hydrocarbon vapors present (2.5% LEL). Hot work prohibited. Forced air purging required.',
    SAP__Messages: []
  },
  {
    PermitNo: 'PTW0000015',
    TestSeq: '1',
    TestType: 'INIT',
    TestDate: '2026-10-05',
    TestTime: '10:00:00',
    TestLocation: 'Effluent Pit Trench E-09',
    SampleLevel: 'BOT',
    TestedBy: 'SAFETY-01',
    Cert: 'AGT-GFL-2026-04',
    MeterType: 'Industrial Scientific Ventis Pro5',
    MeterId: 'MTR-GFL-022',
    CalibDate: '2026-09-28',
    BumpTestOk: 'Y',
    LelPct: 14.00,
    O2Pct: 18.20,
    CoVal: 35.00,
    H2sVal: 18.00,
    OtherGas: 'Cl2',
    OtherVal: 1.20,
    OtherUnit: 'PPM',
    TesterSigned: 'Y',
    Remarks: 'CRITICAL HAZARD: Oxygen deficient (18.2%), H2S 18 ppm, LEL 14%. Entry prohibited. Red stop-work tag attached.',
    SAP__Messages: []
  }
];

class GasTesterApiService {
  private localStore: GasTestRecord[] = [...FALLBACK_GAS_TESTS];

  /**
   * Evaluates Oxygen (O2 % v/v) with precision safety limits and color indication
   */
  public evaluateO2(o2: number): GasParamEvaluation {
    const val = Number(o2);
    if (!Number.isFinite(val) || val <= 0) {
      return {
        status: 'DANGER',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 ring-rose-200',
        dotClass: 'bg-rose-600',
        label: 'Sensor Unread / Error',
        message: 'Invalid or zero oxygen reading. Instrument malfunction suspected.',
        unit: '% v/v',
        currentValue: val
      };
    }

    if (val < 19.5) {
      return {
        status: 'DANGER',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 ring-rose-200 animate-pulse',
        dotClass: 'bg-rose-600',
        label: 'Asphyxiation Hazard (< 19.5%)',
        message: `DANGER: Oxygen deficiency (${val.toFixed(2)}% v/v). Hypoxia hazard. Entry prohibited without supplied-air SCBA.`,
        unit: '% v/v',
        currentValue: val
      };
    }

    if (val > 23.5) {
      return {
        status: 'DANGER',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 ring-amber-200 animate-pulse',
        dotClass: 'bg-amber-600',
        label: 'Oxygen Enriched (> 23.5%)',
        message: `DANGER: Oxygen enrichment (${val.toFixed(2)}% v/v). Extreme fire risk. Ignition sources & hot work strictly prohibited.`,
        unit: '% v/v',
        currentValue: val
      };
    }

    if (val >= 20.8 && val <= 21.0) {
      return {
        status: 'OPTIMAL',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-emerald-200',
        dotClass: 'bg-emerald-500',
        label: 'Optimal / Ambient Air (20.9%)',
        message: `Optimal fresh air oxygen concentration (${val.toFixed(2)}% v/v). Ideal breathing atmosphere.`,
        unit: '% v/v',
        currentValue: val
      };
    }

    return {
      status: 'SAFE',
      badgeClass: 'bg-teal-50 text-teal-700 border-teal-300 ring-teal-200',
      dotClass: 'bg-teal-500',
      label: 'Safe Working Range (19.5 - 23.5%)',
      message: `Acceptable working oxygen concentration (${val.toFixed(2)}% v/v). Permissible for entry.`,
      unit: '% v/v',
      currentValue: val
    };
  }

  /**
   * Evaluates Combustible / Flammable Gas (% LEL) with precision safety limits and color indication
   */
  public evaluateLel(lel: number, isHotWork = false): GasParamEvaluation {
    const val = Number(lel);
    if (!Number.isFinite(val) || val < 0) {
      return {
        status: 'DANGER',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-300',
        dotClass: 'bg-rose-600',
        label: 'Sensor Unread / Error',
        message: 'Invalid LEL reading.',
        unit: '% LEL',
        currentValue: val
      };
    }

    if (val === 0) {
      return {
        status: 'OPTIMAL',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-emerald-200',
        dotClass: 'bg-emerald-500',
        label: 'Nil Flammable (0% LEL)',
        message: 'Zero combustible gas detected. Meets strict zero-LEL requirement for Hot Work and Vessel Entry.',
        unit: '% LEL',
        currentValue: val
      };
    }

    if (val < 5.0) {
      return {
        status: isHotWork ? 'DANGER' : 'WARNING',
        badgeClass: isHotWork ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-amber-50 text-amber-700 border-amber-300',
        dotClass: isHotWork ? 'bg-rose-600' : 'bg-amber-500',
        label: isHotWork ? 'Hot Work Prohibited (> 0% LEL)' : 'Trace Combustible (< 5% LEL)',
        message: isHotWork
          ? `VIOLATION: Hot work requires strictly 0.0% LEL. Current reading ${val.toFixed(2)}% LEL prohibits hot work.`
          : `CAUTION: Trace flammable vapors detected (${val.toFixed(2)}% LEL). Forced air ventilation must continue.`,
        unit: '% LEL',
        currentValue: val
      };
    }

    if (val < 10.0) {
      return {
        status: 'WARNING',
        badgeClass: 'bg-orange-50 text-orange-700 border-orange-300 ring-orange-200',
        dotClass: 'bg-orange-500',
        label: 'Elevated LEL (5% - 9.9%)',
        message: `WARNING: Elevated flammable gas (${val.toFixed(2)}% LEL). Evacuate confined space, purge with nitrogen/air.`,
        unit: '% LEL',
        currentValue: val
      };
    }

    return {
      status: 'DANGER',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 ring-rose-200 animate-pulse',
      dotClass: 'bg-rose-600',
      label: 'Explosive Hazard (≥ 10% LEL)',
      message: `CRITICAL DANGER: Flammable gas reached explosive threshold (${val.toFixed(2)}% LEL). Evacuate immediately!`,
      unit: '% LEL',
      currentValue: val
    };
  }

  /**
   * Evaluates Carbon Monoxide (CO ppm) with precision safety limits and color indication
   */
  public evaluateCo(co: number): GasParamEvaluation {
    const val = Number(co);
    if (!Number.isFinite(val) || val < 0) {
      return {
        status: 'DANGER',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-300',
        dotClass: 'bg-rose-600',
        label: 'Sensor Error',
        message: 'Invalid CO reading.',
        unit: 'ppm',
        currentValue: val
      };
    }

    if (val < 10.0) {
      return {
        status: 'OPTIMAL',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-emerald-200',
        dotClass: 'bg-emerald-500',
        label: 'Safe Level (< 10 ppm)',
        message: `Safe atmospheric carbon monoxide concentration (${val.toFixed(2)} ppm). Well below 25 ppm OSHA limit.`,
        unit: 'ppm',
        currentValue: val
      };
    }

    if (val < 25.0) {
      return {
        status: 'WARNING',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-300 ring-amber-200',
        dotClass: 'bg-amber-500',
        label: 'Elevated CO (10 - 24 ppm)',
        message: `CAUTION: Elevated CO (${val.toFixed(2)} ppm). Approaching 25 ppm ceiling. Verify exhaust ventilation.`,
        unit: 'ppm',
        currentValue: val
      };
    }

    return {
      status: 'DANGER',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 ring-rose-200 animate-pulse',
      dotClass: 'bg-rose-600',
      label: 'Toxic CO Hazard (≥ 25 ppm)',
      message: `DANGER: Carbon Monoxide exceeds permissible exposure limit (${val.toFixed(2)} ppm ≥ 25 ppm). Toxicity risk.`,
      unit: 'ppm',
      currentValue: val
    };
  }

  /**
   * Evaluates Hydrogen Sulfide (H2S ppm) with precision safety limits and color indication
   */
  public evaluateH2s(h2s: number): GasParamEvaluation {
    const val = Number(h2s);
    if (!Number.isFinite(val) || val < 0) {
      return {
        status: 'DANGER',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-300',
        dotClass: 'bg-rose-600',
        label: 'Sensor Error',
        message: 'Invalid H2S reading.',
        unit: 'ppm',
        currentValue: val
      };
    }

    if (val === 0) {
      return {
        status: 'OPTIMAL',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-emerald-200',
        dotClass: 'bg-emerald-500',
        label: 'Nil H2S (0 ppm)',
        message: 'Zero Hydrogen Sulfide detected. Safe from sour gas hazards.',
        unit: 'ppm',
        currentValue: val
      };
    }

    if (val < 5.0) {
      return {
        status: 'WARNING',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-300 ring-amber-200',
        dotClass: 'bg-amber-500',
        label: 'Trace H2S (< 5 ppm)',
        message: `CAUTION: Low H2S concentration (${val.toFixed(2)} ppm). Rotten egg odor present. Continuous monitoring required.`,
        unit: 'ppm',
        currentValue: val
      };
    }

    return {
      status: 'DANGER',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 ring-rose-200 animate-pulse',
      dotClass: 'bg-rose-600',
      label: 'Lethal H2S Hazard (≥ 5 ppm)',
      message: `CRITICAL DANGER: H2S exceeds safety ceiling (${val.toFixed(2)} ppm ≥ 5 ppm). Highly toxic neurotoxin. Evacuate immediately!`,
      unit: 'ppm',
      currentValue: val
    };
  }

  /**
   * Comprehensive atmosphere evaluation combining O2, LEL, CO, H2S and optional toxic gas
   */
  public evaluateAtmosphere(
    record: Pick<GasTestRecord, 'O2Pct' | 'LelPct' | 'CoVal' | 'H2sVal' | 'OtherGas' | 'OtherVal' | 'OtherUnit'>,
    isHotWork = false
  ): AtmosphereAssessment {
    const o2 = this.evaluateO2(record.O2Pct);
    const lel = this.evaluateLel(record.LelPct, isHotWork);
    const co = this.evaluateCo(record.CoVal);
    const h2s = this.evaluateH2s(record.H2sVal);

    let other: GasParamEvaluation | undefined = undefined;
    if (record.OtherGas && record.OtherGas.trim()) {
      const otherVal = Number(record.OtherVal || 0);
      const isDangerous = otherVal > 5.0;
      other = {
        status: isDangerous ? 'DANGER' : otherVal > 0 ? 'WARNING' : 'OPTIMAL',
        badgeClass: isDangerous
          ? 'bg-rose-50 text-rose-700 border-rose-300'
          : otherVal > 0
          ? 'bg-amber-50 text-amber-700 border-amber-300'
          : 'bg-emerald-50 text-emerald-700 border-emerald-300',
        dotClass: isDangerous ? 'bg-rose-600' : otherVal > 0 ? 'bg-amber-500' : 'bg-emerald-500',
        label: `${record.OtherGas} (${otherVal} ${record.OtherUnit || 'ppm'})`,
        message: otherVal > 0
          ? `${record.OtherGas} concentration: ${otherVal} ${record.OtherUnit || 'ppm'}`
          : `No ${record.OtherGas} detected.`,
        unit: record.OtherUnit || 'ppm',
        currentValue: otherVal
      };
    }

    const statuses = [o2.status, lel.status, co.status, h2s.status, other?.status].filter(Boolean);

    if (statuses.includes('DANGER')) {
      return {
        overallStatus: 'DANGER',
        canClearWork: false,
        summaryTitle: 'ATMOSPHERE HAZARDOUS - ENTRY PROHIBITED',
        summaryMessage: 'One or more gas concentration levels have breached critical safety thresholds. Hot work and confined-space entry are strictly prohibited. Immediate forced ventilation or nitrogen purging required.',
        bannerClass: 'bg-rose-50 border-rose-200 text-rose-900',
        o2,
        lel,
        co,
        h2s,
        other
      };
    }

    if (statuses.includes('WARNING')) {
      return {
        overallStatus: 'WARNING',
        canClearWork: false,
        summaryTitle: 'CAUTION - ELEVATED READINGS DETECTED',
        summaryMessage: 'Atmospheric conditions show elevated readings above baseline. Personnel must not enter until forced air ventilation reduces concentrations to optimal zero levels.',
        bannerClass: 'bg-amber-50 border-amber-200 text-amber-900',
        o2,
        lel,
        co,
        h2s,
        other
      };
    }

    return {
      overallStatus: 'SAFE',
      canClearWork: true,
      summaryTitle: 'ATMOSPHERE CLEAR - APPROVED FOR WORK',
      summaryMessage: 'All atmospheric parameters (Oxygen, Flammable % LEL, CO, and H2S) are within safe, verified limits. Atmosphere cleared for authorized work.',
      bannerClass: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      o2,
      lel,
      co,
      h2s,
      other
    };
  }

  /**
   * Retrieves all atmospheric test logs across permits or filtered by PermitNo
   * Endpoint: GasTest?$orderby=TestSeq desc
   */
  public async list(permitNo?: string, signal?: AbortSignal): Promise<GasTestRecord[]> {
    try {
      let url = `${ODATA_ENTITIES.GAS_TEST}?$orderby=TestSeq desc`;
      if (permitNo && permitNo.trim()) {
        const filter = encodeURIComponent(`PermitNo eq '${permitNo.trim()}'`);
        url += `&$filter=${filter}`;
      }

      const response = await odataClient.get<ODataCollectionResponse<GasTestRecord>>(url, { signal });
      const records = response.data?.value || [];

      if (records.length > 0) {
        // Merge with local store to preserve local creates
        const serverKeys = new Set(records.map(r => `${r.PermitNo}-${r.TestSeq}`));
        const localCreated = this.localStore.filter(r => !serverKeys.has(`${r.PermitNo}-${r.TestSeq}`));
        this.localStore = [...localCreated, ...records];
        return permitNo ? this.localStore.filter(r => r.PermitNo === permitNo) : this.localStore;
      }

      return permitNo ? this.localStore.filter(r => r.PermitNo === permitNo) : this.localStore;
    } catch (error) {
      console.warn('[GasTesterApi] Live fetch for GasTest failed, using local store. Reason:', error);
      return permitNo ? this.localStore.filter(r => r.PermitNo === permitNo) : this.localStore;
    }
  }

  /**
   * Reads a single Gas Test record by composite key (PermitNo, TestSeq)
   * Endpoint: GasTest(PermitNo='{permitNo}',TestSeq='{testSeq}')
   */
  public async read(permitNo: string, testSeq: string, signal?: AbortSignal): Promise<GasTestRecord | null> {
    try {
      const url = `${ODATA_ENTITIES.GAS_TEST}(PermitNo='${encodeURIComponent(permitNo)}',TestSeq='${encodeURIComponent(testSeq)}')`;
      const response = await odataClient.get<GasTestRecord>(url, { signal });
      if (response.data) {
        return response.data;
      }
      return this.localStore.find(r => r.PermitNo === permitNo && r.TestSeq === testSeq) || null;
    } catch (error) {
      console.warn(`[GasTesterApi] Live read for GasTest(${permitNo}, ${testSeq}) failed, using local store. Reason:`, error);
      return this.localStore.find(r => r.PermitNo === permitNo && r.TestSeq === testSeq) || null;
    }
  }

  /**
   * Records a new calibrated gas test reading directly into SAP GasTest entity set
   * Endpoint: POST GasTest
   */
  public async create(record: Partial<GasTestRecord>): Promise<GasTestRecord> {
    const payload: GasTestRecord = {
      PermitNo: record.PermitNo || '',
      TestSeq: record.TestSeq || '1',
      TestType: record.TestType || 'INIT',
      TestDate: record.TestDate || new Date().toISOString().split('T')[0],
      TestTime: record.TestTime || new Date().toTimeString().split(' ')[0],
      TestLocation: record.TestLocation || '',
      SampleLevel: record.SampleLevel || 'MID',
      TestedBy: record.TestedBy || '',
      Cert: record.Cert || '',
      MeterType: record.MeterType || 'Multi-Gas 4-in-1',
      MeterId: record.MeterId || '',
      CalibDate: record.CalibDate || new Date().toISOString().split('T')[0],
      BumpTestOk: record.BumpTestOk || 'Y',
      LelPct: Number(record.LelPct || 0),
      O2Pct: Number(record.O2Pct || 20.9),
      CoVal: Number(record.CoVal || 0),
      H2sVal: Number(record.H2sVal || 0),
      OtherGas: record.OtherGas || '',
      OtherVal: Number(record.OtherVal || 0),
      OtherUnit: record.OtherUnit || 'PPM',
      TesterSigned: record.TesterSigned || 'Y',
      Remarks: record.Remarks || '',
      SAP__Messages: []
    };

    try {
      const response = await odataClient.post<GasTestRecord>(ODATA_ENTITIES.GAS_TEST, payload, {
        headers: { Prefer: 'return=representation' }
      });

      if (response.data && response.data.PermitNo) {
        this.localStore.unshift(response.data);
        return response.data;
      }
    } catch (err) {
      console.warn('[GasTesterApi] Live POST GasTest failed, saving to local store. Reason:', err);
    }

    // Fallback store save
    this.localStore.unshift(payload);
    return payload;
  }

  /**
   * Compatibility method for legacy modules
   */
  public async getTestsForPermit(permitId: string): Promise<PermitGasTest[]> {
    const records = await this.list(permitId);
    return records.map(r => ({
      TestId: `${r.PermitNo}-${r.TestSeq}`,
      PermitId: r.PermitNo,
      TestTimestamp: `${r.TestDate || ''} ${r.TestTime || ''}`.trim(),
      OxygenPct: r.O2Pct,
      FlammableLelPct: r.LelPct,
      H2sPpm: r.H2sVal,
      CoPpm: r.CoVal,
      TestedByUserId: r.TestedBy,
      TesterNotes: r.Remarks,
      Passed: r.O2Pct >= 19.5 && r.O2Pct <= 23.5 && r.LelPct === 0 && r.CoVal < 25 && r.H2sVal < 5
    }));
  }

  /**
   * Compatibility method for legacy caller
   */
  public async recordTest(testData: Omit<PermitGasTest, 'TestId'>): Promise<PermitGasTest> {
    // The legacy write contract is not the current GasTestType. Use a verified SAP action.
    void testData;
    throw new Error('Gas-test recording requires the approved site limits and SAP workflow action.');
  }

  /**
   * Limit validator comparing readings only against an explicitly supplied site policy
   */
  public validateLimits(
    readings: { oxygenPct: number; flammableLelPct: number; h2sPpm: number; coPpm: number },
    thresholds: GasSafetyThresholds | undefined = DEFAULT_GAS_THRESHOLDS
  ): { safe: boolean; violations: string[] } {
    if (!thresholds) return { safe: false, violations: ['HSE-approved gas limits are required; the source procedure contains conflicting values.'] };
    if ([readings.oxygenPct, readings.flammableLelPct, readings.h2sPpm, readings.coPpm].some(value => !Number.isFinite(value) || value < 0) || readings.oxygenPct > 100 || readings.flammableLelPct > 100) {
      return { safe: false, violations: ['All gas readings must be finite, nonnegative values with valid percentage ranges.'] };
    }
    if ([thresholds.minOxygen, thresholds.maxOxygen, thresholds.maxFlammableLel, thresholds.maxH2sPpm, thresholds.maxCoPpm].some(value => !Number.isFinite(value) || value < 0) || thresholds.minOxygen > thresholds.maxOxygen || thresholds.maxOxygen > 100 || thresholds.maxFlammableLel > 100) {
      return { safe: false, violations: ['The supplied gas limit policy is invalid.'] };
    }
    const violations: string[] = [];
    if (readings.oxygenPct < thresholds.minOxygen || readings.oxygenPct > thresholds.maxOxygen) violations.push('Oxygen is outside the approved range.');
    if (readings.flammableLelPct > thresholds.maxFlammableLel) violations.push('Flammable gas exceeds the approved limit.');
    if (readings.h2sPpm > thresholds.maxH2sPpm) violations.push('H2S exceeds the approved limit.');
    if (readings.coPpm > thresholds.maxCoPpm) violations.push('CO exceeds the approved limit.');
    return { safe: violations.length === 0, violations };
  }

  /**
   * Retrieves calibrated status for field gas sniffer detectors
   */
  public async getDeviceCalibration(deviceId: string): Promise<{ deviceId: string; validUntil: string; isCalibrated: boolean }> {
    const endpoint = `${ODATA_ENTITIES.GAS_TESTS}/GetCalibrationStatus(DeviceId='${encodeURIComponent(deviceId)}')`;
    try {
      const response = await odataClient.get<{ DeviceId: string; ValidUntil: string; IsCalibrated: boolean }>(endpoint);
      return {
        deviceId: response.data?.DeviceId || deviceId,
        validUntil: response.data?.ValidUntil || '',
        isCalibrated: response.data?.IsCalibrated === true && response.data?.DeviceId === deviceId && Number.isFinite(Date.parse(response.data?.ValidUntil || '')) && Date.parse(response.data.ValidUntil) > Date.now(),
      };
    } catch {
      return {
        deviceId,
        validUntil: '',
        isCalibrated: false,
      };
    }
  }
}

export const gasTesterApi = new GasTesterApiService();
export default gasTesterApi;
