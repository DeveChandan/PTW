import { useState, useEffect, useCallback } from 'react';
import type { SapUser } from '../auth/sapAuthContext';
import { useOptionalSapAuth } from '../auth/sapAuthContext';
import { adminApi } from '../api/modules/admin.api';

/**
 * Standard known system SAP user identities and designations for GFL PTW.
 */
export const KNOWN_SYSTEM_USERS: Record<string, string> = {
  'VERTIF-V': 'Verification Officer',
  'GF10409': 'Vineet Kumar',
  'GF7874': 'Amit Jain',
};

// Module-level in-memory cache for enterprise users (/PFCGUsers)
let userDirectoryCache: Map<string, string> | null = null;
let directoryLoadingPromise: Promise<Map<string, string>> | null = null;

/**
 * Loads enterprise user names from SAP /PFCGUsers entity set once and caches them.
 */
export async function fetchUserDirectoryMap(): Promise<Map<string, string>> {
  if (userDirectoryCache) {
    return userDirectoryCache;
  }
  if (directoryLoadingPromise) {
    return directoryLoadingPromise;
  }

  directoryLoadingPromise = (async () => {
    const map = new Map<string, string>();

    // Seed with known system roles
    Object.entries(KNOWN_SYSTEM_USERS).forEach(([id, name]) => {
      map.set(id.toUpperCase(), name);
    });

    try {
      const users = await adminApi.getPFCGUsers();
      if (Array.isArray(users)) {
        for (const u of users) {
          if (u.SAPUser) {
            const fullName = [u.FirstName, u.LastName].filter(Boolean).join(' ').trim();
            if (fullName && fullName.toUpperCase() !== u.SAPUser.toUpperCase()) {
              map.set(u.SAPUser.toUpperCase(), fullName);
            }
          }
        }
      }
    } catch (err) {
      // In tests or offline mode, keep seed directory without throwing
      console.warn('[AuthorityFormatter] PFCGUsers directory fetch skipped or unavailable:', err);
    }

    userDirectoryCache = map;
    directoryLoadingPromise = null;
    return map;
  })();

  return directoryLoadingPromise;
}

/**
 * Formats a user authority into regulatory audit format:
 * Full Name (SAP_USER_ID)
 * Example: "Verification Officer (VERTIF-V)"
 *
 * Rules:
 * - If only SAP ID is known, attempts to resolve full name from current session, enterprise directory, or known identities.
 * - If full name matches SAP ID, does not duplicate as "ID (ID)".
 * - If already formatted with parentheses, returns as-is.
 * - Non-user status strings like "LOTO Cleared" are preserved.
 */
export function formatUserWithSapId(
  sapId?: string | null,
  fallbackFullName?: string | null,
  currentUser?: SapUser | null,
  directoryMap?: Map<string, string>
): string {
  const cleanId = (sapId || '').trim();
  const cleanFallback = (fallbackFullName || '').trim();

  // If both empty or dashed
  if ((!cleanId || cleanId === '—') && (!cleanFallback || cleanFallback === '—')) {
    return '—';
  }

  // Already formatted as "Name (SAPID)"
  if (cleanId.includes('(') && cleanId.includes(')')) {
    return cleanId;
  }

  // Non-user status tokens
  if (cleanId === 'LOTO Cleared' || cleanId === '[RESTORED]' || cleanId === 'Authorized Issuer') {
    return cleanId;
  }

  // Determine effective SAP User ID vs pure human name
  const effectiveId = cleanId && cleanId !== '—' ? cleanId : '';

  // 1. Resolve human full name
  let resolvedFullName: string | null = null;

  // A. Check explicit fallbackFullName (e.g. SupvName, SafetyOfficer, ApproverName)
  if (
    cleanFallback &&
    cleanFallback !== '—' &&
    cleanFallback.toUpperCase() !== effectiveId.toUpperCase()
  ) {
    resolvedFullName = cleanFallback;
  }

  // B. Check active logged-in SAP session user
  if (!resolvedFullName && currentUser && effectiveId) {
    if (currentUser.id && currentUser.id.toUpperCase() === effectiveId.toUpperCase()) {
      if (
        currentUser.fullName &&
        currentUser.fullName.toUpperCase() !== effectiveId.toUpperCase()
      ) {
        resolvedFullName = currentUser.fullName.trim();
      }
    }
  }

  // C. Check enterprise directory cache (/PFCGUsers)
  if (!resolvedFullName && effectiveId) {
    const fromMap = directoryMap?.get(effectiveId.toUpperCase()) || userDirectoryCache?.get(effectiveId.toUpperCase());
    if (fromMap && fromMap.toUpperCase() !== effectiveId.toUpperCase()) {
      resolvedFullName = fromMap.trim();
    }
  }

  // D. Check standard known system user identities
  if (!resolvedFullName && effectiveId) {
    const known = KNOWN_SYSTEM_USERS[effectiveId.toUpperCase()];
    if (known) {
      resolvedFullName = known;
    }
  }

  // 2. Format output
  if (resolvedFullName) {
    if (effectiveId && resolvedFullName.toUpperCase() !== effectiveId.toUpperCase()) {
      return `${resolvedFullName} (${effectiveId})`;
    }
    return resolvedFullName;
  }

  return effectiveId || cleanFallback || '—';
}

/**
 * React hook to access user directory and authority formatter.
 */
export function useUserDirectory() {
  const [directory, setDirectory] = useState<Map<string, string>>(() => {
    if (userDirectoryCache) return userDirectoryCache;
    const initialMap = new Map<string, string>();
    Object.entries(KNOWN_SYSTEM_USERS).forEach(([id, name]) => {
      initialMap.set(id.toUpperCase(), name);
    });
    return initialMap;
  });

  const authContext = useOptionalSapAuth();
  const currentUser = authContext?.user;

  useEffect(() => {
    let isMounted = true;
    fetchUserDirectoryMap().then((map) => {
      if (isMounted) {
        setDirectory(new Map(map));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const formatAuthority = useCallback(
    (sapId?: string | null, fallbackFullName?: string | null): string => {
      return formatUserWithSapId(sapId, fallbackFullName, currentUser, directory);
    },
    [currentUser, directory]
  );

  return { directory, formatAuthority };
}
