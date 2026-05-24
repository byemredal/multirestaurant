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
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
    ],
  },
};

export default nextConfig;
