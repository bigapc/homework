import Image from "next/image"

type TrackingMapProps = {
  lat: number
  lng: number
  status: string
  updatedAt: string
}

function buildMapboxStaticUrl(lat: number, lng: number, token: string) {
  const marker = `pin-s+0f4c5c(${lng},${lat})`
  const center = `${lng},${lat},13,0`
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${center}/800x360?access_token=${token}`
}

function buildOpenStreetMapUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`
}

export default function TrackingMap({ lat, lng, status, updatedAt }: TrackingMapProps) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const safeLat = Number(lat.toFixed(5))
  const safeLng = Number(lng.toFixed(5))
  const lastUpdated = new Date(updatedAt).toLocaleString()
  const openStreetMapUrl = buildOpenStreetMapUrl(safeLat, safeLng)

  return (
    <div className="rounded-xl border border-safe-100 bg-white overflow-hidden">
      {mapboxToken ? (
        <Image
          src={buildMapboxStaticUrl(safeLat, safeLng, mapboxToken)}
          alt="Courier tracking map"
          width={800}
          height={360}
          className="block h-52 w-full object-cover"
          unoptimized
        />
      ) : (
        <div className="h-52 w-full bg-safe-50 flex items-center justify-center px-6 text-center">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-safe-800">Map preview available when Mapbox is configured</p>
            <p className="text-xs text-safe-500">Set NEXT_PUBLIC_MAPBOX_TOKEN in Vercel or local env to enable the static map preview.</p>
          </div>
        </div>
      )}

      <div className="px-4 py-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-safe-900">Courier location</p>
          <span className="badge-active capitalize">{status}</span>
        </div>
        <p className="text-xs text-safe-500">
          Coordinates: {safeLat}, {safeLng}
        </p>
        <p className="text-xs text-safe-400">Updated {lastUpdated}</p>
        <a
          href={openStreetMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-xs font-medium text-safe-700 underline hover:text-safe-900"
        >
          Open full map
        </a>
      </div>
    </div>
  )
}
