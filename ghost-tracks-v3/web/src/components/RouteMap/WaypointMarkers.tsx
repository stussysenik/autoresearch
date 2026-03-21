import { AdvancedMarker, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps'
import { useState, useCallback } from 'react'

interface Waypoint {
  index: number
  lng: number
  lat: number
  instruction: string
}

interface WaypointMarkerItemProps {
  waypoint: Waypoint
}

const WaypointMarkerItem = ({ waypoint }: WaypointMarkerItemProps) => {
  const [markerRef, marker] = useAdvancedMarkerRef()
  const [showInfo, setShowInfo] = useState(false)

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: waypoint.lat, lng: waypoint.lng }}
        onClick={() => setShowInfo(!showInfo)}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#ff6b35',
            color: 'white',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid white',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            cursor: 'pointer',
          }}
        >
          {waypoint.index}
        </div>
      </AdvancedMarker>
      {showInfo && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setShowInfo(false)}>
          <div style={{ fontSize: 13, maxWidth: 200 }}>
            {waypoint.instruction}
          </div>
        </InfoWindow>
      )}
    </>
  )
}

interface WaypointMarkersProps {
  waypoints: Waypoint[]
}

export const WaypointMarkers = ({ waypoints }: WaypointMarkersProps) => {
  return (
    <>
      {waypoints.map((wp) => (
        <WaypointMarkerItem key={wp.index} waypoint={wp} />
      ))}
    </>
  )
}
