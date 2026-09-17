import React, { createContext, useContext, useState } from 'react';
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
  mockRoles?: string[];
}

interface SapAuthContextType {
  user: SapUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  activeModule: ModuleId;
  setActiveModule: (mod: ModuleId) => void;
  unlockedModules: ModuleDefinition[];
  hasRole: (role: string) => boolean;
  isModuleUnlocked: (moduleId: ModuleId) => boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  switchUser: (userId: string, customRoles?: string[]) => Promise<void>;
  refreshUser: () => Promise<void>;
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
  const [error, setError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleId>('permit-create');

  const computeUnlockedModules = (roles: string[]): ModuleId[] => {
    return MODULE_REGISTRY.filter((mod) =>
      mod.requiredRoles.some((reqRole) => roles.includes(reqRole))
    ).map((m) => m.id);
  };

  /**
   * Login handler that queries SAP OData V4 userinfo endpoint
   */
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setLoading(true);
    setError(null);

    const targetId = credentials.userId.trim().toUpperCase();
    const client = credentials.client || '100';
    const lang = credentials.language || 'EN';

    try {
      // 1. If explicit mockRoles passed (e.g. from preset buttons)
      if (credentials.mockRoles && credentials.mockRoles.length > 0) {
        const unlocked = computeUnlockedModules(credentials.mockRoles);
        const loggedInUser: SapUser = {
          id: targetId,
          firstName: '1',
          lastName: targetId,
          fullName: `1 ${targetId}`,
          email: `${targetId.toLowerCase()}@gfl.co.in`,
          roles: credentials.mockRoles,
          plant: '1000',
          client,
          language: lang,
          isFlpShell: false,
          unlockedModules: unlocked
        };

        setUser(loggedInUser);
        setIsAuthenticated(true);
        if (unlocked.length > 0) {
          setActiveModule(unlocked[0]);
        }
        setLoading(false);
        return true;
      }

      // 2. Fetch live userinfo from SAP OData V4 Service
      try {
        const endpoint = `userinfo?$filter=UserId eq '${encodeURIComponent(targetId)}'`;
        const response = await odataClient.get<{ value: SapUserInfoRecord[] }>(endpoint);

        if (response.data && response.data.value && response.data.value.length > 0) {
          const records = response.data.value;
          const firstRecord = records[0];

          const roles = Array.from(new Set(records.map((r) => r.Role).filter(Boolean)));
          const activeRoles = roles.length > 0 ? roles : ['ZPTW_REQUESTER'];
          const unlocked = computeUnlockedModules(activeRoles);

          const loggedInUser: SapUser = {
            id: firstRecord.UserId,
            firstName: firstRecord.FirstName || '1',
            lastName: firstRecord.LastName || firstRecord.UserId,
            fullName: `${firstRecord.FirstName || '1'} ${firstRecord.LastName || firstRecord.UserId}`.trim(),
            email: firstRecord.Email || `${targetId.toLowerCase()}@gfl.co.in`,
            roles: activeRoles,
            plant: '1000',
            client,
            language: lang,
            isFlpShell: false,
            unlockedModules: unlocked
          };

          setUser(loggedInUser);
          setIsAuthenticated(true);
          if (unlocked.length > 0) {
            setActiveModule(unlocked[0]);
          }
          setLoading(false);
          return true;
        }
      } catch (liveErr: any) {
        console.warn('[SapAuth] Live OData call returned error or offline. Using configured role definition for:', targetId);
      }

      // 3. Fallback matching default roles for common SAP test users
      let fallbackRoles: string[] = ['ZPTW_REQUESTER'];
      if (targetId === 'VERTIF-V') fallbackRoles = ['ZPTW_REQUESTER'];
      else if (targetId.includes('APPROV')) fallbackRoles = ['ZPTW_APPROVER'];
      else if (targetId.includes('ISSUE')) fallbackRoles = ['ZPTW_ISSUER'];
      else if (targetId.includes('HOLD')) fallbackRoles = ['ZPTW_HOLDER'];
      else if (targetId.includes('GAS')) fallbackRoles = ['ZPTW_GAS_TESTER'];
      else if (targetId.includes('ISOLAT')) fallbackRoles = ['ZPTW_ISOLATOR'];
      else if (targetId.includes('ADMIN')) fallbackRoles = ['ZPTW_ADMIN'];
      else fallbackRoles = ['ZPTW_REQUESTER', 'ZPTW_APPROVER'];

      const fallbackUnlocked = computeUnlockedModules(fallbackRoles);
      const fallbackUser: SapUser = {
        id: targetId,
        firstName: '1',
        lastName: targetId,
        fullName: `1 ${targetId}`,
        email: `${targetId.toLowerCase()}@gfl.co.in`,
        roles: fallbackRoles,
        plant: '1000',
        client,
        language: lang,
        isFlpShell: false,
        unlockedModules: fallbackUnlocked
      };

      setUser(fallbackUser);
      setIsAuthenticated(true);
      if (fallbackUnlocked.length > 0) {
        setActiveModule(fallbackUnlocked[0]);
      }
      setLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message || 'Login failed. Verify SAP credentials and Gateway URL.');
      setLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  const switchUser = async (targetUserId: string, customRoles?: string[]) => {
    await login({ userId: targetUserId, mockRoles: customRoles });
  };

  const hasRole = (role: string): boolean => {
    if (!user) return false;
    return user.roles.includes(role) || user.roles.includes('ZPTW_ADMIN');
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
        }
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
