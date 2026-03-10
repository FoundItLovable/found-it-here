import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { FoundItem } from '@/types';
import { AdminItemCard } from './AdminItemCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package } from 'lucide-react';

// CU Boulder approximate center
const DEFAULT_CENTER: [number, number] = [40.0076, -105.2669];
const DEFAULT_ZOOM = 15;

// Sleek CartoDB Positron - clean, minimal, no street labels clutter
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Custom green marker matching FoundIt brand (lime green)
function createMarkerIcon() {
  return L.divIcon({
    className: 'foundit-marker',
    html: `
      <div class="w-4 h-4 rounded-full bg-primary shadow-md border-2 border-white transform -translate-x-1/2 -translate-y-1/2"
           style="background-color: hsl(82, 85%, 45%); box-shadow: 0 2px 8px rgba(0,0,0,0.2);"></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function MapBoundsSync({
  items,
  onBoundsChange,
}: {
  items: FoundItem[];
  onBoundsChange: (bounds: L.LatLngBounds | null) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const updateBounds = () => {
      onBoundsChange(map.getBounds());
    };
    updateBounds();
    map.on('moveend', updateBounds);
    map.on('zoomend', updateBounds);
    return () => {
      map.off('moveend', updateBounds);
      map.off('zoomend', updateBounds);
    };
  }, [map, onBoundsChange]);

  return null;
}

interface InventoryMapViewProps {
  items: FoundItem[];
  onEdit: (item: FoundItem) => void;
  onClose: (item: FoundItem) => void;
  onCancel: (item: FoundItem) => void;
  onView: (item: FoundItem) => void;
  onToggleCatalogVisibility: (item: FoundItem) => void;
}

export function InventoryMapView({
  items,
  onEdit,
  onClose,
  onCancel,
  onView,
  onToggleCatalogVisibility,
}: InventoryMapViewProps) {
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const markerIcon = useMemo(() => createMarkerIcon(), []);

  const itemsWithCoords = useMemo(
    () =>
      items.filter(
        (i) =>
          i.latitude != null &&
          i.longitude != null &&
          Number.isFinite(i.latitude) &&
          Number.isFinite(i.longitude)
      ),
    [items]
  );

  // Filter list by visible bounds when map has loaded
  const visibleItems = useMemo(() => {
    if (!bounds || itemsWithCoords.length === 0) return itemsWithCoords;
    return itemsWithCoords.filter((item) => {
      const lat = item.latitude!;
      const lng = item.longitude!;
      return bounds.contains([lat, lng]);
    });
  }, [bounds, itemsWithCoords]);

  const displayList = visibleItems.length > 0 ? visibleItems : itemsWithCoords;

  if (itemsWithCoords.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
        <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="font-display font-semibold text-lg text-foreground mb-2">
          {items.length === 0 ? 'No items found' : 'No items with locations yet'}
        </h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          {items.length === 0
            ? 'Try adjusting your filters or add new items.'
            : 'Items need latitude and longitude to appear on the map. Add new items and use the map pin picker to set their location.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col lg:flex-row lg:flex-nowrap gap-0 rounded-xl overflow-hidden border border-border/50 bg-card shadow-sm h-[calc(100vh-320px)] min-h-[480px]">
      {/* Map - 60% on desktop */}
      <div className="w-full min-w-0 h-64 lg:h-full lg:flex-none lg:basis-[60%] lg:max-w-[60%] relative">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          className="w-full h-full rounded-t-xl lg:rounded-l-xl lg:rounded-tr-none z-0"
          scrollWheelZoom
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <MapBoundsSync items={itemsWithCoords} onBoundsChange={setBounds} />

          {itemsWithCoords.map((item) => (
            <Marker
              key={item.id}
              position={[item.latitude!, item.longitude!]}
              icon={markerIcon}
              eventHandlers={{
                click: () => setSelectedId(item.id),
              }}
            >
              <Popup>
                <div className="text-sm font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground">{item.foundLocation ?? item.officeLocation}</div>
                <button
                  type="button"
                  className="mt-2 text-xs text-primary hover:underline"
                  onClick={() => onView(item)}
                >
                  View details
                </button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* List - 40% on desktop */}
      <div className="w-full min-w-0 overflow-hidden flex flex-col border-t lg:border-t-0 lg:border-l border-border/50 bg-background lg:flex-none lg:basis-[40%] lg:max-w-[40%]">
        <div className="px-4 py-3 border-b border-border/50">
          <p className="text-sm text-muted-foreground">
            {displayList.length} item{displayList.length !== 1 ? 's' : ''} in view
          </p>
        </div>
        <ScrollArea className="flex-1 min-w-0 overflow-x-hidden">
          <div className="w-full min-w-0 p-4 space-y-3">
            {displayList.map((item) => (
              <div
                key={item.id}
                className={`w-full min-w-0 ${selectedId === item.id ? 'ring-2 ring-primary rounded-xl' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <AdminItemCard
                  item={item}
                  onEdit={onEdit}
                  onClose={onClose}
                  onCancel={onCancel}
                  onView={onView}
                  onToggleCatalogVisibility={onToggleCatalogVisibility}
                  compact
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
