import { Match, categoryIcons } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Navigation, CheckCircle2 } from 'lucide-react';

interface MatchCardProps {
  match: Match;
}

export function MatchCard({ match }: MatchCardProps) {
  const { foundItem, confidence } = match;

  const getConfidenceStyle = (conf: number) => {
    if (conf >= 90) return 'bg-primary text-primary-foreground';
    if (conf >= 70) return 'bg-foreground text-background';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Card className="overflow-hidden border-border/50 bg-card hover:border-primary/40 transition-all duration-200 hover:shadow-lg">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Image Section */}
          <div className="relative sm:w-36 h-36 flex-shrink-0 bg-muted">
            {foundItem.imageUrl ? (
              <img
                src={foundItem.imageUrl}
                alt={foundItem.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl text-muted-foreground">
                {categoryIcons[foundItem.category]}
              </div>
            )}
            <Badge className={`absolute top-2 right-2 ${getConfidenceStyle(confidence)} text-xs font-semibold`}>
              {confidence}%
            </Badge>
          </div>

          {/* Content Section */}
          <div className="flex-1 p-4 space-y-3">
            <div>
              <h3 className="font-display font-semibold text-lg text-foreground">
                {foundItem.name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {foundItem.description}
              </p>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span>{foundItem.officeName}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Navigation className="w-3.5 h-3.5" />
                <span>{foundItem.officeLocation}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>Found {new Date(foundItem.dateFound).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" className="flex-1">
                <Navigation className="w-3.5 h-3.5" />
                Get Directions
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                Not Mine
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
