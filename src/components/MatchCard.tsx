import { Match, categoryIcons } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Navigation, Clock } from 'lucide-react';

interface MatchCardProps {
  match: Match;
}

export function MatchCard({ match }: MatchCardProps) {
  const { foundItem, confidence } = match;

  const getConfidenceColor = (conf: number) => {
    if (conf >= 90) return 'bg-success text-success-foreground';
    if (conf >= 70) return 'bg-warning text-warning-foreground';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg border-primary/20 bg-gradient-to-br from-card to-accent/20">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          {/* Image Section */}
          <div className="relative md:w-48 h-48 md:h-auto flex-shrink-0">
            {foundItem.imageUrl ? (
              <img
                src={foundItem.imageUrl}
                alt={foundItem.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted text-5xl">
                {categoryIcons[foundItem.category]}
              </div>
            )}
            <Badge className={`absolute top-3 right-3 ${getConfidenceColor(confidence)} font-bold shadow-md`}>
              {confidence}% Match
            </Badge>
          </div>

          {/* Content Section */}
          <div className="flex-1 p-5 space-y-4">
            <div>
              <h3 className="font-display font-semibold text-xl mb-1">
                {foundItem.name}
              </h3>
              <p className="text-muted-foreground text-sm line-clamp-2">
                {foundItem.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-foreground">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="font-medium">{foundItem.officeName}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Navigation className="w-4 h-4 flex-shrink-0" />
                <span>{foundItem.officeLocation}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>Found {new Date(foundItem.dateFound).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-success">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">Available for pickup</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="hero" className="flex-1 sm:flex-none">
                <Navigation className="w-4 h-4" />
                Get Directions
              </Button>
              <Button variant="outline" className="flex-1 sm:flex-none">
                Not My Item
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
