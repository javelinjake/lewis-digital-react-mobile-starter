/** Illustration for "Start empty": a baseplate and a handful of loose bricks. Drawn inline, no assets. */
export function BricksArt({ className = '' }: { className?: string }) {
  const brick = (x: number, y: number, w: number, fill: string, key: string) => (
    <g key={key} transform={`translate(${x} ${y})`}>
      <rect x="0" y="10" width={w} height="26" rx="4" fill={fill} />
      <rect x="0" y="30" width={w} height="6" rx="3" fill="rgba(0,0,0,.18)" />
      {Array.from({ length: Math.round(w / 22) }, (_, i) => <rect key={i} x={6 + i * 22} y="2" width="14" height="10" rx="4" fill={fill} />)}
    </g>
  )
  return (
    <svg viewBox="0 0 240 150" className={className} aria-hidden="true">
      <polygon points="50,98 130,70 205,92 128,126" fill="#8d949c" />
      <polygon points="50,98 128,126 128,136 50,108" fill="#6d747c" />
      <polygon points="128,126 205,92 205,102 128,136" fill="#7b828a" />
      {Array.from({ length: 12 }, (_, i) => <ellipse key={i} cx={78 + (i % 4) * 22 + Math.floor(i / 4) * 6} cy={96 + Math.floor(i / 4) * -8 + (i % 4) * 4} rx="7" ry="3.5" fill="#a0a7af" />)}
      {brick(20, 28, 66, '#14b8a6', 'a')}
      {brick(110, 10, 44, '#ff9d2e', 'b')}
      {brick(168, 34, 44, '#8b5cf6', 'c')}
      {brick(8, 74, 44, '#ffd21f', 'd')}
      {brick(176, 96, 44, '#e3342f', 'e')}
      <circle cx="128" cy="86" r="14" fill="#fff" />
      <path d="M121 86h14M128 79v14" stroke="#0b1f3a" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}
