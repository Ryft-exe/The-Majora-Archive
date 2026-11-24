import { useEffect, useRef } from 'react'
import taelSprite from './assets/brand/tael-cursor.png'

type Point = { x: number; y: number }

/**
 * Tael follows the pointer with a little spring, flutters in place, and leaves
 * a short fairy-light trail. The decoration is pointer-events: none, so links,
 * buttons, text selection and scrolling behave exactly as before.
 */
export default function TaelCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const trailRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const root = document.documentElement
    const cursor = cursorRef.current
    const trail = trailRef.current
    const image = imageRef.current
    if (!cursor || !trail || !image) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const position: Point = { x: -120, y: -120 }
    const target: Point = { x: -120, y: -120 }
    let hasPointer = false
    let visible = false
    let lastMove = 0
    let lastSpark = 0
    let frame = 0

    root.classList.add('tael-mode')
    if (reduced) root.classList.add('tael-reduced')

    const show = () => {
      if (visible) return
      visible = true
      cursor.classList.add('on')
    }

    const hide = () => {
      visible = false
      cursor.classList.remove('on')
      trail.replaceChildren()
    }

    const spark = (x: number, y: number) => {
      if (reduced) return
      const star = document.createElement('i')
      const angle = Math.random() * Math.PI * 2
      const spread = 12 + Math.random() * 20
      const gold = Math.random() > 0.7
      star.className = 'tael-spark'
      star.style.left = `${x + (Math.random() - 0.5) * 10}px`
      star.style.top = `${y + (Math.random() - 0.5) * 8}px`
      star.style.setProperty('--dx', `${Math.cos(angle) * spread}px`)
      star.style.setProperty('--dy', `${Math.sin(angle) * spread + 8}px`)
      star.style.setProperty('--spark-color', gold ? '#ffd98a' : '#ff9ad5')
      star.addEventListener('animationend', () => star.remove(), { once: true })
      trail.append(star)
      if (trail.childElementCount > 18) trail.firstElementChild?.remove()
    }

    const render = (now: number) => {
      const ease = reduced ? 1 : 0.34
      const dx = target.x - position.x
      const dy = target.y - position.y
      position.x += dx * ease
      position.y += dy * ease

      cursor.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`
      cursor.style.setProperty('--lean', `${Math.max(-10, Math.min(10, dx * 0.55))}deg`)

      if (visible && !reduced && hasPointer && now - lastMove < 90 && now - lastSpark > 58) {
        spark(position.x, position.y + 8)
        lastSpark = now
      }
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)

    const onMove = (event: PointerEvent) => {
      target.x = event.clientX
      target.y = event.clientY
      if (!hasPointer) {
        position.x = target.x
        position.y = target.y
        hasPointer = true
      }
      lastMove = performance.now()
      show()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hide()
    }
    const onImageError = () => {
      root.classList.remove('tael-mode')
      hide()
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', hide)
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', onVisibility)
    image.addEventListener('error', onImageError)
    if (image.complete && image.naturalWidth === 0) onImageError()

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', hide)
      window.removeEventListener('blur', hide)
      document.removeEventListener('visibilitychange', onVisibility)
      image.removeEventListener('error', onImageError)
      root.classList.remove('tael-mode', 'tael-reduced')
      trail.replaceChildren()
    }
  }, [])

  return (
    <>
      <div ref={cursorRef} className="tael-cursor" aria-hidden="true">
        <div className="tael-cursor__anchor">
          <div className="tael-cursor__float">
            <span className="tael-cursor__aura" />
            <img ref={imageRef} className="tael-cursor__sprite" src={taelSprite} alt="" draggable={false} />
          </div>
        </div>
      </div>
      <div ref={trailRef} className="tael-trail" aria-hidden="true" />
    </>
  )
}
