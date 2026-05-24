const ANON_ID_KEY = 'legal-consent.anonymous-id';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function randomHex(byteLength: number): string {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buffer = new Uint8Array(byteLength);
    crypto.getRandomValues(buffer);
    return Array.from(buffer)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  let result = '';
  for (let i = 0; i < byteLength; i += 1) {
    result += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0');
  }
  return result;
}

/**
 * Returns a stable anonymous identifier for the current browser, generating
 * and persisting one on first use. Identifier is opaque and only meaningful
 * server-side as a join key for anonymous ConsentEvent rows before login.
 */
export function getOrCreateAnonymousIdentifier(): string {
  if (!isBrowser()) {
    return '';
  }
  const existing = window.localStorage.getItem(ANON_ID_KEY);
  if (existing && existing.length > 0) {
    return existing;
  }
  const generated = `anon-${randomHex(16)}`;
  window.localStorage.setItem(ANON_ID_KEY, generated);
  return generated;
}

export function readAnonymousIdentifier(): string | null {
  if (!isBrowser()) {
    return null;
  }
  return window.localStorage.getItem(ANON_ID_KEY);
}
