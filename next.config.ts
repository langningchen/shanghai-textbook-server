import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@octokit/rest'],
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        punycode: false,
      };
    }
    return config;
  },
};

if (process.env.NODE_ENV === 'development') {
  import('@opennextjs/cloudflare').then(({ initOpenNextCloudflareForDev }) => {
    initOpenNextCloudflareForDev();
  }).catch(console.error);
}

export default nextConfig;
