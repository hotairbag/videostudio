import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    reactCompiler: true,
  },
  // Exclude @ffmpeg packages from server-side bundling
  // These packages are browser-only and use document/window APIs
  serverExternalPackages: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core'],
  webpack: (config, { isServer }) => {
    // For server/edge builds, stub out @ffmpeg modules
    if (isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = config.resolve.alias || {};
      config.resolve.alias['@ffmpeg/ffmpeg'] = false;
      config.resolve.alias['@ffmpeg/util'] = false;
      config.resolve.alias['@ffmpeg/core'] = false;
    }
    return config;
  },
};

export default nextConfig;
