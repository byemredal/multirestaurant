import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { setupAppName } from '@/lib/config';

export const metadata: Metadata = {
  title: setupAppName,
  description:
    'One-time bootstrap wizard for initializing the Lieferzonen platform.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
