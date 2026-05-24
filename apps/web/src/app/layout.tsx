import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SystemStateGate } from '@shared/system-state-gate';
import { WebLanguageProvider } from '@/lib/i18n/WebLanguageProvider';
import { CartProvider } from '@/lib/cart/cart-context';
import CartPanel from '@/components/cart/CartPanel';
import { LegalReConsentBanner } from '@/components/legal-re-consent-banner';

export const metadata: Metadata = {
  title: 'Lieferzonen — Çevrenizdeki En İyi Restoranlar',
  description: 'Lieferzonen ile çevrenizdeki restoranları keşfedin, menüye göz atın ve hızlıca sipariş verin.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SystemStateGate>
          <WebLanguageProvider>
            <CartProvider>
              <LegalReConsentBanner />
              {children}
              <CartPanel />
            </CartProvider>
          </WebLanguageProvider>
        </SystemStateGate>
      </body>
    </html>
  );
}
