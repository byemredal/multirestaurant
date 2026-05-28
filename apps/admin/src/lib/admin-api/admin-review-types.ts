export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'revision_required'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'suspended';

export type DocumentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revision_requested'
  | 'expired';

export type ApplicationListEntry = {
  application: {
    id: string;
    tenantAccountId: string;
    status: ApplicationStatus;
    submittedAt: string | null;
    reviewStartedAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    revisionRequestedAt: string | null;
    activatedAt: string | null;
    suspendedAt: string | null;
    lastSubmittedAt: string | null;
    currentRevisionNumber: number;
    createdAt: string;
    updatedAt: string;
  };
  tenantEmail: string;
  tenantCompanyName: string;
  businessCity: string | null;
  businessType: string | null;
  ownerContactName: string | null;
  ownerContactEmail: string | null;
  ownerContactPhone: string | null;
  completeness: boolean;
  documentSummary: {
    totalCurrent: number;
    pending: number;
    approved: number;
    rejected: number;
    revisionRequested: number;
    requiredCurrent: number;
    requiredApproved: number;
  };
};

export type FileAsset = {
  id: string;
  ownerTenantId: string | null;
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string;
  uploadedAt: string;
};

export type TenantDocumentRecord = {
  id: string;
  applicationId: string;
  fileAssetId: string;
  type: string;
  status: DocumentStatus;
  isRequired: boolean;
  version: number;
  isCurrent: boolean;
  uploadedAt: string;
  reviewedAt: string | null;
  reviewedByAdminId: string | null;
  rejectionReason: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  fileUrl?: string | null;
};

export type TenantDocumentQueueEntry = {
  document: TenantDocumentRecord;
  application: ApplicationListEntry['application'] | null;
  tenantAccount: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    companyName: string;
    companyAddress: string;
    tenantType: string;
    deliveryModel: string;
    verificationStatus: string;
    onboardingStatus: string;
    isActive: boolean;
    isVerified: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  fileUrl?: string | null;
};

export type TenantOnboardingConsentSnapshotRecord = {
  id: string;
  applicationId: string;
  consentKey: string;
  consentLabelSnapshot: string;
  documentCode: string;
  documentVersion: string;
  language: string;
  accepted: boolean;
  acceptedAt: string;
};

export type TenantActiveConsentStatus = {
  consentKey: string;
  label: string;
  description: string;
  documentCode: string;
  documentVersion: string;
  documentUrl: string | null;
  required: boolean;
  language: string;
  accepted: boolean;
  acceptedAt: string | null;
  reacceptanceRequired: boolean;
  previouslyAcceptedVersion: string | null;
};

