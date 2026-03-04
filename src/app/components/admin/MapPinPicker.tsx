import { useCallback, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap &copy; CARTO';
const CU_BOULDER: [number, number] = [40.0076, -105.2669];

function createPinIcon() {
  return L.divIcon({
    className: 'map-pin-picker-icon',
    html: `
      <div style="
        width: 24px; height: 24px;
        border-radius: 50% 50% 50% 0;
        background: hsl(82, 85%, 45%);
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        transform: rotate(-45deg) translate(-50%, -100%);
      "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });
}

function MapClickHandler({
  onSelect,
}: {
  onSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'FoundIt/1.0 (Campus Lost & Found)' } }
    );
    const data = await res.json();
    return data?.display_name ?? null;
  } catch {
    return null;
  }
}

interface MapPinPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onSelect: (lat: number, lng: number, address?: string | null) => void;
  onClear?: () => void;
}

export function MapPinPicker({ latitude, longitude, onSelect, onClear }: MapPinPickerProps) {
  const [geocoding, setGeocoding] = useState(false);
  const pinIcon = useMemo(() => createPinIcon(), []);

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      setGeocoding(true);
      const address = await reverseGeocode(lat, lng);
      setGeocoding(false);
      onSelect(lat, lng, address);
    },
    [onSelect]
  );

  const hasPin = latitude != null && longitude != null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Pin location on map (optional)</span>
        {hasPin && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear pin
          </button>
        )}
      </div>
      <div className="rounded-lg overflow-hidden border border-border/50 h-48 bg-muted/30">
        <MapContainer
          center={hasPin ? [latitude!, longitude!] : CU_BOULDER}
          zoom={hasPin ? 17 : 15}
          className="w-full h-full"
          scrollWheelZoom
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <MapClickHandler onSelect={handleMapClick} />
          {hasPin && <Marker position={[latitude!, longitude!]} icon={pinIcon} />}
        </MapContainer>
      </div>
      {geocoding && <p className="text-xs text-muted-foreground">Looking up address...</p>}
      {hasPin && (
        <p className="text-xs text-muted-foreground">
          Coordinates: {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
        </p>
      )}
    </div>
  );
}
