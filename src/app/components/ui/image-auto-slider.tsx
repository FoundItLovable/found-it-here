import React, { useMemo } from "react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { InfiniteSlider } from "@/components/ui/infinite-slider";

type ImageAutoSliderProps = {
  className?: string;
  /** seconds for one full loop */
  durationSeconds?: number;
  images?: string[];
};

const DEFAULT_IMAGES: string[] = [
  // Curated, high-res “student lost items” images (square crop).
  "https://images.unsplash.com/photo-1593476123561-9516f209d6f4?auto=format&fit=crop&w=1600&h=1600&q=85", // water bottle
  "https://images.unsplash.com/photo-1526481280695-3c687fd643ed?auto=format&fit=crop&w=1600&h=1600&q=85", // backpack
  "https://images.unsplash.com/photo-1520975958227-239ee0636ea7?auto=format&fit=crop&w=1600&h=1600&q=85", // keys
  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1600&h=1600&q=85", // laptop
  "https://images.unsplash.com/photo-1526401485004-2aa6b5b0f1b2?auto=format&fit=crop&w=1600&h=1600&q=85", // airpods/earbuds vibe
  "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1600&h=1600&q=85", // headphones
  "https://images.unsplash.com/photo-1520975867597-0f6f1f90c3f6?auto=format&fit=crop&w=1600&h=1600&q=85", // jacket
  "https://images.unsplash.com/photo-1512499617640-c2f999098c01?auto=format&fit=crop&w=1600&h=1600&q=85", // phone
  "https://images.unsplash.com/photo-1516387938699-a93567ec168e?auto=format&fit=crop&w=1600&h=1600&q=85", // notebook
  "https://images.unsplash.com/photo-1602526432604-029a709e131c?auto=format&fit=crop&w=1600&h=1600&q=85", // charger/cables
  // repeat (students lose these constantly)
  "https://images.unsplash.com/photo-1593476123561-9516f209d6f4?auto=format&fit=crop&w=1600&h=1600&q=85",
  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1600&h=1600&q=85",
];

export function ImageAutoSlider({
  className,
  durationSeconds = 26,
  images,
}: ImageAutoSliderProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const base = useMemo(() => {
    const extras = (images ?? []).map((u) => String(u ?? "").trim()).filter(Boolean);
    const merged = extras.length ? [...DEFAULT_IMAGES, ...extras] : DEFAULT_IMAGES;
    return Array.from(new Set(merged));
  }, [images]);
  const secondsPerItem = 2.73;
  const loopDurationSeconds = Math.max(base.length * secondsPerItem, durationSeconds);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl",
        isDark ? "bg-black/60" : "bg-white/50",
        "backdrop-blur-xl",
        className,
      )}
    >
      {/* Soft gradients for depth */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0",
          isDark
            ? "bg-gradient-to-b from-black/40 via-black/20 to-black/60"
            : "bg-gradient-to-b from-white/60 via-white/30 to-white/70",
        )}
      />

      {/* Masked scrolling row */}
      <div
        className={cn(
          "relative z-10 w-full py-6",
          "[mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]",
          "[-webkit-mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]",
        )}
      >
        <InfiniteSlider gap={24} loopDurationSeconds={loopDurationSeconds} hoverSlowdownFactor={0.45}>
          {base.map((src, index) => (
            <div
              key={`${index}-${src}`}
              className={cn(
                "group flex-shrink-0 rounded-2xl overflow-hidden",
                "w-44 h-44 md:w-56 md:h-56 lg:w-72 lg:h-72",
                "shadow-xl shadow-black/10 border border-white/10",
                "bg-muted",
              )}
            >
              <img
                src={src}
                alt={`Lost item ${(index % base.length) + 1}`}
                className={cn(
                  "h-full w-full object-cover",
                  "transition-transform duration-300 ease-out",
                  "group-hover:scale-[1.04]",
                )}
                loading="lazy"
                onError={(e) => {
                  // Last-resort fallback: never show empty tiles.
                  (e.currentTarget as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1600&h=1600&q=85";
                }}
              />
            </div>
          ))}
        </InfiniteSlider>
      </div>

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-20",
          isDark ? "bg-gradient-to-t from-black/60 to-transparent" : "bg-gradient-to-t from-white/70 to-transparent",
        )}
      />
    </div>
  );
}
