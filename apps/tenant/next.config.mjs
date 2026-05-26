import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDirectory = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone tenant app — served at the domain root (e.g. localhost:3060/),
  // no `/tenant` path prefix.
  transpilePackages: ['@lieferzonen/ui', '@lieferzonen/assets'],
  experimental: {
    // Allow importing the shared @locales/* files from the repo root.
    externalDir: true,
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': resolve(appDirectory, 'src'),
      '@locales': resolve(appDirectory, '../../locales'),
      '@shared': resolve(appDirectory, '../../shared'),
    };
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
    ],
  },
};

export default nextConfig;
