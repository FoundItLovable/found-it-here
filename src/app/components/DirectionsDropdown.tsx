import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Navigation } from "lucide-react";

function googleMapsUrl(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function appleMapsUrl(destination: string): string {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}`;
}

export function DirectionsDropdown({
  destination,
  className,
  buttonClassName,
  label = "Get Directions",
  size = "sm",
}: {
  destination: string;
  className?: string;
  buttonClassName?: string;
  label?: string;
  size?: "sm" | "default" | "lg" | "xl" | "icon";
}) {
  const trimmed = String(destination ?? "").trim();
  const disabled = !trimmed;

  const open = (url: string) => {
    // Mobile browsers will forward this to the native maps app if available.
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          size={size}
          className={cn("gap-2", buttonClassName)}
          disabled={disabled}
        >
          <Navigation className="w-4 h-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn("w-44", className)}>
        <DropdownMenuItem onClick={() => open(appleMapsUrl(trimmed))}>
          Apple Maps
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(googleMapsUrl(trimmed))}>
          Google Maps
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

