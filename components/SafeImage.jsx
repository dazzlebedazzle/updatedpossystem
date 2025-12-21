'use client';

import { useState } from 'react';
import Image from 'next/image';

/**
 * SafeImage component that handles image loading errors gracefully
 * Falls back to a provided fallback component when image fails to load
 */
export default function SafeImage({ src, alt, fill, className, fallback, width, height, ...props }) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // If error occurred or no source, show fallback
  if (hasError || !src) {
    return fallback || null;
  }
  
  // Render Next.js Image component
  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse rounded-md" />
      )}
      <Image 
        src={src} 
        alt={alt || ''}
        {...(fill ? { fill: true } : { width, height })}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        onLoad={() => setIsLoading(false)}
        onLoadingComplete={() => setIsLoading(false)}
        unoptimized={src?.startsWith('/assets') || src?.startsWith('/public')}
        priority={false}
        quality={90}
        loading="lazy"
        {...props}
      />
    </>
  );
}

