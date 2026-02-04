import { MapPin } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  const containerSizes = {
    sm: 'p-1.5 rounded-lg',
    md: 'p-2 rounded-lg',
    lg: 'p-2.5 rounded-xl',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
  };

  return (
    <div className="flex items-center gap-2.5">
      <div className={`bg-foreground ${containerSizes[size]}`}>
        <MapPin className={`${iconSizes[size]} text-primary`} />
      </div>
      {showText && (
        <span className={`font-display font-bold ${textSizes[size]} tracking-tight`}>
          <span className="text-foreground">Found</span>
          <span className="text-primary">It</span>
        </span>
      )}
    </div>
  );
}
