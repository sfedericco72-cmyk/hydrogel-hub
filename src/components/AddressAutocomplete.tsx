/// <reference types="google.maps" />
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

type GoogleLocationLike = {
  lat?: number | (() => number);
  lng?: number | (() => number);
} | null | undefined;

type GooglePlace = {
  fetchFields: (request: { fields: string[] }) => Promise<void>;
  formattedAddress?: string;
  location?: GoogleLocationLike;
};

type GooglePlacePrediction = {
  placeId: string;
  text?: { text: string };
  mainText?: { text: string };
  secondaryText?: { text: string };
  toPlace: () => GooglePlace;
};

type GoogleAutocompleteSuggestion = {
  placePrediction?: GooglePlacePrediction;
};

type PlacesLibraryWithAutocomplete = {
  AutocompleteSuggestion?: {
    fetchAutocompleteSuggestions: (request: {
      input: string;
      inputOffset?: number;
      language?: string;
      region?: string;
      includedRegionCodes?: string[];
      sessionToken?: unknown;
    }) => Promise<{ suggestions: GoogleAutocompleteSuggestion[] }>;
  };
  AutocompleteSessionToken?: new () => unknown;
};

type SuggestionItem = {
  id: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  placePrediction: GooglePlacePrediction;
};

let googleMapsLoaded = false;
let googleMapsLoadPromise: Promise<void> | null = null;

function loadGoogleMapsScript(): Promise<void> {
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("No API key"));
  }

  if (googleMapsLoaded && window.google?.maps?.importLibrary) {
    return Promise.resolve();
  }

  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise;
  }

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const finishLoad = async () => {
      try {
        if (!window.google?.maps?.importLibrary) {
          throw new Error("Google Maps library unavailable");
        }
        await google.maps.importLibrary("places");
        googleMapsLoaded = true;
        resolve();
      } catch (error) {
        googleMapsLoadPromise = null;
        reject(error);
      }
    };

    if (window.google?.maps?.importLibrary) {
      void finishLoad();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => void finishLoad(), { once: true });
      existingScript.addEventListener(
        "error",
        () => {
          googleMapsLoadPromise = null;
          reject(new Error("Failed to load Google Maps"));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => void finishLoad();
    script.onerror = () => {
      googleMapsLoadPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

async function getPlacesLibrary(): Promise<PlacesLibraryWithAutocomplete> {
  await loadGoogleMapsScript();
  return (await google.maps.importLibrary("places")) as unknown as PlacesLibraryWithAutocomplete;
}

function readCoordinate(location: GoogleLocationLike, axis: "lat" | "lng"): number | null {
  const value = location?.[axis];

  if (typeof value === "function") {
    return value();
  }

  return typeof value === "number" ? value : null;
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
  const sessionTokenRef = useRef<unknown>(null);
  const skipNextLookupRef = useRef(false);
  const [apiStatus, setApiStatus] = useState<"loading" | "ready" | "fallback">(
    GOOGLE_MAPS_API_KEY ? "loading" : "fallback",
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setApiStatus("fallback");
      return;
    }

    let cancelled = false;

    loadGoogleMapsScript()
      .then(() => {
        if (!cancelled) setApiStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setApiStatus("fallback");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (skipNextLookupRef.current) {
      skipNextLookupRef.current = false;
      return;
    }

    if (apiStatus !== "ready") {
      return;
    }

    const query = value.trim();
    const currentRequestId = ++requestIdRef.current;

    if (!query) {
      sessionTokenRef.current = null;
      setSuggestions([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setIsOpen(false);

      try {
        const placesLibrary = await getPlacesLibrary();

        if (!placesLibrary.AutocompleteSuggestion || !placesLibrary.AutocompleteSessionToken) {
          throw new Error("Google Places Autocomplete API unavailable");
        }

        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLibrary.AutocompleteSessionToken();
        }

        const response = await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          inputOffset: value.length,
          language: "es",
          region: "cl",
          includedRegionCodes: ["cl"],
          sessionToken: sessionTokenRef.current,
        });

        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        const nextSuggestions = (response.suggestions || [])
          .map((item) => item.placePrediction)
          .filter((prediction): prediction is GooglePlacePrediction => Boolean(prediction))
          .map((prediction) => {
            const mainText = prediction.mainText?.text || prediction.text?.text || "";
            const secondaryText = prediction.secondaryText?.text || "";
            return {
              id: prediction.placeId,
              mainText,
              secondaryText,
              fullText:
                prediction.text?.text || [mainText, secondaryText].filter(Boolean).join(", "),
              placePrediction: prediction,
            };
          });

        setSuggestions(nextSuggestions);
        setIsOpen(nextSuggestions.length > 0);
      } catch (error) {
        console.error("Google Places autocomplete failed", error);

        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        setSuggestions([]);
        setIsOpen(false);
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [apiStatus, value]);

  const handleSelectSuggestion = async (suggestion: SuggestionItem) => {
    try {
      setIsSearching(true);
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "location"] });

      const result: AddressResult = {
        address: place.formattedAddress || suggestion.fullText,
        latitude: readCoordinate(place.location, "lat"),
        longitude: readCoordinate(place.location, "lng"),
      };

      skipNextLookupRef.current = true;
      sessionTokenRef.current = null;
      setSuggestions([]);
      setIsOpen(false);
      onChange(result.address);
      onSelect?.(result);
    } catch (error) {
      console.error("Failed to fetch selected place details", error);

      const fallbackResult: AddressResult = {
        address: suggestion.fullText,
        latitude: null,
        longitude: null,
      };

      skipNextLookupRef.current = true;
      sessionTokenRef.current = null;
      setSuggestions([]);
      setIsOpen(false);
      onChange(fallbackResult.address);
      onSelect?.(fallbackResult);
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
        aria-autocomplete={apiStatus === "ready" ? "list" : undefined}
        aria-expanded={apiStatus === "ready" ? isOpen : undefined}
        aria-controls={isOpen ? listId : undefined}
        className={cn(isSearching && "pr-10", className)}
      />

      {isSearching && apiStatus === "ready" && (
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {apiStatus === "ready" && isOpen && suggestions.length > 0 && (
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

      {apiStatus === "fallback" && (
        <p className="mt-1 text-xs text-muted-foreground">
          Podés pegar la dirección o coordenadas desde Google Maps
        </p>
      )}
    </div>
  );
}
