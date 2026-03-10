import { useState, useEffect } from 'react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ReportItemForm } from '@/components/ReportItemForm';
import { MatchCard } from '@/components/MatchCard';
import { SuccessCheckmark } from '@/components/SuccessCheckmark';
import { ItemCategory, LostItem, Match, FoundItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Search, Package, MapPin, Clock, LogIn, LogOut, ChevronRight, X, Loader2, Trash2, CheckCircle2, Calendar, User, Navigation } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useTypewriterPlaceholder } from '@/hooks/useTypewriterPlaceholder';
import { useWatchedMatches } from '@/hooks/useWatchedMatches';
import { useLogoDestination } from '@/hooks/useLogoDestination';
import { categoryIcons } from '@/types';

import { getCurrentUser, signOut } from '../../lib/auth';
import {
  getUserLostReports,
  createLostItemReport,
  updateLostItemReport,
  getUserReportPotentialMatches,
  requestUserPotentialMatchUpdate,
  removeUserPotentialMatch,
  LostItemReportRow,
} from '../../lib/database';
import { supabase } from '../../lib/supabase';

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
    status: (row.status === 'found' ? 'recovered' : row.status === 'cancelled' ? 'claimed' : 'searching') as LostItem['status'],
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
  const office = row.office ?? row.staff?.office;
  const normalizedImageUrl = Array.isArray(row?.image_urls)
    ? row.image_urls[0]
    : typeof row?.image_urls === 'string'
      ? row.image_urls
      : row?.image_url;
  const normalizedStatus = String(row?.status ?? '').toLowerCase();

  return {
    id: row.id,
    name: row.item_name ?? 'Unnamed item',
    description: row.description ?? '',
    category: (row.category as ItemCategory) ?? 'other',
    dateFound: row.found_date ? String(row.found_date).slice(0, 10) : row.created_at?.slice(0, 10) ?? '',
    imageUrl: normalizedImageUrl ?? undefined,
    status: normalizedStatus === 'returned' ? 'returned' : normalizedStatus === 'claimed' ? 'claimed' : 'available',
    officeId: office?.office_id ?? '',
    officeName: office?.office_name ?? 'Unknown Office',
    officeLocation: [office?.building_name, office?.office_address].filter(Boolean).join(' • ') || 'Unknown Location',
    checkedInBy: row.staff?.full_name ?? '',
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserDashboardSkeleton } from '@/components/skeletons/UserDashboardSkeleton';
import { MatchCardSkeleton } from '@/components/skeletons/MatchCardSkeleton';

