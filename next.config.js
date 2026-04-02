// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    workerThreads: false,
  },
  turbopack: {},
};
module.exports = nextConfig;