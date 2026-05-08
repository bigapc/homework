export type OpenStreetMapSuggestion = {
  place_name: string
  center: [number, number]
}

type PhotonFeature = {
  geometry?: {
    coordinates?: [number, number]
  }
  properties?: {
    name?: string
    street?: string
    housenumber?: string
    city?: string
    county?: string
    state?: string
    country?: string
    postcode?: string
  }
}

type RoutePoint = {
  lat: number
  lng: number
}

function normalizePart(value?: string) {
  return value?.trim() ?? ""
}

function buildSuggestionLabel(properties?: PhotonFeature["properties"]) {
  const primary =
    normalizePart(properties?.name) ||
    [normalizePart(properties?.housenumber), normalizePart(properties?.street)].filter(Boolean).join(" ") ||
    normalizePart(properties?.street) ||
    normalizePart(properties?.postcode) ||
    "Selected location"

  const secondary = [
    normalizePart(properties?.city),
    normalizePart(properties?.county),
    normalizePart(properties?.state),
    normalizePart(properties?.country),
  ].filter(Boolean)

  return secondary.length > 0 ? `${primary}, ${secondary.join(", ")}` : primary
}

export async function searchAddressSuggestions(
  query: string,
  limit = 5
): Promise<OpenStreetMapSuggestion[]> {
  if (query.trim().length < 3) {
    return []
  }

  const response = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}`
  )

  if (!response.ok) {
    return []
  }

  const payload = (await response.json()) as {
    features?: PhotonFeature[]
  }

  return (payload.features ?? [])
    .map((feature) => {
      const coordinates = feature.geometry?.coordinates
      if (!coordinates || coordinates.length < 2) {
        return null
      }

      return {
        place_name: buildSuggestionLabel(feature.properties),
        center: [coordinates[0], coordinates[1]] as [number, number],
      }
    })
    .filter((feature): feature is OpenStreetMapSuggestion => feature !== null)
}

export async function geocodeAddress(query: string) {
  const [result] = await searchAddressSuggestions(query, 1)

  if (!result) {
    throw new Error("Unable to geocode the requested address.")
  }

  return {
    lng: result.center[0],
    lat: result.center[1],
  }
}

export async function fetchDrivingRoute(pickup: RoutePoint, dropoff: RoutePoint) {
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=false`
  )

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as {
    routes?: Array<{
      distance?: number
      duration?: number
    }>
  }

  const route = payload.routes?.[0]
  if (!route?.distance || !route?.duration) {
    return null
  }

  return {
    miles: Math.round((route.distance / 1609.34) * 100) / 100,
    minutes: Math.round(route.duration / 60),
  }
}

function buildBoundingBox(first: RoutePoint, second: RoutePoint) {
  const lngPadding = Math.max(Math.abs(first.lng - second.lng) * 0.2, 0.02)
  const latPadding = Math.max(Math.abs(first.lat - second.lat) * 0.2, 0.01)

  const left = Math.min(first.lng, second.lng) - lngPadding
  const bottom = Math.min(first.lat, second.lat) - latPadding
  const right = Math.max(first.lng, second.lng) + lngPadding
  const top = Math.max(first.lat, second.lat) + latPadding

  return `${left}%2C${bottom}%2C${right}%2C${top}`
}

export function buildRoutePreviewEmbedUrl(pickup: RoutePoint, dropoff: RoutePoint) {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${buildBoundingBox(pickup, dropoff)}&layer=mapnik`
}

export function buildRouteDirectionsUrl(pickup: RoutePoint, dropoff: RoutePoint) {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${pickup.lat}%2C${pickup.lng}%3B${dropoff.lat}%2C${dropoff.lng}`
}