import { useEffect, useRef, useState } from 'react'

function useReducedMotion() {
  // Assume reduced motion before mount. Decorations must never be required to understand state.
  const [reduced, setReduced] = useState(true)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

export function SharedTrail({ participatingDays }: { participatingDays: number }) {
  const count = Number.isFinite(participatingDays)
    ? Math.max(0, Math.min(3, Math.floor(participatingDays)))
    : 0
  const offset = count < 2 ? 100 : count === 2 ? 50 : 0
  const reduced = useReducedMotion()
  const path = useRef<SVGPathElement>(null)
  const previous = useRef(offset)

  useEffect(() => {
    const from = previous.current
    previous.current = offset
    if (reduced || from === offset)
      return
    const animation = path.current?.animate(
      [{ strokeDashoffset: from }, { strokeDashoffset: offset }],
      { duration: 450, easing: 'ease-out' },
    )
    return () => animation?.cancel()
  }, [offset, reduced])

  return (
    <section aria-label="Your family trail">
      <p role="status" className="text-sm font-bold">
        {count} of 3 participating days this week
      </p>
      <svg viewBox="0 0 310 76" aria-hidden="true" className="w-full">
        <path d="M40 39 C80 8 100 70 155 39 S230 10 270 39" fill="none" stroke="#e6dfd2" strokeWidth="5" />
        <path
          ref={path}
          d="M40 39 C80 8 100 70 155 39 S230 10 270 39"
          fill="none"
          stroke="#0000ff"
          strokeWidth="5"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={offset}
        />
        {[40, 155, 270].map((x, i) => (
          <g key={x}>
            <circle cx={x} cy="39" r="17" fill={i < count ? '#0000ff' : '#fffdf8'} stroke={i < count ? '#0000ff' : '#d2caba'} strokeWidth="2" />
            <text x={x} y="44" textAnchor="middle" fill={i < count ? 'white' : '#506077'} fontSize="15">
              {i < count ? '✓' : i + 1}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-sm">One little moment is enough. Your memories stay.</p>
    </section>
  )
}

/** Render once for a new local attempt, not again when it later syncs. */
export function MemoryStamp({ operationId, label }: { operationId: string, label: string }) {
  const reduced = useReducedMotion()
  const node = useRef<HTMLDivElement>(null)
  const lastAnimated = useRef<string | null>(null)
  useEffect(() => {
    if (reduced || lastAnimated.current === operationId)
      return
    lastAnimated.current = operationId
    const animation = node.current?.animate(
      [
        { transform: 'scale(.92) rotate(-4deg)', opacity: 0.3 },
        { transform: 'scale(1.03) rotate(1deg)', opacity: 1, offset: 0.65 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 360, easing: 'ease-out' },
    )
    return () => animation?.cancel()
  }, [operationId, reduced])
  return <div ref={node} className="rounded-2xl bg-brand-yellow p-4 font-bold">{label}</div>
}
