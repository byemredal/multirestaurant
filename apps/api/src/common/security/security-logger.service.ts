import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SecurityLoggerService {
  private readonly logger = new Logger('Security');

  logLoginSuccess(subjectType: string, subjectId: string, context: Record<string, unknown> = {}) {
    this.logger.log(this.format('login_success', { subjectType, subjectId, ...context }));
  }

  logLoginFailure(subjectType: string, context: Record<string, unknown> = {}) {
    this.logger.warn(this.format('login_failure', { subjectType, ...context }));
  }

  logRefreshSuccess(subjectType: string, subjectId: string, context: Record<string, unknown> = {}) {
    this.logger.log(this.format('refresh_success', { subjectType, subjectId, ...context }));
  }

  logRefreshFailure(subjectType: string, context: Record<string, unknown> = {}) {
    this.logger.warn(this.format('refresh_failure', { subjectType, ...context }));
  }

  logLogout(subjectType: string, subjectId: string, context: Record<string, unknown> = {}) {
    this.logger.log(this.format('logout', { subjectType, subjectId, ...context }));
  }

  logUnauthorized(context: Record<string, unknown>) {
    this.logger.warn(this.format('unauthorized', context));
  }

  logForbidden(context: Record<string, unknown>) {
    this.logger.warn(this.format('forbidden', context));
  }

  logRateLimit(context: Record<string, unknown>) {
    this.logger.warn(this.format('rate_limited', context));
  }

  private format(event: string, context: Record<string, unknown>) {
    const details = Object.entries(context)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' ');

    return details ? `${event} ${details}` : event;
  }
}
