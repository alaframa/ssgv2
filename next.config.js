// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingExcludes: {
      "*": [
        "./**/(dashboard)/**",
      ],
    },
  },
};


module.exports = nextConfig;