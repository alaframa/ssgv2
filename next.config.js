// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    workerThreads: false,
    cpus: 6,           // limit build workers
  },
  turbopack: {}
};
module.exports = nextConfig;