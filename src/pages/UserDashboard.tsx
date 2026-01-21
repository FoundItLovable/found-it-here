import { useState } from 'react';
import { Logo } from '@/components/Logo';
import { ReportItemForm } from '@/components/ReportItemForm';
import { MatchCard } from '@/components/MatchCard';
import { ItemCard } from '@/components/ItemCard';
import { mockMatches, mockLostItems, mockFoundItems } from '@/data/mockData';
import { ItemCategory, LostItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Search, Package, MapPin, Clock, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function UserDashboard() {
  const [lostItems, setLostItems] = useState<LostItem[]>(mockLostItems);
  const [matches] = useState(mockMatches);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <Link to="/admin">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Settings className="w-4 h-4 mr-2" />
              Admin
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-5" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-2xl mx-auto text-center space-y-4 animate-fade-in">
            <Badge variant="secondary" className="mb-4">
              <Search className="w-3 h-3 mr-1" />
              Lost something?
            </Badge>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              Find your lost items <span className="text-primary">fast</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Report what you've lost and we'll search our network of collection points to help reunite you with your belongings.
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

          {/* Results Section */}
          <div className="lg:col-span-2 space-y-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Tabs defaultValue="matches" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="matches" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Matches
                  {matches.length > 0 && (
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      {matches.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="reported" className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  My Reports
                </TabsTrigger>
              </TabsList>

              <TabsContent value="matches" className="space-y-4">
                {matches.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Clock className="w-4 h-4" />
                      <span>Found {matches.length} potential matches for your items</span>
                    </div>
                    {matches.map((match) => (
                      <MatchCard key={match.id} match={match} />
                    ))}
                  </>
                ) : (
                  <div className="text-center py-12 bg-muted/30 rounded-xl">
                    <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-display font-semibold text-lg mb-2">No matches yet</h3>
                    <p className="text-muted-foreground">
                      Report a lost item and we'll notify you when we find a match.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reported" className="space-y-4">
                {lostItems.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {lostItems.map((item) => (
                      <div key={item.id} className="p-4 bg-card rounded-xl border border-border/50 space-y-2">
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold">{item.name}</h3>
                          <Badge
                            className={
                              item.status === 'matched'
                                ? 'bg-success/10 text-success'
                                : item.status === 'claimed'
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-warning/10 text-warning-foreground'
                            }
                          >
                            {item.status === 'searching' ? 'Searching...' : item.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Lost: {new Date(item.dateLost).toLocaleDateString()}</span>
                          <span>Near: {item.locationLost}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-muted/30 rounded-xl">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-display font-semibold text-lg mb-2">No reported items</h3>
                    <p className="text-muted-foreground">
                      Use the form to report a lost item.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Recent Found Items */}
            <div className="mt-12">
              <h2 className="font-display text-2xl font-bold mb-6">Recently Found Items</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockFoundItems.slice(0, 3).map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 FoundIt. Helping reunite people with their belongings.</p>
        </div>
      </footer>
    </div>
  );
}
