import { Suspense } from 'react';
import AcceptInviteWorkspace from '@/components/tenant/staff/AcceptInviteWorkspace';

export default function StaffAcceptInvitePage() {
  // useSearchParams in the workspace requires a Suspense boundary at the
  // page level under Next 15. The fallback matches the workspace skeleton.
  return (
    <Suspense fallback={<AcceptInviteFallback />}>
      <AcceptInviteWorkspace />
    </Suspense>
  );
}

function AcceptInviteFallback() {
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-10 sm:px-6">
      <div className="h-[280px] animate-pulse rounded-[18px] border border-slate-100 bg-slate-50" />
    </div>
  );
}
