'use client';

import { Button } from '@lieferzonen/ui';

type OnboardingBottomActionBarProps = {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function OnboardingBottomActionBar({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  secondaryLabel,
  onSecondary,
}: OnboardingBottomActionBarProps) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-8 border-t border-ink-200 bg-white/95 px-5 py-4 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-0">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {secondaryLabel && onSecondary ? (
          <Button
            type="button"
            variant="outline"
            onClick={onSecondary}
            disabled={primaryLoading}
            className="rounded-[14px] px-4 py-2.5 text-[14px] font-semibold"
          >
            {secondaryLabel}
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled || primaryLoading}
          className="rounded-[14px] bg-primary px-5 py-2.5 text-[14px] font-semibold text-white shadow-pop disabled:cursor-not-allowed disabled:opacity-60"
        >
          {primaryLoading ? 'Lutfen bekleyin...' : primaryLabel}
        </Button>
      </div>
    </div>
  );
}
