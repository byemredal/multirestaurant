'use client';

import type { ComponentType, SVGProps } from 'react';
import type { TenantOnboardingStepKey, TenantOnboardingWorkspace } from '@/lib/tenant-onboarding-client';
import Image from 'next/image';
import { useTenantOnboardingWorkspace } from './useTenantOnboardingWorkspace';
import { Button } from '@lieferzonen/ui';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { TenantOnboardingSummary } from './TenantOnboardingSummary';
import  logoUrl from '@lieferzonen/assets/logo.svg';
import {
  tenantOnboardingProgressStepOrder,
  tenantOnboardingWorkflowSteps,
  type TenantOnboardingWorkflowStep,
  type TenantOnboardingWorkflowStepKey,
} from './onboarding-routing';

type StepMeta = {
  title: string;
  description: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

function IconStore(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 9 5 4h14l2 5" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3 1.3 3 3 3 3-1.3 3-3 1.3 3 3 3 3-1.3 3-3" />
    </svg>
  );
}

function IconScale(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 4v16" />
      <path d="M7 20h10" />
      <path d="M6 10 3 16c0 1.7 1.3 3 3 3s3-1.3 3-3l-3-6Z" />
      <path d="M18 10l-3 6c0 1.7 1.3 3 3 3s3-1.3 3-3l-3-6Z" />
    </svg>
  );
}

function IconUser(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5" />
    </svg>
  );
}

function IconTruck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 6h11v10H3z" />
      <path d="M14 9h4l3 3v4h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

