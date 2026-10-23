/**
 * GFL Permitting System - Official Time-Band Approval Matrix
 * Reference: Policy ZPTW_APPR_MAT
 *
 * Time Bands:
 * 1. Day Shift:     09:00 Hrs to 17:30 Hrs
 * 2. Evening Shift: 17:30 Hrs to 23:00 Hrs
 * 3. Night Shift:   23:00 Hrs to 09:00 Hrs
 */

export type TimeBandId = 'DAY' | 'EVENING' | 'NIGHT';
export type ApprovalRole = 'PTW_APPR1' | 'PTW_APPR2' | 'PTW_APPR3';

export interface TimeBandDefinition {
  id: TimeBandId;
  label: string;
  shortLabel: string;
  hours: string;
  startMinutes: number; // minutes from 00:00
  endMinutes: number;
  icon: string;
  badgeClass: string;
}

export const TIME_BANDS: Record<TimeBandId, TimeBandDefinition> = {
  DAY: {
    id: 'DAY',
    label: 'Day Shift (09:00 - 17:30)',
    shortLabel: 'Day Shift',
    hours: '9:00 Hrs to 17:30 Hrs',
    startMinutes: 540,
    endMinutes: 1050,
    icon: 'wb_sunny',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200'
  },
  EVENING: {
    id: 'EVENING',
    label: 'Evening Shift (17:30 - 23:00)',
    shortLabel: 'Evening Shift',
    hours: '17:30 Hrs to 23:00 Hrs',
    startMinutes: 1050,
    endMinutes: 1380,
    icon: 'flare',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200'
  },
  NIGHT: {
    id: 'NIGHT',
    label: 'Night Shift (23:00 - 09:00)',
    shortLabel: 'Night Shift',
    hours: '23:00 Hrs to 09:00 Hrs',
    startMinutes: 1380,
    endMinutes: 540, // spans midnight
    icon: 'bedtime',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200'
  }
};

/**
 * Evaluates the time band for a given time string (HH:MM / HH:MM:SS) or Date object.
 * Defaults to current local time if omitted or invalid.
 */
export function getTimeBand(timeOrDate?: string | Date | null): TimeBandDefinition {
  let minutes: number;
  if (timeOrDate instanceof Date) {
    minutes = timeOrDate.getHours() * 60 + timeOrDate.getMinutes();
  } else if (typeof timeOrDate === 'string' && /^([01]\d|2[0-3]):[0-5]\d/.test(timeOrDate.trim())) {
    const parts = timeOrDate.trim().split(':');
    minutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  } else {
    const now = new Date();
    minutes = now.getHours() * 60 + now.getMinutes();
  }

  // 09:00 (540 mins) to 17:30 (1050 mins)
  if (minutes >= 540 && minutes < 1050) {
    return TIME_BANDS.DAY;
  }
  // 17:30 (1050 mins) to 23:00 (1380 mins)
  if (minutes >= 1050 && minutes < 1380) {
    return TIME_BANDS.EVENING;
  }
  // 23:00 (1380 mins) to 09:00 (540 mins)
  return TIME_BANDS.NIGHT;
}

export interface MatrixRow {
  workType: string;
  typeCodes: string[];
  day: {
    roles: ApprovalRole[];
    label: string;
  };
  evening: {
    roles: ApprovalRole[];
    label: string;
  };
  night: {
    roles: ApprovalRole[];
    label: string;
  };
}

/**
 * Official GFL Approval Policy Matrix
 * Exact mapping as authorized in standard operating procedures.
 */
