/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['res.cloudinary.com', 'avatars.githubusercontent.com'],
  },
  async rewrites() {
    const apiTarget = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    return process.env.NODE_ENV === 'development'
      ? [{ source: '/api/:path*', destination: `${apiTarget}/:path*` }]
      : [];
  },
};

module.exports = nextConfig;
