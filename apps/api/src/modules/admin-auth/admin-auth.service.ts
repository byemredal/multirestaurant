import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PasswordService } from '../../common/security/password.service';
import { SecurityLoggerService } from '../../common/security/security-logger.service';
import { SessionTokenService } from '../../common/security/session-token.service';
import { LoginAdminDto } from './dto/login-admin.dto';
import { AdminAccount } from './entities/admin-account.entity';
import { AdminUsersStore } from './admin-users.store';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly adminUsersStore: AdminUsersStore,
    private readonly passwordService: PasswordService,
    private readonly sessionTokenService: SessionTokenService,
    private readonly securityLogger: SecurityLoggerService,
  ) {}

  async login(dto: LoginAdminDto, context: Record<string, unknown> = {}) {
    const account = await this.adminUsersStore.findByEmail(dto.email);
    if (!account || !account.isActive) {
      this.securityLogger.logLoginFailure('admin', {
        email: dto.email.trim().toLowerCase(),
        ...context,
      });
      throw new UnauthorizedException('Invalid admin credentials.');
    }

    const passwordMatches = await this.passwordService.matches(dto.password, account.passwordHash);
    if (!passwordMatches) {
      this.securityLogger.logLoginFailure('admin', {
        email: account.email,
        accountId: account.id,
        reason: 'invalid_password',
        ...context,
      });
      throw new UnauthorizedException('Invalid admin credentials.');
    }

    const updated = await this.adminUsersStore.touchLastLogin(account.id);
    const tokens = await this.sessionTokenService.issueSession({
      id: updated.id,
      email: updated.email,
      type: 'admin',
      claims: {
        role: updated.role,
      },
    });

    this.securityLogger.logLoginSuccess('admin', updated.id, {
      email: updated.email,
      role: updated.role,
      ...context,
    });

    return {
      ...tokens,
      admin: this.toPublicAdmin(updated),
    };
  }

  async refresh(refreshToken: string, context: Record<string, unknown> = {}) {
    const payload = await this.sessionTokenService.verifyRefreshToken(refreshToken, 'admin');
    const admin = await this.adminUsersStore.findById(payload.sub);
    if (!admin || !admin.isActive) {
      this.securityLogger.logRefreshFailure('admin', {
        subjectId: payload.sub,
        reason: 'inactive_or_missing_admin',
        ...context,
      });
      throw new UnauthorizedException('Admin refresh session is no longer valid.');
    }

    const tokens = await this.sessionTokenService.rotateRefreshToken(refreshToken, {
      id: admin.id,
      email: admin.email,
      type: 'admin',
      claims: {
        role: admin.role,
      },
    });
    this.securityLogger.logRefreshSuccess('admin', admin.id, {
      email: admin.email,
      role: admin.role,
      ...context,
    });

    return {
      ...tokens,
      admin: this.toPublicAdmin(admin),
    };
  }

  async logout(refreshToken: string, subjectId: string, context: Record<string, unknown> = {}) {
    const success = await this.sessionTokenService.revokeRefreshToken(refreshToken, 'admin');
    this.securityLogger.logLogout('admin', subjectId, {
      refreshRevoked: success,
      ...context,
    });
    return { success };
  }

  async getProfile(adminId: string) {
    const admin = await this.adminUsersStore.findById(adminId);
    if (!admin) {
      throw new UnauthorizedException('Admin account could not be found.');
    }

    return this.toPublicAdmin(admin);
  }

  async validateAdmin(adminId: string): Promise<AdminAccount | null> {
    const admin = await this.adminUsersStore.findById(adminId);
    if (!admin || !admin.isActive) {
      return null;
    }

    return admin;
  }

  private toPublicAdmin(admin: AdminAccount) {
    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      isActive: admin.isActive,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }
}
