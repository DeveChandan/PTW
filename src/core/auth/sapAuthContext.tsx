import React, { createContext, useContext, useState, useEffect } from 'react';
import odataClient from '../api/odataClient';

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
  | 'permit-approver' 
  | 'permit-issuer' 
  | 'permit-holder' 
  | 'gas-tester' 
  | 'isolation' 
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
    title: 'Permit Create',
    subtitle: 'Hazard JSA, PPE Matrix & Work Scope Creation',
    icon: 'note_add',
    requiredRoles: ['ZPTW_REQUESTER', 'ZPTW_ADMIN'],
    badge: 'Requester'
  },
  {
    id: 'permit-details',
    title: 'Permit Details',
    subtitle: 'Permit Sheet, P&ID Schematic & Real-time Status',
    icon: 'description',
    requiredRoles: ['ZPTW_REQUESTER', 'ZPTW_HOLDER', 'ZPTW_APPROVER', 'ZPTW_ISSUER', 'ZPTW_GAS_TESTER', 'ZPTW_ISOLATOR', 'ZPTW_ADMIN'],
    badge: 'Overview'
  },
  {
    id: 'permit-approver',
    title: 'Permit Approver',
    subtitle: 'Multi-Tier Authorization Chain & Digital Signatures',
    icon: 'draw',
    requiredRoles: ['ZPTW_APPROVER', 'ZPTW_ADMIN'],
    badge: 'Approver'
  },
  {
    id: 'permit-issuer',
    title: 'Permit Issuer',
    subtitle: 'Toolbox Briefing, Site Handover & Field Issuance',
    icon: 'verified',
    requiredRoles: ['ZPTW_ISSUER', 'ZPTW_SAFETY_OFFICER', 'ZPTW_ADMIN'],
    badge: 'Issuer'
  },
  {
    id: 'permit-holder',
    title: 'Permit Holder',
    subtitle: 'On-Site Worker Ledger, Suspension & Site Restoration',
    icon: 'engineering',
    requiredRoles: ['ZPTW_HOLDER', 'ZPTW_REQUESTER', 'ZPTW_ADMIN'],
    badge: 'Holder'
  },
  {
    id: 'gas-tester',
    title: 'Gas Tester',
    subtitle: 'Atmospheric O2, LEL%, H2S, CO Calibration & Logs',
    icon: 'air',
    requiredRoles: ['ZPTW_GAS_TESTER', 'ZPTW_SAFETY_OFFICER', 'ZPTW_ADMIN'],
    badge: 'Gas Tester'
  },
  {
    id: 'isolation',
    title: 'LOTO Isolation',
    subtitle: 'Zero-Energy Breaker, Valve Lock & Blind Flange Registry',
    icon: 'lock_reset',
    requiredRoles: ['ZPTW_ISOLATOR', 'ZPTW_AREA_OWNER', 'ZPTW_ADMIN'],
    badge: 'Isolation'
  },
  {
    id: 'admin',
    title: 'PTW Admin',
    subtitle: 'SAP Role Mappings, Plant Master Data & Global Audits',
    icon: 'admin_panel_settings',
    requiredRoles: ['ZPTW_ADMIN'],
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
  authHeader?: string;
}

export const SESSION_STORAGE_KEY = 'gfl_ptw_user_session_v1';
export const REMEMBERED_USER_KEY = 'gfl_ptw_remembered_userid';
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes Fiori idle timeout

interface SapAuthContextType {
  user: SapUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  isSessionRestoring: boolean;
  error: string | null;
  activeModule: ModuleId;
  setActiveModule: (mod: ModuleId) => void;
  unlockedModules: ModuleDefinition[];
  hasRole: (role: string) => boolean;
  isModuleUnlocked: (moduleId: ModuleId) => boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  switchUser: (userId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  getRememberedUserId: () => string;
}

const SapAuthContext = createContext<SapAuthContextType | undefined>(undefined);

// Extend window definition for SAP ushell container
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
  }
}

