import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

export interface FeatureStep {
  step: string;
  title?: string;
  content: string;
  image: string;
}

type FeatureStepsProps = {
  features: FeatureStep[];
  className?: string;
  title?: string;
  imageHeightClassName?: string;
  /** Set to false to disable autoplay */
  autoPlay?: boolean;
  /** ms between steps */
  autoPlayInterval?: number;
};

export function FeatureSteps({
  features,
  className,
  title = "Built for Efficiency",
  imageHeightClassName = "h-[360px] md:h-[420px] lg:h-[520px]",
  autoPlay = true,
  autoPlayInterval = 4500,
}: FeatureStepsProps) {
  const [currentFeature, setCurrentFeature] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const wheelDeltaAccumRef = useRef(0);
  const lastWheelStepAtRef = useRef(0);
  const interactionTimeoutRef = useRef<number | null>(null);

  const safeFeatures = useMemo(() => features.filter((f) => f?.content && f?.image), [features]);

  useEffect(() => {
    if (!autoPlay || isInteracting || safeFeatures.length <= 1) return;
    const id = window.setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % safeFeatures.length);
    }, autoPlayInterval);
    return () => window.clearInterval(id);
  }, [autoPlay, autoPlayInterval, isInteracting, safeFeatures.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || safeFeatures.length === 0) return;

    const onWheel = (e: WheelEvent) => {
      // Let the page scroll naturally; only use wheel as a paced step signal.
      if (Math.abs(e.deltaY) < 2) return;

      const rect = el.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
      if (!inViewport) return;

      // Direction-aware edge locking:
      // - Scrolling down: start stepping only after section top reaches viewport top.
      // - Scrolling up: start stepping only after section bottom reaches viewport bottom.
      const EDGE_TOLERANCE_PX = 20;
      if (e.deltaY > 0 && rect.top > EDGE_TOLERANCE_PX) return;
      if (e.deltaY < 0 && rect.bottom < window.innerHeight - EDGE_TOLERANCE_PX) return;

      const now = Date.now();
      const STEP_COOLDOWN_MS = 320;
      const STEP_THRESHOLD = 110;

      wheelDeltaAccumRef.current += e.deltaY;

      if (now - lastWheelStepAtRef.current < STEP_COOLDOWN_MS) return;

      const canAdvanceDown = wheelDeltaAccumRef.current >= STEP_THRESHOLD;
      const canAdvanceUp = wheelDeltaAccumRef.current <= -STEP_THRESHOLD;
      if (!canAdvanceDown && !canAdvanceUp) return;

      setCurrentFeature((prev) => {
        if (canAdvanceDown) return Math.min(prev + 1, safeFeatures.length - 1);
        return Math.max(prev - 1, 0);
      });

      lastWheelStepAtRef.current = now;
      wheelDeltaAccumRef.current = 0;
      setIsInteracting(true);
      if (interactionTimeoutRef.current) window.clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = window.setTimeout(() => {
        setIsInteracting(false);
        interactionTimeoutRef.current = null;
      }, 650);
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel as any);
      if (interactionTimeoutRef.current) {
        window.clearTimeout(interactionTimeoutRef.current);
        interactionTimeoutRef.current = null;
      }
    };
  }, [safeFeatures.length]);

  if (safeFeatures.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={cn("p-6 md:p-10", className)}
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onTouchStart={() => setIsInteracting(true)}
      onTouchEnd={() => setIsInteracting(false)}
    >
      <div className="max-w-7xl mx-auto w-full">
        <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-10 text-center tracking-tight">
          {title}
        </h2>

        <div className="flex flex-col md:grid md:grid-cols-2 gap-6 md:gap-10 items-start">
          <div className="order-2 md:order-1 space-y-6 md:space-y-8">
            {safeFeatures.map((feature, index) => {
              const active = index === currentFeature;
              return (
                <button
                  key={`${feature.step}-${index}`}
                  type="button"
                  onClick={() => {
                    setIsInteracting(true);
                    setCurrentFeature(index);
                    window.setTimeout(() => setIsInteracting(false), 1200);
                  }}
                  className={cn(
                    "w-full text-left",
                    "rounded-2xl border transition-all",
                    "px-4 py-4 md:px-5 md:py-5",
                    active
                      ? "border-primary/30 bg-primary/5 shadow-lg shadow-black/5"
                      : "border-border/50 bg-card/40 hover:bg-card/60",
                  )}
                >
                  <motion.div
                    className="flex items-start gap-4 md:gap-5"
                    initial={false}
                    animate={{ opacity: active ? 1 : 0.55 }}
                    transition={{ duration: 0.35 }}
                  >
                    <motion.div
                      className={cn(
                        "mt-0.5 w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center border",
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-glow"
                          : "bg-muted/60 text-muted-foreground border-border/60",
                      )}
                      animate={{ scale: active ? 1.06 : 1 }}
                      transition={{ type: "spring", stiffness: 220, damping: 18 }}
                    >
                      {index < currentFeature ? (
                        <span className="text-lg font-bold">✓</span>
                      ) : (
                        <span className="text-sm font-semibold">{index + 1}</span>
                      )}
                    </motion.div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg md:text-xl font-semibold text-foreground">
                        {feature.title || feature.step}
                      </h3>
                      <p className="mt-1 text-sm md:text-base text-muted-foreground">
                        {feature.content}
                      </p>
                      {active && (
                        <div className="mt-3 h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-primary to-emerald-500"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: autoPlay ? autoPlayInterval / 1000 : 0.9, ease: "linear" }}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                </button>
              );
            })}
          </div>

          <div className={cn("order-1 md:order-2 relative w-full overflow-hidden rounded-2xl border border-white/10", imageHeightClassName)}>
            <AnimatePresence mode="wait">
              {safeFeatures.map(
                (feature, index) =>
                  index === currentFeature && (
                    <motion.div
                      key={`img-${index}`}
                      className="absolute inset-0"
                      initial={{ y: 60, opacity: 0, rotateX: -12 }}
                      animate={{ y: 0, opacity: 1, rotateX: 0 }}
                      exit={{ y: -60, opacity: 0, rotateX: 12 }}
                      transition={{ duration: 0.55, ease: "easeInOut" }}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <img
                        src={feature.image}
                        alt={feature.step}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                    </motion.div>
                  ),
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
