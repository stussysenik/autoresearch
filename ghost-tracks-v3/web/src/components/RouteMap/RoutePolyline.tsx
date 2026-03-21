import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, useRef } from 'react'

interface RoutePolylineProps {
  coordinates: [number, number][] // [lng, lat][]
}

export const RoutePolyline = ({ coordinates }: RoutePolylineProps) => {
  const map = useMap()
  const polylineRef = useRef<google.maps.Polyline | null>(null)

  useEffect(() => {
    if (!map) return

    // Remove existing polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null)
    }

    const path = coordinates.map(([lng, lat]) => ({ lat, lng }))

    polylineRef.current = new google.maps.Polyline({
      path,
      strokeColor: '#3B82F6',
      strokeWeight: 5,
      strokeOpacity: 0.9,
      geodesic: true,
      map,
    })

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null)
        polylineRef.current = null
      }
    }
  }, [map, coordinates])

  return null
}
