/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@lieferzonen/ui'],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
