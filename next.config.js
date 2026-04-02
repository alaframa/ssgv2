// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    runtime: "edge",

    workerThreads: false,
  },
  turbopack: {},
};
module.exports = nextConfig;