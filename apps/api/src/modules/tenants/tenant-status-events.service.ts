import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { TenantStatus } from './tenant-status';

export type TenantStatusChange = {
  tenantId: string;
  status: TenantStatus;
  onboardingStatus: string;
};

/**
 * In-process pub/sub for tenant lifecycle changes. Every tenant-account
 * status transition publishes here (see `TenantAccountsStore`), and the
 * `GET /tenants/me/status/stream` SSE endpoint subscribes per tenant.
 */
@Injectable()
export class TenantStatusEventsService {
  private readonly changes$ = new Subject<TenantStatusChange>();

  emit(change: TenantStatusChange): void {
    this.changes$.next(change);
  }

  stream(tenantId: string): Observable<TenantStatusChange> {
    return this.changes$
      .asObservable()
      .pipe(filter((change) => change.tenantId === tenantId));
  }
}