export type TenantApplicationDetail = {
  application: ApplicationListEntry['application'];
  tenantAccount: TenantDocumentQueueEntry['tenantAccount'];
  steps: Array<{
    id: string;
    applicationId: string;
    stepKey: string;
    status: string;
    completedAt: string | null;
    blockedReason: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  businessInfo: {
    businessName: string;
    businessType: string;
    registrationNumber: string | null;
    taxNumber: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    postalCode: string;
    country: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  legalTaxInfo: {
    legalEntityName: string;
    taxId: string | null;
    vatId: string | null;
    registrationCountry: string;
    registeredAddress: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  ownerContactInfo: {
    fullName: string;
    email: string;
    phoneNumber: string;
    roleTitle: string | null;
    ownershipPercentage: number | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  operationsInfo: {
    primaryCity: string;
    primaryPostalCode: string;
    deliveryModel: string;
    supportsPickup: boolean;
    openingHoursSummary: string | null;
    estimatedGoLiveDate: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  documents: TenantDocumentRecord[];
  consentSnapshots: TenantOnboardingConsentSnapshotRecord[];
  onboardingCompliance: {
    acceptedConsents: TenantActiveConsentStatus[];
    missingRequiredConsentKeys: string[];
  };
  applicationReviews: Array<{
    id: string;
    applicationId: string;
    adminId: string;
    decision: string;
    internalNote: string | null;
    tenantVisibleNote: string | null;
    createdAt: string;
  }>;
  documentReviews: Array<{
    id: string;
    documentId: string;
    adminId: string;
    decision: string;
    note: string | null;
    createdAt: string;
  }>;
  notes: Array<{
    id: string;
    applicationId: string;
    adminId: string;
    scope: 'internal' | 'tenant_visible';
    body: string;
    createdAt: string;
  }>;
};

export type AuditLogEntry = {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  applicationId: string | null;
  tenantAccountId: string | null;
  metadataJson: string;
  createdAt: string;
};

export type TenantBusinessOverview = {
  tenantAccount: TenantDocumentQueueEntry['tenantAccount'];
  application: ApplicationListEntry['application'] | null;
  stores: Array<{
    store: {
      id: string;
      ownerTenantId: string;
      name: string;
      slug: string;
      category: string;
      description: string | null;
      imageUrl: string | null;
      status: string;
      onboardingStatus: string;
      createdAt: string;
      updatedAt: string;
      branchCount?: number;
    };
    generalSettings: {
      id: string;
      storeId: string;
      primaryLanguage: string;
      currencyCode: string;
      serviceMode: 'delivery_only' | 'pickup_only' | 'delivery_and_pickup' | 'reservation_only';
      advancedOptionsJson: Record<string, unknown>;
      createdAt: string;
      updatedAt: string;
    };
    taxSettings: {
      id: string;
      storeId: string;
      taxRegistrationNumber: string | null;
      priceIncludesTax: boolean;
      defaultVatRate: number;
      serviceChargeRate: number;
      invoiceFooterText: string | null;
      createdAt: string;
      updatedAt: string;
    };
    discountRules: Array<{
      id: string;
      storeId: string;
      name: string;
      ruleType: 'coupon' | 'automatic' | 'loyalty' | 'campaign';
      valueType: 'percentage' | 'fixed';
      valueAmount: number;
      isActive: boolean;
      startsAt: string | null;
      endsAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    deliveryFeeSettings: {
      id: string;
      storeId: string;
      baseFee: number;
      freeDeliveryThreshold: number | null;
      surgeFeeEnabled: boolean;
      smallOrderFee: number;
      createdAt: string;
      updatedAt: string;
    };
    reservationSettings: {
      id: string;
      storeId: string;
      enabled: boolean;
      requiresApproval: boolean;
      maxPartySize: number | null;
      defaultSlotMinutes: number;
      leadTimeMinutes: number;
      notes: string | null;
      createdAt: string;
      updatedAt: string;
    };
    receiptSettings: {
      id: string;
      storeId: string;
      headerText: string | null;
      footerText: string | null;
      showTaxBreakdown: boolean;
      showQrCode: boolean;
      layoutConfigJson: Record<string, unknown>;
      createdAt: string;
      updatedAt: string;
    };
    contentSettings: {
      id: string;
      storeId: string;
      defaultLocale: string;
      socialLinksJson: Record<string, unknown>;
      marketingHeadline: string | null;
      marketingDescription: string | null;
      createdAt: string;
      updatedAt: string;
    };
    legalDocuments: Array<{
      id: string;
      storeId: string;
      documentType: 'terms_and_conditions' | 'privacy_notice' | 'distance_sales';
      versionLabel: string;
      isPublished: boolean;
      effectiveFrom: string | null;
      createdAt: string;
      updatedAt: string;
      translations: Array<{
        id: string;
        documentId: string;
        locale: string;
        title: string;
        body: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>;
    profileNotes: Array<{
      id: string;
      storeId: string;
      noteType: 'profile' | 'story' | 'operational';
      isPublished: boolean;
      createdAt: string;
      updatedAt: string;
      translations: Array<{
        id: string;
        noteId: string;
        locale: string;
        title: string | null;
        body: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>;
    sliders: Array<{
      id: string;
      storeId: string;
      name: string;
      sliderType: 'homepage' | 'campaign' | 'seasonal';
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      items: Array<{
        id: string;
        sliderId: string;
        imageAssetId: string | null;
        title: string | null;
        caption: string | null;
        targetUrl: string | null;
        sortOrder: number;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
        imageAsset?: FileAsset | null;
        imageUrl?: string | null;
      }>;
    }>;
    branches: Array<{
      id: string;
      storeId: string;
      name: string;
      addressLine1: string;
      addressLine2: string | null;
      city: string;
      postalCode: string;
      country: string;
      latitude: number | null;
      longitude: number | null;
      phoneNumber: string;
      status: string;
      isActive: boolean;
      openingHours: Array<{
        id: string;
        dayOfWeek: string;
        openTime: string;
        closeTime: string;
        isClosed: boolean;
      }>;
      deliveryZones: Array<{
        id: string;
        name: string;
        postalCodes: string[];
        radiusKm: number | null;
        minimumOrderAmount: number | null;
        deliveryFee: number | null;
        estimatedDeliveryMinutes: number | null;
      }>;
      createdAt: string;
      updatedAt: string;
    }>;
    menuCategories: Array<{
      id: string;
      storeId: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      sortOrder: number;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    menuItems: Array<{
      id: string;
      storeId: string;
      categoryId: string | null;
      name: string;
      description: string | null;
      imageUrl: string | null;
      basePrice: number;
      currency: string;
      sortOrder: number;
      isActive: boolean;
      availabilityType: string;
      createdAt: string;
      updatedAt: string;
      categoryName?: string | null;
    }>;
  }>;
  unavailableSections: {
    termsAndConditions: boolean;
    profileNotes: boolean;
    sliderMedia: boolean;
    staff: boolean;
    kitchen: boolean;
    devices: boolean;
  };
};
