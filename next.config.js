/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      '127.0.0.1',
      'ucbtpddvvbsrqroqhvev.supabase.co'
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        http: false,
        https: false,
        stream: false,
        crypto: false,
        os: false,
        path: false,
        zlib: false,
        child_process: false,
        http2: false
      };
    }

    // Handle all lodash imports
    config.resolve.alias = {
      ...config.resolve.alias,
      'lodash': require.resolve('lodash'),
      // Handle dynamic lodash submodule imports
      'lodash/': require.resolve('lodash').replace('/lodash.js', '/')
    };

    return config;
  },
  transpilePackages: ['recharts', 'lodash', 'd3-*', '@babel/runtime'],
}

module.exports = nextConfig 