import type { Cabinet } from '@ld/pixel-pitch-core'
import { rivalKit } from '../lib/club'

// A small pixel picture of each arcade game, for the top of its card. Each is drawn from little character sprites
// placed on a grid, then turned into one SVG of crisp rectangles: one per run of a colour along a row.

const WIDTH = 44
const HEIGHT = 20

type Sprite = readonly string[]
type Placed = readonly [sprite: Sprite, x: number, y: number]

// Colour keys: k outline and boots, w white, s skin, h hair, p shirt (the club's colour), q shorts (the club's second
// colour), r and t the other side's shirt and shorts, c the keeper's shirt, y yellow, g green, b the dark of a bar,
// n navy, m the net, l a light line on the grass.

const BALL: Sprite = [
  '.kkkk.',
  'kwkwwk',
  'kkkwwk',
  'kwwkkk',
  'kwwkwk',
  '.kkkk.',
]

const BALL_BIG: Sprite = [
  '..kkkk..',
  '.kwwkwk.',
  'kwkkwwwk',
  'kwkwwkwk',
  'kwwwkkwk',
  'kkwwkwwk',
  '.kwkwwk.',
  '..kkkk..',
]

/** Standing, one foot up for a touch of the ball. */
const JUGGLER: Sprite = [
  '..hhh....',
  '.hhhhh...',
  '.hsssh...',
  '..sss....',
  '.ppppp...',
  'ppppppp..',
  's.ppp.s..',
  '..ppp....',
  '..qqqq...',
  '..s..skk.',
  '..p......',
  '.kk......',
]

/** Running right, legs apart. */
const RUNNER: Sprite = [
  '...hhh...',
  '..hhhhs..',
  '..hhsss..',
  '...sss...',
  '...ppp...',
  '..pppppss',
  '.sspppp..',
  '...ppp...',
  '...qqq...',
  '..s...s..',
  '.p.....p.',
  'kk......k',
]

/** Sliding in from the right, a leg out to the left. */
const TACKLER: Sprite = [
  '........hhh.',
  '.......hsssh',
  '........sss.',
  '......rrrr..',
  '....rrrrrrs.',
  '..ttttrr....',
  'kkrrttt.....',
]

/** A keeper on the line, arms out. */
const KEEPER: Sprite = [
  '...hhh...',
  '..hhhhh..',
  '..hsssh..',
  '...sss...',
  'w.ccccc.w',
  'ccccccccc',
  '...ccc...',
  '...nnn...',
  '...s.s...',
  '...c.c...',
  '..kk.kk..',
]

/** A keeper flying to the right, gloves first. */
const DIVER: Sprite = [
  '..............ww',
  '.........hhh.ppw',
  '........hhsssp..',
  'kspppqqqppppppp.',
  'kspppqqqpppppp..',
]

/** The goal: posts and bar in white, the net behind. */
function goal(width: number, height: number): Sprite {
  return Array.from({ length: height }, (_, row) => {
    if (row === 0)
      return 'w'.repeat(width)
    return Array.from({ length: width }, (_, column) => {
      if (column === 0 || column === width - 1)
        return 'w'
      return (row + column) % 3 === 0 ? 'm' : '.'
    }).join('')
  })
}

/** A timing bar with the target in it: a yellow middle and green either side. */
function bar(width: number, centre: number): Sprite {
  const inner = Array.from({ length: width - 2 }, (_, index) => {
    const distance = Math.abs(index + 1 - centre)
    return distance <= 1 ? 'y' : distance <= 4 ? 'g' : 'b'
  }).join('')
  return ['n'.repeat(width), `n${inner}n`, `n${inner}n`, `n${inner}n`, `n${inner}n`, 'n'.repeat(width)]
}

const line = (characters: string): Sprite => [characters]
/** One dot of the dribbler's path, and of a ball's flight. */
const DOT = line('y')
const TRAIL = line('l')

