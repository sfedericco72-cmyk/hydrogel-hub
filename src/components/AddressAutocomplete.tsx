/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  "AIzaSyC41pE7_0Lw73Hy2Ruj8qmYGSlvYbk1_5c";

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
  const onSelectRef = useRef(onSelect);
  const onChangeRef = useRef(onChange);

  // Keep refs in sync to avoid re-creating autocomplete listener
  useEffect(() => {
    onSelectRef.current = onSelect;
    onChangeRef.current = onChange;
  });

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

      onChangeRef.current(result.address);
      onSelectRef.current?.(result);
    });

    autocompleteRef.current = autocomplete;
  }, [apiAvailable]);

  // Always keep as controlled input — Google Autocomplete writes to the DOM
  // directly, so we sync on every change event as well.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleChange}
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
