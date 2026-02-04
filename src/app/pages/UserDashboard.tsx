import { useState } from 'react';
import { Logo } from '@/components/Logo';
import { ReportItemForm } from '@/components/ReportItemForm';
import { MatchCard } from '@/components/MatchCard';
import { mockMatches, mockLostItems } from '@/data/mockData';
import { ItemCategory, LostItem, Match } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Package, MapPin, Clock, Settings, ChevronRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function UserDashboard() {
  const [lostItems, setLostItems] = useState<LostItem[]>(mockLostItems);
  const [matches] = useState(mockMatches);
  const [selectedReport, setSelectedReport] = useState<LostItem | null>(null);

  const handleReportItem = (data: {
    name: string;
    description: string;
    category: ItemCategory;
    dateLost: string;
    locationLost: string;
  }) => {
    const newItem: LostItem = {
      id: `l${Date.now()}`,
      ...data,
      status: 'searching',
      userId: 'user1',
      createdAt: new Date().toISOString(),
    };
    setLostItems([newItem, ...lostItems]);
  };

  // Get matches for selected report
  const getMatchesForReport = (reportId: string): Match[] => {
    return matches.filter(match => match.lostItemId === reportId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'matched':
        return 'bg-primary/15 text-primary border-primary/30';
      case 'claimed':
        return 'bg-muted text-muted-foreground border-muted';
      default:
        return 'bg-secondary text-secondary-foreground border-secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'searching':
        return 'Searching';
      case 'matched':
        return 'Match Found';
      case 'claimed':
        return 'Claimed';
      default:
        return status;
    }
  };

  const getMatchCount = (reportId: string) => {
    return matches.filter(m => m.lostItemId === reportId).length;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <Link to="/admin">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Settings className="w-4 h-4 mr-2" />
              Admin
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-2xl mx-auto text-center space-y-4 animate-fade-in">
            <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary border-0 px-3 py-1">
              <Search className="w-3 h-3 mr-1.5" />
              Lost something?
            </Badge>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Find your lost items{' '}
              <span className="text-primary">instantly</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              Report what you've lost and we'll search our network to help reunite you with your belongings.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Report Form */}
          <div className="lg:col-span-1 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <ReportItemForm onSubmit={handleReportItem} />
          </div>

          {/* Reports & Matches Section */}
          <div className="lg:col-span-2 space-y-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">My Reports</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Click a report to view matches
                </p>
              </div>
              <Badge variant="outline" className="text-muted-foreground">
                {lostItems.length} {lostItems.length === 1 ? 'report' : 'reports'}
              </Badge>
            </div>

            {lostItems.length > 0 ? (
              <div className="space-y-3">
                {lostItems.map((item) => {
                  const matchCount = getMatchCount(item.id);
                  const isSelected = selectedReport?.id === item.id;
                  
                  return (
                    <div key={item.id} className="space-y-3">
                      {/* Report Card */}
                      <button
                        onClick={() => setSelectedReport(isSelected ? null : item)}
                        className={cn(
                          "w-full text-left p-4 rounded-xl border transition-all duration-200",
                          "hover:shadow-md hover:border-primary/30",
                          isSelected
                            ? "bg-card border-primary shadow-md"
                            : "bg-card border-border/50 hover:bg-card/80"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
                              {matchCount > 0 && (
                                <Badge className="bg-primary text-primary-foreground text-xs shrink-0">
                                  {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                              {item.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(item.dateLost).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {item.locationLost}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <Badge
                              variant="outline"
                              className={cn("text-xs", getStatusColor(item.status))}
                            >
                              {getStatusLabel(item.status)}
                            </Badge>
                            <ChevronRight 
                              className={cn(
                                "w-5 h-5 text-muted-foreground transition-transform duration-200",
                                isSelected && "rotate-90"
                              )} 
                            />
                          </div>
                        </div>
                      </button>

                      {/* Expanded Matches */}
                      {isSelected && (
                        <div className="ml-4 pl-4 border-l-2 border-primary/30 space-y-3 animate-fade-in">
                          {getMatchesForReport(item.id).length > 0 ? (
                            <>
                              <div className="flex items-center justify-between py-2">
                                <span className="text-sm font-medium text-foreground">
                                  Potential Matches
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedReport(null)}
                                  className="h-7 w-7 p-0"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                              {getMatchesForReport(item.id).map((match) => (
                                <MatchCard key={match.id} match={match} />
                              ))}
                            </>
                          ) : (
                            <div className="py-6 text-center">
                              <Search className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                              <p className="text-sm text-muted-foreground">
                                No matches found yet. We're still searching!
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
                <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="font-display font-semibold text-lg mb-2 text-foreground">No reports yet</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Use the form to report a lost item and we'll start searching immediately.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 py-8 bg-muted/30">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 FoundIt. Helping reunite people with their belongings.</p>
        </div>
      </footer>
    </div>
  );
}
