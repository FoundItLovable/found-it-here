import { useState, useMemo } from 'react';
import { Logo } from '@/components/Logo';
import { AdminItemCard } from '@/components/admin/AdminItemCard';
import { UploadItemForm } from '@/components/admin/UploadItemForm';
import { mockFoundItems, mockOffices } from '@/data/mockData';
import { FoundItem, ItemCategory, categoryLabels } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  Search, Package, Plus, ArrowLeft, Grid3X3, 
  ListFilter, CheckCircle, XCircle, Clock,
  MapPin, Calendar, User
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const [items, setItems] = useState<FoundItem[]>(mockFoundItems);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [selectedItem, setSelectedItem] = useState<FoundItem | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  const currentOffice = mockOffices[0]; // Simulating logged-in admin's office

  const filteredItems = useMemo(() => {
    let result = items.filter(item => item.officeId === currentOffice.id);

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        item =>
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(item => item.category === categoryFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return result;
  }, [items, searchQuery, categoryFilter, statusFilter, sortBy, currentOffice.id]);

  const stats = useMemo(() => {
    const officeItems = items.filter(item => item.officeId === currentOffice.id);
    return {
      total: officeItems.length,
      available: officeItems.filter(i => i.status === 'available').length,
      claimed: officeItems.filter(i => i.status === 'claimed').length,
      cancelled: officeItems.filter(i => i.status === 'cancelled').length,
    };
  }, [items, currentOffice.id]);

  const handleAddItem = (data: {
    name: string;
    description: string;
    category: ItemCategory;
    imageUrl?: string;
  }) => {
    const newItem: FoundItem = {
      id: `f${Date.now()}`,
      ...data,
      dateFound: new Date().toISOString().split('T')[0],
      status: 'available',
      officeId: currentOffice.id,
      officeName: currentOffice.name,
      officeLocation: currentOffice.location,
      checkedInBy: 'current-admin',
      createdAt: new Date().toISOString(),
    };
    setItems([newItem, ...items]);
  };

  const handleEdit = (item: FoundItem) => {
    setSelectedItem(item);
    toast({
      title: 'Edit mode',
      description: 'Edit functionality coming soon.',
    });
  };

  const handleClose = (item: FoundItem) => {
    setItems(items.map(i => 
      i.id === item.id ? { ...i, status: 'claimed' as const } : i
    ));
    toast({
      title: 'Item claimed!',
      description: `${item.name} has been marked as claimed.`,
    });
  };

  const handleCancel = (item: FoundItem) => {
    setItems(items.map(i => 
      i.id === item.id ? { ...i, status: 'cancelled' as const } : i
    ));
    toast({
      title: 'Item cancelled',
      description: `${item.name} has been cancelled.`,
    });
  };

  const handleView = (item: FoundItem) => {
    setSelectedItem(item);
    setShowDetails(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <Logo size="sm" />
            <Badge variant="secondary" className="hidden sm:flex">
              Admin Dashboard
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">{currentOffice.name}</span>
          </div>
        </div>
      </header>

      {/* Stats Banner */}
      <section className="border-b border-border/50 bg-muted/30">
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-none bg-transparent">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Items</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-none bg-transparent">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Clock className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.available}</p>
                  <p className="text-xs text-muted-foreground">Available</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-none bg-transparent">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <CheckCircle className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.claimed}</p>
                  <p className="text-xs text-muted-foreground">Claimed</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-none bg-transparent">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <XCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.cancelled}</p>
                  <p className="text-xs text-muted-foreground">Cancelled</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="inventory" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Grid3X3 className="w-4 h-4" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="add" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Item
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] bg-background">
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
                  <SelectTrigger className="w-[130px] bg-background">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="claimed">Claimed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[120px] bg-background">
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

            {/* Items Grid */}
            {filteredItems.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <AdminItemCard
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onClose={handleClose}
                    onCancel={handleCancel}
                    onView={handleView}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-muted/30 rounded-xl">
                <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-display font-semibold text-lg mb-2">No items found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your filters.'
                    : 'Add your first item to get started.'}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="add">
            <div className="max-w-lg mx-auto">
              <UploadItemForm onSubmit={handleAddItem} />
            </div>
          </TabsContent>
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
                  <p className="text-sm">{selectedItem.description}</p>
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
                </div>
                <div className="flex gap-2 pt-4">
                  {selectedItem.status === 'available' && (
                    <>
                      <Button variant="success" className="flex-1" onClick={() => {
                        handleClose(selectedItem);
                        setShowDetails(false);
                      }}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark as Claimed
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
