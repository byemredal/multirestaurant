import * as React from 'react';
import { cn } from './cn';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type AvatarStatus = 'online' | 'offline' | 'busy';
type AvatarRounded = 'none' | 'sm' | 'md' | 'lg' | 'full';

export interface AvatarProps {
  src?: string | null;
  /** Used to derive initials and as the default alt text. */
  name?: string;
  alt?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  rounded?: AvatarRounded;
  className?: string;
}

const SIZES: Record<AvatarSize, string> = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-[12px]',
  md: 'h-11 w-11 text-[14px]',
  lg: 'h-14 w-14 text-[18px]',
  xl: 'h-20 w-20 text-[26px]',
};

const STATUS: Record<AvatarStatus, string> = {
  online: 'bg-success-500',
  offline: 'bg-ink-300',
  busy: 'bg-danger-500',
};

const ROUNDED: Record<AvatarRounded, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

function initials(name?: string) {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Circular avatar with image, initials fallback and an optional status dot. */
export function Avatar({ src, name, alt, size = 'md', status, rounded = 'full', className }: AvatarProps) {
  const small = size === 'xs' || size === 'sm';
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center overflow-hidden',
          ROUNDED[rounded],
          'ring-2 ring-white',
          'bg-gradient-to-br from-primary-100 to-primary-200 font-bold text-primary-700',
          SIZES[size],
        )}
      >
        {src ? (
          <img src={src} alt={alt ?? name ?? ''} className="h-full w-full object-cover" />
        ) : (
          initials(name) || (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-1/2 w-1/2 opacity-70">
              <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.7-9 6v2h18v-2c0-3.3-4-6-9-6Z" />
            </svg>
          )
        )}
      </span>
      {status && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-white',
            small ? 'h-2.5 w-2.5' : 'h-3 w-3',
            STATUS[status],
          )}
        />
      )}
    </span>
  );
}
