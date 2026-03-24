import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow tunnel domains to fetch Next.js dev assets (HMR/chunks) during phone testing.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev"],
};

export default nextConfig;
