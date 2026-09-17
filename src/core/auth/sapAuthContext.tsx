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
    // If role includes Z_MOBILE_PI_SHEET (test bypass role) or ZPTW_ADMIN, unlock ALL 8 modules!
    if (roles.includes('Z_MOBILE_PI_SHEET') || roles.includes('ZPTW_ADMIN')) {
      return MODULE_REGISTRY.map((m) => m.id);
    }
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

  const logout = () => {
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
