import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SystemStateGate } from '@shared/system-state-gate';
import { adminAppName } from '@/lib/config';
import { AdminLanguageProvider } from '@/lib/i18n/AdminLanguageProvider';
import { TerminologyProvider } from '@/lib/terminology/TerminologyProvider';
import { BrandingProvider } from '@/lib/branding/BrandingProvider';

export const metadata: Metadata = {
  title: adminAppName,
  description: 'Internal admin panel scaffold for tenant review and activation workflows.',
};

// Every route is behind authentication and bootstraps its session on the
// client — there is nothing cacheable to statically prerender. Rendering
// dynamically keeps the build deterministic and avoids prerendering
// client-only, auth-gated screens.
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <SystemStateGate>
          <AdminLanguageProvider>
            <BrandingProvider>
              <TerminologyProvider>{children}</TerminologyProvider>
            </BrandingProvider>
          </AdminLanguageProvider>
        </SystemStateGate>
      </body>
    </html>
  );
}
