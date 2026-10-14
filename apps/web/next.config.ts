import type { NextConfig } from 'next';
import { resolve } from 'node:path';
const config: NextConfig = {
  outputFileTracingRoot: resolve(process.cwd(), '../..'),
  devIndicators: false,
  serverExternalPackages: ['viem'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
  webpack(config) {
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'], '.mjs': ['.mts', '.mjs'] };
    return config;
  },
};
export default config;
