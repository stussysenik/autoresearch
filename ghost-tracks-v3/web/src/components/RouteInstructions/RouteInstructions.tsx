import { useState } from 'react'

interface WaypointMarker {
  index: number
  lng: number
  lat: number
  instruction: string
}

interface ShapeIdea {
  name: string
  emoji: string
  description: string
  difficulty: string
}

interface GeneratedRoute {
  shape: ShapeIdea
  routed_coordinates: [number, number][]
  distance_km: number
  duration_minutes: number
  waypoints: WaypointMarker[]
  similarity_score: number
  neighborhood: string
  bbox: [number, number, number, number]
  alternative_neighborhoods?: string[]
}

interface RouteInstructionsProps {
  route: GeneratedRoute
  onExportGPX: () => void
  onClose: () => void
  onRetryNeighborhood?: (neighborhood: string) => void
  onToggleWaypoints?: (show: boolean) => void
}

export const RouteInstructions = ({
  route,
  onExportGPX,
  onClose,
  onRetryNeighborhood,
  onToggleWaypoints,
}: RouteInstructionsProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showMarkers, setShowMarkers] = useState(true)

  const scoreColor =
    route.similarity_score >= 70
      ? 'bg-green-100 text-green-700'
      : route.similarity_score >= 45
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700'

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30"
      data-testid="route-display"
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      <div className="glass rounded-t-2xl shadow-lg max-h-[45vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{route.shape.emoji}</span>
              <div>
                <h3 className="font-bold text-slate-900">{route.shape.name}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  <span>{route.distance_km} km</span>
                  <span>{route.duration_minutes} min</span>
                  <span className="capitalize">{route.shape.difficulty}</span>
                  <span>{route.neighborhood}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-700 text-xl p-1"
              onClick={onClose}
            >
              {'\u00D7'}
            </button>
          </div>

          {route.similarity_score > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span
                data-testid="similarity-score"
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${scoreColor}`}
              >
                {Math.round(route.similarity_score)}% match
              </span>
              <span className="text-xs text-slate-400">{route.shape.description}</span>
            </div>
          )}

          {route.alternative_neighborhoods &&
            route.alternative_neighborhoods.length > 0 &&
            onRetryNeighborhood && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">Try in:</span>
                {route.alternative_neighborhoods.map((alt) => (
                  <button
                    key={alt}
                    type="button"
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 hover:bg-[#FF6B35]/10 hover:text-[#FF6B35] transition-colors"
                    onClick={() => onRetryNeighborhood(alt)}
                  >
                    {alt}
                  </button>
                ))}
              </div>
            )}

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              data-testid="export-gpx"
              className="flex-1 rounded-lg bg-[#3B82F6] py-2 text-xs font-bold text-white hover:bg-[#2563EB] transition-all"
              onClick={onExportGPX}
            >
              Export GPX
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg glass py-2 text-xs font-semibold text-slate-700 hover:bg-white/95"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Hide' : 'Show'} directions ({route.waypoints.length} turns)
            </button>
            <button
              type="button"
              className={`rounded-lg py-2 px-3 text-xs font-semibold transition-all ${
                showMarkers
                  ? 'glass text-slate-700 hover:bg-white/95'
                  : 'bg-[#FF6B35] text-white'
              }`}
              onClick={() => {
                const next = !showMarkers
                setShowMarkers(next)
                onToggleWaypoints?.(next)
              }}
            >
              {showMarkers ? 'Path only' : 'Markers'}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="overflow-y-auto p-4 space-y-2">
            {route.waypoints.map((wp) => (
              <div key={wp.index} className="flex items-start gap-3 text-sm">
                <span className="shrink-0 w-7 h-7 rounded-full bg-[#FF6B35] text-white text-xs font-bold flex items-center justify-center">
                  {wp.index}
                </span>
                <span className="text-slate-700 pt-0.5">{wp.instruction}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
