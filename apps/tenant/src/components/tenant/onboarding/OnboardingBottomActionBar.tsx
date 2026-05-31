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
    <div className="sticky bottom-0 -mx-5 mt-10 border-t border-ink-100 bg-white/95 px-5 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0">
      <div className="ml-auto flex w-full flex-col items-stretch gap-2.5 sm:max-w-[360px]">
        <Button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled || primaryLoading}
          size="lg"
          rounded="sm"
          className="box-border w-full bg-primary text-[14px] font-semibold text-white shadow-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {primaryLoading ? 'Lütfen bekleyin...' : primaryLabel}
        </Button>
        {secondaryLabel && onSecondary ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onSecondary}
            disabled={primaryLoading}
            rounded="sm"
            className="box-border w-full text-[13px] font-medium text-ink-500"
          >
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
