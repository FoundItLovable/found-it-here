import { FoundItem, categoryIcons, categoryLabels } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar, MoreVertical, Edit, CheckCircle, XCircle, Eye } from 'lucide-react';

interface AdminItemCardProps {
  item: FoundItem;
  onEdit: (item: FoundItem) => void;
  onClose: (item: FoundItem) => void;
  onCancel: (item: FoundItem) => void;
  onView: (item: FoundItem) => void;
}

export function AdminItemCard({ item, onEdit, onClose, onCancel, onView }: AdminItemCardProps) {
  const statusStyles = {
    available: 'bg-primary/15 text-primary border-primary/30',
    claimed: 'bg-muted text-muted-foreground border-border',
    cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
  };

  return (
    <Card className="overflow-hidden border-border/50 bg-card hover:border-primary/40 transition-all duration-200 group">
      <CardContent className="p-0">
        <div className="flex gap-3">
          {/* Image */}
          <div className="relative w-20 h-20 flex-shrink-0 bg-muted rounded-lg overflow-hidden m-3">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl text-muted-foreground">
                {categoryIcons[item.category]}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 py-3 pr-3 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
              </div>
              <Badge variant="outline" className={`${statusStyles[item.status]} flex-shrink-0 text-xs capitalize`}>
                {item.status}
              </Badge>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-xs bg-secondary/80">
                  {categoryLabels[item.category]}
                </Badge>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(item.dateFound).toLocaleDateString()}
                </span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onView(item)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(item)} disabled={item.status !== 'available'}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onClose(item)} disabled={item.status !== 'available'} className="text-primary">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark as Claimed
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCancel(item)} disabled={item.status !== 'available'} className="text-destructive">
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel
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
