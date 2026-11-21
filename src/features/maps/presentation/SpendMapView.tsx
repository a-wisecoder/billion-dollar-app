import React, { useCallback, useMemo, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Building2,
  Coffee,
  Dumbbell,
  LocateFixed,
  MapPin,
  Plus,
  Search,
  TrainFront,
  X,
} from 'lucide-react';
import type { SubscriptionCategory } from '../../cashflow/domain/subscription';
import type { SubscriptionPrefillDraft } from '../../cashflow/presentation/SubscriptionEditorModal';
import { usePlaceAutocomplete } from '../hooks/usePlaceAutocomplete';
import {
  isGoogleMapsQuotaError,
  notifyGoogleMapsQuotaExceeded,
} from '../utils/mapsQuota';

interface DiscoveredPlace {
  readonly id: string;
  readonly displayName: string;
  readonly formattedAddress: string;
  readonly primaryTypeLabel: string;
  readonly location: google.maps.LatLngLiteral;
  readonly suggestedCategory: SubscriptionCategory;
}

interface SpendMapViewProps {
  readonly onTrackPlaceAsBill: (draft: SubscriptionPrefillDraft) => void;
}

interface NearbyCategoryConfig {
  readonly id: string;
  readonly label: string;
  readonly includedPrimaryTypes: readonly string[];
  readonly vaultCategory: SubscriptionCategory;
  readonly accentHex: string;
  readonly Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const NEARBY_CATEGORIES: readonly NearbyCategoryConfig[] = [
  {
    id: 'gym',
    label: 'Gyms & Fitness',
    includedPrimaryTypes: ['gym', 'fitness_center'],
    vaultCategory: 'health',
    accentHex: '#10B981',
    Icon: Dumbbell,
  },
  {
    id: 'cafe',
    label: 'Cafes & Passes',
    includedPrimaryTypes: ['cafe', 'coffee_shop'],
    vaultCategory: 'streaming',
    accentHex: '#EC4899',
    Icon: Coffee,
  },
  {
    id: 'workspace',
    label: 'Workspaces',
    includedPrimaryTypes: ['library', 'book_store'],
    vaultCategory: 'productivity',
    accentHex: '#06B6D4',
    Icon: Building2,
  },
  {
    id: 'transit',
    label: 'Transit & Utilities',
    includedPrimaryTypes: ['transit_station', 'train_station'],
    vaultCategory: 'utilities',
    accentHex: '#F59E0B',
    Icon: TrainFront,
  },
];

// Neutral starting viewport center (no pre-filled place pins or LLM-sourced data)
const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 37.7749, lng: -122.4194 };

function inferVaultCategory(typeLabel: string): SubscriptionCategory {
  const lower = typeLabel.toLowerCase();
  if (lower.includes('gym') || lower.includes('fitness') || lower.includes('health') || lower.includes('yoga')) {
    return 'health';
  }
  if (lower.includes('transit') || lower.includes('station') || lower.includes('telecom') || lower.includes('store')) {
    return 'utilities';
  }
  if (lower.includes('cafe') || lower.includes('coffee') || lower.includes('cinema') || lower.includes('theater')) {
    return 'streaming';
  }
  return 'productivity';
}

interface PlaceMarkerWithInfoProps {
  readonly place: DiscoveredPlace;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onClose: () => void;
  readonly onTrack: (place: DiscoveredPlace) => void;
}

const PlaceMarkerWithInfo: React.FC<PlaceMarkerWithInfoProps> = ({
  place,
  isSelected,
  onSelect,
  onClose,
  onTrack,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={place.location}
        title={place.displayName}
        onClick={onSelect}
      >
        <Pin
          background={isSelected ? '#1E6B58' : '#FFFFFF'}
          borderColor="#1E6B58"
          glyphColor={isSelected ? '#FFFFFF' : '#1E6B58'}
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={onClose} maxWidth={280}>
          <div className="p-1 text-[#17211E]">
            <p className="text-sm font-bold leading-snug">{place.displayName}</p>
            {place.primaryTypeLabel && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1E6B58] mt-0.5">
                {place.primaryTypeLabel}
              </p>
            )}
            {place.formattedAddress && (
              <p className="text-xs text-[#5B6662] mt-1 leading-relaxed">
                {place.formattedAddress}
              </p>
            )}
            <button
              type="button"
              onClick={() => onTrack(place)}
              className="mt-2.5 w-full min-h-[34px] px-3 py-1.5 rounded-lg bg-[#1E6B58] hover:bg-[#175747] text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Track as Bill</span>
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface MapExplorerInnerProps {
  readonly onTrackPlaceAsBill: (draft: SubscriptionPrefillDraft) => void;
}

