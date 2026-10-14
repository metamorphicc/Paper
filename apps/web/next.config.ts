import type { NextConfig } from 'next';
import { resolve } from 'node:path';
const config: NextConfig = {
  outputFileTracingRoot: resolve(process.cwd(), '../..'),
  devIndicators: false,
  webpack(config) {
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'], '.mjs': ['.mts', '.mjs'] };
    return config;
  },
};
export default config;
