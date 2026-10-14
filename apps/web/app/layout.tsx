import type { Metadata } from 'next';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import './globals.css';
import Shell from '../components/shell';
export const metadata: Metadata = { title: 'Paperclub — протокол, люди, позиции', description: 'Независимый комьюнити-хаб Papertrade на HyperEVM. Публичные данные и локальный торговый стенд.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body><Shell>{children}</Shell></body></html>;
}
