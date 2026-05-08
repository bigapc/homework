type TrackingMapProps = {
  lat: number
  lng: number
  status: string
  updatedAt: string
}

function buildOpenStreetMapEmbedUrl(lat: number, lng: number) {
  const lngDelta = 0.02
  const latDelta = 0.01
  const left = lng - lngDelta
  const bottom = lat - latDelta
  const right = lng + lngDelta
  const top = lat + latDelta

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`
}

function buildOpenStreetMapUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`
}

export default function TrackingMap({ lat, lng, status, updatedAt }: TrackingMapProps) {
  const safeLat = Number(lat.toFixed(5))
  const safeLng = Number(lng.toFixed(5))
  const lastUpdated = new Date(updatedAt).toLocaleString()
  const openStreetMapUrl = buildOpenStreetMapUrl(safeLat, safeLng)

  return (
    <div className="rounded-xl border border-safe-100 bg-white overflow-hidden">
      <iframe
        title="Courier live tracking map"
        src={buildOpenStreetMapEmbedUrl(safeLat, safeLng)}
        width="800"
        height="360"
        className="block h-52 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />

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
