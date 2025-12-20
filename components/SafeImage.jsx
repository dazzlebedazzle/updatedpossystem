'use client';

import { useState } from 'react';
import Image from 'next/image';

/**
 * SafeImage component that handles image loading errors gracefully
 * Falls back to a provided fallback component when image fails to load
 */
export default function SafeImage({ src, alt, fill, className, fallback, width, height, ...props }) {
  const [hasError, setHasError] = useState(false);
  
  // If error occurred or no source, show fallback
  if (hasError || !src) {
    return fallback || null;
  }
  
  // Render Next.js Image component
  return (
    <Image 
      src={src} 
      alt={alt || ''}
      fill={fill}
      width={width}
      height={height}
      className={className}
      onError={() => setHasError(true)}
      {...props}
    />
  );
}

