import { Suspense } from 'react';
import { StaffLoginForm } from '@/components/tenant/staff/StaffLoginForm';

export default function StaffLoginPage() {
  // useSearchParams in the form needs a Suspense boundary at the page level.
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink-50" />}>
      <StaffLoginForm />
    </Suspense>
  );
}
