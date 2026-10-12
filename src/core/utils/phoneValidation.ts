/**
 * Telephone number validation and sanitization utility for PTW workflows.
 * Supports standard Indian mobile numbers (10 digits) as well as international / STD prefixes (+91, 0).
 * Maximum length adheres to SAP OData schema limits: SupvPhone (16 chars), PhoneNo (20 chars).
 */

export interface PhoneValidationResult {
  isValid: boolean;
  digitCount: number;
  error?: string;
}

/**
 * Validates a telephone / mobile number input.
 *
 * Requirements:
 * - When required: non-empty input.
 * - Allowed characters: digits [0-9], spaces, hyphens, parentheses, and leading plus sign (+).
 * - Minimum length: at least 10 digits (standard Indian mobile/landline).
 * - Maximum length: at most 15 digits (ITU-T E.164 standard).
 */
export function validatePhoneNumber(phone: string, isRequired = true): PhoneValidationResult {
  const trimmed = (phone || '').trim();

  if (!trimmed) {
    return {
      isValid: !isRequired,
      digitCount: 0,
      error: isRequired ? 'Phone number is mandatory.' : undefined
    };
  }

  // Check for disallowed characters
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) {
    const digitsOnly = trimmed.replace(/\D/g, '');
    return {
      isValid: false,
      digitCount: digitsOnly.length,
      error: 'Invalid format. Use numbers, optional "+" prefix, hyphens or spaces.'
    };
  }

  const digits = trimmed.replace(/\D/g, '');

  if (digits.length < 10) {
    return {
      isValid: false,
      digitCount: digits.length,
      error: `Phone number is incomplete (${digits.length}/10 digits). 10 digits required.`
    };
  }

  if (digits.length > 15) {
    return {
      isValid: false,
      digitCount: digits.length,
      error: `Phone number exceeds standard length (${digits.length} digits). Max 15 digits allowed.`
    };
  }

  return {
    isValid: true,
    digitCount: digits.length
  };
}

/**
 * Strips disallowed characters while typing and enforces max string length.
 */
export function sanitizePhoneNumber(input: string, maxChars = 16): string {
  if (!input) return '';
  // Preserve leading plus if present, strip other non-allowed characters
  const hasPlus = input.startsWith('+');
  const cleaned = input.replace(/[^\d\s\-()]/g, '');
  const result = hasPlus && !cleaned.startsWith('+') ? `+${cleaned}` : cleaned;
  return result.slice(0, maxChars);
}
