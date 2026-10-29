import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminApi } from '../../core/api/modules/admin.api';
import type { SapUser } from '../../core/auth/sapAuthContext';

export interface UserPtwRolesResult {
  roles: string[];
  displayRoles: string[];
  isLoadingRoles: boolean;
  isUserAdmin: boolean;
  hasApproverRole: boolean;
  hasAcceptorRole: boolean;
  hasAreaOperatorRole: boolean;
  approverTiers: string[];
  refreshRoles: () => Promise<void>;
  roleSource: string;
}

// Known SAP PFCG roles from /PFCGUsers that are NOT PTW functional roles
const NON_PTW_PFCG_ROLES = new Set([
  'Z_MOBILE_PI_SHEET',
  'YSM-XX-PFCG-PTW-APP-XXXXXXXXXX'
]);

/**
 * Custom React Hook: useUserPtwRoles
 *
 * Dedicated hook to read and evaluate the active user's authorizations strictly from
 * SAP OData V4 /UserRole entity set (SAP_USER, PTW_ROLE, ACTIVE).
 * Excludes generic /PFCGUsers PFCG roles to ensure proper PTW permission governance.
 */
export function useUserPtwRoles(user: SapUser | null): UserPtwRolesResult {
  const [liveUserRoles, setLiveUserRoles] = useState<string[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState<boolean>(true);

  const fetchRolesFromSap = useCallback(async () => {
    if (!user?.id) {
      setLiveUserRoles([]);
      setIsLoadingRoles(false);
      return;
    }

    setIsLoadingRoles(true);
    try {
      // Query SAP /UserRole directly for the current user's active role assignments
      const records = await adminApi.getUserRoles({
        user: user.id,
        activeOnly: true
      });

      if (records && Array.isArray(records)) {
        const activeCodes = records
          .filter((r) => r.ACTIVE)
          .map((r) => r.PTW_ROLE?.trim().toUpperCase())
          .filter((r): r is string => Boolean(r) && !NON_PTW_PFCG_ROLES.has(r));
        setLiveUserRoles(activeCodes);
      } else {
        setLiveUserRoles([]);
      }
    } catch (err) {
      console.warn('[useUserPtwRoles] Live SAP /UserRole query failed:', err);
    } finally {
      setIsLoadingRoles(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchRolesFromSap();
  }, [fetchRolesFromSap]);

  // Clean distinct functional roles for UI badge/text display
  const displayRoles = useMemo(() => {
    const rawList = liveUserRoles.length > 0
      ? liveUserRoles
      : (user?.roles || []).filter(r => !NON_PTW_PFCG_ROLES.has(r.trim().toUpperCase()));
    return Array.from(new Set(rawList.map(r => r.trim().toUpperCase())));
  }, [liveUserRoles, user?.roles]);

  // Merge live /UserRole results with aliases (excluding PFCG non-PTW roles)
  const normalizedRoles = useMemo(() => {
    const set = new Set<string>();

    // 1. Prioritize roles directly returned from SAP /UserRole
    for (const r of liveUserRoles) {
      const clean = r.trim().toUpperCase();
      if (clean && !NON_PTW_PFCG_ROLES.has(clean)) {
        set.add(clean);
        // Add bare name and Z-prefix if applicable
        if (clean.startsWith('Z')) set.add(clean.substring(1));
        else set.add(`Z${clean}`);
      }
    }

    // 2. Fall back to user.roles from auth session if /UserRole query is loading or empty
    if (set.size === 0) {
      for (const r of user?.roles || []) {
        const clean = r.trim().toUpperCase();
        if (clean && !NON_PTW_PFCG_ROLES.has(clean)) {
          set.add(clean);
          if (clean.startsWith('Z')) set.add(clean.substring(1));
          else set.add(`Z${clean}`);
        }
      }
    }

    return Array.from(set);
  }, [liveUserRoles, user?.roles]);

  const isUserAdmin = useMemo(() => {
    return normalizedRoles.some((r) => r === 'PTW_ADMIN' || r === 'ZPTW_ADMIN');
  }, [normalizedRoles]);

  const approverTiers = useMemo(() => {
    const tiers: Array<'PTW_APPR1' | 'PTW_APPR2' | 'PTW_APPR3'> = [];
    if (isUserAdmin) {
      tiers.push('PTW_APPR1', 'PTW_APPR2', 'PTW_APPR3');
      return tiers;
    }
    if (normalizedRoles.some((r) => r === 'PTW_APPR1' || r === 'ZPTW_APPR1')) tiers.push('PTW_APPR1');
    if (normalizedRoles.some((r) => r === 'PTW_APPR2' || r === 'ZPTW_APPR2')) tiers.push('PTW_APPR2');
    if (normalizedRoles.some((r) => r === 'PTW_APPR3' || r === 'ZPTW_APPR3')) tiers.push('PTW_APPR3');
    if (
      normalizedRoles.some((r) => r === 'PTW_APPROVER' || r === 'ZPTW_APPROVER') &&
      tiers.length === 0
    ) {
      tiers.push('PTW_APPR1', 'PTW_APPR2', 'PTW_APPR3');
    }
    return tiers;
  }, [normalizedRoles, isUserAdmin]);

  const hasApproverRole = useMemo(() => {
    if (isUserAdmin) return true;
    const approverRoles = [
      'PTW_APPR1',
      'PTW_APPR2',
      'PTW_APPR3',
      'PTW_APPROVER',
      'ZPTW_APPROVER',
      'ZPTW_APPR1',
      'ZPTW_APPR2',
      'ZPTW_APPR3'
    ];
    return normalizedRoles.some((r) => approverRoles.includes(r));
  }, [normalizedRoles, isUserAdmin]);

  const hasAcceptorRole = useMemo(() => {
    if (isUserAdmin) return true;
    const acceptorRoles = [
      'PTW_ACCP',
      'ZPTW_ACCP',
      'PTW_ACCEPTOR',
      'ZPTW_ACCEPTOR',
      'PTW_ISSUER',
      'ZPTW_ISSUER',
      'PTW_ISSU',
      'PTW_HOLDER',
      'PTW_HOLD',
      'ZPTW_HOLDER',
      'PTW_SAFE',
      'PTW_SAFETY_OFFICER'
    ];
    return normalizedRoles.some((r) => acceptorRoles.includes(r));
  }, [normalizedRoles, isUserAdmin]);

  const hasAreaOperatorRole = useMemo(() => {
    if (isUserAdmin) return true;
    const areaRoles = [
      'PTW_AREA_OPP',
      'ZPTW_AREA_OPP',
      'PTW_AOPR',
      'ZPTW_AOPR',
      'PTW_AREA_OWNER',
      'ZPTW_AREA_OWNER',
      'PTW_AREA_ROLE',
      'PTW_AREA_OPP_ROLE'
    ];
    return normalizedRoles.some((r) => areaRoles.includes(r));
  }, [normalizedRoles, isUserAdmin]);

  return {
    roles: normalizedRoles,
    displayRoles,
    isLoadingRoles,
    isUserAdmin,
    hasApproverRole,
    hasAcceptorRole,
    hasAreaOperatorRole,
    approverTiers,
    refreshRoles: fetchRolesFromSap,
    roleSource: 'SAP /UserRole'
  };
}
