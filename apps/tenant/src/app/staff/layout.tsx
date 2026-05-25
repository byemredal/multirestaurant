import type { ReactNode } from 'react';
import { StaffAuthProvider } from '@/lib/auth/staff-auth-context';
import { StaffSessionGate } from '@/lib/auth/staff-session-gate';

/**
 * Route group layout for `/staff/*`. Mounts the staff auth provider +
 * session gate INSIDE the global TenantAuthProvider (from the root
 * layout) but NEVER shares its state — separate context, separate
 * storage key. TenantGate already short-circuits on `/staff/*` so the
 * staff surface owns its own routing.
 */
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <StaffAuthProvider>
      <StaffSessionGate>{children}</StaffSessionGate>
    </StaffAuthProvider>
  );
}
