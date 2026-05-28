'use client';

import { useState, type CSSProperties } from 'react';

export type LogoProps = {
  /** Platform logo image URL — e.g. the data URL uploaded in the setup wizard. */
  src?: string | null;
  /**
   * Optional second-chance image — the bundled `logo.svg` (passed as a data
   * URL via `@lieferzonen/assets`). When omitted no <img> is rendered at all
   * in the fallback path — the component falls through to the text mark
   * instead.
   */
  fallbackSrc?: string;
  /**
   * Wordmark/initials shown when no usable image is available. Pass the
   * runtime platform name (e.g. setup-configured `platformName`). Without
   * this the component renders a generic "Platform" wordmark.
   */
  fallbackText?: string;
  /** Rendered height in pixels. Width scales to keep the aspect ratio. */
  height?: number;
  /**
   * Accessible alt text. Defaults to `fallbackText` so screen readers never
   * announce a stale hardcoded brand.
   */
  alt?: string;
  /** Extra class names applied to the rendered element. */
  className?: string;
  /** Inline style overrides for the rendered element. */
  style?: CSSProperties;
};

function deriveInitials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'P';
  }
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    return `${tokens[0]![0] ?? ''}${tokens[1]![0] ?? ''}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/**
 * Platform logo with a three-step fallback chain:
 *   1. `src`            — operator-uploaded image (e.g. setup wizard).
 *   2. `fallbackSrc`    — optional bundled brand-neutral mark.
 *   3. `fallbackText`   — wordmark / initials so the brand area NEVER renders
 *                          a broken image or a stale hardcoded label.
 */
export function Logo({
  src,
  fallbackSrc,
  fallbackText,
  height = 28,
  alt,
  className,
  style,
}: LogoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const platformSrc = src?.trim() || '';
  const usePlatform = platformSrc !== '' && failedSrc !== platformSrc;
  const useBundled =
    !usePlatform &&
    typeof fallbackSrc === 'string' &&
    fallbackSrc.trim() !== '' &&
    failedSrc !== fallbackSrc;
  const resolved = usePlatform ? platformSrc : useBundled ? fallbackSrc : null;
  const safeText = (fallbackText ?? '').trim() || 'Platform';
  const a11yLabel = (alt ?? safeText).trim() || 'Platform';

  if (resolved) {
    return (
      // The platform logo is typically an uploaded data URL, so a plain <img>
      // (not next/image) is the correct, framework-agnostic choice here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={a11yLabel}
        onError={() => setFailedSrc(resolved)}
        className={className}
        style={{
          height,
          width: 'auto',
          display: 'block',
          objectFit: 'contain',
          ...style,
        }}
      />
    );
  }

  // Text fallback — keeps the slot visually intact when:
  //  * setup didn't upload a logo AND no bundled mark is provided, or
  //  * every image in the chain failed to load.
  const showsFullText = safeText.length <= 18;
  const display = showsFullText ? safeText : deriveInitials(safeText);
  const horizontalPadding = Math.max(8, Math.round(height * 0.35));
  const fontSize = Math.max(11, Math.round(height * (showsFullText ? 0.48 : 0.55)));

  return (
    <span
      role="img"
      aria-label={a11yLabel}
      className={className}
      style={{
        height,
        minWidth: height,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `0 ${horizontalPadding}px`,
        borderRadius: Math.max(4, Math.round(height / 5)),
        background: '#0f172a',
        color: '#ffffff',
        fontWeight: 700,
        fontSize,
        letterSpacing: '0.02em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {display}
    </span>
  );
}
