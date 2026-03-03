import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface SuccessCheckmarkProps {
  open: boolean;
  onComplete?: () => void;
  duration?: number;
}

/**
 * Animated green checkmark that draws itself on screen.
 * Used for success states like report submission.
 */
export function SuccessCheckmark({ open, onComplete, duration = 1800 }: SuccessCheckmarkProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      const done = setTimeout(() => {
        setVisible(false);
        setTimeout(() => {
          setMounted(false);
          onComplete?.();
        }, 300);
      }, duration);
      return () => {
        cancelAnimationFrame(t);
        clearTimeout(done);
      };
    }
    setMounted(false);
  }, [open, duration, onComplete]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`flex flex-col items-center gap-4 rounded-2xl bg-card p-8 shadow-2xl border border-border/50 transition-all duration-300 ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <svg
          className="w-20 h-20 text-success"
          viewBox="0 0 52 52"
          fill="none"
        >
          <circle
            className="stroke-success/30"
            cx="26"
            cy="26"
            r="24"
            strokeWidth="2"
            fill="none"
          />
          <path
            className="stroke-success stroke-[3] fill-none origin-center"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="100"
            strokeDashoffset="100"
            style={
              visible
                ? {
                    animation: 'checkmarkDraw 0.7s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards',
                  }
                : undefined
            }
            d="M14 27l9 9 17-22"
          />
        </svg>
        <p className="font-display text-xl font-semibold text-foreground">Item Reported!</p>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          We&apos;ll search our database and notify you of any matches.
        </p>
      </div>
    </div>,
    document.body
  );
}
