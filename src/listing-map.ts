import { initListingAuth } from './listing-auth.js';

initListingAuth();

export {};

declare const google: any;

declare global {
  interface Window {
    __ccgGoogleMapsReady?: () => void;
    google?: unknown;
  }
}

type ListingMapRecord = {
  id: string;
  url?: string;
  source?: string;
  status?: string;
  title?: string;
  askingPrice?: number | string;
  saved?: boolean;
  location?: string;
};

type ListingsMapResponse = {
  records: ListingMapRecord[];
  message?: string;
};

type LatLngLiteral = {
  lat: number;
  lng: number;
};

const MAPS_KEY_STORAGE = 'ccg_google_maps_api_key';
const GEOCODE_CACHE_STORAGE = 'ccg_listing_map_geocode_cache_v1';
const DENVER_CENTER: LatLngLiteral = { lat: 39.7392, lng: -104.9903 };

const mapEl = document.getElementById('listing-map-canvas') as HTMLDivElement | null;
const statusEl = document.getElementById('listing-map-status') as HTMLDivElement | null;
const countsEl = document.getElementById('listing-map-counts') as HTMLSpanElement | null;
const apiKeyInput = document.getElementById('listing-map-api-key') as HTMLInputElement | null;
const loadButton = document.getElementById('listing-map-load') as HTMLButtonElement | null;
const clearKeyButton = document.getElementById('listing-map-clear-key') as HTMLButtonElement | null;

let mapsLoaderPromise: Promise<void> | null = null;
let mapInstance: any = null;
let infoWindow: any = null;
let markers: any[] = [];
let geocodeCache = loadGeocodeCache();

function setStatus(message: string, isError = false): void {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error-section', isError);
  statusEl.classList.toggle('result-section', !isError);
}

function setLoading(isLoading: boolean): void {
  if (loadButton) {
    loadButton.disabled = isLoading;
    loadButton.textContent = isLoading ? 'Loading…' : 'Load Map';
  }
  if (clearKeyButton) clearKeyButton.disabled = isLoading;
  if (apiKeyInput) apiKeyInput.disabled = isLoading;
}

function normalizeLocationKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function loadGeocodeCache(): Record<string, LatLngLiteral> {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_STORAGE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LatLngLiteral>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveGeocodeCache(): void {
  try {
    localStorage.setItem(GEOCODE_CACHE_STORAGE, JSON.stringify(geocodeCache));
  } catch {
    // Ignore storage failures.
  }
}

async function loadGoogleMapsApi(apiKey: string): Promise<void> {
  if (window.google && typeof google?.maps === 'object') return;
  if (mapsLoaderPromise) return mapsLoaderPromise;

  mapsLoaderPromise = new Promise<void>((resolve, reject) => {
    const callbackName = '__ccgGoogleMapsReady';
    window[callbackName] = () => {
      delete window[callbackName];
      resolve();
    };

    const existingScript = document.getElementById('ccg-google-maps-script');
    if (existingScript) existingScript.remove();

    const script = document.createElement('script');
    script.id = 'ccg-google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      delete window[callbackName];
      mapsLoaderPromise = null;
      reject(new Error('Unable to load Google Maps JavaScript API.'));
    };

    const timeout = window.setTimeout(() => {
      delete window[callbackName];
      mapsLoaderPromise = null;
      reject(new Error('Google Maps load timed out.'));
    }, 15000);

    const originalCallback = window[callbackName];
    window[callbackName] = () => {
      window.clearTimeout(timeout);
      if (typeof originalCallback === 'function') {
        originalCallback();
      }
    };

    document.head.appendChild(script);
  });

  return mapsLoaderPromise;
}

async function fetchMapListings(): Promise<ListingMapRecord[]> {
  const response = await fetch('/api/listings/map');
  const data = (await response.json().catch(() => ({}))) as ListingsMapResponse;
  if (!response.ok) {
    throw new Error(data.message || 'Unable to load listing map data.');
  }
  return Array.isArray(data.records) ? data.records : [];
}

function geocodeAddress(geocoder: any, address: string): Promise<LatLngLiteral | null> {
  return new Promise((resolve) => {
    geocoder.geocode({ address, region: 'US' }, (results: any[], status: string) => {
      if (status !== 'OK' || !Array.isArray(results) || !results[0]?.geometry?.location) {
        resolve(null);
        return;
      }
      const location = results[0].geometry.location;
      resolve({ lat: Number(location.lat()), lng: Number(location.lng()) });
    });
  });
}

async function geocodeLocation(geocoder: any, location: string): Promise<LatLngLiteral | null> {
  const key = normalizeLocationKey(location);
  if (!key) return null;
  if (geocodeCache[key]) return geocodeCache[key];

  const withCountry = /,\s*(usa|united states)\s*$/i.test(location) ? location : `${location}, USA`;
  const result = await geocodeAddress(geocoder, withCountry);
  if (result) {
    geocodeCache[key] = result;
    saveGeocodeCache();
  }
  return result;
}

function offsetPosition(base: LatLngLiteral, index: number): LatLngLiteral {
  if (index === 0) return base;
  const angle = (index * 137.508) * (Math.PI / 180);
  const radiusMeters = 120 + (65 * Math.floor(Math.sqrt(index)));
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = Math.max(1, metersPerDegreeLat * Math.cos(base.lat * (Math.PI / 180)));
  return {
    lat: base.lat + ((radiusMeters * Math.cos(angle)) / metersPerDegreeLat),
    lng: base.lng + ((radiusMeters * Math.sin(angle)) / metersPerDegreeLng),
  };
}

