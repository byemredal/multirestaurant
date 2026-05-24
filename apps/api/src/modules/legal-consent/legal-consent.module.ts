import { Module } from '@nestjs/common';
import { AdminAuditLogModule } from '../admin-audit-log/admin-audit-log.module';
import { StoresModule } from '../stores/stores.module';
import { LegalConsentService } from './legal-consent.service';
import { PublicLegalDocumentsController } from './public-legal-documents.controller';
import { AdminLegalDocumentsController } from './admin-legal-documents.controller';
import {
  CheckoutLegalAcceptanceController,
  CustomerLegalController,
} from './customer-legal.controller';
import {
  TenantLegalController,
  TenantStoreTermsAddendumController,
} from './tenant-legal.controller';

@Module({
  imports: [AdminAuditLogModule, StoresModule],
  controllers: [
    PublicLegalDocumentsController,
    AdminLegalDocumentsController,
    CustomerLegalController,
    CheckoutLegalAcceptanceController,
    TenantLegalController,
    TenantStoreTermsAddendumController,
  ],
  providers: [LegalConsentService],
  exports: [LegalConsentService],
})
export class LegalConsentModule {}