export default function UserDashboard() {
  const navigate = useNavigate();
  const logoTo = useLogoDestination();
  const [activeTab, setActiveTab] = useState<'report' | 'reports'>('report');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<LostItem | null>(null);
  const [matches, setMatches] = useState<Map<string, Match[]>>(new Map());
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  const formatPotentialMatches = (reportId: string, potentialMatches: any[]): Match[] => {
    const availableMatches = potentialMatches.filter(
      (row: any) => String(row?.foundItem?.status ?? '').toLowerCase() === 'available'
    );

    return availableMatches.map((row: any) => ({
      id: String(row.matchId ?? `match-${reportId}-${row.foundItemId}`),
      lostItemId: String(row.reportId ?? reportId),
      foundItemId: String(row.foundItemId),
      confidence: Number.isFinite(Number(row.confidence))
        ? Number(row.confidence)
        : Number.isFinite(Number(row.score))
          ? Math.round(Number(row.score) * 100)
          : 50,
      foundItem: dbFoundItemToFoundItem(row.foundItem),
    }));
  };
  const [recoveringReportId, setRecoveringReportId] = useState<string | null>(null);
  const [showSuccessCheckmark, setShowSuccessCheckmark] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [reportSearchQuery, setReportSearchQuery] = useState('');

  const searchPlaceholder = useTypewriterPlaceholder([
    'AirPods',
    'Keys',
    'North Face backpack',
    'Blue iPhone',
    'Wallet',
  ]);
  const { isWatched, toggleWatch } = useWatchedMatches(user?.id ?? null);

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

  // Preload matches for all reports once reports are loaded (no click-triggered fetches).
  useEffect(() => {
    if (!user || lostItems.length === 0) return;

    const reportIdsToLoad = lostItems.map((item) => item.id).filter((id) => !matches.has(id));
    if (reportIdsToLoad.length === 0) return;

    let cancelled = false;

    const activeReportIds = lostItems
      .filter((item) => item.status === 'searching')
      .map((item) => item.id)
      .filter((id) => reportIdsToLoad.includes(id));

    async function preloadMatches() {
      setLoadingMatches(true);
      try {
        // Step 1: Show existing matches immediately
        const loaded = await Promise.all(
          reportIdsToLoad.map(async (reportId) => {
            const potentialMatches = await getUserReportPotentialMatches(reportId);
            return [reportId, formatPotentialMatches(reportId, potentialMatches)] as const;
          })
        );

        if (cancelled) return;

        setMatches((prev) => {
          const next = new Map(prev);
          for (const [reportId, reportMatches] of loaded) {
            next.set(reportId, reportMatches);
          }
          return next;
        });
        setLoadingMatches(false);

        // Step 2: Refresh matches server-side for active reports, then reload
        if (activeReportIds.length === 0) return;

        await Promise.allSettled(
          activeReportIds.map((reportId) => requestUserPotentialMatchUpdate(reportId))
        );

        if (cancelled) return;

        const refreshed = await Promise.all(
          activeReportIds.map(async (reportId) => {
            const potentialMatches = await getUserReportPotentialMatches(reportId);
            return [reportId, formatPotentialMatches(reportId, potentialMatches)] as const;
          })
        );

        if (cancelled) return;

        setMatches((prev) => {
          const next = new Map(prev);
          for (const [reportId, reportMatches] of refreshed) {
            next.set(reportId, reportMatches);
          }
          return next;
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error('[UserDashboard.preloadMatches] failed', err);
        toast({
          title: 'Error',
          description: `Failed to load potential matches: ${message}`,
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoadingMatches(false);
      }
    }

    void preloadMatches();
    return () => {
      cancelled = true;
    };
  }, [user, lostItems, matches]);

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
      throw new Error('Sign in required');
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

      // Trigger server-side match computation (fire and forget)
      void supabase.functions.invoke("update-user-matches", {
        body: { reportId: created.id },
      });
    } catch (err: any) {
      console.error('Failed to create report:', err);
      toast({
        title: 'Error',
        description: err?.message ?? 'Failed to create report',
        variant: 'destructive',
      });
      throw err;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setLostItems([]);
      setMatches(new Map());
      toast({ title: 'Signed out', description: 'You have been signed out.' });
      navigate('/');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  const handleMarkRecovered = async (reportId: string) => {
    const confirmed = window.confirm('Mark this report as recovered? You got your item back!');
    if (!confirmed) return;

    setRecoveringReportId(reportId);
    try {
      await updateLostItemReport(reportId, { status: 'found' });
      setLostItems((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: 'recovered' as const } : r))
      );
      setSelectedReport((prev) => (prev?.id === reportId ? null : prev));

      // Clear potential matches — report is no longer active
      void supabase.from("potential_matches").delete().eq("report_id", reportId);

      toast({
        title: 'Item recovered!',
        description: "We're glad you got your item back.",
      });
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['hsl(82, 85%, 55%)', 'hsl(82, 85%, 45%)', 'hsl(0, 0%, 100%)'],
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message ?? 'Could not update report',
        variant: 'destructive',
      });
    } finally {
      setRecoveringReportId(null);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    const confirmed = window.confirm('Delete this lost item report? This action cannot be undone.');
    if (!confirmed) return;

    try {
      setDeletingReportId(reportId);
      const { error: deleteError } = await supabase.functions.invoke("delete-lost-report", {
        body: { reportId },
      });
      if (deleteError) throw deleteError;

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

  const handleNotMine = async (match: Match) => {
    try {
      await removeUserPotentialMatch(match.lostItemId, match.foundItemId);

      setMatches((prev) => {
        const next = new Map(prev);
        const current = next.get(match.lostItemId) ?? [];
        next.set(
          match.lostItemId,
          current.filter((m) => m.foundItemId !== match.foundItemId)
        );
        return next;
      });

      toast({
        title: 'Match removed',
        description: 'This item will no longer appear as a potential match.',
      });
    } catch (err: any) {
      console.error('Failed to remove potential match:', err);
      toast({
        title: 'Error',
        description: err?.message ?? 'Failed to remove potential match',
        variant: 'destructive',
      });
    }
  };

  const getMatchesForReport = (reportId: string): Match[] => {
    return matches.get(reportId) ?? [];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'matched':
        return 'bg-primary/15 text-primary border-primary/30';
      case 'recovered':
        return 'bg-success/15 text-success border-success/30';
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
      case 'recovered':
        return 'Recovered';
      case 'claimed':
        return 'Closed';
      default:
        return status;
    }
  };

  const getMatchCount = (reportId: string) => {
    return matches.get(reportId)?.length ?? 0;
  };

  const filteredLostItems = reportSearchQuery.trim()
    ? lostItems.filter(
        (item) =>
          item.name.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
          item.locationLost.toLowerCase().includes(reportSearchQuery.toLowerCase())
      )
    : lostItems;

  if (loading) {
    return <UserDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/20 bg-background/40 backdrop-blur-2xl shadow-lg shadow-black/5">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Logo to={logoTo} />
          <nav className="flex items-center gap-4 md:gap-6">
            <Link
              to="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              Dashboard
            </Link>
            <Link to="/browse">
              <Button variant="default" size="sm" className="whitespace-nowrap">
                Browse Catalog
              </Button>
            </Link>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
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
            {user && (
              <Link to="/browse" className="inline-block mt-4">
                <Button variant="outline" size="lg" className="gap-2">
                  <Package className="w-4 h-4" />
                  Browse items found by offices
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'report' | 'reports')}>
          <div className="flex justify-center mb-8">
            <TabsList className="h-14 p-1 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl shadow-sm">
              <TabsTrigger value="report" className="px-8 py-3 text-base font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all duration-200">Report Item</TabsTrigger>
              <TabsTrigger value="reports" className="px-8 py-3 text-base font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all duration-200">My Reports</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="report">
            <div className="max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <ReportItemForm
                onSubmit={handleReportItem}
                onSuccess={() => {
                  setShowSuccessCheckmark(true);
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <div className="space-y-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="space-y-4">
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
                {user && lostItems.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder={searchPlaceholder}
                      value={reportSearchQuery}
                      onChange={(e) => setReportSearchQuery(e.target.value)}
                      className="pl-9 bg-background border-border/50"
                    />
                  </div>
                )}
                {!user && (
                  <p className="text-sm text-muted-foreground mt-1">Sign in to see your reports</p>
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
                  {filteredLostItems.length === 0 ? (
                    <div className="py-12 text-center">
                      <Search className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="text-muted-foreground">No reports match &quot;{reportSearchQuery}&quot;</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => setReportSearchQuery('')}
                      >
                        Clear search
                      </Button>
                    </div>
                  ) : filteredLostItems.map((item) => {
                    const matchCount = getMatchCount(item.id);
                    const isSelected = selectedReport?.id === item.id;

                    return (
                      <div key={item.id} className="space-y-3">
                        {/* Report Card */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedReport(isSelected ? null : item)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedReport(isSelected ? null : item); } }}
                          className={cn(
                            "w-full text-left p-4 rounded-xl border transition-all duration-200 ease-out cursor-pointer",
                            "hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30",
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
                              {(item.status === 'searching' || item.status === 'matched') && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleMarkRecovered(item.id);
                                  }}
                                  disabled={recoveringReportId === item.id}
                                  className="h-8 px-2 text-success hover:text-success hover:bg-success/10"
                                  title="I got my item back"
                                >
                                  {recoveringReportId === item.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span className="hidden sm:inline ml-1">I got it back</span>
                                    </>
                                  )}
                                </Button>
                              )}
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
                        </div>

                        {/* Expanded Matches */}
                        {isSelected && (
                          <div className="ml-4 pl-4 border-l-2 border-primary/30 space-y-3 animate-fade-in">
                            {loadingMatches && !matches.has(item.id) ? (
                              <div className="py-6 text-center">
                                <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin mb-2" />
                                <p className="text-sm text-muted-foreground">
                                  Loading saved matches...
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
                                  <MatchCard
                                    key={match.id}
                                    match={match} onNotMine={handleNotMine}
                                    isWatched={isWatched(match.id)}
                                    onToggleWatch={() => toggleWatch(match.id)}
                                    onViewDetails={() => setSelectedMatch(match)}
                                  />
                                ))}
                              </>
                            ) : (
                              <div className="py-6 text-center">
                                <Search className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                                <p className="text-sm text-muted-foreground">
                                  No saved matches yet.
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
          </TabsContent>
        </Tabs>
      </main>

      {/* Success checkmark overlay */}
      <SuccessCheckmark
        open={showSuccessCheckmark}
        onComplete={() => {
          setShowSuccessCheckmark(false);
          toast({
            title: 'Item reported!',
            description: "We'll search our database and notify you of any matches.",
          });
        }}
      />

      {/* Match detail modal */}
      <Dialog open={!!selectedMatch} onOpenChange={(open) => !open && setSelectedMatch(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedMatch && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{selectedMatch.foundItem.name}</DialogTitle>
                <DialogDescription>Potential match • {selectedMatch.confidence}% confidence</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {selectedMatch.foundItem.imageUrl ? (
                  <img
                    src={selectedMatch.foundItem.imageUrl}
                    alt={selectedMatch.foundItem.name}
                    className="w-full aspect-video object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center rounded-lg bg-muted text-5xl">
                    {categoryIcons[selectedMatch.foundItem.category]}
                  </div>
                )}
                <p className="text-sm text-foreground">{selectedMatch.foundItem.description}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{selectedMatch.foundItem.officeName} • {selectedMatch.foundItem.officeLocation}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>Found {new Date(selectedMatch.foundItem.dateFound).toLocaleDateString()}</span>
                  </div>
                  {selectedMatch.foundItem.checkedInBy && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4 text-primary" />
                      <span>Checked in by {selectedMatch.foundItem.checkedInBy}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1">
                    <Navigation className="w-4 h-4 mr-2" />
                    Get Directions
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedMatch(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 py-8 bg-muted/30">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 FoundIt. Helping reunite people with their belongings.</p>
        </div>
      </footer>
    </div>
  );
}
