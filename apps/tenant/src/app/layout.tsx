import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SystemStateGate } from '@shared/system-state-gate';
import { WebLanguageProvider } from '@/lib/i18n/WebLanguageProvider';
import { TenantAuthProvider } from '@/lib/auth/tenant-auth-context';
import { TenantGate } from '@/lib/auth/tenant-gate';
import { TenantOrderStreamProvider } from '@/lib/realtime/tenant-order-stream-context';
import { TenantStoreProvider } from '@/lib/tenant-store-context';

export const metadata: Metadata = {
  title: 'Lieferzonen Tenant',
  description: 'Restoranınızı Lieferzonen üzerinde tek bir akışta yönetin.',
};

export default function TenantRootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SystemStateGate>
          <WebLanguageProvider>
            <TenantAuthProvider>
              <TenantGate>
                <TenantStoreProvider>
                  <TenantOrderStreamProvider>{children}</TenantOrderStreamProvider>
                </TenantStoreProvider>
              </TenantGate>
            </TenantAuthProvider>
          </WebLanguageProvider>
        </SystemStateGate>
      </body>
    </html>
  );
}