export const APPROVAL_MATRIX_RULES: MatrixRow[] = [
  {
    workType: 'Cold Work',
    typeCodes: ['COLD'],
    day: { roles: [], label: 'Approver Sign Not Required' },
    evening: { roles: [], label: 'Approver Sign Not Required' },
    night: { roles: [], label: 'Approver Sign Not Required' }
  },
  {
    workType: 'Hot Work',
    typeCodes: ['HOT'],
    day: { roles: ['PTW_APPR1', 'PTW_APPR2'], label: 'Approver I And Approver II' },
    evening: { roles: ['PTW_APPR1', 'PTW_APPR2'], label: 'Approver I And Approver II' },
    night: { roles: ['PTW_APPR2'], label: 'Approver II' }
  },
  {
    workType: 'Confined Space',
    typeCodes: ['CSE', 'CONF'],
    day: { roles: ['PTW_APPR1', 'PTW_APPR2'], label: 'Approver I And Approver II' },
    evening: { roles: ['PTW_APPR1', 'PTW_APPR2'], label: 'Approver I And Approver II' },
    night: { roles: ['PTW_APPR3'], label: 'Approver III' }
  },
  {
    workType: 'Excavation',
    typeCodes: ['EXCA', 'EXC', 'EXCV'],
    day: { roles: ['PTW_APPR1', 'PTW_APPR2'], label: 'Below 1.8 Approver I And Approver II' },
    evening: { roles: ['PTW_APPR1', 'PTW_APPR2'], label: 'Below 1.8 Approver I And Approver II' },
    night: { roles: ['PTW_APPR2'], label: 'Below 1.8 Approver II' }
  },
  {
    workType: 'Work at Height',
    typeCodes: ['HGHT', 'W@H', 'HEIGHT'],
    day: { roles: ['PTW_APPR1'], label: 'Approver I' },
    evening: { roles: ['PTW_APPR1'], label: 'Approver I' },
    night: { roles: ['PTW_APPR2'], label: 'Approver II' }
  },
  {
    workType: 'Line Breaking',
    typeCodes: ['LINE', 'LNBK', 'LBRK'],
    day: { roles: ['PTW_APPR1', 'PTW_APPR2'], label: 'Approver I And Approver II' },
    evening: { roles: ['PTW_APPR1', 'PTW_APPR2'], label: 'Approver I And Approver II' },
    night: { roles: ['PTW_APPR2'], label: 'Approver II' }
  },
  {
    workType: 'Radiography',
    typeCodes: ['RAD', 'RADI'],
    day: { roles: ['PTW_APPR1'], label: 'Approver I' },
    evening: { roles: ['PTW_APPR1', 'PTW_APPR2'], label: 'Approver I And Approver II' },
    night: { roles: ['PTW_APPR2'], label: 'Approver II' }
  },
  {
    workType: 'Rigging job',
    typeCodes: ['RIG', 'RIGG'],
    day: { roles: ['PTW_APPR1'], label: 'Approver I' },
    evening: { roles: ['PTW_APPR1', 'PTW_APPR2'], label: 'Approver I And Approver II' },
    night: { roles: ['PTW_APPR2'], label: 'Approver II' }
  }
];

export interface PermitApprovalPolicyResult {
  requiredRoles: ApprovalRole[];
  policyLabel: string;
  timeBand: TimeBandDefinition;
  isApprovalRequired: boolean;
  workTypeLabel: string;
}

/**
 * Evaluates the required approvers for a permit based on its work type and time band.
 */
export function getRequiredApproversForPermit(
  permitType?: string,
  timeBandOrTime?: TimeBandId | string | Date | null
): PermitApprovalPolicyResult {
  const timeBand =
    typeof timeBandOrTime === 'string' && (timeBandOrTime === 'DAY' || timeBandOrTime === 'EVENING' || timeBandOrTime === 'NIGHT')
      ? TIME_BANDS[timeBandOrTime]
      : getTimeBand(timeBandOrTime);

  const cleanType = (permitType || '').trim().toUpperCase();
  const rule = APPROVAL_MATRIX_RULES.find(r =>
    r.typeCodes.includes(cleanType) || cleanType.startsWith(r.typeCodes[0])
  );

  if (!rule) {
    if (timeBand.id === 'NIGHT') {
      return {
        requiredRoles: ['PTW_APPR2'],
        policyLabel: 'Night Shift Policy: Approver II (Direct Shift Head)',
        timeBand,
        isApprovalRequired: true,
        workTypeLabel: permitType || 'Standard Work'
      };
    }
    return {
      requiredRoles: ['PTW_APPR1', 'PTW_APPR2'],
      policyLabel: 'Standard Policy: Approver I And Approver II',
      timeBand,
      isApprovalRequired: true,
      workTypeLabel: permitType || 'Standard Work'
    };
  }

  const slot = timeBand.id === 'DAY' ? rule.day : timeBand.id === 'EVENING' ? rule.evening : rule.night;
  return {
    requiredRoles: slot.roles,
    policyLabel: `${rule.workType} (${timeBand.shortLabel}): ${slot.label}`,
    timeBand,
    isApprovalRequired: slot.roles.length > 0,
    workTypeLabel: rule.workType
  };
}
