import { cn } from "@/lib/utils";
import { motion, useAnimationFrame, useMotionValue } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import useMeasure from "react-use-measure";

type InfiniteSliderProps = {
  children: React.ReactNode;
  gap?: number;
  speed?: number;
  speedOnHover?: number;
  /** Optional: total seconds for one full loop */
  loopDurationSeconds?: number;
  /** Optional hover slowdown multiplier when speedOnHover is not provided (e.g. 0.5) */
  hoverSlowdownFactor?: number;
  direction?: "horizontal" | "vertical";
  reverse?: boolean;
  className?: string;
};

export function InfiniteSlider({
  children,
  gap = 16,
  speed = 80,
  speedOnHover,
  loopDurationSeconds,
  hoverSlowdownFactor,
  direction = "horizontal",
  reverse = false,
  className,
}: InfiniteSliderProps) {
  const [ref] = useMeasure();
  const [segmentRef, segmentBounds] = useMeasure();
  const translation = useMotionValue(0);
  const currentSpeedRef = useRef(speed);
  const restSpeedRef = useRef(speed);
  const hoverSpeedRef = useRef<number | undefined>(undefined);
  const isHoveredRef = useRef(false);
  const phaseRef = useRef(0);

  const segmentSize = direction === "horizontal" ? segmentBounds.width : segmentBounds.height;
  const loopDistance = segmentSize + gap;

  const baseSpeed = useMemo(
    () =>
      loopDurationSeconds && loopDurationSeconds > 0 && loopDistance > 0
        ? loopDistance / loopDurationSeconds
        : speed,
    [loopDurationSeconds, loopDistance, speed]
  );

  const hoverSpeed = useMemo(
    () =>
      speedOnHover ??
      (hoverSlowdownFactor && hoverSlowdownFactor > 0
        ? baseSpeed * hoverSlowdownFactor
        : undefined),
    [speedOnHover, hoverSlowdownFactor, baseSpeed]
  );

  useEffect(() => {
    if (!loopDistance) return;
    // Preserve phase when size recalculates (e.g. image decode, responsive layout)
    // to avoid visible jumps/stutters over long runs.
    phaseRef.current = ((phaseRef.current % loopDistance) + loopDistance) % loopDistance;
    translation.set(reverse ? -loopDistance + phaseRef.current : -phaseRef.current);
    currentSpeedRef.current = baseSpeed;
    restSpeedRef.current = baseSpeed;
    hoverSpeedRef.current = hoverSpeed;
  }, [loopDistance, reverse, baseSpeed, hoverSpeed, translation]);

  useAnimationFrame((_, delta) => {
    if (!loopDistance || delta <= 0) return;

    const cappedDeltaMs = Math.min(delta, 50);
    const targetSpeed =
      isHoveredRef.current && hoverSpeedRef.current != null
        ? hoverSpeedRef.current
        : restSpeedRef.current;
    const current = currentSpeedRef.current;
    // Smoothly approach target speed to avoid visible speed pops.
    const blend = 1 - Math.exp(-cappedDeltaMs / 140);
    const nextSpeed = current + (targetSpeed - current) * blend;
    currentSpeedRef.current = nextSpeed;

    phaseRef.current = (phaseRef.current + nextSpeed * (cappedDeltaMs / 1000)) % loopDistance;
    const next = reverse ? -loopDistance + phaseRef.current : -phaseRef.current;
    translation.set(next);
  });

  const hoverProps = speedOnHover || hoverSlowdownFactor
    ? {
        onHoverStart: () => {
          restSpeedRef.current = baseSpeed;
          hoverSpeedRef.current = hoverSpeed;
          isHoveredRef.current = true;
        },
        onHoverEnd: () => {
          isHoveredRef.current = false;
          // Explicitly restore baseline speed so hover never leaves a faster default.
          currentSpeedRef.current = restSpeedRef.current;
        },
      }
    : {};

  return (
    <div className={cn("overflow-hidden", className)}>
      <motion.div
        className="flex w-max will-change-transform"
        style={{
          ...(direction === "horizontal" ? { x: translation } : { y: translation }),
          gap: `${gap}px`,
          flexDirection: direction === "horizontal" ? "row" : "column",
        }}
        ref={ref}
        {...hoverProps}
      >
        <div
          ref={segmentRef}
          className="flex w-max"
          style={{ gap: `${gap}px`, flexDirection: direction === "horizontal" ? "row" : "column" }}
        >
          {children}
        </div>
        <div
          className="flex w-max"
          style={{ gap: `${gap}px`, flexDirection: direction === "horizontal" ? "row" : "column" }}
        >
          {children}
        </div>
      </motion.div>
    </div>
  );
}
