/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
  reactStrictMode: true,
  eslint: {
    // ESLint v9 removed `useEslintrc`/`extensions` options used internally by
    // older eslint-config-next. Lint is enforced separately via `npm run lint`.
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', 'xlsx', 'jsdom', 'cheerio'],
  }
}

module.exports = nextConfig