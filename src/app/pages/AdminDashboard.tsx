// src/app/pages/AdminDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import { getCurrentUserWithProfile, isStaff, signOut } from "../../lib/auth";
import {
  getOfficeFoundItems,
  getOfficeClaims,
  getAllLostReports,
  updateFoundItem,
  deleteFoundItem,
  createFoundItem,
} from "../../lib/database";
import type { ClaimRow, LostItemReportRow } from "../../lib/database";

import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminDashboardSkeleton } from "@/components/skeletons/AdminDashboardSkeleton";
import { AdminItemCard } from "@/components/admin/AdminItemCard";
import { InventoryMapView } from "@/components/admin/InventoryMapView";
import { AddItemModal } from "@/components/admin/AddItemModal";
import { MetricsPanel } from "@/components/admin/MetricsPanel";
import { toast } from "@/hooks/use-toast";

import {
  Search, Package, Plus, ArrowLeft, Grid3X3, BarChart3,
  ListFilter, CheckCircle, XCircle, Clock,
  MapPin, Calendar, User, Map, LayoutGrid
} from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

import type { FoundItem, ItemFormData } from "@/types";
import { categoryLabels } from "@/types";
import { useTypewriterPlaceholder } from "@/hooks/useTypewriterPlaceholder";
import confetti from "canvas-confetti";



