import { useState, useEffect } from 'react';
import { Logo } from '@/components/Logo';
import { ReportItemForm } from '@/components/ReportItemForm';
import { MatchCard } from '@/components/MatchCard';
import { ItemCategory, LostItem, Match, FoundItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Package, MapPin, Clock, LogIn, LogOut, ChevronRight, X, Loader2, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

import { getCurrentUser, signOut } from '../../lib/auth';
import {
  getUserLostReports,
  createLostItemReport,
  deleteLostItemReport,
  findPotentialMatches,
  LostItemReportRow,
} from '../../lib/database';

// Convert database row to frontend LostItem type
function rowToLostItem(row: LostItemReportRow): LostItem {
  return {
    id: row.id,
    name: row.item_name ?? 'Unnamed item',
    description: row.description ?? '',
    category: (row.category as ItemCategory) ?? 'other',
    color: row.color ?? undefined,
    dateLost: row.lost_date ? String(row.lost_date).slice(0, 10) : '',
    locationLost: row.lost_location ?? '',
    status: (row.status === 'found' ? 'matched' : row.status === 'cancelled' ? 'claimed' : 'searching') as LostItem['status'],
    userId: row.student_id,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

const normalizeColorList = (value: string): string =>
  Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[;,/|]+/g)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  ).join(',');

// Convert database found item to frontend FoundItem type
function dbFoundItemToFoundItem(row: any): FoundItem {
  const office = row.staff?.office;
  return {
    id: row.id,
    name: row.item_name ?? 'Unnamed item',
    description: row.description ?? '',
    category: (row.category as ItemCategory) ?? 'other',
    dateFound: row.found_date ? String(row.found_date).slice(0, 10) : row.created_at?.slice(0, 10) ?? '',
    imageUrl: row.image_urls?.[0] ?? undefined,
    status: row.status === 'returned' ? 'returned' : 'available',
    officeId: office?.office_id ?? '',
    officeName: office?.office_name ?? 'Unknown Office',
    officeLocation: [office?.building_name, office?.office_address].filter(Boolean).join(' • ') || 'Unknown Location',
    checkedInBy: row.staff?.full_name ?? '',
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export default function UserDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<LostItem | null>(null);
  const [matches, setMatches] = useState<Map<string, Match[]>>(new Map());
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  // Load user and their reports on mount
  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        if (currentUser) {
          const reports = await getUserLostReports();
          setLostItems(reports.map(rowToLostItem));
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Load matches when a report is selected
  useEffect(() => {
    if (!selectedReport) return;

    // Check if we already have matches for this report
    if (matches.has(selectedReport.id)) return;

    async function loadMatches() {
      if (!selectedReport) return;

      setLoadingMatches(true);
      try {
        const lostItemData = {
          item_name: selectedReport.name,
          description: selectedReport.description,
          category: selectedReport.category,
          color: selectedReport.color,
          lost_location: selectedReport.locationLost,
        };

        const potentialMatches = await findPotentialMatches(lostItemData);

        const formattedMatches: Match[] = potentialMatches.map((item: any, index: number) => ({
          id: `match-${selectedReport.id}-${index}`,
          lostItemId: selectedReport.id,
          foundItemId: item.id,
          confidence: Math.round(item.matchScore * 100),
          foundItem: dbFoundItemToFoundItem(item),
        }));

        setMatches(prev => new Map(prev).set(selectedReport.id, formattedMatches));
      } catch (err) {
        console.error('Failed to load matches:', err);
        toast({
          title: 'Error',
          description: 'Failed to load potential matches',
          variant: 'destructive',
        });
      } finally {
        setLoadingMatches(false);
      }
    }

    loadMatches();
  }, [selectedReport, matches]);

  const handleReportItem = async (data: {
    name: string;
    description: string;
    category: ItemCategory;
    dateLost: string;
    locationLost: string;
    color?: string;
  }) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to report a lost item.',
        variant: 'destructive',
      });
      navigate('/login');
      return;
    }

    try {
      const cleanedColor = normalizeColorList(data.color ?? '');
      const created = await createLostItemReport({
        item_name: data.name,
        description: data.description,
        category: data.category,
        color: cleanedColor || undefined,
        lost_date: data.dateLost,
        lost_location: data.locationLost,
        status: 'active',
      });

      const newItem = rowToLostItem(created);
      setLostItems(prev => [newItem, ...prev]);

      toast({
        title: 'Item reported!',
        description: "We'll search our database and notify you of any matches.",
      });
    } catch (err: any) {
      console.error('Failed to create report:', err);
      toast({
        title: 'Error',
        description: err?.message ?? 'Failed to create report',
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setLostItems([]);
      setMatches(new Map());
      toast({ title: 'Signed out', description: 'You have been signed out.' });
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    const confirmed = window.confirm('Delete this lost item report? This action cannot be undone.');
    if (!confirmed) return;

    try {
      setDeletingReportId(reportId);
      await deleteLostItemReport(reportId);

      setLostItems(prev => prev.filter(item => item.id !== reportId));
      setSelectedReport(prev => (prev?.id === reportId ? null : prev));
      setMatches(prev => {
        const next = new Map(prev);
        next.delete(reportId);
        return next;
      });

      toast({
        title: 'Report deleted',
        description: 'Your lost item report has been removed.',
      });
    } catch (err: any) {
      console.error('Failed to delete report:', err);
      toast({
        title: 'Error',
        description: err?.message ?? 'Failed to delete report',
        variant: 'destructive',
      });
    } finally {
      setDeletingReportId(null);
    }
  };

  const getMatchesForReport = (reportId: string): Match[] => {
    return matches.get(reportId) ?? [];
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
    return matches.get(reportId)?.length ?? 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            {user ? (
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            ) : (
              <Link to="/login">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              </Link>
            )}
          </div>
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
                  {user ? 'Click a report to view matches' : 'Sign in to see your reports'}
                </p>
              </div>
              {user && (
                <Badge variant="outline" className="text-muted-foreground">
                  {lostItems.length} {lostItems.length === 1 ? 'report' : 'reports'}
                </Badge>
              )}
            </div>

            {!user ? (
              <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
                <LogIn className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="font-display font-semibold text-lg mb-2 text-foreground">Sign in to view reports</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-4">
                  Create an account or sign in to report lost items and track your reports.
                </p>
                <Link to="/login">
                  <Button>Sign In</Button>
                </Link>
              </div>
            ) : lostItems.length > 0 ? (
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
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDeleteReport(item.id);
                              }}
                              disabled={deletingReportId === item.id}
                              className="h-8 px-2 text-destructive hover:text-destructive"
                            >
                              {deletingReportId === item.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
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
                          {loadingMatches ? (
                            <div className="py-6 text-center">
                              <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin mb-2" />
                              <p className="text-sm text-muted-foreground">
                                Searching for matches...
                              </p>
                            </div>
                          ) : getMatchesForReport(item.id).length > 0 ? (
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
