import { useEffect, useState, type RefObject } from 'react'

/**
 * True once the element has been near the viewport (sticky: never flips back, so cached cells are
 * not unmounted/refetched while scrolling). This is what makes the matrix lazy per row (S-1.4a):
 * rows far below the fold issue no state requests. Without IntersectionObserver (old browsers,
 * jsdom) everything counts as visible - the D-20 limiter still bounds the burst.
 */
export function useInView(ref: RefObject<Element | null>): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (seen || !ref.current) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [seen, ref])
  return seen
}
