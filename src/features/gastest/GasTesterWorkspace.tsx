import type { SapUser } from '../../core/auth/sapAuthContext';
import { PermitProcedureWorkspace } from '../permits/PermitProcedureWorkspace';
/** The supplied service exposes read-only gas evidence and permit-bound finalization. */
export function GasTesterWorkspace({ user, onBack }: { user: SapUser | null; onBack: () => void }) {
  return <PermitProcedureWorkspace module="gas-tester" user={user} onBack={onBack} />;
}
