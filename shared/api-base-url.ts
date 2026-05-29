const FALLBACK = 'http://localhost:4000/api/v1';

/**
 * API base URL'i çağrı yerine göre çözer.
 *
 * Server tarafında (Next.js Server Component / route handler) `localhost`
 * container'ın kendisini gösterir; bu yüzden Docker servis adına işaret eden
 * `INTERNAL_API_BASE_URL` tercih edilir. Tarayıcıda `NEXT_PUBLIC_API_BASE_URL`
 * kullanılır (host port-map üzerinden erişilir).
 */
export function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return (
      process.env.INTERNAL_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      FALLBACK
    );
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? FALLBACK;
}