function safeDateOnly(value?: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function officeLocation(profile: any): string {
  const office = profile?.office;
  const building = office?.building_name ?? "";
  const addr = office?.office_address ?? "";
  return [building, addr].filter(Boolean).join(" • ");
}

function rowToFoundItem(row: any, profile: any): FoundItem {
  const status = row?.status as FoundItem['status'] ?? 'available';
  return {
    id: String(row?.id),
    name: String(row?.item_name ?? "Unnamed item"),
    description: String(row?.description ?? ""),
    category: row?.category,
    status,
    imageUrl: row?.image_urls?.[0] ?? row?.image_url ?? undefined,
    dateFound: safeDateOnly(row?.found_date ?? row?.created_at),
    officeId: String(profile?.office_id ?? ""),
    officeName: String(profile?.office?.office_name ?? "Office"),
    officeLocation: officeLocation(profile),
    foundLocation: row?.found_location ?? undefined,
    checkedInBy: String(profile?.full_name ?? ""),
    createdAt: String(row?.created_at ?? new Date().toISOString()),
    updatedAt: String(row?.updated_at ?? row?.created_at ?? new Date().toISOString()),
    color: row?.color ?? undefined,
    brand: row?.brand ?? undefined,
    showInPublicCatalog: row?.show_in_public_catalog !== false,
    latitude: row?.latitude != null ? Number(row.latitude) : undefined,
    longitude: row?.longitude != null ? Number(row.longitude) : undefined,
  };
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FoundItem[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [lostReports, setLostReports] = useState<LostItemReportRow[]>([]);
  const [currentOffice, setCurrentOffice] = useState({ name: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const searchPlaceholder = useTypewriterPlaceholder([
    "AirPods",
    "Keys",
    "North Face backpack",
    "iPhone",
    "Wallet",
    "Laptop charger",
  ]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedItem, setSelectedItem] = useState<FoundItem | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [inventoryView, setInventoryView] = useState<'grid' | 'map'>('grid');
  const [staffContext, setStaffContext] = useState<{ staffId: string; officeId: string }>({
    staffId: "",
    officeId: "",
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        const userWithProfile: any = await getCurrentUserWithProfile();
        if (!userWithProfile) {
          navigate("/Login");
          return;
        }

        const ok = await isStaff();
        if (!ok) {
          await signOut();
          navigate("/Login");
          return;
        }

        // In your setup, staffId is the auth user id (profiles.id matches it)
        const staffId = userWithProfile?.profile?.id ?? userWithProfile?.id;
        if (!staffId) throw new Error("Missing staff id");
        const officeId = String(userWithProfile?.profile?.office_id ?? "");

        const [rows, claimsData, reportsData] = await Promise.all([
          getOfficeFoundItems(officeId, 200, 0),
          getOfficeClaims(officeId, 500, 0),
          getAllLostReports(),
        ]);
        if (!mounted) return;

        const normalized = (rows ?? []).map((r: any) => rowToFoundItem(r, userWithProfile.profile));
        setItems(normalized);
        setClaims((claimsData ?? []) as ClaimRow[]);
        setLostReports((reportsData ?? []) as LostItemReportRow[]);
        setCurrentOffice({ name: userWithProfile.profile?.office?.office_name ?? "Office" });
        setStaffContext({ staffId: String(staffId), officeId });
      } catch (err: any) {
        console.error(err);
        toast({
          title: "Load failed",
          description: err?.message ?? "Could not load admin items",
          variant: "destructive",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const stats = useMemo(() => {
    const total = items.length;
    const available = items.filter((i) => i.status === "available").length;
    const claimed = items.filter((i) => i.status === "claimed").length;
    const returned = items.filter((i) => i.status === "returned").length;
    return { total, available, claimed, returned };
  }, [items]);

  const filteredItems = useMemo(() => {
    let filtered = items;

    // Search filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      filtered = filtered.filter((item) => {
        const haystack = [
          item.name,
          item.description,
          String(item.category ?? ""),
          item.officeName,
          item.officeLocation,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return tokens.every((t) => haystack.includes(t));
      });
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((item) => item.category === categoryFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [items, searchQuery, categoryFilter, statusFilter, sortBy]);

  async function handleCreate(data: ItemFormData & { highValue?: boolean; showInPublicCatalog?: boolean; latitude?: number | null; longitude?: number | null }) {
    try {

      // Your DB expects found_items columns (item_name, found_location, etc.)
      const createdRow = await createFoundItem({
        item_name: data.name,
        description: data.description,
        category: data.category,
        found_location: data.foundLocation ?? null,
        current_location: data.foundLocation ?? null,
        found_date: data.foundDate ?? new Date().toLocaleDateString("en-CA"),
        brand: data.brand ?? null,
        color: data.color ?? null,
        image_urls: data.imageUrl ? [data.imageUrl] : [],
        high_value: data.highValue ? true : false,
        show_in_public_catalog: data.showInPublicCatalog !== false,
        status: "available",
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      });

      const userWithProfile: any = await getCurrentUserWithProfile();
      const created = rowToFoundItem(createdRow, userWithProfile?.profile);

      setItems((prev) => [created, ...prev]);
      toast({ title: "Item added", description: "New found item created." });

    } catch (err: any) {
      console.error(err);
      toast({
        title: "Create failed",
        description: err?.message ?? "Could not create item",
        variant: "destructive",
      });
    }
  }

  async function handleToggleCatalogVisibility(item: FoundItem) {
    const next = !item.showInPublicCatalog;
    try {
      await updateFoundItem(item.id, { show_in_public_catalog: next });
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, showInPublicCatalog: next } : x)));
      toast({
        title: next ? "Item now visible" : "Item hidden from catalog",
        description: next ? `${item.name} will appear in public browse/search.` : `${item.name} is hidden from browse/search but still appears in matching.`,
      });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message ?? "Could not update visibility",
        variant: "destructive",
      });
    }
  }

  async function handleReturn(item: FoundItem) {
    try {
      await updateFoundItem(item.id, { status: "returned" });
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: "returned" } : x)));
      toast({ title: "Marked returned", description: `${item.name} is now returned.` });
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ["hsl(82, 85%, 55%)", "hsl(82, 85%, 45%)", "hsl(0, 0%, 100%)"],
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Update failed",
        description: err?.message ?? "Could not mark returned",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(item: FoundItem) {
    try {
      await deleteFoundItem(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      toast({ title: "Deleted", description: `${item.name} removed.` });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Delete failed",
        description: err?.message ?? "Could not delete item",
        variant: "destructive",
      });
    }
  }

  const handleAddItem = handleCreate;
  

  const handleView = (item: FoundItem) => {
    setSelectedItem(item);
    setShowDetails(true);
  };
  const handleEdit = () => {}; // Edit disabled for now
  const handleClose = handleReturn;
  const handleCancel = handleDelete;

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/20 bg-background/40 backdrop-blur-2xl shadow-lg shadow-black/5">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon" className="hover:bg-secondary">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <Logo size="sm" to="/admin" />
            <Badge variant="outline" className="hidden sm:flex text-xs">
              Admin
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ThemeToggle />
            <MapPin className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">{currentOffice.name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
              className="ml-4"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Stats Banner */}
      <section className="border-b border-border/50 bg-muted/20">
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-4 gap-4">
            <Card className="border-0 shadow-none bg-transparent">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-foreground">
                  <Package className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-none bg-transparent">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/15">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.available}</p>
                  <p className="text-xs text-muted-foreground">Available</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-none bg-transparent">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/15">
                  <User className="w-4 h-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.claimed}</p>
                  <p className="text-xs text-muted-foreground">Claimed</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-none bg-transparent">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/15">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.returned}</p>
                  <p className="text-xs text-muted-foreground">Returned</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Main Content - off-white background for floating card effect */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="inventory" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3 bg-background/40 backdrop-blur-md border border-white/10">
            <TabsTrigger value="inventory" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Grid3X3 className="w-4 h-4" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-2 data-[state=active]:bg-background">
              <BarChart3 className="w-4 h-4" />
              Metrics
            </TabsTrigger>
            <div className="flex items-center justify-center">
              <Button variant="ghost" size="sm" onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Item</span>
              </Button>
            </div>
          </TabsList>

          <TabsContent value="inventory" className="space-y-6">
            {/* Filters - sticky with glassmorphism */}
            <div className="sticky top-16 z-40 -mx-4 px-4 py-3 -mt-3 pt-3 mb-3 border-b border-white/10 bg-background/30 backdrop-blur-xl shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant={inventoryView === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setInventoryView('grid')}
                  className="h-9"
                >
                  <LayoutGrid className="w-4 h-4 mr-1.5" />
                  Grid
                </Button>
                <Button
                  variant={inventoryView === 'map' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setInventoryView('map')}
                  className="h-9"
                >
                  <Map className="w-4 h-4 mr-1.5" />
                  Map
                </Button>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background border-border/50"
                />
              </div>
              <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] bg-background border-border/50">
                    <ListFilter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[120px] bg-background border-border/50">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[110px] bg-background border-border/50">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            </div>

            {/* Items Grid or Map */}
            {inventoryView === 'map' ? (
              <InventoryMapView
                items={filteredItems}
                onEdit={handleEdit}
                onClose={handleClose}
                onCancel={handleCancel}
                onView={handleView}
                onToggleCatalogVisibility={handleToggleCatalogVisibility}
              />
            ) : filteredItems.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <AdminItemCard
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onClose={handleClose}
                    onCancel={handleCancel}
                    onView={handleView}
                    onToggleCatalogVisibility={handleToggleCatalogVisibility}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
                <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="font-display font-semibold text-lg mb-2 text-foreground">No items found</h3>
                <p className="text-muted-foreground text-sm">
                  {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your filters.'
                    : 'Add your first item to get started.'}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="metrics">
            <MetricsPanel items={items} claims={claims} lostReports={lostReports} />
          </TabsContent>

          {/* Add modal rendered outside the tabs */}
          <AddItemModal
            open={showAddModal}
            onOpenChange={setShowAddModal}
            onSubmit={handleAddItem}
            staffId={staffContext.staffId}
            officeId={staffContext.officeId}
          />
        </Tabs>
      </main>

      {/* Item Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-lg">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{selectedItem.name}</DialogTitle>
                <DialogDescription>Item details and history</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {selectedItem.imageUrl && (
                  <img
                    src={selectedItem.imageUrl}
                    alt={selectedItem.name}
                    className="w-full aspect-video object-cover rounded-lg"
                  />
                )}
                <div className="space-y-3">
                  <p className="text-sm text-foreground">{selectedItem.description}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Found: {new Date(selectedItem.dateFound).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span>By: {selectedItem.checkedInBy}</span>
                    </div>
                  </div>
                  {selectedItem.status === 'available' && (
                    <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-muted/20">
                      <div>
                        <p className="text-sm font-medium">Show in public catalog</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedItem.showInPublicCatalog !== false
                            ? 'Visible in browse/search'
                            : 'Hidden from browse/search (still in matching)'}
                        </p>
                      </div>
                      <Switch
                        checked={selectedItem.showInPublicCatalog !== false}
                        onCheckedChange={() => {
                          handleToggleCatalogVisibility(selectedItem);
                          setSelectedItem((prev) => prev ? { ...prev, showInPublicCatalog: !prev.showInPublicCatalog } : null);
                        }}
                        className="scale-90"
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-4">
                  {selectedItem.status === 'available' && (
                    <>
                      <Button className="flex-1" onClick={() => {
                        handleClose(selectedItem);
                        setShowDetails(false);
                      }}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark as Returned
                      </Button>
                      <Button variant="outline" onClick={() => setShowDetails(false)}>
                        Cancel
                      </Button>
                    </>
                  )}
                  {selectedItem.status !== 'available' && (
                    <Button variant="outline" className="w-full" onClick={() => setShowDetails(false)}>
                      Close
                    </Button>
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
