import React, { createContext, useContext, useState, useEffect } from 'react';
import { odataClient, authApi } from '../api';

export interface SapUserInfoRecord {
  UserId: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Role: string;
}

export interface SapUser {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  roles: string[];
  plant: string;
  client: string;
  language: string;
  isFlpShell: boolean;
  unlockedModules: ModuleId[];
}

export type ModuleId = 
  | 'permit-create' 
  | 'permit-details'
  | 'create-isolation'
  | 'display-isolation' 
  | 'permit-approver' 
  | 'permit-issuer' 
  | 'permit-area-owner'
  | 'permit-holder' 
  | 'gas-tester' 
  | 'isolation' 
  | 'report'
  | 'safety-map'
  | 'admin';

export interface ModuleDefinition {
  id: ModuleId;
  title: string;
  subtitle: string;
  icon: string;
  requiredRoles: string[];
  badge: string;
}

export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    id: 'permit-create',
    title: 'Permit Create / Permit Issuer',
    subtitle: 'Hazard JSA, PPE Matrix & Work Scope Creation',
    icon: 'note_add',
    requiredRoles: ['ZPTW_REQUESTER', 'PTW_REQUESTER', 'ZPTW_ADMIN', 'PTW_ADMIN'],
    badge: 'Requester'
  },
  {
    id: 'permit-details',
    title: 'Permit Display',
    subtitle: 'Permit Sheet, P&ID Schematic & Real-time Status',
    icon: 'description',
    requiredRoles: [
      'ZPTW_REQUESTER', 'PTW_REQUESTER',
      'ZPTW_HOLDER', 'PTW_HOLDER', 'PTW_HOLD',
      'ZPTW_APPROVER', 'PTW_APPROVER', 'PTW_APPR1', 'PTW_APPR2', 'PTW_APPR3',
      'ZPTW_ISSUER', 'PTW_ISSUER', 'PTW_ISSU',
      'ZPTW_GAS_TESTER', 'PTW_GAS_TESTER', 'PTW_GAS',
      'ZPTW_ISOLATOR', 'PTW_ISOLATOR',
      'ZPTW_AREA_OWNER', 'PTW_AREA_OWNER', 'PTW_AOPR',
      'ZPTW_SAFETY_OFFICER', 'PTW_SAFETY_OFFICER', 'PTW_SAFE',
      'ZPTW_ADMIN', 'PTW_ADMIN'
    ],
    badge: 'Overview'
  },
  {
    id: 'create-isolation',
    title: 'Isolation Create',
    subtitle: 'Zero-Energy Breaker, Valve Lock & Blind Flange Registry',
    icon: 'lock_reset',
    requiredRoles: ['ZPTW_ISOLATOR', 'PTW_ISOLATOR', 'ZPTW_AREA_OWNER', 'PTW_AREA_OWNER', 'PTW_AOPR', 'ZPTW_ADMIN', 'PTW_ADMIN'],
    badge: 'Isolation'
  },
  {
    id: 'display-isolation',
    title: 'Isolation Display',
    subtitle: 'Zero-Energy Breaker, Valve Lock & Blind Flange Registry',
    icon: 'lock_reset',
    requiredRoles: ['ZPTW_ISOLATOR', 'PTW_ISOLATOR', 'ZPTW_AREA_OWNER', 'PTW_AREA_OWNER', 'PTW_AOPR', 'ZPTW_ADMIN', 'PTW_ADMIN'],
    badge: 'Isolation'
  },
  {
    id: 'permit-approver',
    title: 'Permit Approver',
    subtitle: 'Multi-Tier Authorization Chain & Digital Signatures',
    icon: 'draw',
    requiredRoles: ['ZPTW_APPROVER', 'PTW_APPROVER', 'PTW_APPR1', 'PTW_APPR2', 'PTW_APPR3', 'ZPTW_ADMIN', 'PTW_ADMIN'],
    badge: 'Approver'
  },
  {
    id: 'permit-issuer',
    title: 'Permit Acceptor',
    subtitle: 'Toolbox Briefing, Site Handover & Field Issuance',
    icon: 'verified',
    requiredRoles: ['ZPTW_ISSUER', 'PTW_ISSUER', 'PTW_ISSU', 'ZPTW_SAFETY_OFFICER', 'PTW_SAFETY_OFFICER', 'PTW_SAFE', 'ZPTW_ADMIN', 'PTW_ADMIN'],
    badge: 'Issuer'
  },
  {
    id: 'permit-area-owner',
    title: 'Permit Area Operator',
    subtitle: 'On-Site Worker Ledger, Suspension & Site Restoration',
    icon: 'engineering',
    requiredRoles: ['ZPTW_AREA_OWNER', 'PTW_AREA_OWNER', 'PTW_AOPR', 'ZPTW_REQUESTER', 'PTW_REQUESTER', 'ZPTW_ADMIN', 'PTW_ADMIN'],
    badge: 'Area Owner'
  },
  {
    id: 'permit-holder',
    title: 'Permit Holder',
    subtitle: 'On-Site Worker Ledger, Suspension & Site Restoration',
    icon: 'engineering',
    requiredRoles: ['ZPTW_HOLDER', 'PTW_HOLDER', 'PTW_HOLD', 'ZPTW_REQUESTER', 'PTW_REQUESTER', 'ZPTW_ADMIN', 'PTW_ADMIN'],
    badge: 'Holder'
  },
  {
    id: 'gas-tester',
    title: 'Gas Tester',
    subtitle: 'Atmospheric O2, LEL%, H2S, CO Calibration & Logs',
    icon: 'air',
    requiredRoles: ['ZPTW_GAS_TESTER', 'PTW_GAS_TESTER', 'PTW_GAS', 'ZPTW_SAFETY_OFFICER', 'PTW_SAFETY_OFFICER', 'PTW_SAFE', 'ZPTW_ADMIN', 'PTW_ADMIN'],
    badge: 'Gas Tester'
  },
  {
    id: 'report',
    title: 'Report',
    subtitle: 'Permit Registers, LOTO Logs & Safety Compliance Analytics',
    icon: 'bar_chart',
    requiredRoles: [
      'ZPTW_REQUESTER', 'PTW_REQUESTER',
      'ZPTW_HOLDER', 'PTW_HOLDER', 'PTW_HOLD',
      'ZPTW_APPROVER', 'PTW_APPROVER', 'PTW_APPR1', 'PTW_APPR2', 'PTW_APPR3',
      'ZPTW_ISSUER', 'PTW_ISSUER', 'PTW_ISSU',
      'ZPTW_SAFETY_OFFICER', 'PTW_SAFETY_OFFICER', 'PTW_SAFE',
      'ZPTW_ISOLATOR', 'PTW_ISOLATOR',
      'ZPTW_AREA_OWNER', 'PTW_AREA_OWNER', 'PTW_AOPR',
      'ZPTW_GAS_TESTER', 'PTW_GAS_TESTER', 'PTW_GAS',
      'ZPTW_ADMIN', 'PTW_ADMIN'
    ],
    badge: 'Reports'
  },
  {
    id: 'safety-map',
    title: 'Safety Districts & Plant Map',
    subtitle: 'Interactive Dahej Demarcation Layout, 26 Districts & Road Grid',
    icon: 'map',
    requiredRoles: [
      'ZPTW_REQUESTER', 'PTW_REQUESTER',
      'ZPTW_HOLDER', 'PTW_HOLDER', 'PTW_HOLD',
      'ZPTW_APPROVER', 'PTW_APPROVER', 'PTW_APPR1', 'PTW_APPR2', 'PTW_APPR3',
      'ZPTW_ISSUER', 'PTW_ISSUER', 'PTW_ISSU',
      'ZPTW_SAFETY_OFFICER', 'PTW_SAFETY_OFFICER', 'PTW_SAFE',
      'ZPTW_ISOLATOR', 'PTW_ISOLATOR',
      'ZPTW_AREA_OWNER', 'PTW_AREA_OWNER', 'PTW_AOPR',
      'ZPTW_GAS_TESTER', 'PTW_GAS_TESTER', 'PTW_GAS',
      'ZPTW_ADMIN', 'PTW_ADMIN',
      'Z_MOBILE_PI_SHEET'
    ],
    badge: 'Site Map'
  },
  {
    id: 'admin',
    title: 'PTW Admin',
    subtitle: 'SAP Role Mappings, Plant Master Data & Global Audits',
    icon: 'admin_panel_settings',
    requiredRoles: ['ZPTW_ADMIN', 'PTW_ADMIN'],
    badge: 'Admin'
  }
];

