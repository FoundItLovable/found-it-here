import { FoundItem, categoryIcons, categoryLabels } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Calendar, MoreVertical, Eye, EyeOff, CheckCircle, Trash2 } from "lucide-react";

interface AdminItemCardProps {
  item: FoundItem;
  onEdit: (item: FoundItem) => void; // kept for compatibility (you can no-op it)
  onClose: (item: FoundItem) => void; // we’ll use this as “Mark Returned”
  onCancel: (item: FoundItem) => void; // we’ll use this as “Delete”
  onView: (item: FoundItem) => void; // kept for compatibility (you can no-op it)
  onToggleCatalogVisibility?: (item: FoundItem) => void;
}

export function AdminItemCard({ item, onEdit, onClose, onCancel, onView, onToggleCatalogVisibility }: AdminItemCardProps) {
  const statusStyles: Record<string, string> = {
    available: "bg-primary/15 text-primary border-primary/30",
    returned: "bg-muted text-muted-foreground border-border",
  };

  const badgeClass = statusStyles[item.status] ?? statusStyles.available;

  return (
    <Card className="overflow-hidden rounded-xl border-0 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200 ease-out group">
      <CardContent className="p-0">
        {/* Hero image - stretches across top half, edge-to-edge */}
        <div className="relative w-full aspect-[4/3] bg-muted/50 overflow-hidden">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/80 to-muted/40">
              <span className="text-4xl text-muted-foreground/70">{categoryIcons[item.category]}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {item.showInPublicCatalog === false && (
                <Badge variant="secondary" className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                  <EyeOff className="w-3 h-3 mr-0.5" />
                  Hidden
                </Badge>
              )}
              <Badge variant="outline" className={`${badgeClass} text-xs capitalize`}>
                {item.status}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs bg-secondary/80">
                {categoryLabels[item.category]}
              </Badge>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(item.dateFound).toLocaleDateString()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {item.status === "available" && onToggleCatalogVisibility && (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-muted-foreground hidden sm:inline">Catalog</span>
                  <Switch
                    checked={item.showInPublicCatalog !== false}
                    onCheckedChange={() => onToggleCatalogVisibility(item)}
                    className="scale-[0.7]"
                  />
                </div>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onView(item)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onClose(item)}
                    disabled={item.status !== "available"}
                    className="text-primary"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark Returned
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onCancel(item)}
                    disabled={item.status !== "available"}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
