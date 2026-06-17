/** @type {import('next').NextConfig} */
const nextConfig = {
  // 允许在服务端使用 fs / child_process 等 Node.js API
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "node-cron", "openai"],
  },
};

export default nextConfig;
