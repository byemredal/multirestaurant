import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '../../../modules/admin-auth/entities/admin-account.entity';
import { AuthenticatedRequest } from '../../types/authenticated-request.interface';
import { ADMIN_ROLES_KEY } from '../decorators/admin-roles.decorator';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles =
      this.reflector.getAllAndOverride<AdminRole[] | undefined>(ADMIN_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user.type !== 'admin' || !request.user.role || !roles.includes(request.user.role)) {
      throw new ForbiddenException('You do not have the required admin role.');
    }

    return true;
  }
}
