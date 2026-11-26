import type { SpriteParts } from '@ld/pixel-pitch-core'
import { loadImage } from '@ld/game'
import { composeSprite } from './compose'
import { playerLayers } from './player-layers'

// Animation frames for a player sprite in the arcade, made from the same 12×16 layer art as everywhere else: a run
// cycle, the same seen from behind (for the player's own runner, going up the pitch), and a lunging tackle to either
// side. Each frame is a small canvas with room around the sprite, its feet on the bottom row.

/** Every frame's size, and where the 12×16 sprite sits in it. */
export const FRAME_WIDTH = 20
export const FRAME_HEIGHT = 18
const OX = 4
const OY = 1
/** The top of the legs in the sprite: rows above it are the head and body, rows from it the legs. */
const LEGS = 11

export interface RunnerFrames {
  /** Four steps: left foot up, down, right foot up, down. */
  run: HTMLCanvasElement[]
  /** Lunging with a leg out to the left, and to the right. */
  lunge: [left: HTMLCanvasElement, right: HTMLCanvasElement]
}

function canvas(width: number, height: number) {
  const element = document.createElement('canvas')
  element.width = width
  element.height = height
  const context = element.getContext('2d', { willReadFrequently: true })!
  context.imageSmoothingEnabled = false
  return { element, context }
}

type Source = HTMLImageElement | HTMLCanvasElement

/** Draws a part of the sprite (`sx`, `sy`, `w`, `h`) into a frame, moved by (`dx`, `dy`). */
function part(context: CanvasRenderingContext2D, source: Source, sx: number, sy: number, w: number, h: number, dx: number, dy: number) {
  context.drawImage(source, sx, sy, w, h, OX + sx + dx, OY + sy + dy, w, h)
}

/** One step: the body bobbing down `bob` pixels, and one foot lifted. */
function step(source: Source, lift: 'left' | 'right' | null, bob: number) {
  const { element, context } = canvas(FRAME_WIDTH, FRAME_HEIGHT)
  part(context, source, 0, LEGS, 6, 16 - LEGS, 0, lift === 'left' ? -1 : 0)
  part(context, source, 6, LEGS, 6, 16 - LEGS, 0, lift === 'right' ? -1 : 0)
  part(context, source, 0, 0, 12, LEGS, 0, bob)
  return element
}

/** A lunge to `side`: crouched, leaning in, that leg stretched out along the grass and a puff of dust at the boot. */
function lunge(source: Source, side: -1 | 1) {
  const { element, context } = canvas(FRAME_WIDTH, FRAME_HEIGHT)
  const [plantX, reachX] = side < 0 ? [6, 0] : [0, 6]
  part(context, source, plantX, LEGS, 6, 16 - LEGS, 0, 0)
  // The shin and boot (not the shorts) drawn out sideways, three pixels long, for the leg stretched at the ball.
  for (let reach = 1; reach <= 3; reach++)
    part(context, source, reachX, LEGS + 2, 6, 14 - LEGS, side * reach, 1)
  part(context, source, 0, 0, 12, LEGS, side, 2)
  context.fillStyle = 'rgba(244, 244, 244, 0.7)'
  const boot = side < 0 ? OX - 3 : OX + 14
  context.fillRect(boot, FRAME_HEIGHT - 2, 1, 1)
  context.fillRect(boot + side, FRAME_HEIGHT - 3, 1, 1)
  return element
}

/** The sprite seen from behind: the face becomes the back of the head (hair, or skin for a bald player). */
function fromBehind(image: HTMLImageElement) {
  const { element, context } = canvas(12, 16)
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, 12, 16)
  const at = (x: number, y: number) => (y * 12 + x) * 4
  const colour = (x: number, y: number) => Array.from(pixels.data.slice(at(x, y), at(x, y) + 4))
  const skin = colour(5, 5)
  const hair = colour(5, 1)
  const bald = hair.every((value, index) => value === skin[index])
  for (let y = 2; y <= 5; y++) {
    for (let x = 3; x <= 8; x++) {
      if (pixels.data[at(x, y) + 3] === 0)
        continue
      pixels.data.set(bald ? skin : hair, at(x, y))
    }
  }
  context.putImageData(pixels, 0, 0)
  return element
}

function framesOf(source: Source): RunnerFrames {
  return {
    run: [step(source, 'left', 0), step(source, null, 1), step(source, 'right', 0), step(source, null, 1)],
    lunge: [lunge(source, -1), lunge(source, 1)],
  }
}

/** A player's frames in `kit`, facing the camera or, with `behind`, running away from it. */
export async function runnerFrames(sprite: SpriteParts, kit: readonly [string, string], behind = false): Promise<RunnerFrames> {
  const image = await loadImage(await composeSprite(playerLayers(sprite, kit), 12, 16))
  return framesOf(behind ? fromBehind(image) : image)
}