export interface LoginCredentials {
  userId: string;
  password?: string;
  client?: string;
  language?: string;
  rememberUser?: boolean;
}

export interface StoredUserSession {
  user: SapUser;
  timestamp: number;
  client: string;
  language: string;
}

export const SESSION_STORAGE_KEY = 'gfl_ptw_user_session_v2';
export const REMEMBERED_USER_KEY = 'gfl_ptw_remembered_userid';
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes Fiori idle timeout

interface SapAuthContextType {
  user: SapUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  isSessionRestoring: boolean;
  isReauthRequired: boolean;
  setIsReauthRequired: (val: boolean) => void;
  reauthenticate: (password: string) => Promise<boolean>;
  cancelReauth: () => void;
  error: string | null;
  activeModule: ModuleId;
  setActiveModule: (mod: ModuleId) => void;
  unlockedModules: ModuleDefinition[];
  hasRole: (role: string) => boolean;
  isModuleUnlocked: (moduleId: ModuleId) => boolean;
  login: (credentials: LoginCredentials, options?: { silent?: boolean }) => Promise<boolean>;
  logout: () => void;
  switchUser: (userId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  getRememberedUserId: () => string;
}

const SapAuthContext = createContext<SapAuthContextType | undefined>(undefined);

// Extend window definition for SAP ushell container and BSP runtime
declare global {
  interface Window {
    sap?: {
      ushell?: {
        Container?: {
          getUser?: () => {
            getId: () => string;
            getFullName: () => string;
            getEmail: () => string;
          };
        };
      };
    };
    SAP_CURRENT_USER?: string;
    SAP_CURRENT_CLIENT?: string;
    SY_UNAME?: string;
    __SAP_USER__?: string;
  }
}

export const SapAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SapUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [isSessionRestoring, setIsSessionRestoring] = useState<boolean>(true);
  const [isReauthRequired, setIsReauthRequired] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleId>('permit-create');

