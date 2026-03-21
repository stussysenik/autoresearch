import { useState, useEffect } from 'react'

type ToastType = 'info' | 'success' | 'warning' | 'error'

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

// Global toast state (simple event-based pattern for RedwoodJS)
let toastListeners: Array<(toasts: ToastItem[]) => void> = []
let toasts: ToastItem[] = []

export function addToast(type: ToastType, message: string, duration = 4000) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const toast: ToastItem = { id, type, message }
  toasts = [...toasts, toast]
  toastListeners.forEach((fn) => fn(toasts))

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    toastListeners.forEach((fn) => fn(toasts))
  }, duration)
}

const iconMap: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2715',
  warning: '\u26A0',
  info: '\u2139',
}

const colorMap: Record<ToastType, string> = {
  success: 'bg-green-50 text-green-800 border-green-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
}

export const Toast = () => {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const listener = (updated: ToastItem[]) => setItems([...updated])
    toastListeners.push(listener)
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {items.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-md flex items-center gap-2 animate-[slideIn_0.3s_ease-out] ${colorMap[toast.type]}`}
        >
          <span className="font-bold">{iconMap[toast.type]}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
