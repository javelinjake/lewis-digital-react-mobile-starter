// A goal under the floodlights, seen from behind the penalty spot, for the canvas games that are played at a goal
// (Penalty Shootout, Keeper Reflex). One canvas pixel is one goal unit, so the rules' numbers (in `core`) are pixels
// here: `x` from the left post, `y` up from the goal line.

export interface GoalScene {
  /** The canvas, in pixels. */
  width: number
  height: number
  /** Where the goal mouth starts (x = 0) and where the goal line is (y = 0). */
  left: number
  ground: number
  goalWidth: number
  goalHeight: number
  /** The penalty spot. */
  spot: { x: number, y: number }
  /** The crowd and the advertising boards along the top. */
  standHeight: number
}

export const PITCH = '#23702d'
export const PITCH_DARK = '#287a32'
const LINE = 'rgba(244, 244, 244, 0.85)'
const NET = 'rgba(232, 236, 255, 0.22)'
const NET_EDGE = 'rgba(232, 236, 255, 0.5)'

/** A point in goal units, on the canvas. */
export function toCanvas(scene: GoalScene, x: number, y: number) {
  return { x: scene.left + x, y: scene.ground - y }
}

/** A canvas point, in goal units. */
export function toGoal(scene: GoalScene, x: number, y: number) {
  return { x: x - scene.left, y: scene.ground - y }
}

/** Where a pointer event landed, in canvas pixels, whatever size the canvas is drawn at. */
export function pointerOnCanvas(event: { clientX: number, clientY: number, currentTarget: Element }, scene: Pick<GoalScene, 'width' | 'height'>) {
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0)
    return null
  return { x: ((event.clientX - rect.left) / rect.width) * scene.width, y: ((event.clientY - rect.top) / rect.height) * scene.height }
}

/** The stand, the pitch, the lines and the back of the net: everything behind the keeper. */
export function drawGoalScene(context: CanvasRenderingContext2D, scene: GoalScene, crowd?: HTMLImageElement | null) {
  const { width, height, left, ground, goalWidth, goalHeight, spot, standHeight } = scene
  const right = left + goalWidth
  const top = ground - goalHeight

  context.fillStyle = '#0b1028'
  context.fillRect(0, 0, width, height)
  // The crowd, then the boards: navy panels with a yellow mark on each.
  const boards = standHeight - 5
  if (crowd) {
    for (let x = 0; x < width; x += crowd.width) {
      for (let y = boards - crowd.height; y > -crowd.height; y -= crowd.height)
        context.drawImage(crowd, x, y)
    }
  }
  context.fillStyle = '#16204f'
  context.fillRect(0, boards, width, 5)
  context.fillStyle = '#2a3680'
  context.fillRect(0, boards, width, 1)
  for (let x = 4; x < width; x += 24) {
    context.fillStyle = (x / 24) % 2 < 1 ? '#ffd23f' : '#5ac8fa'
    context.fillRect(x, boards + 2, 12, 2)
  }

  // Mown stripes, across.
  for (let y = standHeight, band = 0; y < height; y += 8, band++) {
    context.fillStyle = band % 2 ? PITCH_DARK : PITCH
    context.fillRect(0, y, width, 8)
  }

  // The goal line, the six-yard box (wider as it comes toward us) and the spot.
  context.fillStyle = LINE
  context.fillRect(0, ground, width, 1)
  const box = Math.round((height - ground) * 0.28)
  for (let step = 0; step <= box; step++) {
    const spread = Math.round(step * 0.5)
    context.fillRect(left - 14 - spread, ground + step, 1, 1)
    context.fillRect(right + 13 + spread, ground + step, 1, 1)
  }
  const spreadAtBox = Math.round(box * 0.5)
  context.fillRect(left - 14 - spreadAtBox, ground + box, goalWidth + 28 + spreadAtBox * 2, 1)
  context.fillRect(Math.round(spot.x) - 1, Math.round(spot.y), 3, 1)

  // The net: dark in the mouth, the back frame a few pixels in, the mesh over it.
  const depth = 5
  context.fillStyle = 'rgba(7, 11, 30, 0.55)'
  context.fillRect(left, top, goalWidth, goalHeight)
  context.fillStyle = NET
  for (let x = left + 3; x < right; x += 4)
    context.fillRect(x, top, 1, goalHeight)
  for (let y = top + 3; y < ground; y += 4)
    context.fillRect(left, y, goalWidth, 1)
  context.fillStyle = NET_EDGE
  context.fillRect(left + depth, top + depth - 1, goalWidth - depth * 2, 1)
  context.fillRect(left + depth, top + depth - 1, 1, goalHeight - depth + 1)
  context.fillRect(right - depth - 1, top + depth - 1, 1, goalHeight - depth + 1)
  for (let step = 0; step < depth; step++) {
    context.fillRect(left + step, top + step, 1, 1)
    context.fillRect(right - 1 - step, top + step, 1, 1)
  }
}

/** The posts and the bar, in front of the keeper and the net: white, with a shaded edge. */
export function drawGoalFrame(context: CanvasRenderingContext2D, scene: GoalScene) {
  const { left, ground, goalWidth, goalHeight } = scene
  const right = left + goalWidth
  const top = ground - goalHeight
  context.fillStyle = '#f4f4f4'
  context.fillRect(left - 2, top - 2, goalWidth + 4, 2)
  context.fillRect(left - 2, top - 2, 2, goalHeight + 3)
  context.fillRect(right, top - 2, 2, goalHeight + 3)
  context.fillStyle = '#b4bdff'
  context.fillRect(left - 1, top - 1, goalWidth + 2, 1)
  context.fillRect(left - 1, top, 1, goalHeight + 1)
  context.fillRect(right + 1, top, 1, goalHeight + 1)
}

/** A ring where a ball went in, spreading through the net for `amount` 0 to 1. */
export function drawNetRipple(context: CanvasRenderingContext2D, x: number, y: number, amount: number) {
  if (amount <= 0 || amount >= 1)
    return
  const radius = 3 + amount * 9
  context.fillStyle = `rgba(232, 236, 255, ${0.6 * (1 - amount)})`
  for (let step = 0; step < 16; step++) {
    const turn = (step / 16) * Math.PI * 2
    context.fillRect(Math.round(x + Math.cos(turn) * radius), Math.round(y + Math.sin(turn) * radius * 0.7), 1, 1)
  }
}
