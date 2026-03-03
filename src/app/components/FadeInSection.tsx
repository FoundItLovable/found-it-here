import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/utils';

interface FadeInSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Wraps content and fades it in + slides up when it scrolls into view.
 */
export function FadeInSection({ children, className, delay = 0 }: FadeInSectionProps) {
  const { ref, isInView } = useInView({ threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-out',
        isInView
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-8',
        className
      )}
      style={{ transitionDelay: isInView ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}