function clearMarkers(): void {
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
}

function formatPrice(value: number | string | undefined): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  if (trimmed.includes('$')) return trimmed;
  const numeric = Number.parseFloat(trimmed.replace(/[^0-9.]/g, ''));
  if (Number.isFinite(numeric)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(numeric);
  }
  return trimmed;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildInfoContent(record: ListingMapRecord): string {
  const title = escapeHtml((record.title || 'Untitled listing').trim());
  const location = escapeHtml((record.location || 'Unknown location').trim());
  const source = escapeHtml((record.source || 'Unknown source').trim());
  const price = formatPrice(record.askingPrice);
  const priceMarkup = price ? `<p><strong>${escapeHtml(price)}</strong></p>` : '';
  const linkMarkup = record.url
    ? `<p><a href="${escapeHtml(record.url)}" target="_blank" rel="noopener noreferrer">Open listing</a></p>`
    : '';
  return `<div class="listing-map-info"><h3>${title}</h3>${priceMarkup}<p>${location}</p><p>${source}</p>${linkMarkup}</div>`;
}

async function renderMapWithListings(): Promise<void> {
  if (!mapEl) return;
  const records = await fetchMapListings();
  const candidates = records.filter((record) => (record.location || '').trim().length > 0);
  if (!mapInstance) {
    mapInstance = new google.maps.Map(mapEl, {
      center: DENVER_CENTER,
      zoom: 9,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
  }

  if (!infoWindow) infoWindow = new google.maps.InfoWindow();
  clearMarkers();

  if (candidates.length === 0) {
    if (countsEl) countsEl.textContent = 'No non-archived listings with location.';
    setStatus('No mappable listings found.');
    return;
  }

  const geocoder = new google.maps.Geocoder();
  const uniqueLocations = Array.from(new Set(candidates.map((record) => normalizeLocationKey(record.location || '')))).filter(Boolean);
  const coordinatesByLocation = new Map<string, LatLngLiteral>();
  let unresolvedLocations = 0;

  for (const locationKey of uniqueLocations) {
    const originalText = candidates.find((record) => normalizeLocationKey(record.location || '') === locationKey)?.location || '';
    const coordinate = await geocodeLocation(geocoder, originalText);
    if (coordinate) {
      coordinatesByLocation.set(locationKey, coordinate);
    } else {
      unresolvedLocations += 1;
    }
  }

  const groupedIndex = new Map<string, number>();
  const bounds = new google.maps.LatLngBounds();
  let unsavedPins = 0;
  let savedPins = 0;
  let renderedPins = 0;

  for (const record of candidates) {
    const locationKey = normalizeLocationKey(record.location || '');
    const base = coordinatesByLocation.get(locationKey);
    if (!base) continue;

    const index = groupedIndex.get(locationKey) || 0;
    groupedIndex.set(locationKey, index + 1);
    const position = offsetPosition(base, index);
    bounds.extend(position);

    const isSaved = Boolean(record.saved);
    if (isSaved) savedPins += 1;
    else unsavedPins += 1;

    const marker = new google.maps.Marker({
      map: mapInstance,
      position,
      title: record.title || 'Listing',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: isSaved ? '#2563eb' : '#16a34a',
        fillOpacity: 0.95,
        strokeColor: '#0f172a',
        strokeOpacity: 1,
        strokeWeight: 1,
        scale: 8,
      },
    });

    marker.addListener('click', () => {
      infoWindow.setContent(buildInfoContent(record));
      infoWindow.open({
        anchor: marker,
        map: mapInstance,
      });
    });

    markers.push(marker);
    renderedPins += 1;
  }

  if (renderedPins > 0) {
    mapInstance.fitBounds(bounds);
    const currentZoom = mapInstance.getZoom();
    if (typeof currentZoom === 'number' && currentZoom > 12) {
      mapInstance.setZoom(12);
    }
  } else {
    mapInstance.setCenter(DENVER_CENTER);
    mapInstance.setZoom(9);
  }

  if (countsEl) {
    countsEl.textContent = `Unsaved: ${unsavedPins} • Saved: ${savedPins} • Unresolved locations: ${unresolvedLocations}`;
  }
  setStatus(`Rendered ${renderedPins} pins from ${records.length} active listings.`);
}

async function handleLoadMap(): Promise<void> {
  const key = apiKeyInput?.value.trim() || '';
  if (!key) {
    setStatus('Google Maps API key is required.', true);
    return;
  }

  setLoading(true);
  setStatus('Loading Google Maps and listing data...');

  try {
    localStorage.setItem(MAPS_KEY_STORAGE, key);
    await loadGoogleMapsApi(key);
    await renderMapWithListings();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load map.';
    setStatus(message, true);
  } finally {
    setLoading(false);
  }
}

function handleClearKey(): void {
  localStorage.removeItem(MAPS_KEY_STORAGE);
  if (apiKeyInput) apiKeyInput.value = '';
  mapsLoaderPromise = null;
  setStatus('Stored Google Maps API key cleared.');
}

if (loadButton) {
  loadButton.addEventListener('click', () => {
    void handleLoadMap();
  });
}

if (clearKeyButton) {
  clearKeyButton.addEventListener('click', () => {
    handleClearKey();
  });
}

if (apiKeyInput) {
  const queryKey = new URLSearchParams(window.location.search).get('gmapsKey')?.trim() || '';
  const stored = localStorage.getItem(MAPS_KEY_STORAGE) || '';
  apiKeyInput.value = queryKey || stored;
  apiKeyInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleLoadMap();
    }
  });
}
