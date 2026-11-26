/** A rival's shield: the league's sides have no crest art, so a plain one in colours picked from their place. */
const RIVAL_COLOURS = [['#3b6fd8', '#ffd23f'], ['#7a3fd6', '#f4f4f4'], ['#e08a2e', '#15141c'], ['#2e9e8a', '#f4f4f4'], ['#c43a5a', '#f4f4f4']] as const
export function RivalShield({ index, size = 38 }: { index: number, size?: number }) {
  const [top, bottom] = RIVAL_COLOURS[index % RIVAL_COLOURS.length]
  return (
    <svg viewBox="0 0 12 14" width={size} height={Math.round(size * 14 / 12)} shapeRendering="crispEdges" aria-hidden="true">
      <path fill="#0b1028" d="M0 0h12v9h-1v2H9v2H7v1H5v-1H3v-2H1V9H0z" />
      <path fill={top} d="M1 1h10v5H1z" />
      <path fill={bottom} d="M1 6h10v2h-1v2H8v2H4v-2H2V8H1z" />
    </svg>
  )
}
