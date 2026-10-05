/**
 * Google Places API (New), used only on demand ("Ver horario") and kept inside the free monthly
 * allowances. The field masks decide what Google bills:
 * - findPlaceId asks only for place ids: "Text Search Essentials (IDs Only)", free and unlimited.
 * - getPlaceDetails asks for hours, phone and website: "Place Details Enterprise", 1,000 free a
 *   month. Callers reserve one from the budget first (queries/google.ts).
 * Google's terms allow storing place ids; everything else is shown to the user and not stored.
 */

const BASE_URL = 'https://places.googleapis.com/v1';
const TIMEOUT_MS = 6000;
/** About 170 m around the place: the listing has to be right there. */
const SEARCH_BOX_DEGREES = 0.0015;

const DETAILS_FIELDS = [
  'id',
  'displayName',
  'location',
  'businessStatus',
  'regularOpeningHours',
  'nationalPhoneNumber',
  'websiteUri',
  'googleMapsUri',
].join(',');

export type GoogleConfig = { apiKey: string; fetcher?: typeof fetch };

export type PlaceDetails = {
  id: string;
  name: string | null;
  location: { lat: number; lng: number } | null;
  businessStatus: string | null;
  weekdayHours: string[];
  openNow: boolean | null;
  phone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
};

export class GoogleError extends Error {}

async function call(config: GoogleConfig, path: string, init: RequestInit, fieldMask: string) {
  const fetcher = config.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new GoogleError(`Google Places ${path.split('?')[0]}: ${(error as Error).message}`);
  }
  if (!response.ok) throw new GoogleError(`Google Places ${path}: HTTP ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

/** The place id of the listing that best matches the place's name right where the place is. */
export async function findPlaceId(
  config: GoogleConfig,
  place: { name: string; lat: number; lng: number },
): Promise<string | null> {
  const body = await call(
    config,
    '/places:searchText',
    {
      method: 'POST',
      body: JSON.stringify({
        textQuery: place.name,
        pageSize: 1,
        regionCode: 'MX',
        locationRestriction: {
          rectangle: {
            low: {
              latitude: place.lat - SEARCH_BOX_DEGREES,
              longitude: place.lng - SEARCH_BOX_DEGREES,
            },
            high: {
              latitude: place.lat + SEARCH_BOX_DEGREES,
              longitude: place.lng + SEARCH_BOX_DEGREES,
            },
          },
        },
      }),
    },
    'places.id',
  );
  const places = (body.places as { id?: string }[] | undefined) ?? [];
  return places[0]?.id ?? null;
}

export async function getPlaceDetails(
  config: GoogleConfig,
  placeId: string,
  language: string,
): Promise<PlaceDetails> {
  const query = new URLSearchParams({ languageCode: language, regionCode: 'MX' });
  const place = await call(
    config,
    `/places/${encodeURIComponent(placeId)}?${query}`,
    { method: 'GET' },
    DETAILS_FIELDS,
  );
  const location = place.location as { latitude?: number; longitude?: number } | undefined;
  const hours = place.regularOpeningHours as
    { weekdayDescriptions?: string[]; openNow?: boolean } | undefined;
  return {
    id: String(place.id ?? placeId),
    name: (place.displayName as { text?: string } | undefined)?.text ?? null,
    location:
      location?.latitude !== undefined && location.longitude !== undefined
        ? { lat: location.latitude, lng: location.longitude }
        : null,
    businessStatus: (place.businessStatus as string | undefined) ?? null,
    weekdayHours: hours?.weekdayDescriptions ?? [],
    openNow: hours?.openNow ?? null,
    phone: (place.nationalPhoneNumber as string | undefined) ?? null,
    website: (place.websiteUri as string | undefined) ?? null,
    googleMapsUrl: (place.googleMapsUri as string | undefined) ?? null,
  };
}
