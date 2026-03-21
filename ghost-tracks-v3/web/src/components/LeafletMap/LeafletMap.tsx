import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface WaypointData {
  index: number
  lng: number
  lat: number
  instruction: string
}

interface AlternativeMarker {
  lat: number
  lng: number
  name: string
  score: number
}

interface LeafletMapProps {
  routeCoordinates?: [number, number][] | null
  waypoints?: WaypointData[]
  showWaypoints?: boolean
  onMapReady?: () => void
  exploreMode?: boolean
  onPinDrop?: (lat: number, lng: number) => void
  pinLocation?: { lat: number; lng: number } | null
  alternativeMarkers?: AlternativeMarker[]
}

export const LeafletMap = ({
  routeCoordinates,
  waypoints = [],
  showWaypoints = true,
  onMapReady,
  exploreMode = false,
  onPinDrop,
  pinLocation,
  alternativeMarkers = [],
}: LeafletMapProps) => {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const polylineRef = useRef<L.Polyline | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const pinRef = useRef<L.Marker | null>(null)
  const altMarkersRef = useRef<L.Marker[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [50.0755, 14.4378],
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    })

    // CartoDB Positron tiles — clean, light style similar to Google Maps Silver
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (exploreMode && onPinDrop) {
        onPinDrop(e.latlng.lat, e.latlng.lng)
      }
    })

    mapRef.current = map
    setIsLoaded(true)
    onMapReady?.()

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update click handler when explore mode changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.off('click')
    if (exploreMode && onPinDrop) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onPinDrop(e.latlng.lat, e.latlng.lng)
      })
    }
  }, [exploreMode, onPinDrop])

  // Update route polyline
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (polylineRef.current) {
      polylineRef.current.remove()
      polylineRef.current = null
    }

    if (routeCoordinates && routeCoordinates.length > 0) {
      const latLngs = routeCoordinates.map(([lng, lat]) => [lat, lng] as [number, number])
      polylineRef.current = L.polyline(latLngs, {
        color: '#3B82F6',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)

      map.fitBounds(polylineRef.current.getBounds(), { padding: [60, 60] })
    }
  }, [routeCoordinates])

  // Update waypoint markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    if (!showWaypoints || waypoints.length === 0) return

    waypoints.forEach((wp) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;border-radius:50%;background:#ff6b35;color:white;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;">${wp.index}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })

      const marker = L.marker([wp.lat, wp.lng], { icon })
        .bindPopup(wp.instruction, { closeButton: false, offset: [0, -14] })
        .addTo(map)

      markersRef.current.push(marker)
    })
  }, [waypoints, showWaypoints])

  // Update pin marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (pinRef.current) {
      pinRef.current.remove()
      pinRef.current = null
    }

    if (pinLocation) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:36px;height:36px;border-radius:50% 50% 50% 0;background:#dc2626;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:14px;color:white;font-weight:700;">📍</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      })

      pinRef.current = L.marker([pinLocation.lat, pinLocation.lng], { icon }).addTo(map)
    }
  }, [pinLocation])

  // Update alternative markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    altMarkersRef.current.forEach((m) => m.remove())
    altMarkersRef.current = []

    alternativeMarkers.forEach((marker) => {
      const color = marker.score >= 70 ? '#16a34a' : '#ca8a04'
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${color};color:white;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;">${marker.name} ${marker.score}%</div>`,
        iconSize: [100, 24],
        iconAnchor: [50, 12],
      })

      const m = L.marker([marker.lat, marker.lng], { icon }).addTo(map)
      altMarkersRef.current.push(m)
    })
  }, [alternativeMarkers])

  return (
    <div className="absolute inset-0 w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        data-testid="leaflet-map"
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 transition-opacity duration-300">
          <div className="text-center">
            <div className="text-4xl mb-2 animate-pulse">👻</div>
            <p className="text-slate-500 text-sm">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  )
}
