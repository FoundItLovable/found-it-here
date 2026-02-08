import { useState, useRef } from 'react';
import { ItemCategory, categoryLabels } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Camera, Plus, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadImage } from '../../../lib/database';

interface UploadItemFormProps {
  onSubmit: (data: {
    name: string;
    description: string;
    category: ItemCategory;
    imageUrl?: string;
    foundLocation?: string;
    color?: string;
    brand?: string;
    foundDate?: string;
  }) => void;
}

export function UploadItemForm({ onSubmit }: UploadItemFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ItemCategory>('other');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [foundLocation, setFoundLocation] = useState('');
  const [color, setColor] = useState('');
  const [brand, setBrand] = useState('');
  const [foundDate, setFoundDate] = useState(new Date().toISOString().slice(0, 10));
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file (PNG, JPG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 10MB',
        variant: 'destructive',
      });
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Supabase
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setImageUrl(url);
      toast({
        title: 'Image uploaded',
        description: 'Your image has been uploaded successfully.',
      });
    } catch (err: any) {
      console.error('Upload failed:', err);
      setImagePreview(null);
      toast({
        title: 'Upload failed',
        description: err?.message ?? 'Could not upload image. You can still add a URL manually.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !description.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    onSubmit({
      name,
      description,
      category,
      imageUrl: imageUrl || undefined,
      foundLocation: foundLocation || undefined,
      color: color || undefined,
      brand: brand || undefined,
      foundDate: foundDate || undefined
    });

    // Reset form
    setName('');
    setDescription('');
    setCategory('other');
    setImageUrl('');
    setImagePreview(null);
    setFoundLocation('');
    setColor('');
    setBrand('');
    setFoundDate(new Date().toISOString().slice(0, 10));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    toast({
      title: 'Item added!',
      description: 'The item has been added to your office inventory.',
    });
  };

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-foreground">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="font-display text-lg">Add Found Item</CardTitle>
            <CardDescription>
              Check in a new item to your office
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Item Photo</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-48 object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={handleRemoveImage}
                  disabled={uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
                {uploading && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/20"
              >
                <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG up to 10MB
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">Item Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Black iPhone with blue case"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium">Category</Label>
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
              placeholder="Describe the item in detail - color, brand, condition, any identifying features..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-background border-border/50 resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl" className="text-sm font-medium">Image URL (optional)</Label>
            <Input
              id="imageUrl"
              placeholder="https://... (or upload above)"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                if (e.target.value && !imagePreview) {
                  setImagePreview(e.target.value);
                }
              }}
              className="bg-background border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="foundLocation" className="text-sm font-medium">Found Location (optional)</Label>
            <Input
              id="foundLocation"
              placeholder="e.g., Main entrance, Room 101"
              value={foundLocation}
              onChange={(e) => setFoundLocation(e.target.value)}
              className="bg-background border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color" className="text-sm font-medium">Color (optional)</Label>
            <Input
              id="color"
              placeholder="e.g., Black, Blue"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="bg-background border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand" className="text-sm font-medium">Brand (optional)</Label>
            <Input
              id="brand"
              placeholder="e.g., Apple, Nike"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="bg-background border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="foundDate" className="text-sm font-medium">Found Date</Label>
            <Input
              id="foundDate"
              type="date"
              value={foundDate}
              onChange={(e) => setFoundDate(e.target.value)}
              className="bg-background border-border/50"
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={uploading}>
            <Upload className="w-4 h-4" />
            Add to Inventory
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
