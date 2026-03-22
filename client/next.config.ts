import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Smaller peak RAM on low-memory deploy hosts (avoids OOM / exit 137 during CI builds)
  experimental: {
    cpus: 1,
    memoryBasedWorkersCount: true,
  },
};

export default nextConfig;
