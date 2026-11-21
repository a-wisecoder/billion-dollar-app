import { useCallback, useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  isGoogleMapsQuotaError,
  notifyGoogleMapsQuotaExceeded,
} from '../utils/mapsQuota';

export interface UsePlaceAutocompleteResult {
  readonly suggestions: google.maps.places.AutocompleteSuggestion[];
  readonly isLoading: boolean;
  readonly errorMessage: string | null;
  readonly resetSession: () => void;
}

/**
 * Programmatic Places API (New) Autocomplete hook using AutocompleteSuggestion
 * paired with AutocompleteSessionToken for cost-efficient session billing.
 * Docs: https://developers.google.com/maps/documentation/javascript/place-autocomplete-data?utm_campaign=gmp_mcp_codeassist_v1_aistudio
 */
export function usePlaceAutocomplete(
  inputString: string,
  locationBias?: google.maps.LatLngLiteral | null,
): UsePlaceAutocompleteResult {
  const placesLib = useMapsLibrary('places');

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(
    null,
  );
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = inputString.trim();
    if (!placesLib || trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }

        const request: google.maps.places.AutocompleteRequest = {
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          ...(locationBias
            ? {
                locationBias: {
                  center: locationBias,
                  radius: 15000,
                },
              }
            : {}),
        };

        const response =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

        if (!cancelled) {
          setSuggestions(response?.suggestions ?? []);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          if (isGoogleMapsQuotaError(err)) {
            notifyGoogleMapsQuotaExceeded();
          }
          setSuggestions([]);
          setIsLoading(false);
          setErrorMessage('Could not load place suggestions right now.');
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [placesLib, inputString, locationBias]);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
  }, []);

  return { suggestions, isLoading, errorMessage, resetSession };
}
