import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Smart Attender — Teacher Portal',
  description: 'Teacher-facing dashboard for smart attendance tracking and smart curriculum planning.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-slate-50 text-slate-900`}>{/* eslint-disable-next-line react/jsx-no-useless-fragment */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
