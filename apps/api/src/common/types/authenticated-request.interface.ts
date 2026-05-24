import { Request } from 'express';
import { AuthSubjectType } from '../security/auth-subject.type';
import { AdminRole } from '../../modules/admin-auth/entities/admin-account.entity';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    type: AuthSubjectType;
    role?: AdminRole;
  };
}
