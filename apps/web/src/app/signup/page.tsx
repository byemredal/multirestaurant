import { Suspense } from 'react';
import AuthPage from '@/components/auth/AuthPage';
import { GuestOnlyGuard } from '@/components/auth/GuestOnlyGuard';

export default function SignupPage() {
  // AuthPage reads useSearchParams(); Next.js requires a Suspense boundary
  // around it so the page can still be statically prerendered.
  // GuestOnlyGuard keeps already-signed-in customers off the signup screen.
  return (
    <GuestOnlyGuard>
      <Suspense>
        <AuthPage initialMode="signup" />
      </Suspense>
    </GuestOnlyGuard>
  );
}
