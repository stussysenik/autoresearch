import { useState, useCallback, useEffect } from 'react'
import { MetaTags } from '@redwoodjs/web'

import { MapWrapper } from 'src/components/MapWrapper/MapWrapper'
import { ModeSwitcher } from 'src/components/ModeSwitcher/ModeSwitcher'
import { DescribePanel } from 'src/components/DescribePanel/DescribePanel'
import { GeneratePanel } from 'src/components/GeneratePanel/GeneratePanel'
import { RouteInstructions } from 'src/components/RouteInstructions/RouteInstructions'
import { Toast, addToast } from 'src/components/Toast/Toast'
import { FeasibilityPanel } from 'src/components/FeasibilityPanel/FeasibilityPanel'
import type { FeasibilityResult } from 'src/components/FeasibilityPanel/FeasibilityPanel'
import { PinDropOverlay } from 'src/components/PinDropOverlay/PinDropOverlay'

type AppMode = 'generate' | 'describe' | 'explore'

interface WaypointMarker {
  index: number
  lng: number
  lat: number
  instruction: string
}

interface ShapeIdea {
  name: string
  description: string
  emoji: string
  estimated_distance_km: number
  difficulty: string
  control_points: Array<{ lng: number; lat: number }>
  target_area: string
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

const SESSION_KEY = 'ghost-tracks-last-route'

const HomePage = () => {
  const [mode, setMode] = useState<AppMode>('generate')
  const [generatedRoute, setGeneratedRoute] = useState<GeneratedRoute | null>(null)
  const [isRoutingIdea, setIsRoutingIdea] = useState(false)
  const [showWaypoints, setShowWaypoints] = useState(true)

  // Explore mode state
  const [exploreShape, setExploreShape] = useState('')
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [feasibilityResult, setFeasibilityResult] = useState<FeasibilityResult | null>(null)
  const [isCheckingFeasibility, setIsCheckingFeasibility] = useState(false)

  // Clear stale session on mount — don't auto-restore routes
  // (prevents getting trapped in a route view on reload)
  useEffect(() => {
    sessionStorage.removeItem(SESSION_KEY)
  }, [])

  const saveRoute = useCallback((route: GeneratedRoute) => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(route))
    } catch {
      // storage full or unavailable
    }
  }, [])

  const buildRoute = useCallback((data: any): GeneratedRoute => {
    return {
      shape: data.shape,
      routed_coordinates: data.routed_coordinates,
      distance_km: data.distance_km,
      duration_minutes: data.duration_minutes,
      waypoints: data.waypoints,
      similarity_score: data.similarity_score,
      neighborhood: data.neighborhood,
      bbox: [data.bbox.min_lng, data.bbox.min_lat, data.bbox.max_lng, data.bbox.max_lat],
      alternative_neighborhoods: data.alternative_neighborhoods,
    }
  }, [])

  const showSimilarityToast = useCallback((score: number) => {
    if (score >= 85) {
      addToast('success', `Great match! ${Math.round(score)}% similarity`)
    } else if (score >= 50) {
      addToast('info', `${Math.round(score)}% match — try another neighborhood for better results`)
    } else if (score > 0) {
      addToast('warning', `Low match (${Math.round(score)}%) — consider a different shape or neighborhood`)
    }
  }, [])

  const handleModeChange = useCallback((newMode: AppMode) => {
    setMode(newMode)
    setGeneratedRoute(null)
    setShowWaypoints(true)
    sessionStorage.removeItem(SESSION_KEY)
    // Reset explore state when switching modes
    setPinLocation(null)
    setFeasibilityResult(null)
    setIsCheckingFeasibility(false)
  }, [])

  const handleDescribeResult = useCallback((data: any) => {
    const route = buildRoute(data)
    setGeneratedRoute(route)
    setShowWaypoints(true)
    saveRoute(route)
    showSimilarityToast(route.similarity_score)
  }, [buildRoute, saveRoute, showSimilarityToast])

  const handleIdeaSelected = useCallback(async (idea: ShapeIdea) => {
    setIsRoutingIdea(true)
    try {
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'
      const response = await fetch(`${pythonUrl}/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: idea.name }),
      })

      if (!response.ok) throw new Error('Routing failed')

      const data = await response.json()
      const route = buildRoute(data)
      setGeneratedRoute(route)
      setShowWaypoints(true)
      saveRoute(route)
      showSimilarityToast(route.similarity_score)
    } catch (err) {
      console.error('Failed to route idea:', err)
      addToast('error', 'Failed to generate route. Please try again.')
    } finally {
      setIsRoutingIdea(false)
    }
  }, [buildRoute, saveRoute, showSimilarityToast])

  const handleRetryNeighborhood = useCallback(async (neighborhood: string) => {
    if (!generatedRoute) return
    setIsRoutingIdea(true)

    try {
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'
      const response = await fetch(`${pythonUrl}/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: generatedRoute.shape.name,
          neighborhood,
        }),
      })

      if (!response.ok) throw new Error('Routing failed')

      const data = await response.json()
      const route = buildRoute(data)
      setGeneratedRoute(route)
      setShowWaypoints(true)
      saveRoute(route)
      showSimilarityToast(route.similarity_score)
      addToast('info', `Regenerated in ${neighborhood}`)
    } catch (err) {
      console.error('Failed to retry in neighborhood:', err)
      addToast('error', `Failed to generate route in ${neighborhood}`)
    } finally {
      setIsRoutingIdea(false)
    }
  }, [generatedRoute, buildRoute, saveRoute, showSimilarityToast])

  const handleExportGPX = useCallback(async () => {
    if (!generatedRoute) return

    const coords = generatedRoute.routed_coordinates
    const name = generatedRoute.shape.name

    // Simple GPX generation
    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Ghost Tracks"
  xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${name}</name>
    <trkseg>
${coords.map(([lng, lat]) => `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`).join('\n')}
    </trkseg>
  </trk>
</gpx>`

    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ghost-tracks-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50)}.gpx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    addToast('success', 'GPX file downloaded')
  }, [generatedRoute])

  const handleCloseRoute = useCallback(() => {
    setGeneratedRoute(null)
    setShowWaypoints(true)
  }, [])

  // --- Explore mode handlers ---

  const handlePinDrop = useCallback(async (lat: number, lng: number) => {
    if (!exploreShape.trim()) {
      addToast('warning', 'Enter a shape name first')
      return
    }

    setPinLocation({ lat, lng })
    setFeasibilityResult(null)
    setIsCheckingFeasibility(true)

    try {
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'
      const response = await fetch(`${pythonUrl}/feasibility/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: exploreShape.trim(),
          center: { lng, lat },
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(body || 'Feasibility check failed')
      }

      const data = await response.json()
      setFeasibilityResult({
        feasible: data.feasible,
        score: data.score,
        breakdown: {
          hausdorff: data.breakdown?.hausdorff ?? 0,
          ordered_sampling: data.breakdown?.ordered_sampling ?? 0,
          raster_iou: data.breakdown?.raster_iou ?? 0,
        },
        nearest_alternatives: (data.nearest_alternatives || []).map((alt: any) => ({
          name: alt.name,
          score: alt.score,
          distance_km: alt.distance_km,
          feasible: alt.feasible,
        })),
        other_cities: (data.other_cities || []).map((city: any) => ({
          city: city.city,
          neighborhood: city.neighborhood,
          score: city.score,
          feasible: city.feasible,
        })),
      })
    } catch (err) {
      console.error('Feasibility check failed:', err)
      addToast('error', 'Feasibility check failed. Please try again.')
    } finally {
      setIsCheckingFeasibility(false)
    }
  }, [exploreShape])

  const handleSelectAlternative = useCallback(async (name: string) => {
    // Re-check feasibility at the alternative location
    // For now, search by name using the describe endpoint with neighborhood
    addToast('info', `Checking ${name}...`)

    try {
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'
      const response = await fetch(`${pythonUrl}/feasibility/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: exploreShape.trim(),
          center: pinLocation ? { lng: pinLocation.lng, lat: pinLocation.lat } : { lng: 14.4378, lat: 50.0755 },
          neighborhood: name,
        }),
      })

      if (!response.ok) throw new Error('Check failed')

      const data = await response.json()
      setFeasibilityResult({
        feasible: data.feasible,
        score: data.score,
        breakdown: {
          hausdorff: data.breakdown?.hausdorff ?? 0,
          ordered_sampling: data.breakdown?.ordered_sampling ?? 0,
          raster_iou: data.breakdown?.raster_iou ?? 0,
        },
        nearest_alternatives: (data.nearest_alternatives || []).map((alt: any) => ({
          name: alt.name,
          score: alt.score,
          distance_km: alt.distance_km,
          feasible: alt.feasible,
        })),
        other_cities: (data.other_cities || []).map((city: any) => ({
          city: city.city,
          neighborhood: city.neighborhood,
          score: city.score,
          feasible: city.feasible,
        })),
      })
    } catch (err) {
      console.error('Alternative check failed:', err)
      addToast('error', `Failed to check ${name}`)
    }
  }, [exploreShape, pinLocation])

  const handleGenerateFromFeasibility = useCallback(async () => {
    if (!pinLocation || !exploreShape.trim()) return

    setIsRoutingIdea(true)
    setFeasibilityResult(null)

    try {
      const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'
      const response = await fetch(`${pythonUrl}/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: exploreShape.trim(),
        }),
      })

      if (!response.ok) throw new Error('Route generation failed')

      const data = await response.json()
      const route = buildRoute(data)
      setGeneratedRoute(route)
      setShowWaypoints(true)
      saveRoute(route)
      showSimilarityToast(route.similarity_score)
      setMode('describe')
      setPinLocation(null)
    } catch (err) {
      console.error('Failed to generate route from feasibility:', err)
      addToast('error', 'Failed to generate route. Please try again.')
    } finally {
      setIsRoutingIdea(false)
    }
  }, [pinLocation, exploreShape, buildRoute, saveRoute, showSimilarityToast])

  const handleCloseFeasibility = useCallback(() => {
    setFeasibilityResult(null)
    setPinLocation(null)
  }, [])

  // Build alternative markers for the map from feasibility results
  const alternativeMarkers = feasibilityResult?.nearest_alternatives
    ?.filter((alt) => alt.feasible)
    ?.map((alt, i) => ({
      // Offset markers slightly so they don't overlap the pin
      lat: (pinLocation?.lat ?? 50.0755) + (i + 1) * 0.003,
      lng: (pinLocation?.lng ?? 14.4378) + (i + 1) * 0.003,
      name: alt.name,
      score: alt.score,
    })) || []

  const isExploreMode = mode === 'explore'

  return (
    <>
      <MetaTags title="Ghost Tracks" description="Discover hidden shapes in city streets" />

      <div className="relative h-full w-full overflow-hidden bg-slate-100">
        <MapWrapper
          routeCoordinates={generatedRoute?.routed_coordinates}
          waypoints={generatedRoute?.waypoints}
          showWaypoints={showWaypoints}
          exploreMode={isExploreMode && !!exploreShape.trim()}
          onPinDrop={handlePinDrop}
          pinLocation={pinLocation}
          alternativeMarkers={alternativeMarkers}
        />

        {/* Pin drop overlay for explore mode */}
        <PinDropOverlay visible={isExploreMode && !!exploreShape.trim() && !pinLocation && !feasibilityResult} />

        {/* Top controls */}
        <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
          <div className="p-4 space-y-3 pointer-events-auto max-w-lg">
            <div className="flex items-center gap-3">
              <div className="text-xl font-bold text-slate-800 glass rounded-full px-3 py-1.5">
                {'\uD83D\uDC7B'}
              </div>
              <ModeSwitcher mode={mode} onModeChange={handleModeChange} />
            </div>

            {mode === 'generate' ? (
              <GeneratePanel onIdeaSelected={handleIdeaSelected} />
            ) : mode === 'describe' ? (
              <DescribePanel onRouteGenerated={handleDescribeResult} />
            ) : (
              /* Explore mode: shape name input */
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={exploreShape}
                    onChange={(e) => setExploreShape(e.target.value)}
                    placeholder="Enter a shape name (e.g. 'a heart', 'letter M')"
                    className="glass w-full rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setExploreShape('')
                        setPinLocation(null)
                        setFeasibilityResult(null)
                      }
                    }}
                  />
                </div>
                {exploreShape.trim() && !pinLocation && (
                  <p className="text-xs text-slate-500 px-1">
                    Now tap anywhere on the map to check if &quot;{exploreShape.trim()}&quot; works there
                  </p>
                )}
              </div>
            )}

            {(isRoutingIdea || isCheckingFeasibility) && (
              <div className="glass rounded-xl p-3 text-sm text-slate-600 flex items-center gap-2">
                <span className="animate-spin">{'\u2728'}</span>
                {isCheckingFeasibility ? 'Checking feasibility...' : 'Routing through real streets...'}
              </div>
            )}
          </div>
        </div>

        {/* Route details panel */}
        {generatedRoute && (
          <RouteInstructions
            route={generatedRoute}
            onExportGPX={handleExportGPX}
            onClose={handleCloseRoute}
            onRetryNeighborhood={handleRetryNeighborhood}
            onToggleWaypoints={setShowWaypoints}
          />
        )}

        {/* Feasibility panel */}
        {feasibilityResult && (
          <FeasibilityPanel
            result={feasibilityResult}
            shapeName={exploreShape}
            onSelectAlternative={handleSelectAlternative}
            onGenerateRoute={handleGenerateFromFeasibility}
            onClose={handleCloseFeasibility}
          />
        )}

        {/* Toast notifications */}
        <Toast />
      </div>
    </>
  )
}

export default HomePage
