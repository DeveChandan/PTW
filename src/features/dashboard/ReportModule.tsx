import React from 'react';
import { ModuleDefinition, SapUser } from '../../core/auth/sapAuthContext';
import { ComingSoonModule } from '../../shared/components/ComingSoonModule';

interface ReportModuleProps {
  module: ModuleDefinition;
  user: SapUser | null;
  onBack?: () => void;
}

/**
 * ReportModule - Developer 3 Assigned Scope
 * Displays coming soon state for PTW Reports & Analytics module
 */
export const ReportModule: React.FC<ReportModuleProps> = ({ module, user, onBack }) => {
  return (
    <ComingSoonModule
      module={module}
      user={user}
      onBack={onBack}
    />
  );
};

export default ReportModule;
