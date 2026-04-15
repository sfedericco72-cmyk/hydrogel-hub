import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

interface AddressResult {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (result: AddressResult) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
}

let googleMapsLoaded = false;
let googleMapsLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadGoogleMapsScript(): Promise<void> {
  if (googleMapsLoaded) return Promise.resolve();
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error("No API key"));

  return new Promise((resolve, reject) => {
    if (googleMapsLoading) {
      loadCallbacks.push(resolve);
      return;
    }
    googleMapsLoading = true;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => {
      googleMapsLoaded = true;
      googleMapsLoading = false;
      resolve();
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    script.onerror = () => {
      googleMapsLoading = false;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Dirección o coordenadas de Google Maps",
  className,
  maxLength = 500,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [apiAvailable, setApiAvailable] = useState(false);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    loadGoogleMapsScript()
      .then(() => setApiAvailable(true))
      .catch(() => setApiAvailable(false));
  }, []);

  useEffect(() => {
    if (!apiAvailable || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;

      const result: AddressResult = {
        address: place.formatted_address || place.name || "",
        latitude: place.geometry.location.lat(),
        longitude: place.geometry.location.lng(),
      };

      onChange(result.address);
      onSelect?.(result);
    });

    autocompleteRef.current = autocomplete;
  }, [apiAvailable, onChange, onSelect]);

  // Fallback: plain input when API not available
  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={apiAvailable ? undefined : value}
        defaultValue={apiAvailable ? value : undefined}
        onChange={apiAvailable ? undefined : (e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cn(className)}
      />
      {!GOOGLE_MAPS_API_KEY && (
        <p className="text-xs text-muted-foreground mt-1">
          Podés pegar la dirección o coordenadas desde Google Maps
        </p>
      )}
    </div>
  );
}
