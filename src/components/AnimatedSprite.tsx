"use client";

import { useState, useEffect } from "react";

interface AnimatedSpriteProps {
  frames: string[];
  fps?: number;
  size?: number;
  className?: string;
}

/**
 * Cycles through an array of image frames to create a pixel art animation.
 * Uses pixelated rendering for crisp scaling.
 */
export default function AnimatedSprite({
  frames,
  fps = 6,
  size = 64,
  className = "",
}: AnimatedSpriteProps) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (frames.length <= 1) return;
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [frames.length, fps]);

  if (frames.length === 0) return null;

  return (
    <img
      src={frames[frameIndex]}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
