import { useEffect, useState } from "react";
import type { FoundItem, ItemCategory } from "@/types";
import { categoryLabels } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Save, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type EditFormState = {
  name: string;
  description: string;
  category: ItemCategory;
  color: string;
  brand: string;
  foundLocation: string;
  foundDate: string;
  showInPublicCatalog: boolean;
};

interface EditItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FoundItem | null;
  onSubmit: (data: EditFormState) => Promise<void>;
  submitting?: boolean;
}

const blankState = (): EditFormState => ({
  name: "",
  description: "",
  category: "other",
  color: "",
  brand: "",
  foundLocation: "",
  foundDate: new Date().toISOString().slice(0, 10),
  showInPublicCatalog: true,
});

export function EditItemModal({ open, onOpenChange, item, onSubmit, submitting = false }: EditItemModalProps) {
  const [form, setForm] = useState<EditFormState>(blankState);

  useEffect(() => {
    if (!open || !item) return;
    setForm({
      name: item.name ?? "",
      description: item.description ?? "",
      category: (item.category as ItemCategory) ?? "other",
      color: item.color ?? "",
      brand: item.brand ?? "",
      foundLocation: item.foundLocation ?? "",
      foundDate: item.dateFound ? String(item.dateFound).slice(0, 10) : new Date().toISOString().slice(0, 10),
      showInPublicCatalog: item.showInPublicCatalog !== false,
    });
  }, [open, item]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.foundLocation.trim() || !form.foundDate.trim()) {
      toast({
        title: "Missing information",
        description: "Item name, description, found location, and found date are required.",
        variant: "destructive",
      });
      return;
    }
    await onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Edit Found Item</DialogTitle>
          <DialogDescription>Update item details and save changes.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm font-medium">Item Name *</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="bg-background border-border/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category" className="text-sm font-medium">Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v as ItemCategory }))}>
                <SelectTrigger id="edit-category" className="bg-background border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-description" className="text-sm font-medium">Description *</Label>
              <Textarea
                id="edit-description"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                className="bg-background border-border/50 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-color" className="text-sm font-medium">Color</Label>
              <Input
                id="edit-color"
                value={form.color}
                onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                className="bg-background border-border/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-brand" className="text-sm font-medium">Brand</Label>
              <Input
                id="edit-brand"
                value={form.brand}
                onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                className="bg-background border-border/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-found-location" className="text-sm font-medium">Found Location *</Label>
              <Input
                id="edit-found-location"
                value={form.foundLocation}
                onChange={(e) => setForm((p) => ({ ...p, foundLocation: e.target.value }))}
                className="bg-background border-border/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-found-date" className="text-sm font-medium">Found Date *</Label>
              <Input
                id="edit-found-date"
                type="date"
                value={form.foundDate}
                onChange={(e) => setForm((p) => ({ ...p, foundDate: e.target.value }))}
                className="bg-background border-border/50"
              />
            </div>

            <div className="col-span-2 flex items-center justify-between rounded-lg border border-border/50 p-4 bg-muted/20">
              <div>
                <Label htmlFor="edit-showInPublicCatalog" className="text-sm font-medium">Show in public catalog</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  When off, item is hidden from browse/search but still appears in lost-item matching.
                </p>
              </div>
              <Switch
                id="edit-showInPublicCatalog"
                checked={form.showInPublicCatalog}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, showInPublicCatalog: !!checked }))}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
