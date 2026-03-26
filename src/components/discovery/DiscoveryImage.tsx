"use client";

import { useState, useEffect } from "react";
import { checkImageExists } from "@/lib/discovery/assets";

/**
 * DiscoveryImage — renders a Discovery Engine image asset with fallback.
 *
 * If the image file doesn't exist yet (not generated), renders
 * the fallback content (emoji, gradient, or children).
 *
 * This allows the entire Discovery Engine to work with CSS
 * gradients/emoji NOW and seamlessly upgrade when images
 * are dropped into /public/discovery/.
 */

interface DiscoveryImageProps {
  src: string;
  alt: string;
  fallback?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** If true, render as background-image instead of <img> */
  asBackground?: boolean;
  children?: React.ReactNode;
}

export function DiscoveryImage({
  src,
  alt,
  fallback,
  className = "",
  style,
  asBackground = false,
  children,
}: DiscoveryImageProps) {
  const [imageExists, setImageExists] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    checkImageExists(src).then((exists) => {
      if (mounted) setImageExists(exists);
    });
    return () => { mounted = false; };
  }, [src]);

  // Still checking — show fallback to avoid flash
  if (imageExists === null || imageExists === false) {
    if (fallback) return <>{fallback}</>;
    return null;
  }

  if (asBackground) {
    return (
      <div
        className={className}
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
    />
  );
}
