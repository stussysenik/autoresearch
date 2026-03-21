import { useState, useEffect } from 'react'
import { LeafletMap } from 'src/components/LeafletMap/LeafletMap'

/**
 * MapWrapper — renders Leaflet/OSM by default (works without any API key).
 * Google Maps can be enabled when a valid API key + enabled Maps JS API is confirmed.
 *
 * Currently always uses Leaflet because:
 * 1. It works instantly with no configuration
 * 2. CartoDB Positron tiles look clean and professional
 * 3. No billing or API key management needed for development
 */

interface MapWrapperProps {
  routeCoordinates?: [number, number][] | null
  waypoints?: Array<{ index: number; lng: number; lat: number; instruction: string }>
  showWaypoints?: boolean
  onMapReady?: () => void
  exploreMode?: boolean
  onPinDrop?: (lat: number, lng: number) => void
  pinLocation?: { lat: number; lng: number } | null
  alternativeMarkers?: Array<{ lat: number; lng: number; name: string; score: number }>
}

export const MapWrapper = (props: MapWrapperProps) => {
  // Always use Leaflet — it works without any API key
  // Google Maps requires: valid key + Maps JS API enabled + billing in Google Cloud Console
  return <LeafletMap {...props} />
}