function IconFile(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

function IconBadgeCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3 2.4 1.8 2.9-.4.4 2.9L19.5 9.6l-1.8 2.4.4 2.9-2.9.4L13.8 18l-2.9-.4-2.4 1.8-2.4-1.8-2.9.4-.4-2.9L1 14.4l1.8-2.4-.4-2.9 2.9-.4L7.7 4.4 10.6 4 12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

const STEP_META: Record<TenantOnboardingStepKey, StepMeta> = {
  business_info: {
    title: 'İşletme bilgileri',
    description: 'Adres ve isteğe bağlı tescil detayları.',
    Icon: IconStore,
  },
  legal_tax_info: {
    title: 'Hukuki ve vergi',
    description: 'Vergi kimlik numaralarını ekleyin.',
    Icon: IconScale,
  },
  owner_contact_info: {
    title: 'Sahip iletişim',
    description: 'Pozisyon ve ortaklık bilgisi.',
    Icon: IconUser,
  },
  operations_info: {
    title: 'Operasyon',
    description: 'Bölge, teslimat ve çalışma planı.',
    Icon: IconTruck,
  },
  documents: {
    title: 'Belgeler',
    description: 'Gerekli belgeleri yükleyin.',
    Icon: IconFile,
  },
  final_review: {
    title: 'Son inceleme',
    description: 'Başvurunuzu inceleyip gönderin.',
    Icon: IconBadgeCheck,
  },
};

type Props = {
  activeStep: TenantOnboardingWorkflowStepKey;
  onSelectStep: (step: TenantOnboardingWorkflowStepKey) => void;
  workspace: TenantOnboardingWorkspace;
};


export function TenantOnboardingSidebar({ activeStep, onSelectStep, workspace }: Props) {

  const { logout } = useTenantAuth();
  const { session, loadWorkspace, lastCheckedAt } = useTenantOnboardingWorkspace();

  const IconSignOut = (props: SVGProps<SVGSVGElement>) => {
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M13 5V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" />
        <path d="M17 10H8" />
        <path d="m14 7 3 3-3 3" />
      </svg>
    );
  }

  const visibleSteps = tenantOnboardingWorkflowSteps.filter((step) =>
    tenantOnboardingProgressStepOrder.includes(step.key),
  );
  const activeIndex = visibleSteps.findIndex((step) => step.key === activeStep);

  const getWorkflowStatus = (step: TenantOnboardingWorkflowStep) => {
    if (!step.backendStep) {
      const index = visibleSteps.findIndex((entry) => entry.key === step.key);
      return index >= 0 && activeIndex > index ? 'completed' : 'not_started';
    }

    return workspace.steps.find((entry) => entry.stepKey === step.backendStep)?.status ?? 'not_started';
  };

  const getWorkflowIcon = (step: TenantOnboardingWorkflowStep) => {
    if (step.backendStep && STEP_META[step.backendStep]) {
      return STEP_META[step.backendStep].Icon;
    }

    if (step.key === 'phone-verification') return IconUser;
    if (step.key === 'business-intro') return IconBadgeCheck;
    if (step.key === 'bank-details') return IconScale;
    if (step.key === 'plan-selection') return IconTruck;
    return IconStore;
  };

  const IconRefresh = (props: SVGProps<SVGSVGElement>) => {
    return (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
          <path d="M18.6091 5.89092L15.5 9H21.5V3L18.6091 5.89092ZM18.6091 5.89092C16.965 4.1131 14.6125 3 12 3C7.36745 3 3.55237 6.50005 3.05493 11M5.39092 18.1091L2.5 21V15H8.5L5.39092 18.1091ZM5.39092 18.1091C7.03504 19.8869 9.38753 21 12 21C16.6326 21 20.4476 17.5 20.9451 13" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
        </g>
      </svg>
    );
  }


  return (
    <>
      {/* Mobile / tablet — horizontal scrollable strip */}
      <div className="lg:hidden">
        <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#a8a29e]">
          Adımlar
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {visibleSteps.map((step, index) => {
            const selected = activeStep === step.key;
            const status = getWorkflowStatus(step);
            const completed = status === 'completed';
            const revision = status === 'needs_revision';
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => onSelectStep(step.key)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${selected
                  ? 'border-[#f97316] bg-[#f97316] text-white'
                  : revision
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : completed
                      ? 'border-[#bbf7d0] bg-[#ecfdf3] text-[#067647]'
                      : 'border-[#e7dfd3] bg-white text-[#78716c]'
                  }`}
              >
                <span className="flex h-5 w-5 items-center justify-center">
                  {completed && !selected ? (
                    <IconCheck className="h-3.5 w-3.5" />
                  ) : (
                    <span className="text-[11px] font-bold">{index + 1}</span>
                  )}
                </span>
                <span className="whitespace-nowrap">{step.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop — vertical step list */}
      <aside className="relative hidden h-full overflow-hidden rounded-[24px] border border-[#ece2d2] bg-[linear-gradient(180deg,#fffbf5_0%,#fff1e6_62%,#f4eedd_100%)] lg:block">
        <div className="relative z-10 flex h-full flex-col p-4 gap-4">
          <div className='flex flex-col gap-4'>
            <div className="size-fit bg-primary/15 p-2 rounded-md">
              <Image
                alt="Lieferzonen"
                className="h-8 w-auto"
                height={32}
                priority
                src={logoUrl}
                width={108}
              />
            </div>
            <div className='flex flex-row items-center justify-between gap-4'>
              <div className="hidden sm:block">
                <p className="font-bold text-gray-900 text-[1rem]">
                  {session?.tenant.companyName ?? 'Tenant'}
                </p>
                <p className="text-[1rem] text-gray-800">{session?.tenant.email}</p>
              </div>
              <div className='flex flex-row justify-between items-center gap-4'>
                {/* <Button
                  className="p-2 bg-white text-primary"
                  onClick={() => void loadWorkspace()}
                  variant="ghost"
                >
                  <IconRefresh width={16} height={16} />
                </Button> */}
                <Button
                  className="p-2 bg-white border text-secondary"
                  onClick={() => {
                    void logout();
                  }}
                  variant="secondary"
                >
                  <IconSignOut width={16} height={16} />
                </Button>
              </div>
            </div>
          </div>
          <div>
            {/* ── Runtime tenant status ──────────────────────────────────── */}
            <TenantOnboardingSummary lastCheckedAt={lastCheckedAt} workspace={workspace} />
          </div>

          <ol className="flex flex-1 flex-col">
            {visibleSteps.map((step, index) => {
              const Icon = getWorkflowIcon(step);
              const selected = activeStep === step.key;
              const status = getWorkflowStatus(step);
              const completed = status === 'completed';
              const revision = status === 'needs_revision';
              const isLast = index === visibleSteps.length - 1;

              const circleClass = selected
                ? 'border-[#f97316] bg-[#f97316] text-white shadow-[0_0_0_4px_rgba(249,115,22,0.18)]'
                : completed
                  ? 'border-[#f97316] bg-white text-[#f97316]'
                  : revision
                    ? 'border-amber-300 bg-amber-50 text-amber-600'
                    : 'border-[#e7dfd3] bg-white text-[#a8a29e]';

              const connectorClass = completed
                ? 'bg-[#f97316]'
                : selected
                  ? 'bg-[linear-gradient(180deg,#f97316_0%,#e7dfd3_100%)]'
                  : 'bg-[#e7dfd3]';

              const titleClass = selected || completed ? 'text-[#1c1917]' : 'text-[#44403c]';
              const descClass = selected ? 'text-[#586575]' : 'text-[#78716c]';

              return (
                <li key={step.key} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelectStep(step.key)}
                    className="grid w-full grid-cols-[40px_1fr] gap-4 rounded-[14px] px-1 py-1 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#f97316]"
                  >
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${circleClass}`}
                      >
                        {completed && !selected ? (
                          <IconCheck className="h-5 w-5" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </span>
                      {!isLast && (
                        <span className={`mt-1.5 w-[2px] flex-1 rounded-full ${connectorClass}`} />
                      )}
                    </div>
                    <div className={`${isLast ? 'pb-0' : 'pb-6'} pt-1.5`}>
                      <p className={`text-[15px] font-semibold tracking-[-0.01em] ${titleClass}`}>
                        {step.title}
                      </p>
                      <p className={`mt-1 text-[13px] leading-5 ${descClass}`}>
                        {step.description}
                      </p>
                      {revision && (
                        <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700">
                          Revizyon
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Decorative pattern at the bottom (subtle) */}
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-10 h-56 w-56 rounded-[32px] bg-[linear-gradient(135deg,#ffd7a6_0%,#ffe5c9_55%,#fff_100%)] opacity-50 blur-[2px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 left-6 h-32 w-32 rounded-[24px] border-[8px] border-[#f97316]/15" />
      </aside>
    </>
  );
}
