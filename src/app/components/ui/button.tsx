import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background",
    "transition-all duration-300 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    // Liquid-glass surface (applies to all variants, each variant sets its own colors)
    "overflow-hidden backdrop-blur-2xl",
    // bright rim + micro-borders
    "ring-1 ring-inset ring-white/18 dark:ring-white/10",
    "border border-white/14 dark:border-white/10",
    // specular highlight + caustics (intense)
    "before:pointer-events-none before:absolute before:inset-[-40%] before:opacity-0 before:transition-opacity before:duration-300",
    "before:bg-[radial-gradient(800px_circle_at_30%_10%,rgba(255,255,255,0.55),transparent_45%)]",
    "after:pointer-events-none after:absolute after:inset-0 after:opacity-100",
    "after:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.22),transparent_45%,rgba(0,0,0,0.16))]",
    // subtle “liquid” sheen sweep on hover
    "hover:before:opacity-100",
    "hover:shadow-[0_18px_45px_-22px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.22)]",
    "active:shadow-[0_10px_30px_-20px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.10),inset_0_1px_0_rgba(255,255,255,0.18)]",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "text-primary-foreground bg-gradient-to-b from-primary/95 to-emerald-600/75 shadow-md shadow-primary/25 hover:brightness-110 active:brightness-95 active:scale-[0.98] hover:shadow-primary/25",
        destructive:
          "text-destructive-foreground bg-gradient-to-b from-destructive/95 to-destructive/70 shadow-md shadow-destructive/20 hover:brightness-110 active:brightness-95 active:scale-[0.98]",
        outline:
          "bg-background/45 text-foreground hover:bg-accent/35 hover:text-foreground hover:shadow-sm active:scale-[0.98]",
        secondary:
          "bg-secondary/65 text-secondary-foreground hover:brightness-105 hover:shadow-sm active:scale-[0.98]",
        ghost:
          "border border-transparent bg-transparent text-foreground hover:bg-accent/35 hover:text-foreground active:scale-[0.98] after:opacity-0 before:opacity-0 backdrop-blur-0",
        link: "text-primary underline-offset-4 hover:underline",
        hero:
          "text-background bg-gradient-to-b from-foreground/90 to-foreground/70 shadow-lg shadow-black/25 hover:brightness-110 active:brightness-95 active:scale-[0.98] font-semibold",
        success:
          "text-primary-foreground bg-gradient-to-b from-primary/95 to-emerald-600/75 shadow-md shadow-primary/25 hover:brightness-110 active:brightness-95 active:scale-[0.98] hover:shadow-primary/25",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
