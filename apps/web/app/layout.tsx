import type { Metadata } from 'next';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import './globals.css';
import Shell from '../components/shell';
export const metadata: Metadata = {
  title: 'Paperclub — protocol, community, positions',
  description:
    'An independent Papertrade community hub on HyperEVM. Public data and a local trading sandbox.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
