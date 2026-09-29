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
    requiredRoles: ['ZPTW_REQUESTER', 'ZPTW_ADMIN'],
    badge: 'Requester'
  },
  {
    id: 'permit-details',
    title: 'Permit Display',
    subtitle: 'Permit Sheet, P&ID Schematic & Real-time Status',
    icon: 'description',
    requiredRoles: ['ZPTW_REQUESTER', 'ZPTW_HOLDER', 'ZPTW_APPROVER', 'ZPTW_ISSUER', 'ZPTW_GAS_TESTER', 'ZPTW_ISOLATOR', 'ZPTW_ADMIN'],
    badge: 'Overview'
  },
   {
    id: 'create-isolation',
    title: 'Isolation Create',
    subtitle: 'Zero-Energy Breaker, Valve Lock & Blind Flange Registry',
    icon: 'lock_reset',
    requiredRoles: ['ZPTW_ISOLATOR', 'ZPTW_AREA_OWNER', 'ZPTW_ADMIN'],
    badge: 'Isolation'
  },
   {
    id: 'display-isolation',
    title: 'Isolation Display',
    subtitle: 'Zero-Energy Breaker, Valve Lock & Blind Flange Registry',
    icon: 'lock_reset',
    requiredRoles: ['ZPTW_ISOLATOR', 'ZPTW_AREA_OWNER', 'ZPTW_ADMIN'],
    badge: 'Isolation'
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
    title: 'Permit Acceptor',
    subtitle: 'Toolbox Briefing, Site Handover & Field Issuance',
    icon: 'verified',
    requiredRoles: ['ZPTW_ISSUER', 'ZPTW_SAFETY_OFFICER', 'ZPTW_ADMIN'],
    badge: 'Issuer'
  },
   {
    id: 'permit-area-owner',
    title: 'Permit Area Operator',
    subtitle: 'On-Site Worker Ledger, Suspension & Site Restoration',
    icon: 'engineering',
    requiredRoles: ['ZPTW_AREA_OWNER', 'ZPTW_REQUESTER', 'ZPTW_ADMIN'],
    badge: 'Area Owner'
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
    id: 'report',
    title: 'Report',
    subtitle: 'Permit Registers, LOTO Logs & Safety Compliance Analytics',
    icon: 'bar_chart',
    requiredRoles: ['ZPTW_REQUESTER', 'ZPTW_HOLDER', 'ZPTW_APPROVER', 'ZPTW_ISSUER', 'ZPTW_SAFETY_OFFICER', 'ZPTW_ISOLATOR', 'ZPTW_AREA_OWNER', 'ZPTW_GAS_TESTER', 'ZPTW_ADMIN'],
    badge: 'Reports'
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
}

export const SESSION_STORAGE_KEY = 'gfl_ptw_user_session_v2';
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
    // SAP-returned admin and the authorized testing role unlock every module.
    if (roles.includes('ZPTW_ADMIN') || roles.includes('Z_MOBILE_PI_SHEET')) {
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
   * 1. Lifecycle Hook: Auto-restore session from sessionStorage on app mount / page reload (F5)
   * or detect SAP Fiori Launchpad container user.
   */
  useEffect(() => {
    const restoreSession = async () => {
      try {
        sessionStorage.removeItem('gfl_ptw_user_session_v1');
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
            // Revalidate against SAP; browser storage is not proof of authentication.
            await login({ userId: parsedSession.user.id, client: parsedSession.client, language: parsedSession.language });
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
      authApi.clearSession();
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
    setLoading(true); setError(null);
    const targetId = credentials.userId.trim().toUpperCase();
    const client = credentials.client || import.meta.env.VITE_SAP_CLIENT || '200';
    const lang = credentials.language || 'EN';
    try {
      if (!targetId) throw new Error('Enter your SAP user ID.');
      odataClient.clearCredentials();
      odataClient.setClient(client);
      odataClient.setCredentials(targetId, credentials.password);
      const records = await authApi.fetchUserInfo(targetId, client);
      if (!records.length) throw new Error('SAP returned no PTW profile for this user.');
      const roles = Array.from(new Set(records.map(record => record.Role.trim()).filter(Boolean)));
      const unlocked = computeUnlockedModules(roles);
      if (!unlocked.length) throw new Error('This SAP user has no assigned PTW authorization.');
      const profile = records[0];
      const loggedInUser: SapUser = {
        id: profile.UserId, firstName: profile.FirstName || '', lastName: profile.LastName || '',
        fullName: [profile.FirstName, profile.LastName].filter(Boolean).join(' ') || profile.UserId,
        email: profile.Email || '', roles, plant: '', client, language: lang,
        isFlpShell: Boolean(window.sap?.ushell?.Container), unlockedModules: unlocked,
      };
      setUser(loggedInUser); setIsAuthenticated(true); setActiveModule(unlocked[0]);
      persistSession(loggedInUser, client, lang, credentials);
      return true;
    } catch (err) {
      authApi.clearSession();
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setUser(null); setIsAuthenticated(false);
      setError(err instanceof Error ? err.message : 'SAP sign-in failed.');
      return false;
    } finally { setLoading(false); }
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
