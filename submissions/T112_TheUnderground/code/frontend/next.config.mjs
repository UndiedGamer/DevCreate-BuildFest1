/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: process.env.NEXT_PUBLIC_ALLOWED_ORIGINS?.split(',') ?? []
    }
  }
};

export default nextConfig;
