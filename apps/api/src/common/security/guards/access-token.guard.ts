import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../../../modules/auth/auth.service';
import { AdminAuthService } from '../../../modules/admin-auth/admin-auth.service';
import { StaffAuthService } from '../../../modules/staff-auth/staff-auth.service';
import { TenantsService } from '../../../modules/tenants/tenants.service';
import { AuthenticatedRequest } from '../../types/authenticated-request.interface';
import { AuthSubjectType } from '../auth-subject.type';
import { AUTH_TYPES_KEY, IS_PUBLIC_KEY } from '../constants';
import { SecurityLoggerService } from '../security-logger.service';
import { SessionTokenService } from '../session-token.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionTokenService: SessionTokenService,
    private readonly authService: AuthService,
    private readonly adminAuthService: AdminAuthService,
    private readonly tenantsService: TenantsService,
    private readonly staffAuthService: StaffAuthService,
    private readonly securityLogger: SecurityLoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest & Request>();
    const token =
      this.extractBearerToken(request.headers.authorization) ??
      this.extractQueryToken(request);

    if (!token) {
      this.securityLogger.logUnauthorized({
        path: request.originalUrl,
        method: request.method,
        ip: request.ip,
        reason: 'missing_bearer_token',
      });
      throw new UnauthorizedException('Authentication is required.');
    }

    const payload = await this.verifyToken(token, request);
    const allowedTypes =
      this.reflector.getAllAndOverride<AuthSubjectType[] | undefined>(AUTH_TYPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (allowedTypes.length > 0 && !allowedTypes.includes(payload.type)) {
      this.securityLogger.logForbidden({
        path: request.originalUrl,
        method: request.method,
        ip: request.ip,
        tokenType: payload.type,
        requiredTypes: allowedTypes.join(','),
      });
      throw new ForbiddenException('You do not have access to this resource.');
    }

    if (payload.type === 'customer') {
      const account = await this.authService.validateCustomer(payload.sub);
      if (!account) {
        this.securityLogger.logUnauthorized({
          path: request.originalUrl,
          method: request.method,
          ip: request.ip,
          tokenType: payload.type,
          reason: 'inactive_or_missing_customer',
        });
        throw new UnauthorizedException('Authenticated account is inactive or missing.');
      }

      request.user = {
        id: account.id,
        email: account.email,
        type: 'customer',
      };
      return true;
    }

    if (payload.type === 'tenant') {
      const tenant = await this.tenantsService.validateTenant(payload.sub);
      if (!tenant) {
        this.securityLogger.logUnauthorized({
          path: request.originalUrl,
          method: request.method,
          ip: request.ip,
          tokenType: payload.type,
          reason: 'inactive_or_missing_tenant',
        });
        throw new UnauthorizedException('Authenticated account is inactive or missing.');
      }

      request.user = {
        id: tenant.id,
        email: tenant.email,
        type: 'tenant',
      };
      return true;
    }

    if (payload.type === 'staff') {
      const session = await this.staffAuthService.validateStaff(payload.sub);
      if (!session) {
        this.securityLogger.logUnauthorized({
          path: request.originalUrl,
          method: request.method,
          ip: request.ip,
          tokenType: payload.type,
          reason: 'inactive_or_missing_staff_or_membership',
        });
        throw new UnauthorizedException('Authenticated account is inactive or missing.');
      }

      // staffStoreScope is derived server-side from active StaffMembership
      // rows. The JWT may carry a `storeScope` claim, but the guard ALWAYS
      // overrides it with the live DB value so a stolen or stale token cannot
      // widen scope. This is what makes membership revocation effective on
      // the very next request, not on the next access-token rotation.
      request.user = {
        id: session.account.id,
        email: session.account.email,
        type: 'staff',
        staffStoreScope: [...session.storeScope],
      };
      return true;
    }

    const admin = await this.adminAuthService.validateAdmin(payload.sub);
    if (!admin) {
      this.securityLogger.logUnauthorized({
        path: request.originalUrl,
        method: request.method,
        ip: request.ip,
        tokenType: payload.type,
        reason: 'inactive_or_missing_admin',
      });
      throw new UnauthorizedException('Authenticated account is inactive or missing.');
    }

    // CANONICAL admin role source = AdminAccount.role (MR-DB-HARDENING-01 Slice 6).
    // Do NOT read AdminMembership.role here for authorization — it is an unused
    // placeholder for a future scoped RBAC design. See
    // docs/architecture/admin-role-source-of-truth.md.
    request.user = {
      id: admin.id,
      email: admin.email,
      type: 'admin',
      role: admin.role,
    };
    return true;
  }

  private async verifyToken(token: string, request: Request) {
    // Try each surface in turn — verifyAccessToken refuses to honor a token
    // whose `type` does not match the requested subject, which is the
    // structural guarantee that surfaces cannot cross-contaminate. The
    // downstream switch on `payload.type` then routes the (already-bound)
    // claim through the matching account-validator branch.
    const subjects: AuthSubjectType[] = ['customer', 'tenant', 'staff', 'admin'];
    for (const subjectType of subjects) {
      try {
        return await this.sessionTokenService.verifyAccessToken(token, subjectType);
      } catch {
        // try next subject
      }
    }

    this.securityLogger.logUnauthorized({
      path: request.originalUrl,
      method: request.method,
      ip: request.ip,
      reason: 'invalid_access_token',
    });
    throw new UnauthorizedException('Access token is invalid or expired.');
  }

  private extractBearerToken(authorizationHeader?: string) {
    if (!authorizationHeader) {
      return null;
    }

    const [scheme, token] = authorizationHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token.trim();
  }

  /**
   * Server-Sent Events streams are opened with the browser `EventSource` API,
   * which cannot set an `Authorization` header. For those connections the
   * access token is supplied as the `access_token` query parameter. The
   * fallback is intentionally restricted to GET requests so write operations
   * can never authenticate with a token that may leak into URLs / logs.
   */
  private extractQueryToken(request: Request) {
    if (request.method !== 'GET') {
      return null;
    }

    const value = request.query?.access_token;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    return null;
  }
}
