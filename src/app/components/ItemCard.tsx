import { FoundItem, categoryIcons, categoryLabels } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, ArrowRight } from 'lucide-react';

interface ItemCardProps {
  item: FoundItem;
  confidence?: number;
  onViewDetails?: () => void;
}

export function ItemCard({ item, confidence, onViewDetails }: ItemCardProps) {
  const statusStyles = {
    available: 'bg-success/10 text-success border-success/20',
    claimed: 'bg-muted text-muted-foreground border-muted',
    cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  return (
    <Card className="group flex h-full flex-col overflow-hidden transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 gradient-card border-border/50">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">
            {categoryIcons[item.category]}
          </div>
        )}
        {confidence !== undefined && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-primary text-primary-foreground font-semibold shadow-md">
              {confidence}% Match
            </Badge>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge variant="secondary" className="backdrop-blur-sm bg-background/80">
            {categoryLabels[item.category]}
          </Badge>
        </div>
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold text-lg leading-tight line-clamp-1">
            {item.name}
          </h3>
          <Badge className={statusStyles[item.status]}>
            {item.status === 'available' ? 'Available' : item.status === 'claimed' ? 'Claimed' : 'Cancelled'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="min-h-[2.5rem] text-sm text-muted-foreground line-clamp-2">
          {item.description}
        </p>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="line-clamp-1">{item.officeName}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4 text-primary" />
            <span>Found {new Date(item.dateFound).toLocaleDateString()}</span>
          </div>
        </div>

        {onViewDetails && item.status === 'available' && (
          <Button 
            variant="hero" 
            size="sm" 
            className="w-full mt-auto"
            onClick={onViewDetails}
          >
            View Location
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
