import odataClient from '../odataClient';
import { ODATA_ENTITIES } from '../odataEndpoints';
import { PermitGasTest } from '../../types/ptw.types';
import { ODataCollectionResponse } from '../../types/odata.types';

export interface GasSafetyThresholds {
  minOxygen: number;       // 19.5%
  maxOxygen: number;       // 23.5%
  maxFlammableLel: number; // Approved % LEL
  maxH2sPpm: number;       // Approved ppm
  maxCoPpm: number;        // Approved ppm
}

// The source has conflicting gas limits (pp. 11, 14, 24). No implicit clearance policy.
export const DEFAULT_GAS_THRESHOLDS: GasSafetyThresholds | undefined = undefined;

/**
 * Module API: Gas Tester (Atmospheric O2, LEL%, H2S, CO Calibration & Logs)
 */
export const gasTesterApi = {
  /**
   * Retrieves all atmospheric test logs for a permit ordered by timestamp
   */
  async getTestsForPermit(permitId: string): Promise<PermitGasTest[]> {
    const filter = encodeURIComponent(`PermitId eq '${permitId}'`);
    const endpoint = `${ODATA_ENTITIES.GAS_TESTS}?$filter=${filter}&$orderby=TestTimestamp desc`;
    const response = await odataClient.get<ODataCollectionResponse<PermitGasTest>>(endpoint);
    return response.data?.value || [];
  },

  /**
   * Records a new calibrated gas test reading
   */
  async recordTest(testData: Omit<PermitGasTest, 'TestId'>): Promise<PermitGasTest> {
    // The legacy write contract is not the current GasTestType. Use a verified SAP action.
    void testData;
    throw new Error('Gas-test recording requires the approved site limits and SAP workflow action.');
  },

  /** Compare readings only against an explicitly supplied site policy. */
  validateLimits(
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
  },
  /**
   * Retrieves calibrated status for field gas sniffer detectors
   */
  async getDeviceCalibration(deviceId: string): Promise<{ deviceId: string; validUntil: string; isCalibrated: boolean }> {
    const endpoint = `${ODATA_ENTITIES.GAS_TESTS}/GetCalibrationStatus(DeviceId='${encodeURIComponent(deviceId)}')`;
    try {
      const response = await odataClient.get<{ DeviceId: string; ValidUntil: string; IsCalibrated: boolean }>(endpoint);
      return {
        deviceId: response.data?.DeviceId || deviceId,
        validUntil: response.data?.ValidUntil || '',
        isCalibrated: response.data?.IsCalibrated === true && response.data?.DeviceId === deviceId && Number.isFinite(Date.parse(response.data?.ValidUntil || '')) && Date.parse(response.data.ValidUntil) > Date.now(),
      };
    } catch {
      // Missing calibration evidence cannot assert a valid instrument.
      return {
        deviceId,
        validUntil: '',
        isCalibrated: false,
      };
    }
  },
};

export default gasTesterApi;
