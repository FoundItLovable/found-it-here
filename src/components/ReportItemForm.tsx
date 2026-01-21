import { useState } from 'react';
import { ItemCategory, categoryLabels } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReportItemFormProps {
  onSubmit: (data: {
    name: string;
    description: string;
    category: ItemCategory;
    dateLost: string;
    locationLost: string;
  }) => void;
}

export function ReportItemForm({ onSubmit }: ReportItemFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ItemCategory>('other');
  const [dateLost, setDateLost] = useState('');
  const [locationLost, setLocationLost] = useState('');
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

    onSubmit({ name, description, category, dateLost, locationLost });
    
    // Reset form
    setName('');
    setDescription('');
    setCategory('other');
    setDateLost('');
    setLocationLost('');

    toast({
      title: 'Item reported!',
      description: "We'll search our database and notify you of any matches.",
    });
  };

  return (
    <Card className="border-border/50 shadow-lg">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="font-display text-xl">Report Lost Item</CardTitle>
            <CardDescription>
              Describe your item and we'll search for matches
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Item Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Blue iPhone 14"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ItemCategory)}>
              <SelectTrigger className="bg-background">
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
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe any identifying features, case, stickers, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-background resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateLost">Date Lost *</Label>
              <Input
                id="dateLost"
                type="date"
                value={dateLost}
                onChange={(e) => setDateLost(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationLost">Location *</Label>
              <Input
                id="locationLost"
                placeholder="e.g., Library 2nd floor"
                value={locationLost}
                onChange={(e) => setLocationLost(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>

          <Button type="submit" variant="hero" size="lg" className="w-full">
            <Search className="w-5 h-5" />
            Search for Matches
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
