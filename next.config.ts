import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.nexus-ia.com.es' }],
        destination: 'https://nexus-ia.com.es/:path*',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
