import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ItemCard } from '@/components/ItemCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Search, LogOut, MapPin, Calendar, User, Loader2, Menu, SlidersHorizontal } from 'lucide-react';
import { signOut } from '../../lib/auth';
import { useAuthState } from '@/hooks/useAuthState';
import {
  getPublicCatalogItems,
  getAllOffices,
  PublicCatalogFilters,
} from '../../lib/database';
import { FoundItem, ItemCategory, categoryLabels, categoryIcons } from '@/types';
import { useTypewriterPlaceholder } from '@/hooks/useTypewriterPlaceholder';
import { useLogoDestination } from '@/hooks/useLogoDestination';

function FiltersForm({
  filters,
  setFilters,
  setSearchInput,
  offices,
  onApply,
}: {
  filters: PublicCatalogFilters;
  setFilters: React.Dispatch<React.SetStateAction<PublicCatalogFilters>>;
  setSearchInput: (v: string) => void;
  offices: { office_id: string; office_name?: string | null; building_name?: string | null }[];
  onApply: () => void;
}) {
  return (
    <div className="space-y-4">
      <Select
        value={filters.category ?? 'all'}
        onValueChange={(v) =>
          setFilters((f) => ({ ...f, category: v === 'all' ? undefined : v }))
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.officeId ?? 'all'}
        onValueChange={(v) =>
          setFilters((f) => ({ ...f, officeId: v === 'all' ? undefined : v }))
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Office" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All offices</SelectItem>
          {offices.map((o) => (
            <SelectItem key={o.office_id} value={o.office_id}>
              {o.office_name ?? o.building_name ?? o.office_id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="Color"
        value={filters.color ?? ''}
        onChange={(e) =>
          setFilters((f) => ({ ...f, color: e.target.value.trim() || undefined }))
        }
        className="w-full"
      />
      <Input
        placeholder="Brand"
        value={filters.brand ?? ''}
        onChange={(e) =>
          setFilters((f) => ({ ...f, brand: e.target.value.trim() || undefined }))
        }
        className="w-full"
      />
      <Input
        type="date"
        placeholder="From date"
        value={filters.dateFrom ?? ''}
        onChange={(e) =>
          setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))
        }
        className="w-full"
      />
      <Input
        type="date"
        placeholder="To date"
        value={filters.dateTo ?? ''}
        onChange={(e) =>
          setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))
        }
        className="w-full"
      />
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            setFilters({});
            setSearchInput('');
          }}
        >
          Clear filters
        </Button>
        <Button className="flex-1" onClick={onApply}>
          Apply
        </Button>
      </div>
    </div>
  );
}

function dbRowToFoundItem(row: any): FoundItem {
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
    color: row.color ?? undefined,
    brand: row.brand ?? undefined,
  };
}

