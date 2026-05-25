/**
 * StaffInviteToken is the single-use, expiring secret a staff member
 * exchanges for an initial password. The raw token NEVER lives in the DB —
 * only its SHA-256 hash does. The raw token is returned exactly once to the
 * tenant owner at invite time and surfaced to the staff via out-of-band
 * means (manual share / email when wired).
 */
export interface StaffInviteToken {
  id: string;
  staffAccountId: string;
  /** SHA-256 hex hash of the raw token. Never the raw value. */
  tokenHash: string;
  expiresAt: Date;
  /** When the token was redeemed. NULL until accept-invite succeeds. */
  usedAt: Date | null;
  createdByTenantAccountId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
