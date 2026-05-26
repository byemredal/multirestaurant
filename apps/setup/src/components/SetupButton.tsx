import type { ButtonHTMLAttributes, ReactNode } from 'react';

type SetupButtonVariant = 'secondary' | 'primary';

const BASE =
  'inline-flex items-center justify-center gap-[7px] h-11 px-5 rounded ' +
  'border text-[13.5px] font-medium transition-colors ' +
  'disabled:opacity-55 disabled:cursor-not-allowed max-[520px]:w-full';

const VARIANTS: Record<SetupButtonVariant, string> = {
  secondary:
    'border-line bg-white text-ink-soft ' +
    'enabled:hover:bg-surface-muted enabled:hover:border-line-strong enabled:hover:text-ink',
  primary:
    'border-accent bg-accent text-white ' +
    'enabled:hover:bg-accent-hover enabled:hover:border-accent-hover',
};

/**
 * Shared class string for the wizard's footer actions. Used by `SetupButton`
 * and by the few places that need an `<a>`/`<Link>` styled as a button.
 */
export function setupButtonClass(options?: {
  variant?: SetupButtonVariant;
  block?: boolean;
  grow?: boolean;
}): string {
  const { variant = 'secondary', block = false, grow = false } = options ?? {};
  return [
    BASE,
    VARIANTS[variant],
    block ? 'w-full' : '',
    grow ? 'flex-1' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

const INPUT_BASE =
  'w-full h-[42px] rounded border bg-white px-[13px] text-[13.5px] ' +
  'transition-[border-color,box-shadow] duration-100 placeholder:text-ink-faint ' +
  'focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15';

/** Shared class string for the wizard's text inputs. */
export function setupInputClass(invalid = false): string {
  return `${INPUT_BASE} ${invalid ? 'border-danger-border' : 'border-line'}`;
}

type SetupButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: SetupButtonVariant;
  block?: boolean;
  grow?: boolean;
  /**
   * When true the button renders an inline spinner and is auto-disabled.
   * Use this on actions that perform async work or navigate between wizard
   * steps so the user gets immediate feedback that the click registered.
   */
  loading?: boolean;
  loadingLabel?: ReactNode;
};

export function SetupButton({
  variant = 'secondary',
  block = false,
  grow = false,
  className,
  type = 'button',
  loading = false,
  loadingLabel,
  disabled,
  children,
  ...props
}: SetupButtonProps) {
  return (
    <button
      type={type}
      className={[setupButtonClass({ variant, block, grow }), className]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-[7px]">
          <span
            aria-hidden
            className="inline-block h-[14px] w-[14px] animate-spin rounded-full border-[2px] border-white/40 border-t-white"
          />
          <span>{loadingLabel ?? children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
