// Small sprites drawn from text, for the canvas games: one character a pixel, `.` clear, any other character a colour
// from a palette. Each sprite and palette is painted once into a little canvas and then drawn from that, so a game can
// draw dozens a frame. Draw onto a canvas with image smoothing off (useCanvasLoop turns it off) for hard pixel edges.

export type PixelRows = readonly string[]
export type Palette = Readonly<Record<string, string>>

const painted = new WeakMap<PixelRows, Map<string, HTMLCanvasElement>>()

/** The sprite painted in `palette`, once: later calls get the same canvas. */
export function paintSprite(rows: PixelRows, palette: Palette): HTMLCanvasElement {
  const key = JSON.stringify(palette)
  let byPalette = painted.get(rows)
  if (!byPalette) {
    byPalette = new Map()
    painted.set(rows, byPalette)
  }
  const ready = byPalette.get(key)
  if (ready)
    return ready
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(...rows.map(row => row.length))
  canvas.height = rows.length
  const context = canvas.getContext('2d')!
  for (const [y, row] of rows.entries()) {
    for (let x = 0; x < row.length; x++) {
      const colour = palette[row[x]]
      if (row[x] === '.' || !colour)
        continue
      context.fillStyle = colour
      context.fillRect(x, y, 1, 1)
    }
  }
  byPalette.set(key, canvas)
  return canvas
}

export interface DrawOptions {
  /** The sprite pixel that lands on (x, y). Its middle by default. */
  anchorX?: number
  anchorY?: number
  /** Mirror left to right (about the anchor). */
  flip?: boolean
  /** Turn about the anchor, in radians, clockwise. */
  rotate?: number
  /** Whole pixels per sprite pixel. */
  scale?: number
  alpha?: number
}

/** Draws a sprite with its anchor at (x, y). Unrotated, it lands on whole pixels, so it stays crisp. */
export function drawSprite(context: CanvasRenderingContext2D, rows: PixelRows, palette: Palette, x: number, y: number, options: DrawOptions = {}) {
  const image = paintSprite(rows, palette)
  const { anchorX = image.width / 2, anchorY = image.height / 2, flip = false, rotate = 0, scale = 1, alpha = 1 } = options
  context.save()
  context.globalAlpha = alpha
  context.translate(rotate ? x : Math.round(x), rotate ? y : Math.round(y))
  if (rotate)
    context.rotate(rotate)
  context.scale(flip ? -scale : scale, scale)
  context.drawImage(image, -anchorX, -anchorY)
  context.restore()
}

/** A pixel football of whole-pixel `radius`, the patches turned to `spin` (any number: a quarter turn each 1). */
export function ballRows(radius: number, spin: number): PixelRows {
  const r = Math.max(2, Math.round(radius))
  const size = r * 2
  const turn = ((Math.floor(spin) % 4) + 4) % 4
  // A patch in the middle and three round it, the three turned a quarter at a time as it spins.
  const patches = [[0, -0.62], [0.58, 0.32], [-0.58, 0.32]].map(([px, py]) => {
    const [qx, qy] = turn === 0 ? [px, py] : turn === 1 ? [-py, px] : turn === 2 ? [-px, -py] : [py, -px]
    return [qx * r, qy * r]
  })
  patches.push([0, 0])
  const patch = r * 0.12 + 0.4
  const rows: string[] = []
  for (let y = 0; y < size; y++) {
    let row = ''
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - r
      const dy = y + 0.5 - r
      const d = dx * dx + dy * dy
      if (d > r * r) {
        row += '.'
      }
      else if (d > (r - 1) * (r - 1)) {
        row += 'k'
      }
      else if (patches.some(([px, py]) => Math.abs(dx - px) < patch && Math.abs(dy - py) < patch)) {
        row += 'p'
      }
      else {
        row += dx + dy > r * 0.55 ? 's' : 'w'
      }
    }
    rows.push(row)
  }
  return rows
}

export const BALL_PALETTE: Palette = { k: '#0b1028', w: '#f4f4f4', s: '#b4bdff', p: '#1b1f3b' }

const balls = new Map<string, PixelRows>()

/** Draws a pixel football with its middle at (x, y). */
export function drawBall(context: CanvasRenderingContext2D, x: number, y: number, radius: number, spin = 0, alpha = 1) {
  const r = Math.max(2, Math.round(radius))
  const key = `${r}:${((Math.floor(spin) % 4) + 4) % 4}`
  let rows = balls.get(key)
  if (!rows) {
    rows = ballRows(r, spin)
    balls.set(key, rows)
  }
  drawSprite(context, rows, BALL_PALETTE, x, y, { anchorX: r, anchorY: r, alpha })
}
