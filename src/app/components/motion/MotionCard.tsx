import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type MotionCardProps = React.HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "button";
};

export function MotionCard({ className, children, as = "div", ...props }: MotionCardProps) {
  const reduceMotion = useReducedMotion();
  const Comp = as === "button" ? motion.button : motion.div;

  return (
    <Comp
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm",
        "transition-colors",
        "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-300",
        "before:bg-[radial-gradient(1200px_circle_at_30%_-20%,hsl(var(--primary)/0.18),transparent_40%)]",
        "hover:border-primary/40 hover:before:opacity-100",
        className,
      )}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -6,
              boxShadow: "0 18px 40px -18px rgba(0,0,0,0.25)",
            }
      }
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      {...props}
    >
      {children}
    </Comp>
  );
}

