import { MapPin } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className="flex items-center gap-2">
      <div className="gradient-hero rounded-xl p-2 shadow-md">
        <MapPin className={`${iconSizes[size]} text-primary-foreground`} />
      </div>
      {showText && (
        <span className={`font-display font-bold ${textSizes[size]} text-foreground`}>
          Found<span className="text-primary">It</span>
        </span>
      )}
    </div>
  );
}
