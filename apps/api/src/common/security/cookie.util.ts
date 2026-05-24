export function parseCookieHeader(cookieHeader?: string | string[]): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  const headerValue = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader;
  return headerValue
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, entry) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      if (!key) {
        return accumulator;
      }

      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}