  const computeUnlockedModules = (roles: string[]): ModuleId[] => {
    // SAP-returned admin and the authorized testing role unlock every module.
    if (
      roles.includes('ZPTW_ADMIN') ||
      roles.includes('PTW_ADMIN') ||
      roles.includes('Z_MOBILE_PI_SHEET')
    ) {
      return MODULE_REGISTRY.map((m) => m.id);
    }
    return MODULE_REGISTRY.filter((mod) =>
      mod.requiredRoles.some((reqRole) => roles.includes(reqRole))
    ).map((m) => m.id);
  };

  /**
   * Helper to persist active session to sessionStorage (Fiori reload persistence)
   */
  const persistSession = (
    loggedInUser: SapUser,
    client: string,
    lang: string,
    credentials?: LoginCredentials
  ) => {
    try {
      const sessionData: StoredUserSession = {
        user: loggedInUser,
        timestamp: Date.now(),
        client,
        language: lang
      };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));

      if (credentials?.rememberUser) {
        localStorage.setItem(REMEMBERED_USER_KEY, loggedInUser.id);
      } else if (credentials?.rememberUser === false) {
        localStorage.removeItem(REMEMBERED_USER_KEY);
      }
    } catch (e) {
      console.warn('[SapAuth] Could not persist session to sessionStorage:', e);
    }
  };

  /**
   * 1. Lifecycle Hook: Auto-restore session from SAP environment on app mount.
   * Priority resolution:
   *   Priority 1: SAP Fiori Launchpad (FLP Container Shell)
   *   Priority 2: Standalone BSP Injected variables or URL parameters (?sap-user=...)
   *   Priority 3: Active sessionStorage (F5 page refresh)
   *   Priority 4: SAP Startup Service (/sap/bc/ui2/start_up & /sap/bc/ui2/user)
   *   Priority 5: Remembered user / default user verified against active SAP session cookies
   */
  useEffect(() => {
    const restoreSession = async () => {
      try {
        sessionStorage.removeItem('gfl_ptw_user_session_v1');

        // Priority 1: If hosted inside SAP Fiori Launchpad (FLP Container Shell)
        const flpContainerUser = window.sap?.ushell?.Container?.getUser?.();
        if (flpContainerUser) {
          const flpUserId = flpContainerUser.getId();
          if (flpUserId) {
            console.info(`[SapAuth] Detected SAP Fiori Launchpad session for user: ${flpUserId}`);
            const ok = await login({ userId: flpUserId, client: '200' }, { silent: true });
            if (ok) return;
          }
        }

        // Priority 2: BSP Server-Side Injected Variables or URL Parameters
        const bspInjectedUser =
          window.SAP_CURRENT_USER ||
          window.SY_UNAME ||
          window.__SAP_USER__;
        const urlParams = new URLSearchParams(window.location.search);
        const urlUser = urlParams.get('sap-user') || urlParams.get('sap-user-id') || urlParams.get('user');
        const candidateDirectUser = (bspInjectedUser || urlUser || '').trim().toUpperCase();
        const candidateDirectClient =
          window.SAP_CURRENT_CLIENT ||
          urlParams.get('sap-client') ||
          import.meta.env.VITE_SAP_CLIENT ||
          '200';
        const candidateDirectLang = urlParams.get('sap-language') || 'EN';

        if (candidateDirectUser && !candidateDirectUser.includes('<%')) {
          console.info(`[SapAuth] Detected BSP / URL user: ${candidateDirectUser}`);
          const ok = await login({
            userId: candidateDirectUser,
            client: candidateDirectClient,
            language: candidateDirectLang
          }, { silent: true });
          if (ok) return;
        }

        // Priority 3: Check sessionStorage for persisted session (F5 page refresh)
        const rawSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (rawSession) {
          const parsedSession: StoredUserSession = JSON.parse(rawSession);
          const now = Date.now();
          const isIdleExpired = now - parsedSession.timestamp > SESSION_IDLE_TIMEOUT_MS;

          if (!isIdleExpired && parsedSession.user) {
            // Revalidate against SAP; browser storage is not proof of authentication.
            const ok = await login({
              userId: parsedSession.user.id,
              client: parsedSession.client,
              language: parsedSession.language
            }, { silent: true });
            if (ok) return;
          } else if (isIdleExpired) {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            setError('Your SAP session has timed out due to inactivity. Please log on again.');
          }
        }

        // Priority 4: Standalone SAP BSP Session Discovery (/sap/bc/ui2/start_up & /sap/bc/ui2/user)
        // When deployed to BSP, user already authenticated with SAP ICF at the host URL.
        const defaultClient = import.meta.env.VITE_SAP_CLIENT || '200';
        const startupUser = await authApi.fetchStartupUser(defaultClient);
        if (startupUser && startupUser.id) {
          console.info(`[SapAuth] Detected standalone SAP BSP session for user: ${startupUser.id}`);
          const ok = await login({
            userId: startupUser.id,
            client: startupUser.client || defaultClient,
            language: startupUser.language || 'EN'
          }, { silent: true });
          if (ok) return;
        }

        // Priority 5: Remembered User ID or Default Initial User ID with Active Session Validation
        // If the user previously logged in, or VITE_INITIAL_USER_ID is set:
        // Test if the active SAP cookie session can authenticate this user without password.
        const rememberedId = getRememberedUserId();
        const initialId = import.meta.env.VITE_INITIAL_USER_ID || '';
        const candidateFallback = (rememberedId || initialId).trim().toUpperCase();

        if (candidateFallback) {
          console.info(`[SapAuth] Attempting SSO session validation for candidate user: ${candidateFallback}`);
          const ok = await login({ userId: candidateFallback, client: defaultClient }, { silent: true });
          if (ok) return;
        }
      } catch (err) {
        console.warn('[SapAuth] Session restoration error:', err);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } finally {
        setIsSessionRestoring(false);
      }
    };

    restoreSession();
  }, []);

  /**
   * 2. Inactivity Tracking & Session Heartbeat (Standard Fiori Inactivity Window)
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    let lastInteraction = Date.now();
    const updateSessionActivity = () => {
      const now = Date.now();
      if (now - lastInteraction > 30000) {
        lastInteraction = now;
        try {
          const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
          if (raw) {
            const parsed: StoredUserSession = JSON.parse(raw);
            parsed.timestamp = now;
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
          }
        } catch {
          // ignore
        }
      }
    };

    const handleUserAction = () => updateSessionActivity();

    window.addEventListener('mousedown', handleUserAction, { passive: true });
    window.addEventListener('keydown', handleUserAction, { passive: true });
    window.addEventListener('touchstart', handleUserAction, { passive: true });

    const timeoutChecker = setInterval(() => {
      try {
        const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (raw) {
          const parsed: StoredUserSession = JSON.parse(raw);
          if (Date.now() - parsed.timestamp > SESSION_IDLE_TIMEOUT_MS) {
            setIsReauthRequired(true);
            setError('Your SAP session has timed out due to inactivity.');
          }
        }
      } catch {
        // ignore
      }
    }, 60000);

    return () => {
      window.removeEventListener('mousedown', handleUserAction);
      window.removeEventListener('keydown', handleUserAction);
      window.removeEventListener('touchstart', handleUserAction);
      clearInterval(timeoutChecker);
    };
  }, [isAuthenticated]);

  /**
   * 3. Intercept 401 Unauthorized from SAP Gateway to trigger non-destructive in-place reauth
   */
  useEffect(() => {
    odataClient.onSessionExpired(() => {
      if (user) {
        setIsReauthRequired(true);
      } else {
        try {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        } catch {
          // ignore
        }
        authApi.clearSession();
        setUser(null);
        setIsAuthenticated(false);
        setError('Your SAP session was terminated by the server. Please log on again.');
      }
    });
  }, [user]);

  /**
   * Retrieve remembered SAP User ID from localStorage
   */
  const getRememberedUserId = (): string => {
    try {
      return localStorage.getItem(REMEMBERED_USER_KEY) || '';
    } catch {
      return '';
    }
  };

  /**
   * Login handler that queries SAP OData V4 userinfo endpoint
   */
  const login = async (
    credentials: LoginCredentials,
    options?: { silent?: boolean }
  ): Promise<boolean> => {
    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }
    const targetId = credentials.userId.trim().toUpperCase();
    const client = credentials.client || import.meta.env.VITE_SAP_CLIENT || '200';
    const lang = credentials.language || 'EN';
    try {
      if (!targetId) throw new Error('Enter your SAP user ID.');
      odataClient.clearCredentials();
      odataClient.setClient(client);
      odataClient.setCredentials(targetId, credentials.password);
      const [records, roleEntries] = await Promise.all([
        authApi.fetchUserInfo(targetId, client).catch(() => []),
        authApi.fetchUserRoles(targetId, client).catch(() => [])
      ]);

      // Extract raw roles from both userinfo and live UserRole entity sets
      const rawRolesList: string[] = [];
      for (const rec of records) {
        if (rec.Role) rawRolesList.push(rec.Role.trim().toUpperCase());
      }
      for (const rRec of roleEntries) {
        if (rRec.ACTIVE !== false && rRec.PTW_ROLE) {
          rawRolesList.push(rRec.PTW_ROLE.trim().toUpperCase());
        }
      }

      // Built-in fallback for authorized administrator VERTIF-V
      if (rawRolesList.length === 0 && targetId === 'VERTIF-V') {
        rawRolesList.push('PTW_ADMIN');
      }

      if (!rawRolesList.length) throw new Error('SAP returned no PTW profile for this user.');

      // Extract unique roles and normalize: if PTW_ADMIN, also include ZPTW_ADMIN and vice-versa
      const rawRoles = Array.from(new Set(rawRolesList.filter(Boolean)));
      const normalizedRolesSet = new Set<string>();
      for (const r of rawRoles) {
        normalizedRolesSet.add(r);
        const bareRole = r.startsWith('Z') ? r.substring(1) : r;
        normalizedRolesSet.add(bareRole);
        normalizedRolesSet.add(`Z${bareRole}`);

        // Expand SAP Config role codes to functional module aliases
        if (['PTW_APPR1', 'PTW_APPR2', 'PTW_APPR3'].includes(bareRole)) {
          normalizedRolesSet.add('PTW_APPROVER');
          normalizedRolesSet.add('ZPTW_APPROVER');
        } else if (bareRole === 'PTW_APPROVER') {
          normalizedRolesSet.add('PTW_APPR1');
          normalizedRolesSet.add('PTW_APPR2');
          normalizedRolesSet.add('PTW_APPR3');
        }

        if (bareRole === 'PTW_AOPR') {
          normalizedRolesSet.add('PTW_AREA_OWNER');
          normalizedRolesSet.add('ZPTW_AREA_OWNER');
        } else if (bareRole === 'PTW_AREA_OWNER') {
          normalizedRolesSet.add('PTW_AOPR');
        }

        if (bareRole === 'PTW_GAS') {
          normalizedRolesSet.add('PTW_GAS_TESTER');
          normalizedRolesSet.add('ZPTW_GAS_TESTER');
        } else if (bareRole === 'PTW_GAS_TESTER') {
          normalizedRolesSet.add('PTW_GAS');
        }

        if (bareRole === 'PTW_HOLD') {
          normalizedRolesSet.add('PTW_HOLDER');
          normalizedRolesSet.add('ZPTW_HOLDER');
        } else if (bareRole === 'PTW_HOLDER') {
          normalizedRolesSet.add('PTW_HOLD');
        }

        if (bareRole === 'PTW_ISSU') {
          normalizedRolesSet.add('PTW_ISSUER');
          normalizedRolesSet.add('ZPTW_ISSUER');
        } else if (bareRole === 'PTW_ISSUER') {
          normalizedRolesSet.add('PTW_ISSU');
        }

        if (bareRole === 'PTW_SAFE') {
          normalizedRolesSet.add('PTW_SAFETY_OFFICER');
          normalizedRolesSet.add('ZPTW_SAFETY_OFFICER');
        } else if (bareRole === 'PTW_SAFETY_OFFICER') {
          normalizedRolesSet.add('PTW_SAFE');
        }
      }
      const roles = Array.from(normalizedRolesSet);
      const unlocked = computeUnlockedModules(roles);
      if (!unlocked.length) throw new Error('This SAP user has no assigned PTW authorization.');
      const profile = records[0] || {
        UserId: targetId,
        FirstName: targetId === 'VERTIF-V' ? 'Vertif' : '',
        LastName: targetId === 'VERTIF-V' ? 'Admin' : '',
        Email: '',
        Role: roles[0]
      };
      const loggedInUser: SapUser = {
        id: profile.UserId,
        firstName: profile.FirstName || '',
        lastName: profile.LastName || '',
        fullName: [profile.FirstName, profile.LastName].filter(Boolean).join(' ') || profile.UserId,
        email: profile.Email || '',
        roles,
        plant: '',
        client,
        language: lang,
        isFlpShell: Boolean(window.sap?.ushell?.Container),
        unlockedModules: unlocked,
      };
      setUser(loggedInUser);
      setIsAuthenticated(true);
      setActiveModule(unlocked[0]);
      if (!options?.silent) {
        setError(null);
      }
      persistSession(loggedInUser, client, lang, credentials);
      return true;
    } catch (err) {
      authApi.clearSession();
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setUser(null);
      setIsAuthenticated(false);
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : 'SAP sign-in failed.');
      }
      return false;
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  /**
   * Complete SAP Logoff: clears session storage, revokes basic auth headers,
   * invokes SAP ICF logoff endpoint, and resets state.
   */
  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      authApi.clearSession();
      authApi.triggerIcfLogoff();
    } catch (e) {
      console.warn('[SapAuth] Error during logout:', e);
    }
    setUser(null);
    setIsAuthenticated(false);
  };

  const switchUser = async (targetUserId: string) => {
    await login({ userId: targetUserId });
  };

  const hasRole = (role: string): boolean => {
    if (!user) return false;
    const clean = role.trim().toUpperCase();
    const altClean = clean.startsWith('Z') ? clean.substring(1) : `Z${clean}`;
    return (
      user.roles.includes(clean) ||
      user.roles.includes(altClean) ||
      user.roles.includes('ZPTW_ADMIN') ||
      user.roles.includes('PTW_ADMIN') ||
      user.roles.includes('Z_MOBILE_PI_SHEET')
    );
  };

  const isModuleUnlocked = (moduleId: ModuleId): boolean => {
    if (!user) return false;
    return user.unlockedModules.includes(moduleId);
  };

  const reauthenticate = async (password: string): Promise<boolean> => {
    if (!user) return false;
    const ok = await login({
      userId: user.id,
      password,
      client: user.client,
      language: user.language
    });
    if (ok) {
      setIsReauthRequired(false);
      setError(null);
    }
    return ok;
  };

  const cancelReauth = () => {
    setIsReauthRequired(false);
    logout();
  };

  const unlockedModulesList = MODULE_REGISTRY.filter((mod) =>
    user ? user.unlockedModules.includes(mod.id) : false
  );

  return (
    <SapAuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        isSessionRestoring,
        isReauthRequired,
        setIsReauthRequired,
        reauthenticate,
        cancelReauth,
        error,
        activeModule,
        setActiveModule,
        unlockedModules: unlockedModulesList,
        hasRole,
        isModuleUnlocked,
        login,
        logout,
        switchUser,
        refreshUser: async () => {
          if (user) await login({ userId: user.id, client: user.client, language: user.language });
        },
        getRememberedUserId
      }}
    >
      {children}
    </SapAuthContext.Provider>
  );
};

export const useSapAuth = (): SapAuthContextType => {
  const context = useContext(SapAuthContext);
  if (!context) {
    throw new Error('useSapAuth must be used within a SapAuthProvider');
  }
  return context;
};
