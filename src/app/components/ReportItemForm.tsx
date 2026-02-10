import { useState } from 'react';
import { ItemCategory, categoryLabels } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReportItemFormProps {
  onSubmit: (data: {
    name: string;
    description: string;
    category: ItemCategory;
    dateLost: string;
    locationLost: string;
    color?: string;
    brand?: string;
  }) => void;
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
  ).join(",");

export function ReportItemForm({ onSubmit }: ReportItemFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ItemCategory>('other');
  const [dateLost, setDateLost] = useState('');
  const [locationLost, setLocationLost] = useState('');
  const [color, setColor] = useState('');
  const [brand, setBrand] = useState('');
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !description.trim() || !dateLost || !locationLost.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const cleanedColor = normalizeColorList(color);
    onSubmit({ name, description, category, dateLost, locationLost, color: cleanedColor || undefined, brand: brand.trim() || undefined });

    // Reset form
    setName('');
    setDescription('');
    setCategory('other');
    setDateLost('');
    setLocationLost('');
    setColor('');
    setBrand('');

    toast({
      title: 'Item reported!',
      description: "We'll search our database and notify you of any matches.",
    });
  };

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="space-y-2 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-foreground">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="font-display text-xl">Report Lost Item</CardTitle>
            <CardDescription className="text-muted-foreground">
              Describe what you lost
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">Item Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Blue iPhone 14"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background border-border/50 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium">Category *</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ItemCategory)}>
              <SelectTrigger className="bg-background border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe any identifying features, case, stickers, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-background border-border/50 focus:border-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="color" className="text-sm font-medium">Color</Label>
              <Input
                id="color"
                placeholder="e.g., black,silver"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="bg-background border-border/50 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand" className="text-sm font-medium">Brand</Label>
              <Input
                id="brand"
                placeholder="e.g., Apple, Nike"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="bg-background border-border/50 focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dateLost" className="text-sm font-medium">Date Lost *</Label>
              <Input
                id="dateLost"
                type="date"
                value={dateLost}
                onChange={(e) => setDateLost(e.target.value)}
                className="bg-background border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationLost" className="text-sm font-medium">Location *</Label>
              <Input
                id="locationLost"
                placeholder="e.g., Library"
                value={locationLost}
                onChange={(e) => setLocationLost(e.target.value)}
                className="bg-background border-border/50"
              />
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full mt-2">
            <Search className="w-4 h-4" />
            Search for Matches
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
