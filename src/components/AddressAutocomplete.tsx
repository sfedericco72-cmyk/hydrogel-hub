import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
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

interface PlaceSuggestion {
  id: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  placeId: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Dirección o coordenadas de Google Maps",
  className,
  maxLength = 500,
}: AddressAutocompleteProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const skipNextLookupRef = useRef(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [apiAvailable, setApiAvailable] = useState(!!GOOGLE_MAPS_API_KEY);

  // Close dropdown on outside click
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  // Fetch suggestions via REST API
  useEffect(() => {
    if (skipNextLookupRef.current) {
      skipNextLookupRef.current = false;
      return;
    }

    if (!apiAvailable) return;

    const query = value.trim();
    const currentRequestId = ++requestIdRef.current;

    if (!query || query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);

      try {
        const response = await fetch(
          "https://places.googleapis.com/v1/places:autocomplete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY!,
            },
            body: JSON.stringify({
              input: query,
              languageCode: "es",
              regionCode: "cl",
              includedRegionCodes: ["cl"],
            }),
          },
        );

        if (currentRequestId !== requestIdRef.current) return;

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          console.error("Places API error:", response.status, errorData);
          if (response.status === 403 || response.status === 400) {
            setApiAvailable(false);
          }
          setSuggestions([]);
          setIsOpen(false);
          return;
        }

        const data = await response.json();

        if (currentRequestId !== requestIdRef.current) return;

        const nextSuggestions: PlaceSuggestion[] = (data.suggestions || [])
          .map((s: any) => s.placePrediction)
          .filter(Boolean)
          .map((p: any) => ({
            id: p.placeId || p.place,
            placeId: p.placeId || p.place?.replace("places/", ""),
            mainText: p.structuredFormat?.mainText?.text || p.text?.text || "",
            secondaryText: p.structuredFormat?.secondaryText?.text || "",
            fullText: p.text?.text || "",
          }));

        setSuggestions(nextSuggestions);
        setIsOpen(nextSuggestions.length > 0);
      } catch (error) {
        console.error("Places autocomplete failed:", error);
        if (currentRequestId === requestIdRef.current) {
          setSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [apiAvailable, value]);

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    try {
      setIsSearching(true);

      // Fetch place details via REST to get coordinates
      const placeId = suggestion.placeId.startsWith("places/")
        ? suggestion.placeId
        : `places/${suggestion.placeId}`;

      const response = await fetch(
        `https://places.googleapis.com/v1/${placeId}?fields=formattedAddress,location`,
        {
          headers: {
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY!,
          },
        },
      );

      let result: AddressResult;

      if (response.ok) {
        const data = await response.json();
        result = {
          address: data.formattedAddress || suggestion.fullText,
          latitude: data.location?.latitude ?? null,
          longitude: data.location?.longitude ?? null,
        };
      } else {
        result = {
          address: suggestion.fullText,
          latitude: null,
          longitude: null,
        };
      }

      skipNextLookupRef.current = true;
      setSuggestions([]);
      setIsOpen(false);
      onChange(result.address);
      onSelect?.(result);
    } catch (error) {
      console.error("Failed to fetch place details:", error);
      skipNextLookupRef.current = true;
      setSuggestions([]);
      setIsOpen(false);
      onChange(suggestion.fullText);
      onSelect?.({
        address: suggestion.fullText,
        latitude: null,
        longitude: null,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (e.key === "Enter" && isOpen && suggestions[0]) {
      e.preventDefault();
      void handleSelectSuggestion(suggestions[0]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={handleChange}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete={apiAvailable ? "list" : undefined}
        aria-expanded={apiAvailable ? isOpen : undefined}
        aria-controls={isOpen ? listId : undefined}
        className={cn(isSearching && "pr-10", className)}
      />

      {isSearching && apiAvailable && (
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {apiAvailable && isOpen && suggestions.length > 0 && (
        <div
          id={listId}
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg"
        >
          <ul className="max-h-72 overflow-y-auto py-1">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void handleSelectSuggestion(suggestion)}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{suggestion.mainText}</span>
                    {suggestion.secondaryText && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {suggestion.secondaryText}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!apiAvailable && (
        <p className="mt-1 text-xs text-muted-foreground">
          Podés pegar la dirección o coordenadas desde Google Maps
        </p>
      )}
    </div>
  );
}
