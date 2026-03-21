import { useState } from 'react'

interface ScoreBreakdown {
  hausdorff: number
  ordered_sampling: number
  raster_iou: number
}

interface Alternative {
  name: string
  score: number
  distance_km: number
  feasible: boolean
}

interface CityResult {
  city: string
  neighborhood: string
  score: number
  feasible: boolean
}

interface FeasibilityResult {
  feasible: boolean
  score: number
  breakdown: ScoreBreakdown
  nearest_alternatives: Alternative[]
  other_cities: CityResult[]
}

interface FeasibilityPanelProps {
  result: FeasibilityResult
  shapeName: string
  onSelectAlternative: (name: string) => void
  onGenerateRoute: () => void
  onClose: () => void
}

export type { FeasibilityResult, ScoreBreakdown, Alternative, CityResult }

export const FeasibilityPanel = ({ result, shapeName, onSelectAlternative, onGenerateRoute, onClose }: FeasibilityPanelProps) => {
  const [disclosureLevel, setDisclosureLevel] = useState<'compact' | 'standard' | 'full'>('compact')

  const toggleMore = () => {
    if (disclosureLevel === 'compact') setDisclosureLevel('standard')
    else if (disclosureLevel === 'standard') setDisclosureLevel('full')
    else setDisclosureLevel('compact')
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30" style={{ animation: 'slideUp 0.4s ease-out' }}>
      <div className="glass rounded-t-2xl shadow-lg max-h-[45vh] overflow-hidden flex flex-col">
        <div className="p-4">
          {/* Compact: Always visible */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`text-3xl ${result.feasible ? '' : 'grayscale opacity-60'}`}>
                {result.feasible ? '\u2705' : '\u274C'}
              </span>
              <div>
                <h3 className="font-bold text-slate-900">
                  {result.feasible ? 'Yes! This works here' : 'Not quite right here'}
                </h3>
                <p className="text-xs text-slate-500">
                  {shapeName} — {result.score}% match
                </p>
              </div>
            </div>
            <button type="button" className="text-slate-400 hover:text-slate-700 text-xl p-1" onClick={onClose}>{'\u00D7'}</button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            {result.feasible && (
              <button
                type="button"
                className="flex-1 rounded-xl bg-[#FF6B35] py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#e55a2b] transition-all"
                onClick={onGenerateRoute}
              >
                Generate Route
              </button>
            )}
            <button
              type="button"
              className="flex-1 rounded-xl glass py-2.5 text-xs font-semibold text-slate-700 hover:bg-white/95"
              onClick={toggleMore}
            >
              {disclosureLevel === 'compact' ? 'Show more' : disclosureLevel === 'standard' ? 'Show full details' : 'Show less'}
            </button>
          </div>

          {/* Standard: Alternatives */}
          {disclosureLevel !== 'compact' && (
            <div className="mt-3 space-y-2">
              {!result.feasible && result.nearest_alternatives.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">Nearest spots where it works:</p>
                  <div className="space-y-1.5">
                    {result.nearest_alternatives.map((alt) => (
                      <button
                        key={alt.name}
                        type="button"
                        className="w-full glass rounded-lg p-2.5 flex items-center justify-between hover:bg-white/95 transition-all text-left"
                        onClick={() => onSelectAlternative(alt.name)}
                      >
                        <div>
                          <span className="text-sm font-semibold text-slate-800">{alt.name}</span>
                          <span className="text-xs text-slate-500 ml-2">{alt.distance_km} km away</span>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          alt.feasible ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {alt.score}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {result.feasible && result.nearest_alternatives.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">Also works in:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.nearest_alternatives.filter(a => a.feasible).map((alt) => (
                      <button
                        key={alt.name}
                        type="button"
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                        onClick={() => onSelectAlternative(alt.name)}
                      >
                        {alt.name} ({alt.score}%)
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full: Score breakdown + other cities */}
          {disclosureLevel === 'full' && (
            <div className="mt-3 space-y-3">
              <div className="glass rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">Score Breakdown</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Shape accuracy (Hausdorff)', value: result.breakdown.hausdorff, weight: '55%' },
                    { label: 'Point ordering', value: result.breakdown.ordered_sampling, weight: '35%' },
                    { label: 'Visual coverage (IoU)', value: result.breakdown.raster_iou, weight: '10%' },
                  ].map((metric) => (
                    <div key={metric.label} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-36 shrink-0">{metric.label}</span>
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${metric.value >= 90 ? 'bg-green-500' : metric.value >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${metric.value}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 w-10 text-right">{metric.value}%</span>
                      <span className="text-xs text-slate-400 w-8">{metric.weight}</span>
                    </div>
                  ))}
                </div>
              </div>

              {result.other_cities.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">Same shape in other cities</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {result.other_cities.map((city) => (
                      <div
                        key={`${city.city}-${city.neighborhood}`}
                        className="glass rounded-lg p-2 text-center"
                      >
                        <span className={`text-lg ${city.feasible ? '' : 'grayscale opacity-50'}`}>
                          {city.feasible ? '\u2705' : '\u274C'}
                        </span>
                        <p className="text-xs font-semibold text-slate-800">{city.city}</p>
                        <p className="text-xs text-slate-500">{city.neighborhood}</p>
                        <span className={`text-xs font-bold ${city.feasible ? 'text-green-600' : 'text-red-500'}`}>
                          {city.score}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
