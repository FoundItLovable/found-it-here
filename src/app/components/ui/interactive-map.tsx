import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L, { type LatLngLiteral } from "leaflet";
import "leaflet/dist/leaflet.css";

import { cn } from "@/lib/utils";

// Fix for default markers in React-Leaflet builds.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const createCustomIcon = (color: "blue" | "red" | "green" | "orange" = "blue") =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

type MapMarker = {
  id: string;
  position: [number, number];
  color?: "blue" | "red" | "green" | "orange";
  popup?: {
    title: string;
    content?: string;
  };
};

function MapEvents({ onMapClick }: { onMapClick?: (latlng: LatLngLiteral) => void }) {
  useMapEvents({
    click: (e) => onMapClick?.(e.latlng),
  });
  return null;
}

function TopRightControls({
  onLocate,
  onToggleSatellite,
  satelliteOn,
}: {
  onLocate: () => void;
  onToggleSatellite: () => void;
  satelliteOn: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    const control = L.control({ position: "topright" });

    control.onAdd = () => {
      const div = L.DomUtil.create("div");
      div.className = "rounded-lg bg-white/90 backdrop-blur-md shadow-lg border border-black/10 p-2 flex gap-2";

      const locate = L.DomUtil.create("button", "", div);
      locate.type = "button";
      locate.textContent = "📍";
      locate.title = "Locate me";
      locate.className = "h-9 w-9 rounded-md border border-black/10 hover:bg-black/5";

      const sat = L.DomUtil.create("button", "", div);
      sat.type = "button";
      sat.textContent = "🛰️";
      sat.title = "Toggle satellite";
      sat.className = "h-9 w-9 rounded-md border border-black/10 hover:bg-black/5";

      L.DomEvent.disableClickPropagation(div);

      locate.onclick = () => onLocate();
      sat.onclick = () => onToggleSatellite();

      return div;
    };

    control.addTo(map);
    return () => {
      control.remove();
    };
  }, [map, onLocate, onToggleSatellite, satelliteOn]);

  return null;
}

export function AdvancedMap({
  center = [40.0076, -105.2659],
  zoom = 14,
  markers = [],
  className,
  style,
  enableClustering = true,
  enableControls = true,
  onMapClick,
}: {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  className?: string;
  style?: React.CSSProperties;
  enableClustering?: boolean;
  enableControls?: boolean;
  onMapClick?: (latlng: LatLngLiteral) => void;
}) {
  const [satelliteOn, setSatelliteOn] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => null,
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const tiles = useMemo(() => {
    if (satelliteOn) {
      return {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
      };
    }
    return {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    };
  }, [satelliteOn]);

  return (
    <div className={cn("advanced-map overflow-hidden rounded-2xl border border-white/10 shadow-xl", className)} style={style}>
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer attribution={tiles.attribution} url={tiles.url} />

        <MapEvents onMapClick={onMapClick} />

        {enableControls && (
          <TopRightControls
            onLocate={handleLocate}
            onToggleSatellite={() => setSatelliteOn((p) => !p)}
            satelliteOn={satelliteOn}
          />
        )}

        {enableClustering ? (
          <MarkerClusterGroup>
            {markers.map((m) => (
              <Marker key={m.id} position={m.position} icon={createCustomIcon(m.color ?? "blue")}>
                {m.popup && (
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-semibold">{m.popup.title}</div>
                      {m.popup.content && <div className="text-sm">{m.popup.content}</div>}
                    </div>
                  </Popup>
                )}
              </Marker>
            ))}
          </MarkerClusterGroup>
        ) : (
          markers.map((m) => (
            <Marker key={m.id} position={m.position} icon={createCustomIcon(m.color ?? "blue")}>
              {m.popup && (
                <Popup>
                  <div className="space-y-1">
                    <div className="font-semibold">{m.popup.title}</div>
                    {m.popup.content && <div className="text-sm">{m.popup.content}</div>}
                  </div>
                </Popup>
              )}
            </Marker>
          ))
        )}

        {userLocation && (
          <Marker position={userLocation} icon={createCustomIcon("red")}>
            <Popup>Your current location</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}

