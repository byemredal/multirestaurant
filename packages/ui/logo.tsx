'use client';

import { useState, type CSSProperties } from 'react';

export type LogoProps = {
  /** Platform logo image URL — e.g. the data URL uploaded in the setup wizard. */
  src?: string | null;
  /**
   * Fallback logo shown when no platform logo is configured (or the
   * configured one fails to load). Defaults to `/logo.svg`, which every app
   * ships in its own `public/` folder.
   */
  fallbackSrc?: string;
  /** Rendered height in pixels. Width scales to keep the aspect ratio. */
  height?: number;
  /** Accessible alt text. */
  alt?: string;
  /** Extra class names applied to the image. */
  className?: string;
  /** Inline style overrides for the image. */
  style?: CSSProperties;
};

/**
 * The platform logo, rendered consistently across every Lieferzonen app
 * (admin, partner, web). Always shows an image — never a text mark: the
 * platform logo uploaded in the setup wizard when available, otherwise the
 * bundled `/logo.svg`. A stale/broken logo URL also falls back to `/logo.svg`.
 */
export function Logo({
  src,
  fallbackSrc = '/logo.svg',
  height = 28,
  alt = 'Lieferzonen',
  className,
  style,
}: LogoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const platformSrc = src?.trim() || '';
  const usePlatform = platformSrc !== '' && failedSrc !== platformSrc;
  const resolved = usePlatform ? platformSrc : fallbackSrc;

  return (
    // The platform logo is typically an uploaded data URL, so a plain <img>
    // (not next/image) is the correct, framework-agnostic choice here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      onError={() => {
        if (usePlatform) setFailedSrc(platformSrc);
      }}
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
