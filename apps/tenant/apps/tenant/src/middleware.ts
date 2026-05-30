import { NextResponse, type NextRequest } from 'next/server';
import {
  resolveSetupGateDecision,
  setupGateMatcher,
  SETUP_REDIRECT_URL,
} from '@shared/setup-gate-middleware';

// Platform-initialization gate. When the platform is not yet set up, this
// redirects to the setup wizard at the request level — before any tenant
// shell / partner landing / onboarding / login HTML is rendered — so an
// un-initialized platform never flickers the tenant app before the setup
// notice.
export async function middleware(request: NextRequest) {
  const decision = await resolveSetupGateDecision(request.nextUrl.pathname);
  if (decision === 'redirect') {
    return NextResponse.redirect(SETUP_REDIRECT_URL);
  }
  return NextResponse.next();
}

export const config = { matcher: setupGateMatcher };
