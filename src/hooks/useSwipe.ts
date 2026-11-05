import { useCallback, useRef, useState } from 'react'

interface SwipeOptions {
  threshold?: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onTap?: () => void
  enabled?: boolean
}

/**
 * Pointer-based swipe detection. Returns handlers to spread on the element plus
 * the live horizontal offset so the card can follow the finger.
 */
export function useSwipe({ threshold = 80, onSwipeLeft, onSwipeRight, onTap, enabled = true }: SwipeOptions) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      start.current = { x: e.clientX, y: e.clientY, t: Date.now() }
      setDragging(true)
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [enabled],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!start.current || !enabled) return
      const dx = e.clientX - start.current.x
      const dy = e.clientY - start.current.y
      if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dx) < 20) return
      setOffset(dx)
    },
    [enabled],
  )

  const finish = useCallback(
    (e: React.PointerEvent) => {
      if (!start.current) return
      const dx = e.clientX - start.current.x
      const dy = e.clientY - start.current.y
      const dt = Date.now() - start.current.t
      start.current = null
      setDragging(false)
      setOffset(0)

      const isTap = Math.abs(dx) < 8 && Math.abs(dy) < 8 && dt < 400
      if (isTap) {
        onTap?.()
        return
      }
      if (enabled && Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) onSwipeLeft?.()
        else onSwipeRight?.()
      }
    },
    [enabled, threshold, onSwipeLeft, onSwipeRight, onTap],
  )

  const onPointerCancel = useCallback(() => {
    start.current = null
    setDragging(false)
    setOffset(0)
  }, [])

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel },
    offset,
    dragging,
  }
}
