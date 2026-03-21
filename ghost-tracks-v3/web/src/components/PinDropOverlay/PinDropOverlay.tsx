interface PinDropOverlayProps {
  visible: boolean
}

export const PinDropOverlay = ({ visible }: PinDropOverlayProps) => {
  if (!visible) return null

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
      <div className="glass rounded-2xl px-6 py-4 text-center shadow-lg pointer-events-none animate-pulse">
        <div className="text-3xl mb-2">{'\uD83D\uDCCD'}</div>
        <p className="text-sm font-semibold text-slate-800">Tap the map to check feasibility</p>
        <p className="text-xs text-slate-500 mt-1">We'll tell you if your shape works here</p>
      </div>
    </div>
  )
}
