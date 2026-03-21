import { useCallback, useEffect, useRef, useState } from 'react'
import { Map, useMap, AdvancedMarker } from '@vis.gl/react-google-maps'
import { RoutePolyline } from './RoutePolyline'
import { WaypointMarkers } from './WaypointMarkers'

interface AlternativeMarker {
  lat: number
  lng: number
  name: string
  score: number
}

interface RouteMapProps {
  routeCoordinates?: [number, number][] | null // [lng, lat][]
  waypoints?: Array<{ index: number; lng: number; lat: number; instruction: string }>
  showWaypoints?: boolean
  onMapReady?: () => void
  exploreMode?: boolean
  onPinDrop?: (lat: number, lng: number) => void
  pinLocation?: { lat: number; lng: number } | null
  alternativeMarkers?: AlternativeMarker[]
}

export const RouteMap = ({
  routeCoordinates,
  waypoints = [],
  showWaypoints = true,
  onMapReady,
  exploreMode = false,
  onPinDrop,
  pinLocation,
  alternativeMarkers = [],
}: RouteMapProps) => {
  const map = useMap()
  const [isLoaded, setIsLoaded] = useState(false)
  const hasFlown = useRef(false)

  // Auto-zoom to route bounds when coordinates change
  useEffect(() => {
    if (!map || !routeCoordinates || routeCoordinates.length === 0) return

    const bounds = new google.maps.LatLngBounds()
    routeCoordinates.forEach(([lng, lat]) => {
      bounds.extend({ lat, lng })
    })
    map.fitBounds(bounds, { top: 60, right: 60, bottom: 200, left: 60 })
  }, [map, routeCoordinates])

  const handleTilesLoaded = useCallback(() => {
    if (!isLoaded) {
      setIsLoaded(true)
      onMapReady?.()
    }
  }, [isLoaded, onMapReady])

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!exploreMode || !onPinDrop) return
      const latLng = e.latLng
      if (latLng) {
        onPinDrop(latLng.lat(), latLng.lng())
      }
    },
    [exploreMode, onPinDrop]
  )

  // Attach click listener for explore mode
  useEffect(() => {
    if (!map) return
    const listener = map.addListener('click', handleMapClick)
    return () => {
      google.maps.event.removeListener(listener)
    }
  }, [map, handleMapClick])

  return (
    <div className="absolute inset-0 w-full h-full">
      <Map
        defaultCenter={{ lat: 50.0755, lng: 14.4378 }}
        defaultZoom={13}
        mapId={process.env.GOOGLE_MAPS_MAP_ID && process.env.GOOGLE_MAPS_MAP_ID !== 'demo' ? process.env.GOOGLE_MAPS_MAP_ID : undefined}
        gestureHandling="greedy"
        disableDefaultUI={false}
        zoomControl={true}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        onTilesLoaded={handleTilesLoaded}
        style={{ width: '100%', height: '100%' }}
      >
        {routeCoordinates && routeCoordinates.length > 0 && (
          <RoutePolyline coordinates={routeCoordinates} />
        )}
        {showWaypoints && waypoints.length > 0 && (
          <WaypointMarkers waypoints={waypoints} />
        )}

        {/* Pin marker for explore mode */}
        {pinLocation && (
          <AdvancedMarker position={{ lat: pinLocation.lat, lng: pinLocation.lng }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50% 50% 50% 0',
                background: '#dc2626',
                transform: 'rotate(-45deg)',
                border: '3px solid white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ transform: 'rotate(45deg)', fontSize: 14, color: 'white', fontWeight: 700 }}>
                {'\uD83D\uDCCD'}
              </span>
            </div>
          </AdvancedMarker>
        )}

        {/* Alternative location markers */}
        {alternativeMarkers.map((marker) => (
          <AdvancedMarker
            key={marker.name}
            position={{ lat: marker.lat, lng: marker.lng }}
          >
            <div
              style={{
                background: marker.score >= 70 ? '#16a34a' : '#ca8a04',
                color: 'white',
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700,
                border: '2px solid white',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                whiteSpace: 'nowrap',
              }}
            >
              {marker.name} {marker.score}%
            </div>
          </AdvancedMarker>
        ))}
      </Map>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 transition-opacity duration-300">
          <div className="text-center">
            <div className="text-4xl mb-2 animate-pulse">&#x1F47B;</div>
            <p className="text-slate-500 text-sm">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  )
}
