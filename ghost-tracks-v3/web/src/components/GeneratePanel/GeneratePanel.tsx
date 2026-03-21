import { useState } from 'react'

interface ShapeIdea {
  name: string
  description: string
  emoji: string
  estimated_distance_km: number
  difficulty: string
  control_points: { lng: number; lat: number }[]
  target_area: string
}

interface GeneratePanelProps {
  onIdeaSelected: (idea: ShapeIdea) => void
}

const NEIGHBORHOODS = [
  { value: 'Vinohrady', label: 'Vinohrady' },
  { value: 'Karlín', label: 'Karlín' },
  { value: 'Letná', label: 'Letná' },
  { value: 'Holešovice', label: 'Holešovice' },
  { value: 'Žižkov', label: 'Žižkov' },
  { value: 'Vršovice', label: 'Vršovice' },
  { value: 'Nusle', label: 'Nusle' },
  { value: 'Dejvice', label: 'Dejvice' },
  { value: 'Smíchov', label: 'Smíchov' },
  { value: 'Staré Město', label: 'Staré Město' },
  { value: 'Malá Strana', label: 'Malá Strana' },
  { value: 'Nové Město', label: 'Nové Město' },
]

export const GeneratePanel = ({ onIdeaSelected }: GeneratePanelProps) => {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('')
  const [ideas, setIdeas] = useState<ShapeIdea[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    if (!selectedNeighborhood) return
    setIsLoading(true)
    setError('')
    setIdeas([])

    try {
      const response = await fetch(
        `${process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ neighborhood: selectedNeighborhood, count: 3 }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || data.error || 'Generation failed')
      }

      const data = await response.json()
      setIdeas(data.ideas)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <select
        value={selectedNeighborhood}
        onChange={(e) => setSelectedNeighborhood(e.target.value)}
        className="glass w-full rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30"
      >
        <option value="">Choose a neighborhood...</option>
        {NEIGHBORHOODS.map((n) => (
          <option key={n.value} value={n.value}>
            {n.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        data-testid="generate-button"
        disabled={!selectedNeighborhood || isLoading}
        className="w-full rounded-xl bg-[#FF6B35] py-3 text-sm font-bold text-white shadow-md hover:bg-[#e55a2b] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={generate}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <span className="animate-spin">*</span> Generating ideas...
          </span>
        ) : (
          'Generate Route Ideas'
        )}
      </button>

      {error && (
        <div className="glass rounded-xl p-3 text-sm text-red-600">
          {error}
          <button type="button" className="underline ml-2" onClick={generate}>
            Retry
          </button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2" data-testid="skeleton-loaders">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-xl p-3 animate-pulse flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-200 rounded w-3/4" />
                <div className="h-2.5 bg-slate-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {ideas.length > 0 && (
        <div className="space-y-2" data-testid="ideas-list">
          {ideas.map((idea) => (
            <button
              key={idea.name}
              type="button"
              className="glass w-full rounded-xl p-3 flex items-center gap-3 hover:bg-white/95 transition-all text-left"
              onClick={() => onIdeaSelected(idea)}
            >
              <span className="text-2xl">{idea.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 text-sm">{idea.name}</div>
                <div className="text-xs text-slate-500 truncate">{idea.description}</div>
                <div className="flex gap-2 mt-0.5 text-xs text-slate-400">
                  <span>{idea.estimated_distance_km} km</span>
                  <span className="capitalize">{idea.difficulty}</span>
                  <span>{idea.target_area}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