const MapExplorerInner: React.FC<MapExplorerInnerProps> = ({ onTrackPlaceAsBill }) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');

  const [cameraCenter, setCameraCenter] = useState<google.maps.LatLngLiteral>(DEFAULT_CENTER);
  const [searchInput, setSearchInput] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [places, setPlaces] = useState<DiscoveredPlace[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { suggestions, isLoading: isAutocompleteLoading, errorMessage, resetSession } =
    usePlaceAutocomplete(searchInput, cameraCenter);

  const handleTrack = useCallback(
    (place: DiscoveredPlace) => {
      onTrackPlaceAsBill({
        name: place.displayName,
        category: place.suggestedCategory,
        notes: place.formattedAddress
          ? `Location: ${place.formattedAddress}`
          : place.primaryTypeLabel,
      });
    },
    [onTrackPlaceAsBill],
  );

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      const prediction = suggestion.placePrediction;
      if (!prediction) return;

      setDropdownOpen(false);
      setStatusMessage(null);
      setActiveCategoryId(null);

      try {
        // Places API (New): fetch only the required fields within the active autocomplete session
        const place = prediction.toPlace();
        await place.fetchFields({
          fields: [
            'displayName',
            'formattedAddress',
            'location',
            'viewport',
            'primaryTypeDisplayName',
          ],
        });
        resetSession();

        if (!place.location) {
          setStatusMessage('No map coordinates were returned for that place.');
          return;
        }

        const latLng: google.maps.LatLngLiteral = {
          lat: place.location.lat(),
          lng: place.location.lng(),
        };
        const displayName = place.displayName ?? prediction.text.text;
        const primaryTypeLabel = place.primaryTypeDisplayName ?? 'Local Merchant';

        const discovered: DiscoveredPlace = {
          id: place.id ?? `place_${Date.now()}`,
          displayName,
          formattedAddress: place.formattedAddress ?? '',
          primaryTypeLabel,
          location: latLng,
          suggestedCategory: inferVaultCategory(primaryTypeLabel),
        };

        setSearchInput(displayName);
        setPlaces((prev) => {
          const rest = prev.filter((item) => item.id !== discovered.id);
          return [discovered, ...rest];
        });
        setSelectedPlaceId(discovered.id);

        if (map) {
          if (place.viewport) {
            map.fitBounds(place.viewport);
          } else {
            map.panTo(latLng);
            map.setZoom(15);
          }
        }
      } catch (err) {
        if (isGoogleMapsQuotaError(err)) {
          notifyGoogleMapsQuotaExceeded();
        }
        setStatusMessage('Unable to load full place details. Please try again.');
      }
    },
    [map, resetSession],
  );

  const handleNearbySearch = useCallback(
    async (category: NearbyCategoryConfig) => {
      if (!placesLib) {
        setStatusMessage('Places service is still initializing...');
        return;
      }

      setActiveCategoryId(category.id);
      setIsSearchingNearby(true);
      setStatusMessage(null);
      setDropdownOpen(false);

      const center = map?.getCenter()?.toJSON() ?? cameraCenter;

      try {
        // Places API (New): Place.searchNearby with explicit field mask
        const { Place } = placesLib;
        const response = await Place.searchNearby({
          fields: [
            'displayName',
            'formattedAddress',
            'location',
            'primaryTypeDisplayName',
          ],
          locationRestriction: {
            center,
            radius: 3000,
          },
          includedPrimaryTypes: [...category.includedPrimaryTypes],
          maxResultCount: 10,
        });

        const rawPlaces = response?.places ?? [];
        const mapped: DiscoveredPlace[] = rawPlaces
          .filter((p) => Boolean(p.location))
          .map((p, index) => ({
            id: p.id ?? `nearby_${category.id}_${index}`,
            displayName: p.displayName ?? 'Unnamed Place',
            formattedAddress: p.formattedAddress ?? '',
            primaryTypeLabel: p.primaryTypeDisplayName ?? category.label,
            location: {
              lat: p.location!.lat(),
              lng: p.location!.lng(),
            },
            suggestedCategory: category.vaultCategory,
          }));

        setPlaces(mapped);
        if (mapped.length > 0) {
          setSelectedPlaceId(mapped[0].id);
          if (map && typeof google !== 'undefined' && google.maps?.LatLngBounds) {
            const bounds = new google.maps.LatLngBounds();
            mapped.forEach((p) => bounds.extend(p.location));
            map.fitBounds(bounds, 48);
          }
        } else {
          setSelectedPlaceId(null);
          setStatusMessage(
            `No ${category.label.toLowerCase()} found in this map area. Pan or zoom out and try again.`,
          );
        }
      } catch (err) {
        if (isGoogleMapsQuotaError(err)) {
          notifyGoogleMapsQuotaExceeded();
        }
        setStatusMessage('Nearby search failed. Check your connection or try another area.');
      } finally {
        setIsSearchingNearby(false);
      }
    },
    [placesLib, map, cameraCenter],
  );

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setStatusMessage('Geolocation is not supported in this browser.');
      return;
    }
    setStatusMessage('Locating your current position...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextCenter: google.maps.LatLngLiteral = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCameraCenter(nextCenter);
        if (map) {
          map.panTo(nextCenter);
          map.setZoom(14);
        }
        setStatusMessage(null);
      },
      () => {
        setStatusMessage('Location permission declined. Search any city or merchant above.');
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, [map]);

  const selectedPlace = useMemo(
    () => places.find((p) => p.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  return (
    <div className="space-y-5">
      {/* Header & Search Bar */}
      <div className="rounded-2xl vault-surface p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#17211E]">
              Local Membership &amp; Merchant Map
            </h1>
            <p className="text-xs text-[#5B6662] mt-1">
              Find physical gyms, coworking hubs, cafes, or transit stations and add them to your recurring bills.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLocateMe}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] hover:border-[#1E6B58] text-xs font-semibold text-[#17211E] flex items-center gap-2 whitespace-nowrap self-start sm:self-auto transition-colors cursor-pointer"
          >
            <LocateFixed className="w-4 h-4 text-[#1E6B58]" aria-hidden="true" />
            <span>Near Me</span>
          </button>
        </div>

        {/* Autocomplete Search Input */}
        <div className="relative">
          <Search
            className="w-4 h-4 text-[#85918C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchInput}
            onFocus={() => setDropdownOpen(true)}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setDropdownOpen(true);
            }}
            placeholder="Search a gym, coworking space, cafe, or address..."
            aria-label="Search merchant or place"
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#F5F6F3] border border-[#E4E7E1] text-sm text-[#17211E] placeholder:text-[#85918C] focus:outline-none focus:bg-white focus:border-[#1E6B58]"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                resetSession();
                setDropdownOpen(false);
              }}
              aria-label="Clear place search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-[#85918C] hover:text-[#17211E] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}

          {dropdownOpen && (suggestions.length > 0 || isAutocompleteLoading) && (
            <div
              role="listbox"
              aria-label="Place suggestions"
              className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-xl bg-white border border-[#E4E7E1] shadow-lg overflow-hidden"
            >
              {isAutocompleteLoading && suggestions.length === 0 ? (
                <div className="px-4 py-3 text-xs text-[#5B6662]">Searching places...</div>
              ) : (
                suggestions.map((suggestion, index) => {
                  const prediction = suggestion.placePrediction;
                  if (!prediction) return null;
                  return (
                    <button
                      key={prediction.placeId || `sug_${index}`}
                      type="button"
                      role="option"
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#F5F6F3] border-b last:border-b-0 border-[#EEF1EC] flex items-start gap-2.5 transition-colors cursor-pointer"
                    >
                      <MapPin
                        className="w-4 h-4 text-[#1E6B58] shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span className="text-xs font-medium text-[#17211E] leading-snug">
                        {prediction.text.text}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Nearby Discovery Category Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#5B6662] mr-1">
            Explore nearby:
          </span>
          {NEARBY_CATEGORIES.map((cat) => {
            const CatIcon = cat.Icon;
            const active = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                disabled={isSearchingNearby}
                onClick={() => handleNearbySearch(cat)}
                className={`min-h-[34px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 ${
                  active
                    ? 'bg-[#E6F2EE] border-[#1E6B58] text-[#155243]'
                    : 'bg-[#F5F6F3] border-[#E4E7E1] text-[#5B6662] hover:text-[#17211E] hover:border-[#CFD6CC]'
                }`}
              >
                <CatIcon
                  className="w-3.5 h-3.5"
                  aria-hidden={true}
                />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {(statusMessage || errorMessage) && (
          <p className="text-xs font-medium text-[#B86A14]">{statusMessage || errorMessage}</p>
        )}
      </div>

      {/* Interactive Google Map + Discovered Places Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div
          data-testid="google-map-container"
          className="lg:col-span-8 h-[420px] lg:h-[540px] rounded-2xl overflow-hidden border border-[#E4E7E1] bg-[#EEF1EC] relative"
        >
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={13}
            colorScheme="LIGHT"
            gestureHandling="greedy"
            disableDefaultUI={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            onCameraChanged={(ev) => {
              if (ev.detail.center) {
                setCameraCenter(ev.detail.center);
              }
            }}
            style={{ width: '100%', height: '100%' }}
          >
            {places.map((place) => (
              <PlaceMarkerWithInfo
                key={place.id}
                place={place}
                isSelected={place.id === selectedPlaceId}
                onSelect={() => setSelectedPlaceId(place.id)}
                onClose={() => setSelectedPlaceId(null)}
                onTrack={handleTrack}
              />
            ))}
          </GoogleMap>
        </div>

        {/* Discovered Places Panel */}
        <aside className="lg:col-span-4 rounded-2xl vault-surface p-4 flex flex-col max-h-[540px]">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EEF1EC]">
            <h2 className="text-sm font-bold text-[#17211E]">
              {places.length > 0 ? `Places (${places.length})` : 'Discovered Places'}
            </h2>
            {places.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPlaces([]);
                  setSelectedPlaceId(null);
                  setActiveCategoryId(null);
                }}
                className="text-xs font-semibold text-[#5B6662] hover:text-[#17211E] cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {places.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <MapPin className="w-7 h-7 text-[#1E6B58] mx-auto opacity-80" aria-hidden="true" />
              <p className="text-sm font-bold text-[#17211E]">No places pinned yet</p>
              <p className="text-xs text-[#5B6662] leading-relaxed max-w-[240px] mx-auto">
                Search for a local business above or pick a nearby category to inspect locations on the map.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2.5 overflow-y-auto pr-1">
              {places.map((place) => {
                const isSelected = selectedPlace?.id === place.id;
                return (
                  <div
                    key={place.id}
                    className={`rounded-xl p-3 border transition-colors ${
                      isSelected
                        ? 'bg-[#E6F2EE]/60 border-[#1E6B58]'
                        : 'bg-[#F5F6F3] border-[#E4E7E1] hover:border-[#CFD6CC]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlaceId(place.id);
                        if (map) {
                          map.panTo(place.location);
                          map.setZoom(15);
                        }
                      }}
                      className="w-full text-left cursor-pointer"
                    >
                      <p className="text-sm font-bold text-[#17211E] leading-snug">
                        {place.displayName}
                      </p>
                      <p className="text-[11px] font-semibold text-[#1E6B58] mt-0.5">
                        {place.primaryTypeLabel}
                      </p>
                      {place.formattedAddress && (
                        <p className="text-xs text-[#5B6662] mt-1 leading-relaxed">
                          {place.formattedAddress}
                        </p>
                      )}
                    </button>

                    <div className="mt-2.5 pt-2.5 border-t border-[#E4E7E1] flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleTrack(place)}
                        className="min-h-[32px] px-3 py-1 rounded-lg bg-[#1E6B58] hover:bg-[#175747] text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Track as Bill</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export const SpendMapView: React.FC<SpendMapViewProps> = ({ onTrackPlaceAsBill }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="rounded-2xl vault-surface p-8 text-center max-w-xl mx-auto mt-6 space-y-3">
        <MapPin className="w-8 h-8 text-[#1E6B58] mx-auto" aria-hidden="true" />
        <h1 className="text-lg font-bold text-[#17211E]">
          Google Maps Platform Not Configured
        </h1>
        <p className="text-sm text-[#5B6662] leading-relaxed">
          Set <code className="font-mono text-xs text-[#17211E]">VITE_GOOGLE_MAPS_API_KEY</code> in your environment to enable the interactive merchant map and Places search.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} language="en" region="US">
      <MapExplorerInner onTrackPlaceAsBill={onTrackPlaceAsBill} />
    </APIProvider>
  );
};
