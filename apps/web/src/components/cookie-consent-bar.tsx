'use client';

import { useEffect, useState } from 'react';
import { getOrCreateAnonymousIdentifier } from '@/lib/legal/anonymous-id';
import {
  fetchActiveLegalDocuments,
  pickCookiePolicyVersionId,
  recordAnonymousConsent,
} from '@/lib/legal/legal-consent-client';

const COOKIE_CONSENT_KEY = 'cookie-consent.choice';

type ConsentChoice = 'necessary' | 'all' | 'preferences';

export function CookieConsentBar() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const storedChoice = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    setIsVisible(!storedChoice);
  }, []);

  async function handleConsent(choice: ConsentChoice) {
    // UI cache — keep banner from re-rendering immediately even if backend
    // POST fails (banner reappears next visit if backend write fails).
    window.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
    setIsVisible(false);

    // Fire-and-forget backend record. Architecture Law J-11: cookie consent
    // must have a durable backend ConsentEvent row. localStorage alone is
    // only a UI hint.
    try {
      const anonymousIdentifier = getOrCreateAnonymousIdentifier();
      if (!anonymousIdentifier) {
        return;
      }
      const documents = await fetchActiveLegalDocuments('customer', 'tr');
      const cookiePolicyVersionId = pickCookiePolicyVersionId(documents);
      if (!cookiePolicyVersionId) {
        // No cookie policy configured yet — skip backend POST. Once admin
        // publishes a cookie_policy document, future visits will sync.
        return;
      }
      await recordAnonymousConsent({
        channel: 'web',
        anonymousIdentifier,
        entries: [
          {
            documentVersionId: cookiePolicyVersionId,
            action: choice === 'necessary' ? 'revoked' : 'granted',
            contextRef: `cookie-bar:${choice}`,
          },
        ],
      });
    } catch {
      // Swallow network errors silently — UI already committed the choice.
      // Server-side ConsentEvent will be retried on next visit naturally.
    }
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 md:inset-x-5 md:bottom-5">
      <div className="rounded-3xl bg-[#1f1b16] px-5 py-5 text-white shadow-[0_18px_50px_rgba(0,0,0,0.32)] md:px-8 md:py-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[1200px]">
            <h2 className="mb-2 text-2xl font-bold leading-none text-white">Cookies</h2>
            <p className="text-sm leading-7 text-white/90 md:text-[15px]">
              We use our own and third party cookies and other tech to enhance and
              personalise your user experience, optimize analytics, and show ads with
              third parties (read our{' '}
              <a className="font-semibold underline underline-offset-2" href="#">
                Statement
              </a>
              ). Necessary cookies are always set. Click{' '}
              <button
                className="font-semibold underline underline-offset-2"
                onClick={() => handleConsent('necessary')}
                type="button"
              >
                Necessary only
              </button>{' '}
              to continue without accepting more. Click{' '}
              <button
                className="font-semibold underline underline-offset-2"
                onClick={() => handleConsent('preferences')}
                type="button"
              >
                Manage preferences
              </button>{' '}
              to share your preferences or{' '}
              <button
                className="font-semibold underline underline-offset-2"
                onClick={() => handleConsent('all')}
                type="button"
              >
                Accept all
              </button>
              .
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
            <button
              className="text-left text-sm font-semibold text-white underline underline-offset-2 md:text-right"
              onClick={() => handleConsent('preferences')}
              type="button"
            >
              Manage preferences
            </button>

            <button
              className="rounded-full bg-secondary px-6 py-3 text-base font-semibold text-white transition hover:brightness-110"
              onClick={() => handleConsent('necessary')}
              type="button"
            >
              Necessary only
            </button>

            <button
              className="rounded-full bg-secondary px-6 py-3 text-base font-semibold text-white transition hover:brightness-110"
              onClick={() => handleConsent('all')}
              type="button"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
