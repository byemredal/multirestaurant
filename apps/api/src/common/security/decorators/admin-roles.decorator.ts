import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '../../../modules/admin-auth/entities/admin-account.entity';

export const ADMIN_ROLES_KEY = 'admin_roles';
export const AdminRoles = (...roles: AdminRole[]) => SetMetadata(ADMIN_ROLES_KEY, roles);