export const SapAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SapUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [isSessionRestoring, setIsSessionRestoring] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleId>('permit-create');

  const computeUnlockedModules = (roles: string[]): ModuleId[] => {
    // If role includes Z_MOBILE_PI_SHEET (test bypass role) or ZPTW_ADMIN, unlock ALL 8 modules!
    if (roles.includes('Z_MOBILE_PI_SHEET') || roles.includes('ZPTW_ADMIN')) {
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
        language: lang,
        authHeader: credentials?.password
          ? btoa(`${credentials.userId.trim().toUpperCase()}:${credentials.password}`)
          : undefined
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
   * 1. Lifecycle Hook: Auto-restore session from sessionStorage on app mount / page reload (F5)
   * or detect SAP Fiori Launchpad container user.
   */
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Priority A: If hosted inside SAP Fiori Launchpad (FLP Container Shell)
        const flpContainerUser = window.sap?.ushell?.Container?.getUser?.();
        if (flpContainerUser) {
          const flpUserId = flpContainerUser.getId();
          if (flpUserId) {
            console.info(`[SapAuth] Detected SAP Fiori Launchpad session for user: ${flpUserId}`);
            await login({ userId: flpUserId, client: '200' });
            setIsSessionRestoring(false);
            return;
          }
        }

        // Priority B: Check sessionStorage for persisted session
        const rawSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (rawSession) {
          const parsedSession: StoredUserSession = JSON.parse(rawSession);
          const now = Date.now();
          const isIdleExpired = now - parsedSession.timestamp > SESSION_IDLE_TIMEOUT_MS;

          if (!isIdleExpired && parsedSession.user) {
            setUser(parsedSession.user);
            setIsAuthenticated(true);
            if (parsedSession.user.unlockedModules?.length > 0) {
              setActiveModule(parsedSession.user.unlockedModules[0]);
            }

            if (parsedSession.authHeader) {
              try {
                const decoded = atob(parsedSession.authHeader);
                const [storedUser, storedPass] = decoded.split(':');
                odataClient.setCredentials(storedUser, storedPass);
              } catch {
                // Ignore decoding error
              }
            }

            parsedSession.timestamp = Date.now();
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsedSession));
            console.info(`[SapAuth] Restored active session for SAP User: ${parsedSession.user.id}`);
          } else if (isIdleExpired) {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            setError('Your SAP session has timed out due to inactivity. Please log on again.');
          }
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
            logout();
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
   * 3. Intercept 401 Unauthorized from SAP Gateway to expire session
   */
  useEffect(() => {
    odataClient.onSessionExpired(() => {
      try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        // ignore
      }
      setUser(null);
      setIsAuthenticated(false);
      setError('Your SAP session was terminated by the server. Please log on again.');
    });
  }, []);

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
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setLoading(true);
    setError(null);

    const targetId = credentials.userId.trim().toUpperCase();
    const client = credentials.client || '200';
    const lang = credentials.language || 'EN';

    if (!targetId) {
      setError('YOUR NOT AUTHORIGE USE PERMIT TO WORK GFL APP');
      setLoading(false);
      return false;
    }

    try {
      // Set basic auth credentials if password provided
      odataClient.setCredentials(targetId, credentials.password);

      // Query live userinfo from SAP OData V4 Service with sap-client=200
      const endpoint = `userinfo?$filter=UserId eq '${encodeURIComponent(targetId)}'&sap-client=${client}`;
      let liveSuccess = false;
      let records: SapUserInfoRecord[] = [];

      try {
        const response = await odataClient.get<{ value: SapUserInfoRecord[] }>(endpoint);
        if (response.data && Array.isArray(response.data.value)) {
          records = response.data.value;
          liveSuccess = true;
        }
      } catch (liveErr) {
        console.warn('[SapAuth] Live OData call returned error or offline:', liveErr);
      }

      // If live call returned data
      if (liveSuccess) {
        if (records.length === 0) {
          // User not found in SAP
          setError('YOUR NOT AUTHORIGE USE PERMIT TO WORK GFL APP');
          setIsAuthenticated(false);
          setUser(null);
          setLoading(false);
          return false;
        }

        const roles = Array.from(new Set(records.map((r) => r.Role).filter(Boolean)));
        const unlocked = computeUnlockedModules(roles);

        if (unlocked.length === 0) {
          // User exists but has no valid PTW roles
          setError('YOUR NOT AUTHORIGE USE PERMIT TO WORK GFL APP');
          setIsAuthenticated(false);
          setUser(null);
          setLoading(false);
          return false;
        }

        const firstRecord = records[0];
        const loggedInUser: SapUser = {
          id: firstRecord.UserId,
          firstName: firstRecord.FirstName || '1',
          lastName: firstRecord.LastName || firstRecord.UserId,
          fullName: `${firstRecord.FirstName || '1'} ${firstRecord.LastName || firstRecord.UserId}`.trim(),
          email: firstRecord.Email || `${targetId.toLowerCase()}@gfl.co.in`,
          roles,
          plant: '1000',
          client,
          language: lang,
          isFlpShell: false,
          unlockedModules: unlocked
        };

        setUser(loggedInUser);
        setIsAuthenticated(true);
        setActiveModule(unlocked[0]);
        setLoading(false);
        persistSession(loggedInUser, client, lang, credentials);
        return true;
      }

      // Local / Offline fallback ONLY for verified SAP test user VERTIF-V
      if (targetId === 'VERTIF-V') {
        const roles = ['ZPTW_REQUESTER'];
        const unlocked = computeUnlockedModules(roles);
        const loggedInUser: SapUser = {
          id: 'VERTIF-V',
          firstName: '1',
          lastName: 'VERTIF-V',
          fullName: '1 VERTIF-V',
          email: 'testuser2@gfl.co.in',
          roles,
          plant: '1000',
          client,
          language: lang,
          isFlpShell: false,
          unlockedModules: unlocked
        };

        setUser(loggedInUser);
        setIsAuthenticated(true);
        setActiveModule(unlocked[0]);
        setLoading(false);
        persistSession(loggedInUser, client, lang, credentials);
        return true;
      }

      // Local / Offline fallback for test bypass role Z_MOBILE_PI_SHEET
      if (targetId === 'Z_MOBILE_PI_SHEET' || targetId.includes('PI_SHEET')) {
        const roles = ['Z_MOBILE_PI_SHEET'];
        const unlocked = computeUnlockedModules(roles);
        const loggedInUser: SapUser = {
          id: targetId,
          firstName: 'Mobile',
          lastName: 'PI Sheet',
          fullName: 'Test PI Sheet User',
          email: `${targetId.toLowerCase()}@gfl.co.in`,
          roles,
          plant: '1000',
          client,
          language: lang,
          isFlpShell: false,
          unlockedModules: unlocked
        };

        setUser(loggedInUser);
        setIsAuthenticated(true);
        setActiveModule(unlocked[0]);
        setLoading(false);
        persistSession(loggedInUser, client, lang, credentials);
        return true;
      }

      // Any other user not found or without role
      setError('YOUR NOT AUTHORIGE USE PERMIT TO WORK GFL APP');
      setIsAuthenticated(false);
      setUser(null);
      setLoading(false);
      return false;
    } catch (err: any) {
      setError('YOUR NOT AUTHORIGE USE PERMIT TO WORK GFL APP');
      setIsAuthenticated(false);
      setUser(null);
      setLoading(false);
      return false;
    }
  };

  /**
   * Complete SAP Logoff: clears session storage, revokes basic auth headers,
   * invokes SAP ICF logoff endpoint, and resets state.
   */
  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      odataClient.clearCredentials();
      odataClient.triggerIcfLogoff();
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
    return (
      user.roles.includes(role) ||
      user.roles.includes('ZPTW_ADMIN') ||
      user.roles.includes('Z_MOBILE_PI_SHEET')
    );
  };

  const isModuleUnlocked = (moduleId: ModuleId): boolean => {
    if (!user) return false;
    return user.unlockedModules.includes(moduleId);
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
          await login({ userId: user?.id || 'VERTIF-V' });
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
