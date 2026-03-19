import * as React from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

import { cn } from "@/lib/utils";

type ParallaxBlobProps = {
  className?: string;
  /** Tailwind background classes (e.g. bg-primary/20) */
  tintClassName: string;
  /** Amount of vertical parallax in px */
  strength?: number;
};

export function ParallaxBlob({ className, tintClassName, strength = 90 }: ParallaxBlobProps) {
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 800], [0, strength]);

  return (
    <motion.div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full blur-3xl will-change-transform",
        tintClassName,
        className,
      )}
      style={reduceMotion ? undefined : { y }}
    />
  );
}

