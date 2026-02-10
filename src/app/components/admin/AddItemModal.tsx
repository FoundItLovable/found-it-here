import { useEffect, useRef, useState } from 'react';
import { ItemCategory, categoryLabels } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Camera, X, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteImage, uploadImage } from '../../.././lib/database';
import { mapCategory } from '../../data/categoryMap';

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<{
    name: string;
    description: string;
    category: ItemCategory;
    imageUrl?: string;
    foundLocation?: string;
    color?: string;
    brand?: string;
    foundDate?: string;
    highValue?: boolean;
  }>;
  onSubmit: (data: {
    name: string;
    description: string;
    category: ItemCategory;
    imageUrl?: string;
    foundLocation?: string;
    color?: string;
    brand?: string;
    foundDate?: string;
    highValue?: boolean;
  }) => Promise<void> | void;
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

const initialFormState = () => ({
  name: '',
  description: '',
  category: 'other' as ItemCategory,
  imageUrl: '',
  imagePreview: null as string | null,
  foundLocation: '',
  color: '',
  brand: '',
  foundDate: new Date().toISOString().slice(0, 10),
  highValue: false,
});

export function AddItemModal({ open, onOpenChange, onSubmit, initialData }: AddItemModalProps) {
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState(initialFormState);

  const cleanupUploadedImage = async (url: string) => {
    if (!url) return;
    try {
      await deleteImage(url);
    } catch (err) {
      console.error('Failed to delete uploaded image:', err);
    }
  };

  // (initialData is synced into form when modal opens further below)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file type', description: 'Please select an image file (PNG, JPG, etc.)', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please select an image under 10MB', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => setFormData((p) => ({ ...p, imagePreview: event.target?.result as string }));
    reader.readAsDataURL(file);
    setUploading(true);
    try {
      const previousImageUrl = formData.imageUrl;
      const url = await uploadImage(file);
      setFormData((p) => ({ ...p, imageUrl: url }));
      toast({ title: 'Image uploaded', description: 'Your image has been uploaded successfully.' });
      console.log('Uploaded image URL:', url);
      toast({ title: 'Analyzing image', description: 'AI analysis in progress...'});
      if (previousImageUrl && previousImageUrl !== url) {
        void cleanupUploadedImage(previousImageUrl);
      }

      // Call server analyze endpoint to auto-fill fields (non-blocking)
      try {
        // Also send the file bytes to the server so the model can analyze the actual image
        const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => {
            const s = r.result as string;
            const idx = s.indexOf(',');
            resolve(idx >= 0 ? s.slice(idx + 1) : s);
          };
          r.onerror = reject;
          r.readAsDataURL(f);
        });

        const base64 = await toBase64(file);
        const resp = await fetch('/api/gemini/analyze-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, mimeType: file.type, base64 }),
        });
        if (resp.ok) {
          const data = await resp.json();
          setFormData((prev) => {
            const next = { ...prev };
            if (!prev.name?.trim() && data.name) next.name = data.name;
            if (!prev.description?.trim() && data.description) next.description = data.description;
            if ((!prev.category || prev.category === 'other') && data.category) {
              const mapped = mapCategory(data.category);
              if (mapped) next.category = mapped as ItemCategory;
              else next.category = (data.category as ItemCategory) ?? prev.category;
            }
            if (!prev.color?.trim() && data.color) next.color = normalizeColorList(data.color);
            if (!prev.brand?.trim() && data.brand) next.brand = data.brand;
            if (!prev.foundLocation?.trim() && data.foundLocation) next.foundLocation = data.foundLocation;
            if (!prev.foundDate?.trim() && data.foundDate && /^\d{4}-\d{2}-\d{2}$/.test(data.foundDate)) next.foundDate = data.foundDate;
            if (data.highValue === true) next.highValue = true;
            return next;
          });
          toast({ title: 'AI analysis applied', description: 'Fields were pre-filled. Please verify before submitting.' });
        } else {
          console.warn('AI analyze returned non-OK', resp.status);
        }
      } catch (err) {
        console.error('AI analyze error:', err);
        toast({ title: 'AI analysis failed', description: 'Could not parse the image. You can fill fields manually.', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error(err);
      setFormData((p) => ({ ...p, imagePreview: null }));
      toast({ title: 'Upload failed', description: err?.message ?? 'Could not upload image. You can still proceed.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    const imageUrlToDelete = formData.imageUrl;
    setFormData((p) => ({ ...p, imageUrl: '', imagePreview: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageUrlToDelete) void cleanupUploadedImage(imageUrlToDelete);
  };

  const handleNext = () => {
    if (step === 2) {
      if (!formData.name.trim() || !formData.description.trim()) {
        toast({ title: 'Missing information', description: 'Please fill in item name and description.', variant: 'destructive' });
        return;
      }
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleFinalSubmit = async () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      toast({ title: 'Missing information', description: 'Please fill in required fields.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const cleanedColor = normalizeColorList(formData.color);
      await onSubmit({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        imageUrl: formData.imageUrl || undefined,
        foundLocation: formData.foundLocation || undefined,
        color: cleanedColor || undefined,
        brand: formData.brand || undefined,
        foundDate: formData.foundDate,
        highValue: formData.highValue,
      });
      handleOpenChange(false, { keepImage: true });
    } catch (e) {
      // parent handles errors
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (v: boolean, options?: { keepImage?: boolean }) => {
    if (!v) {
      const imageUrlToDelete = options?.keepImage ? '' : formData.imageUrl;
      setFormData(initialFormState());
      setStep(1);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (imageUrlToDelete) void cleanupUploadedImage(imageUrlToDelete);
    }
    onOpenChange(v);
  };

  // sync initialData into form only when modal opens / initialData changes
  useEffect(() => {
    if (!open || !initialData) return;
    setFormData((prev) => ({
      ...prev,
      name: initialData.name ?? prev.name,
      description: initialData.description ?? prev.description,
      category: (initialData.category as ItemCategory) ?? prev.category,
      imageUrl: initialData.imageUrl ?? prev.imageUrl,
      imagePreview: initialData.imageUrl ?? prev.imagePreview,
      foundLocation: initialData.foundLocation ?? prev.foundLocation,
      color: initialData.color ?? prev.color,
      brand: initialData.brand ?? prev.brand,
      foundDate: initialData.foundDate ?? prev.foundDate,
      highValue: initialData.highValue ?? prev.highValue,
    }));
  }, [open, initialData]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add Found Item</DialogTitle>
          <DialogDescription>Step {step} of 3 - {step === 1 ? 'Upload Photo' : step === 2 ? 'Item Details' : 'Review'}</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <Label className="text-sm font-medium">Item Photo</Label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            {formData.imagePreview ? (
              <div className="relative rounded-lg overflow-hidden w-full aspect-square bg-muted">
                <img src={formData.imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={handleRemoveImage} disabled={uploading}>
                  <X className="w-4 h-4" />
                </Button>
                {uploading && <div className="absolute inset-0 bg-background/80 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/20 aspect-square flex flex-col items-center justify-center">
                <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button onClick={handleNext}>{formData.imagePreview ? 'Continue' : 'Skip'} <ChevronRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Item Name *</Label>
                <Input id="name" placeholder="e.g., Black iPhone" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} className="bg-background border-border/50" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData((p) => ({ ...p, category: v as ItemCategory }))}>
                  <SelectTrigger className="bg-background border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(categoryLabels).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="description" className="text-sm font-medium">Description *</Label>
                <Textarea id="description" placeholder="Describe the item in detail..." value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} rows={3} className="bg-background border-border/50 resize-none" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color" className="text-sm font-medium">Color</Label>
                <Input id="color" placeholder="e.g., Black" value={formData.color} onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))} className="bg-background border-border/50" />
                <p className="text-xs text-muted-foreground">
                  Enter multiple colors as a comma-separated list with no spaces (example: black,silver,blue).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand" className="text-sm font-medium">Brand</Label>
                <Input id="brand" placeholder="e.g., Apple" value={formData.brand} onChange={(e) => setFormData((p) => ({ ...p, brand: e.target.value }))} className="bg-background border-border/50" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="foundLocation" className="text-sm font-medium">Found Location</Label>
                <Input id="foundLocation" placeholder="e.g., Main entrance" value={formData.foundLocation} onChange={(e) => setFormData((p) => ({ ...p, foundLocation: e.target.value }))} className="bg-background border-border/50" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="foundDate" className="text-sm font-medium">Found Date</Label>
                <Input id="foundDate" type="date" value={formData.foundDate} onChange={(e) => setFormData((p) => ({ ...p, foundDate: e.target.value }))} className="bg-background border-border/50" />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={handleBack}><ChevronLeft className="w-4 h-4 mr-2" />Back</Button>
              <Button onClick={handleNext}>Continue<ChevronRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              <div className="flex items-start gap-3">
                <Checkbox id="highValue" checked={formData.highValue} onCheckedChange={(checked) => setFormData((p) => ({ ...p, highValue: checked as boolean }))} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="highValue" className="font-medium cursor-pointer">Mark as High Value / Personal Information</Label>
                  <p className="text-sm text-muted-foreground mt-1">Check this box if the item contains sensitive information or has significant monetary value. This will flag it for special handling.</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-4 border border-border/50">
              <h4 className="font-semibold text-sm mb-3">Summary</h4>
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{formData.name}</span></div>
                <div><span className="text-muted-foreground">Category:</span> <span className="font-medium">{categoryLabels[formData.category]}</span></div>
                {formData.imagePreview && <div><span className="text-muted-foreground">Photo:</span> <span className="font-medium">Yes</span></div>}
                {formData.highValue && <div><span className="text-destructive">🔴 High Value Item</span></div>}
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={handleBack} disabled={submitting}><ChevronLeft className="w-4 h-4 mr-2" />Back</Button>
              <Button onClick={handleFinalSubmit} disabled={submitting}>
                {submitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</>) : (<><Upload className="w-4 h-4 mr-2" />Add to Inventory</>)}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
