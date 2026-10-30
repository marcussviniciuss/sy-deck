import type { Metadata, Viewport } from 'next';
import { Inter, Orbitron } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: 'SY Deck — Stream Deck pela Wi‑Fi',
  description:
    'Transforme qualquer celular num Stream Deck. Baixe a ponte, abra o celular na mesma rede, controle o OBS.',
  openGraph: {
    title: 'SY Deck',
    description: 'Stream Deck pela Wi‑Fi — grátis, local, sem conta.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SY Deck',
    description: 'Stream Deck pela Wi‑Fi — grátis, local, sem conta.',
  },
};

export const viewport: Viewport = {
  themeColor: '#030B16',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${orbitron.variable}`}>
      <body>{children}</body>
    </html>
  );
}
