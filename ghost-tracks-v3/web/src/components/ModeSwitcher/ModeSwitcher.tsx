type AppMode = 'generate' | 'describe' | 'explore'

interface ModeSwitcherProps {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
}

export const ModeSwitcher = ({ mode, onModeChange }: ModeSwitcherProps) => {
  return (
    <div className="flex gap-2" data-testid="mode-switcher">
      <button
        type="button"
        data-testid="mode-generate"
        className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
          mode === 'generate'
            ? 'bg-[#FF6B35] text-white shadow-md'
            : 'glass text-slate-700 hover:bg-white/95'
        }`}
        onClick={() => onModeChange('generate')}
      >
        Generate
      </button>
      <button
        type="button"
        data-testid="mode-describe"
        className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
          mode === 'describe'
            ? 'bg-[#FF6B35] text-white shadow-md'
            : 'glass text-slate-700 hover:bg-white/95'
        }`}
        onClick={() => onModeChange('describe')}
      >
        Describe
      </button>
      <button
        type="button"
        data-testid="mode-explore"
        className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
          mode === 'explore'
            ? 'bg-[#FF6B35] text-white shadow-md'
            : 'glass text-slate-700 hover:bg-white/95'
        }`}
        onClick={() => onModeChange('explore')}
      >
        Explore
      </button>
    </div>
  )
}
