import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Low-memory deploy hosts: avoid OOM / exit 137 during `next build`.
  // Do not set memoryBasedWorkersCount: Next's getNumberOfWorkers() then uses
  // Math.max(..., 4) and forces ≥4 workers when cpus matches the default.
  experimental: {
    cpus: 1,
    webpackBuildWorker: false,
    webpackMemoryOptimizations: true,
  },
  webpack: (config) => {
    config.parallelism = 1;
    return config;
  },
};

export default nextConfig;
