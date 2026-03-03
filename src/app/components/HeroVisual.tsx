/**
 * Sleek isometric-style visual of lost items (keys, phone, mug) with subtle floating animation.
 */
export function HeroVisual() {
  return (
    <div className="relative w-full max-w-md mx-auto h-56 md:h-72 flex items-center justify-center">
      <div className="relative w-full h-full flex items-center justify-center [perspective:800px]">
        {/* Isometric container */}
        <div
          className="relative w-48 h-48 md:w-56 md:h-56"
          style={{ transform: 'rotateX(15deg) rotateY(-20deg)' }}
        >
          {/* Phone */}
          <div
            className="absolute left-1/2 top-1/3 w-12 h-20 md:w-14 md:h-24 rounded-xl bg-gradient-to-b from-muted-foreground/90 to-muted-foreground/70 border-2 border-foreground/20 shadow-xl flex items-center justify-center -translate-x-1/2 -translate-y-1/2 animate-hero-float"
            style={{ animationDelay: '0s' }}
          >
            <div className="w-8 h-12 md:w-10 md:h-14 rounded-md bg-background/40" />
          </div>

          {/* Keys */}
          <div className="absolute left-1/4 top-2/3 -translate-x-1/2 -translate-y-1/2 animate-hero-float" style={{ animationDelay: '0.6s' }}>
            <div className="w-14 h-6 md:w-16 md:h-7 rounded-lg bg-foreground/80 shadow-lg flex items-center justify-center -rotate-12">
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-3 h-2.5 rounded-full bg-foreground/60" />
            </div>
          </div>

          {/* Coffee mug */}
          <div
            className="absolute left-3/4 top-2/3 w-10 h-12 md:w-12 md:h-14 rounded-b-lg rounded-t-sm bg-gradient-to-b from-muted-foreground/80 to-muted-foreground/60 border-2 border-foreground/20 shadow-lg -translate-x-1/2 -translate-y-1/2 animate-hero-float flex items-end justify-center pb-1"
            style={{ animationDelay: '1.2s' }}
          >
            <div className="w-1.5 h-3 md:w-2 md:h-4 rounded-r-full bg-muted-foreground/60 -ml-0.5" />
          </div>
        </div>

        {/* Soft glow */}
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl scale-150 -z-10" />
      </div>
    </div>
  );
}