export default function BrowsePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuthState();
  const [items, setItems] = useState<FoundItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false); // local loading for catalog fetches
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offices, setOffices] = useState<{ office_id: string; office_name?: string | null; building_name?: string | null }[]>([]);
  const [selectedItem, setSelectedItem] = useState<FoundItem | null>(null);
  const [filters, setFilters] = useState<PublicCatalogFilters>({});
  const [searchInput, setSearchInput] = useState('');
  const logoTo = useLogoDestination();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const searchPlaceholder = useTypewriterPlaceholder([
    'AirPods',
    'Keys',
    'Blue wallet',
    'North Face backpack',
  ]);

  useEffect(() => {
    if (loading) return;
    async function load() {
      try {
        if (!user) {
          navigate('/login', { replace: true, state: { from: '/browse' } });
          return;
        }
        const [officesData] = await Promise.all([getAllOffices()]);
        setOffices(officesData ?? []);
      } catch (err) {
        console.error('Failed to load:', err);
        navigate('/login', { replace: true, state: { from: '/browse' } });
      } finally {
        // loading is managed by useAuthState
      }
    }
    load();
  }, [user, loading, navigate]);

  const loadInitial = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const { items: fetched, hasMore: more } = await getPublicCatalogItems(filters, 0);
      setItems(fetched.map(dbRowToFoundItem));
      setHasMore(more);
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoadingCatalog(false);
    }
  }, [filters]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const { items: fetched, hasMore: more } = await getPublicCatalogItems(filters, items.length);
      const converted = fetched.map(dbRowToFoundItem);
      setItems((prev) => [...prev, ...converted]);
      setHasMore(more);
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [filters, items.length, hasMore, loadingMore]);

  useEffect(() => {
    if (user) {
      loadInitial();
    }
  }, [user, loadInitial]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput.trim() || undefined }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && items.length > 0) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, items.length, loadMore]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  // show auth-loading spinner or a catalog-loading placeholder when no items yet
  if ((loading || loadingCatalog) && items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const activeFilterCount = [
    filters.category,
    filters.officeId,
    filters.color,
    filters.brand,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-white/20 bg-background/40 backdrop-blur-2xl shadow-lg shadow-black/5">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-2">
          <Logo to={logoTo} />
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-4 md:gap-6">
            <Link
              to="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              Dashboard
            </Link>
            <Link
              to="/browse"
              className="text-sm font-medium text-primary whitespace-nowrap"
            >
              Browse Catalog
            </Link>
          </nav>
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <ThemeToggle />
            {/* Desktop: Sign Out / Sign In */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="hidden md:flex text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
            {/* Mobile: Hamburger menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/browse">Browse Catalog</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto mb-6 md:mb-8">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
            Browse Found Items
          </h1>
          <p className="text-muted-foreground hidden md:block">
            Browse items reported by offices. Found something? Visit the office to claim it.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="max-w-4xl mx-auto mb-6 md:mb-8 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={searchPlaceholder}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            {/* Mobile: Filters button (opens bottom sheet) */}
            <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
              <DrawerTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0 md:hidden relative">
                  <SlidersHorizontal className="w-5 h-5" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  )}
                  <span className="sr-only">Filters</span>
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Filters</DrawerTitle>
                </DrawerHeader>
                <div className="px-4 pb-8 space-y-4 max-h-[60vh] overflow-y-auto">
                  <FiltersForm
                    filters={filters}
                    setFilters={setFilters}
                    setSearchInput={setSearchInput}
                    offices={offices}
                    onApply={() => setFiltersOpen(false)}
                  />
                </div>
              </DrawerContent>
            </Drawer>
          </div>
          {/* Desktop: Full filter row */}
          <div className="hidden md:flex flex-wrap gap-3">
            <Select
              value={filters.category ?? 'all'}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, category: v === 'all' ? undefined : v }))
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.officeId ?? 'all'}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, officeId: v === 'all' ? undefined : v }))
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Office" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {offices.map((o) => (
                  <SelectItem key={o.office_id} value={o.office_id}>
                    {o.office_name ?? o.building_name ?? o.office_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Color"
              value={filters.color ?? ''}
              onChange={(e) =>
                setFilters((f) => ({ ...f, color: e.target.value.trim() || undefined }))
              }
              className="w-[120px]"
            />
            <Input
              placeholder="Brand"
              value={filters.brand ?? ''}
              onChange={(e) =>
                setFilters((f) => ({ ...f, brand: e.target.value.trim() || undefined }))
              }
              className="w-[120px]"
            />
            <Input
              type="date"
              placeholder="From date"
              value={filters.dateFrom ?? ''}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))
              }
              className="w-[140px]"
            />
            <Input
              type="date"
              placeholder="To date"
              value={filters.dateTo ?? ''}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))
              }
              className="w-[140px]"
            />
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters({});
                  setSearchInput('');
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="max-w-4xl mx-auto">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted-foreground">No items match your filters.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setFilters({});
                  setSearchInput('');
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 -mx-2 sm:mx-0 px-2 sm:px-0">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onViewDetails={() => setSelectedItem(item)}
                />
              ))}
            </div>
          )}

          <div ref={loadMoreRef} className="h-20 flex items-center justify-center py-8">
            {loadingMore && (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            )}
          </div>
        </div>
      </main>

      {/* Item detail modal */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{selectedItem.name}</DialogTitle>
                <DialogDescription>
                  {categoryLabels[selectedItem.category]} • {selectedItem.officeName}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {selectedItem.imageUrl ? (
                  <img
                    src={selectedItem.imageUrl}
                    alt={selectedItem.name}
                    className="w-full aspect-video object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center rounded-lg bg-muted text-5xl">
                    {categoryIcons[selectedItem.category]}
                  </div>
                )}
                <p className="text-sm text-foreground">{selectedItem.description}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{selectedItem.officeName} • {selectedItem.officeLocation}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>Found {new Date(selectedItem.dateFound).toLocaleDateString()}</span>
                  </div>
                  {selectedItem.checkedInBy && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4 text-primary" />
                      <span>Checked in by {selectedItem.checkedInBy}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
