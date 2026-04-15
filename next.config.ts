import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  compiler: {
    // Don't remove console.logs in production for debugging
    removeConsole: false,
  },
};

export default nextConfig;
