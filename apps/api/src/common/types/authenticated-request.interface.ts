import { Request } from 'express';
import { AuthSubjectType } from '../security/auth-subject.type';
import { AdminRole } from '../../modules/admin-auth/entities/admin-account.entity';

export interface AuthenticatedUser {
  id: string;
  email: string;
  type: AuthSubjectType;
  role?: AdminRole;
  /**
   * For staff sessions: the store IDs this staff JWT is scoped to. The
   * staff login path (follow-up slice) computes this from active
   * StaffMembership rows at issue time.
   */
  staffStoreScope?: readonly string[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
