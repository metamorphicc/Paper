import type { Metadata } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './globals.css';
import './product.css';
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
