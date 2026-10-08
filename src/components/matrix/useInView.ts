import { useEffect, useState, type RefObject } from 'react'

/**
 * True while the element is near the viewport (S-1.4a lazy loading). It follows the live state, so
 * a row scrolled far away unmounts its cells' queries and its queued requests are aborted instead
 * of holding D-20 slots. Without IntersectionObserver (old browsers, jsdom) everything counts as
 * visible - the limiter still bounds the burst.
 */
export function useInView(ref: RefObject<Element | null>): boolean {
  const supported = typeof IntersectionObserver !== 'undefined'
  const [inView, setInView] = useState(!supported)
  useEffect(() => {
    if (!supported || !ref.current) return
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1]
        if (last) setInView(last.isIntersecting)
      },
      { rootMargin: '200px' },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [supported, ref])
  return inView
}
