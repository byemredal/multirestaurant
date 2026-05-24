'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readAuthSession } from '@/lib/storage/auth-session';
import {
  fetchActiveLegalDocuments,
  fetchCustomerReConsentStatus,
  recordCustomerConsent,
  type LegalDocumentBundle,
} from '@/lib/legal/legal-consent-client';

/**
 * Architecture Law J-13: When a legal document version is superseded, every
 * subject that accepted the old version must re-accept the new one before
 * proceeding. This banner is the customer-side enforcement point.
 *
 * Renders nothing if:
 *   - customer is not authenticated
 *   - re-consent check returned requires=false
 *   - the check failed (we fail-open to avoid breaking the app on transient
 *     network errors)
 */
export function LegalReConsentBanner() {
  const [missingCodes, setMissingCodes] = useState<string[]>([]);
  const [documents, setDocuments] = useState<LegalDocumentBundle[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const session = readAuthSession();
    if (!session) {
      return;
    }
    (async () => {
      try {
        const [status, docs] = await Promise.all([
          fetchCustomerReConsentStatus(session.accessToken),
          fetchActiveLegalDocuments('customer', 'tr'),
        ]);
        if (cancelled) return;
        if (status.requires) {
          setMissingCodes(status.missingDocumentCodes);
          setDocuments(docs);
        }
      } catch {
        // Fail-open: swallow errors so a flaky network doesn't soft-lock the UI.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (missingCodes.length === 0 || dismissedThisSession) {
    return null;
  }

  const missingDocs = missingCodes
    .map((code) => documents.find((doc) => doc.code === code))
    .filter((doc): doc is LegalDocumentBundle => Boolean(doc?.currentVersion));

  const acceptAll = async () => {
    const session = readAuthSession();
    if (!session) return;
    if (missingDocs.length === 0) {
      // codes returned but documents not available — best-effort dismiss
      setDismissedThisSession(true);
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await recordCustomerConsent({
        token: session.accessToken,
        channel: 'web',
        entries: missingDocs.map((doc) => ({
          documentVersionId: doc.currentVersion!.id,
          action: 'granted',
          contextRef: 're-consent-banner',
        })),
      });
      setMissingCodes([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onay kaydedilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="alertdialog"
      aria-live="polite"
      className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px] leading-6">
          <strong className="font-semibold">Yasal güncelleme:</strong>{' '}
          {missingDocs.length > 0 ? (
            <>
              Yeni{' '}
              {missingDocs.map((doc, idx) => (
                <span key={doc.code}>
                  {idx > 0 && ', '}
                  <em className="not-italic font-semibold">
                    {doc.currentVersion?.title ?? doc.code}
                  </em>
                </span>
              ))}{' '}
              sürümünü onaylamanız gerekiyor.
            </>
          ) : (
            <>Hesabınızda bekleyen yasal onay var: {missingCodes.join(', ')}.</>
          )}
          {error && (
            <span className="ml-2 text-amber-800">· {error}</span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {missingDocs.length > 0 ? (
            <button
              onClick={acceptAll}
              disabled={submitting}
              className="rounded-full bg-amber-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-amber-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Kaydediliyor…' : 'Tümünü kabul et'}
            </button>
          ) : null}
          <Link
            href="/me/legal"
            className="rounded-full border border-amber-300 bg-white px-4 py-2 text-[13px] font-semibold text-amber-900 transition hover:bg-amber-100"
          >
            Detaylar
          </Link>
        </div>
      </div>
    </div>
  );
}
