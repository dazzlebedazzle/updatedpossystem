'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';

/**
 * Optimized SafeImage component for fast image loading
 * Uses native img tag for local static images for maximum speed
 * Falls back to Next.js Image for remote images with optimization
 */
export default function SafeImage({ 
  src, 
  alt, 
  fill, 
  className, 
  fallback, 
  width, 
  height, 
  priority = false,
  quality = 70, // Optimized for faster loading
  sizes,
  ...props 
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Check if it's a local static image
  const isLocalImage = useMemo(() => {
    if (!src) return false;
    return src.startsWith('/assets') || 
           src.startsWith('/public') || 
           src.startsWith('/images') ||
           !src.startsWith('http');
  }, [src]);
  
  // If error occurred or no source, show fallback
  if (hasError || !src) {
    return fallback || null;
  }
  
  // For local static images, use native img tag for maximum speed
  if (isLocalImage) {
    return (
      <>
        {isLoading && (
          <div className="absolute inset-0 bg-gray-100 animate-pulse rounded-md" />
        )}
        <img
          src={src}
          alt={alt || ''}
          width={width}
          height={height}
          className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
          style={fill ? { width: '100%', height: '100%', objectFit: 'cover' } : undefined}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
          onLoad={() => setIsLoading(false)}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          {...props}
        />
      </>
    );
  }
  
  // For remote images, use Next.js Image with optimization
  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse rounded-md" />
      )}
      <Image 
        src={src} 
        alt={alt || ''}
        {...(fill ? { fill: true } : { width, height })}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        onLoad={() => setIsLoading(false)}
        onLoadingComplete={() => setIsLoading(false)}
        priority={priority}
        quality={quality}
        loading={priority ? 'eager' : 'lazy'}
        sizes={sizes || (fill ? '100vw' : `${width}px`)}
        fetchPriority={priority ? 'high' : 'auto'}
        {...props}
      />
    </>
  );
}