// The card's best-score badge sits over the top right of the picture, so each keeps its top right clear.
const SCENES: Record<Cabinet, readonly Placed[]> = {
  kick: [
    [bar(42, 32), 1, 13],
    [line('ll.l..l'), 2, 14],
    [line('.l..ll'), 3, 16],
    [BALL_BIG, 10, 12],
  ],
  keepy: [
    [JUGGLER, 9, 8],
    [line('l.l'), 17, 15],
    [line('.l'), 20, 12],
    [BALL, 17, 4],
  ],
  pens: [
    [goal(26, 15), 1, 3],
    [KEEPER, 9, 7],
    [BALL, 19, 5],
    [TRAIL, 26, 11],
    [TRAIL, 29, 13],
    [TRAIL, 32, 15],
    [line('ww'), 34, 18],
  ],
  keeper: [
    [goal(26, 15), 1, 3],
    [DIVER, 4, 7],
    [BALL, 20, 5],
    [TRAIL, 27, 11],
    [TRAIL, 30, 13],
    [TRAIL, 33, 15],
    [TRAIL, 36, 17],
  ],
  dribble: [
    [DOT, 11, 8],
    [DOT, 13, 6],
    [DOT, 15, 5],
    [DOT, 17, 4],
    [DOT, 20, 3],
    [DOT, 23, 4],
    [DOT, 25, 5],
    [DOT, 27, 7],
    [DOT, 29, 9],
    [DOT, 30, 11],
    [line('y.y'), 30, 12],
    [line('y'), 31, 13],
    [RUNNER, 0, 8],
    [BALL, 8, 14],
    [TACKLER, 17, 13],
  ],
}

/** Every pixel of a scene, top to bottom, as colour keys ('.' for none). */
function paint(scene: readonly Placed[]): string[][] {
  const grid = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => '.'))
  for (const [sprite, x, y] of scene) {
    for (const [row, characters] of sprite.entries()) {
      for (const [column, key] of [...characters].entries()) {
        const gy = y + row
        const gx = x + column
        if (key !== '.' && gy >= 0 && gy < HEIGHT && gx >= 0 && gx < WIDTH)
          grid[gy][gx] = key
      }
    }
  }
  return grid
}

/** One rectangle for each run of a colour along a row. */
function runs(grid: readonly string[][]) {
  const rects: Array<{ x: number, y: number, width: number, key: string }> = []
  for (const [y, row] of grid.entries()) {
    let x = 0
    while (x < row.length) {
      const key = row[x]
      let end = x + 1
      while (end < row.length && row[end] === key)
        end++
      if (key !== '.')
        rects.push({ x, y, width: end - x, key })
      x = end
    }
  }
  return rects
}

const RECTS = Object.fromEntries(Object.entries(SCENES).map(([cabinet, scene]) => [cabinet, runs(paint(scene))])) as Record<Cabinet, ReturnType<typeof runs>>

/**
 * A pixel picture of `cabinet`, `scale` screen pixels to a pixel. The player is in the club's kit, and the other side
 * in a kit that stands out from it.
 */
export function CabinetArt({ cabinet, kit, scale = 2, className = '' }: { cabinet: Cabinet, kit: readonly [string, string], scale?: number, className?: string }) {
  const [rival, rivalShorts] = rivalKit(kit)
  const colours: Record<string, string> = {
    k: '#10122a',
    w: '#f4f4f4',
    s: '#f2c79b',
    h: '#3b2a1a',
    p: kit[0],
    q: kit[1],
    r: rival,
    t: rivalShorts,
    c: '#ff9f43',
    y: '#ffd23f',
    g: '#3fa34d',
    b: '#3a3f72',
    n: '#0b1028',
    m: 'rgba(244, 244, 244, 0.35)',
    l: 'rgba(244, 244, 244, 0.6)',
  }
  return (
    <svg
      width={WIDTH * scale}
      height={HEIGHT * scale}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      shapeRendering="crispEdges"
      className={`pixel ${className}`}
      aria-hidden="true"
    >
      {RECTS[cabinet].map(rect => <rect key={`${rect.x},${rect.y}`} x={rect.x} y={rect.y} width={rect.width} height={1} fill={colours[rect.key]} />)}
    </svg>
  )
}
