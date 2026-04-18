import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Суръати бештар ва амният
  reactStrictMode: true,
  
  // 2. Оптимизатсияи аксҳо дар сатҳи "Pro"
  images: {
    formats: ['image/avif', 'image/webp'], // Истифодаи форматҳои хеле сабук
    deviceSizes: [640, 750, 828, 1080, 1200, 1920], // Андозаҳои мувофиқи телефонҳо
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'aztuszloghjkynukjkaa.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'zjhvlsptlmikgpsjmvtv.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  
  // 3. Кам кардани ҳаҷми код (Gzip compression)
  compress: true,

  // 4. Танзими логҳо барои мониторинг дар Vercel
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
