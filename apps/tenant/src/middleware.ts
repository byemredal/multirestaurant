import { NextResponse, type NextRequest } from 'next/server';
import { resolveSetupGateDecision, SETUP_REDIRECT_URL } from '@shared/setup-gate-middleware';

// Platform-initialization gate. When the platform is not yet set up, this
// redirects to the setup wizard at the request level — before any app-shell /
// AdminShell / tenant-shell HTML is rendered — so an un-initialized platform
// never flickers the app before the setup notice.
export async function middleware(request: NextRequest) {
  const decision = await resolveSetupGateDecision(request.nextUrl.pathname);
  if (decision === 'redirect') {
    return NextResponse.redirect(SETUP_REDIRECT_URL);
  }
  return NextResponse.next();
}

// `matcher` MUST be an inline literal so Next can statically analyse it (an
// imported value is silently ignored). Prefix-only — no regex dot-escaping —
// to stay robust; requests for files-with-extension are additionally short
// -circuited by `shouldEnforceSetupGate` inside the gate.
export const config = {
  matcher: ['/((?!api/|_next/|assets/|favicon.ico|robots.txt|sitemap.xml).*)'],
};
