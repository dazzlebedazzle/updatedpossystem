import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable compression
  compress: true,
  
  // Production optimizations
  productionBrowserSourceMaps: false, // Disable source maps in production for smaller bundles
  
  // Image configuration - optimized for speed
  images: {
    unoptimized: false,
    remotePatterns: [],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days cache
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Optimize bundle size
  experimental: {
    optimizePackageImports: ['recharts', 'react-spinners', '@zxing/library', 'html5-qrcode'],
  },
  
  // Webpack optimizations
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      // Optimize client-side bundle
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        minimize: !dev, // Minify in production
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 25,
          minSize: 20000,
          cacheGroups: {
            default: false,
            vendors: false,
            // Separate chunk for tesseract (HUGE library - lazy load only)
            tesseract: {
              name: 'tesseract',
              test: /[\\/]node_modules[\\/]tesseract\.js[\\/]/,
              chunks: 'async', // Only load when needed
              priority: 40,
              enforce: true,
            },
            // Separate chunk for recharts (large library)
            recharts: {
              name: 'recharts',
              test: /[\\/]node_modules[\\/]recharts[\\/]/,
              chunks: 'async', // Lazy load
              priority: 35,
              enforce: true,
            },
            // Separate chunk for @zxing (large library)
            zxing: {
              name: 'zxing',
              test: /[\\/]node_modules[\\/]@zxing[\\/]/,
              chunks: 'async', // Lazy load
              priority: 33,
              enforce: true,
            },
            // Separate chunk for html5-qrcode
            html5qrcode: {
              name: 'html5-qrcode',
              test: /[\\/]node_modules[\\/]html5-qrcode[\\/]/,
              chunks: 'async', // Lazy load
              priority: 32,
              enforce: true,
            },
            // Separate chunk for jspdf
            jspdf: {
              name: 'jspdf',
              test: /[\\/]node_modules[\\/]jspdf[\\/]/,
              chunks: 'async', // Lazy load
              priority: 31,
              enforce: true,
            },
            // Vendor chunk for other node_modules
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]/,
              priority: 20,
              minChunks: 1,
            },
            // Common chunk for shared code
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              minSize: 0,
            },
          },
        },
      };
    }
    return config;
  },
  // Security and performance headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://cdn.jsdelivr.net; worker-src 'self' blob: https://cdn.jsdelivr.net;"
          }
        ],
      },
      // Cache static assets aggressively
      {
        source: '/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Cache API responses with shorter TTL - compatible with bfcache
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=30, stale-while-revalidate=60, must-revalidate',
          },
        ],
      },
      // Cache _next/static files
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
