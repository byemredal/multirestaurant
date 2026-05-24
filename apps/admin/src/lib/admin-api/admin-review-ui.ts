import type {
  ApplicationListEntry,
  ApplicationStatus,
  AuditLogEntry,
  DocumentStatus,
  TenantApplicationDetail,
} from './admin-review-types';

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export function formatRelativeCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function statusTone(status: ApplicationStatus | DocumentStatus) {
  if (status === 'active' || status === 'approved') {
    return 'success';
  }

  if (status === 'revision_required' || status === 'revision_requested' || status === 'under_review') {
    return 'warning';
  }

  if (status === 'rejected' || status === 'suspended' || status === 'expired') {
    return 'danger';
  }

  return 'neutral';
}

export function statusLabel(status: string) {
  return status.replaceAll('_', ' ');
}

export function badgeClass(status: ApplicationStatus | DocumentStatus) {
  const tone = statusTone(status);
  if (tone === 'success') {
    return 'admin-badge admin-badge--success';
  }
  if (tone === 'warning') {
    return 'admin-badge admin-badge--warning';
  }
  if (tone === 'danger') {
    return 'admin-badge admin-badge--danger';
  }
  return 'admin-badge';
}

export function getApplicationSummary(detail: TenantApplicationDetail) {
  const currentDocuments = detail.documents.filter((document) => document.isCurrent);

  return {
    totalCurrentDocuments: currentDocuments.length,
    approvedDocuments: currentDocuments.filter((document) => document.status === 'approved').length,
    pendingDocuments: currentDocuments.filter((document) => document.status === 'pending').length,
    lastReviewEvent:
      detail.applicationReviews[0]?.createdAt ??
      detail.documentReviews[0]?.createdAt ??
      detail.notes[0]?.createdAt ??
      null,
  };
}

export function matchesApplicationSearch(entry: ApplicationListEntry, query: string) {
  const haystack = [
    entry.tenantCompanyName,
    entry.tenantEmail,
    entry.businessCity,
    entry.businessType,
    entry.ownerContactName,
    entry.ownerContactEmail,
    entry.ownerContactPhone,
    entry.application.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export function parseMetadata(entry: AuditLogEntry) {
  try {
    return JSON.parse(entry.metadataJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function formatMoney(value: number | null | undefined, currency = 'CHF') {
  if (value === null || value === undefined) {
    return '-';
  }

  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value}`;
  }
}
