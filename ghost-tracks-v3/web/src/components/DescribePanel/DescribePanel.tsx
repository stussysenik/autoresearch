import { useState, useRef, useEffect, useCallback } from 'react'

interface DescribePanelProps {
  onRouteGenerated: (result: any) => void
}

const steps = [
  'Finding the best neighborhood...',
  'Generating shape control points...',
  'Routing through real streets...',
  'Validating shape similarity...',
]

const neighborhoods = [
  { value: '', label: 'Let AI decide' },
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

export const DescribePanel = ({ onRouteGenerated }: DescribePanelProps) => {
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('')
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startProgressSteps = useCallback(() => {
    setCurrentStep(0)
    stepTimerRef.current = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev))
    }, 3000)
  }, [])

  const stopProgressSteps = useCallback(() => {
    if (stepTimerRef.current) {
      clearInterval(stepTimerRef.current)
      stepTimerRef.current = null
    }
    setCurrentStep(0)
  }, [])

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current)
    }
  }, [])

  const handleSubmit = async () => {
    if (!description.trim()) return
    setIsLoading(true)
    setError('')
    startProgressSteps()

    try {
      const body: Record<string, unknown> = { description: description.trim() }
      if (selectedNeighborhood) body.neighborhood = selectedNeighborhood

      const response = await fetch(
        `${process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'}/describe`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || data.error || 'Generation failed')
      }

      const data = await response.json()
      onRouteGenerated(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
      stopProgressSteps()
    }
  }

  const handleKeydown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setDescription('')
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          data-testid="describe-input"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeydown}
          placeholder="Describe your shape... (e.g. 'a heart', 'letter M', 'a cat')"
          disabled={isLoading}
          className="glass w-full rounded-xl px-4 py-3 pr-12 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 disabled:opacity-50"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#FF6B35]">
            *
          </div>
        )}
      </div>

      <button
        type="button"
        className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-1"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? '\u25BE' : '\u25B8'} Neighborhood preference
      </button>

      {showAdvanced && (
        <select
          value={selectedNeighborhood}
          onChange={(e) => setSelectedNeighborhood(e.target.value)}
          disabled={isLoading}
          className="glass w-full rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 disabled:opacity-50"
        >
          {neighborhoods.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        data-testid="describe-button"
        disabled={!description.trim() || isLoading}
        className="w-full rounded-xl bg-[#FF6B35] py-3 text-sm font-bold text-white shadow-md hover:bg-[#e55a2b] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleSubmit}
      >
        {isLoading ? steps[currentStep] : 'Create Route'}
      </button>

      {isLoading && (
        <div className="glass rounded-xl p-3 space-y-1.5">
          {steps.map((step, i) => (
            <div
              key={step}
              className={`flex items-center gap-2 text-xs ${
                i <= currentStep ? 'text-slate-700' : 'text-slate-300'
              }`}
            >
              {i < currentStep ? (
                <span className="text-green-500 font-bold">{'\u2713'}</span>
              ) : i === currentStep ? (
                <span className="animate-spin text-[#FF6B35]">{'\u25CC'}</span>
              ) : (
                <span className="text-slate-300">{'\u25CB'}</span>
              )}
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="glass rounded-xl p-3 text-sm text-red-600">
          {error}
          <button type="button" className="underline ml-2" onClick={handleSubmit}>
            Retry
          </button>
        </div>
      )}

      <p className="text-xs text-slate-500 px-1">
        Try: &quot;a heart shape&quot;, &quot;letter P&quot;, &quot;a star&quot;, &quot;a triangle&quot;, &quot;a cat&quot;
      </p>
    </div>
  )
}
