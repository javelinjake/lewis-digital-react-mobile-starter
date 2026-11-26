import type { Palette, PixelRows } from './pixel-sprite'
import { drawSprite } from './pixel-sprite'

// The goalkeeper, drawn from text (see pixel-sprite). 18×24 pixels standing, facing the camera, in a keeper's top
// that stands out from the kit colours and the pitch, with big gloves. Frames: standing (with a sway), ready (arms
// up), side-stepping (lean one way) and diving, which is the ready frame turned toward the ball, so a dive can reach
// any height: low, flat or high.

/** Standing, gloves at the hips. */
const IDLE: PixelRows = [
  '......kkkkkk......',
  '.....khhhhhhk.....',
  '.....khsssshk.....',
  '.....kskssksk.....',
  '.....kssssssk.....',
  '......kSSSSk......',
  '....kkkkSSkkkk....',
  '...kttttwwttttk...',
  '..kttttttttttttk..',
  '..kTtkttttttktTk..',
  '..kttkttttttkttk..',
  '..kttkttttttkttk..',
  '..kTTkttttttkTTk..',
  '..kSSkTTTTTTkSSk..',
  '.kwwwkppppppkwwwk.',
  '.kwGwkppppppkwGwk.',
  '..kkkkppkkppkkkk..',
  '.....kppkkppk.....',
  '.....ksskkssk.....',
  '.....kttkkttk.....',
  '.....kttkkttk.....',
  '.....kTTkkTTk.....',
  '....kbbbkkbbbk....',
  '....kkkkkkkkkk....',
]

/** Arms up, gloves open: set for a shot. Turned, it is the dive. */
const READY: PixelRows = [
  '.kkk..kkkkkk..kkk.',
  'kwwwkkhhhhhhkkwwwk',
  'kwGwkkhsssshkkwGwk',
  'kwwwkksksskskkwwwk',
  '.kSk.kssssssk.kSk.',
  '.ktk..kSSSSk..ktk.',
  '.ktkkkkkSSkkkkktk.',
  '.kttttttwwttttttk.',
  '..kttttttttttttk..',
  '...kkttttttttkk...',
  '.....kttttttk.....',
  '.....kttttttk.....',
  '.....kTTTTTTk.....',
  '.....kTTTTTTk.....',
  '.....kppppppk.....',
  '.....kppppppk.....',
  '.....kppkkppk.....',
  '.....kppkkppk.....',
  '.....ksskkssk.....',
  '.....kttkkttk.....',
  '.....kttkkttk.....',
  '.....kTTkkTTk.....',
  '....kbbbkkbbbk....',
  '....kkkkkkkkkk....',
]

/** Side-stepping to the left: leaning into it, feet apart. Mirrored for the right. */
const STEP_LEFT: PixelRows = [
  '.....kkkkkk.......',
  '....khhhhhhk......',
  '....khsssshk......',
  '....kskssksk......',
  '....kssssssk......',
  '.....kSSSSk.......',
  '...kkkkSSkkkk.....',
  '..kttttwwttttk....',
  '.kttttttttttttk...',
  '.kTtkttttttktTk...',
  '.kttkttttttkttk...',
  '.kttkttttttkttk...',
  '.kTTkttttttkTTk...',
  '.kSSkTTTTTTkSSk...',
  'kwwwkppppppkwwwk..',
  'kwGwkppppppkwGwk..',
  '.kkkkppkkppkkkk...',
  '....kppk..kppk....',
  '...kssk....kssk...',
  '...kttk....kttk...',
  '..kttk......kttk..',
  '..kTTk......kTTk..',
  '.kbbbk......kbbbk.',
  '.kkkkk......kkkkk.',
]

export const KEEPER_WIDTH = 18
export const KEEPER_HEIGHT = 24
/** From the feet to the gloves at full stretch, arms up: how far a dive reaches from the keeper's middle. */
export const KEEPER_STRETCH = 9

export interface KeeperKit {
  top: string
  topShade: string
  shorts: string
  gloves: string
  gloveShade: string
  skin: string
  skinShade: string
  hair: string
}

/** Orange top, slate shorts, white gloves: it stands out on the green and from every outfield kit's two colours. */
export const KEEPER_KIT: KeeperKit = {
  top: '#ff9f43',
  topShade: '#d06a1a',
  shorts: '#2a3680',
  gloves: '#f4f4f4',
  gloveShade: '#b4bdff',
  skin: '#f2b27e',
  skinShade: '#c9814f',
  hair: '#4a2c1a',
}

export function keeperPalette(kit: KeeperKit = KEEPER_KIT): Palette {
  return { k: '#0b1028', h: kit.hair, s: kit.skin, S: kit.skinShade, t: kit.top, T: kit.topShade, w: kit.gloves, G: kit.gloveShade, p: kit.shorts, b: '#10122a' }
}

const PALETTE = keeperPalette()

/** Standing; `frame` sways a pixel either way (pass a counter, say one a frame every 400 ms). */
interface Standing { pose: 'idle', frame?: number }
/** Arms up, set for the shot. */
interface Ready { pose: 'ready' }
/** Shuffling sideways: `frame` alternates the step with standing. */
interface Stepping { pose: 'step', toward: 'left' | 'right', frame?: number }
/**
 * Diving from where they stand toward `to` (a canvas point: where the gloves go). `amount` runs 0 (still standing)
 * to 1 (at full stretch), and on to 2 as they come down.
 */
interface Diving { pose: 'dive', to: { x: number, y: number }, amount: number }

export type KeeperPose = Standing | Ready | Stepping | Diving

function shadow(context: CanvasRenderingContext2D, x: number, ground: number, width: number) {
  context.fillStyle = 'rgba(7, 11, 30, 0.45)'
  context.fillRect(Math.round(x - width / 2), Math.round(ground) - 1, Math.round(width), 2)
}

/** Where the keeper's middle and turn are, part way through a dive from standing at (`x`, `ground`). */
export function diveFrame(x: number, ground: number, to: { x: number, y: number }, amount: number) {
  const from = { x, y: ground - KEEPER_HEIGHT / 2 }
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  // Turned from upright so the gloves point at the ball, never further over than a little past flat.
  const side = dx < 0 ? -1 : 1
  const limit = (105 * Math.PI) / 180
  const angle = length < 3 ? 0 : side * Math.min(limit, Math.abs(Math.atan2(dx, -dy)))
  const reach = Math.max(0, length - KEEPER_STRETCH)
  const out = Math.min(1, amount)
  const eased = 1 - (1 - out) * (1 - out)
  const centre = { x: from.x + (dx / (length || 1)) * reach * eased, y: from.y + (dy / (length || 1)) * reach * eased }
  // Then down: back onto their feet from a jump straight up, or flat on the ground from a dive.
  const fall = Math.max(0, Math.min(1, amount - 1))
  if (angle === 0)
    return { x: centre.x, y: centre.y + (from.y - centre.y) * fall, angle: 0 }
  const lying = Math.max(centre.y, ground - 7)
  const turned = angle * eased
  return { x: centre.x, y: centre.y + (lying - centre.y) * fall * fall, angle: turned + (side * (Math.PI / 2) - turned) * fall }
}

/** Draws the keeper standing at `x` with their feet on `ground` (canvas pixels), in a pose. */
export function drawKeeper(context: CanvasRenderingContext2D, x: number, ground: number, keeper: KeeperPose, palette: Palette = PALETTE) {
  const feet = { anchorX: KEEPER_WIDTH / 2, anchorY: KEEPER_HEIGHT }
  switch (keeper.pose) {
    case 'idle': {
      shadow(context, x, ground, 12)
      const sway = ((keeper.frame ?? 0) % 4 === 1 ? 1 : (keeper.frame ?? 0) % 4 === 3 ? -1 : 0)
      drawSprite(context, IDLE, palette, x + sway, ground, feet)
      return
    }
    case 'ready':
      shadow(context, x, ground, 12)
      drawSprite(context, READY, palette, x, ground, feet)
      return
    case 'step':
      shadow(context, x, ground, 16)
      if ((keeper.frame ?? 0) % 2 === 0)
        drawSprite(context, STEP_LEFT, palette, x, ground, { ...feet, flip: keeper.toward === 'right' })
      else
        drawSprite(context, IDLE, palette, x, ground, feet)
      return
    case 'dive': {
      const frame = diveFrame(x, ground, keeper.to, keeper.amount)
      shadow(context, frame.x, ground, 14)
      if (keeper.amount <= 0) {
        drawSprite(context, READY, palette, x, ground, feet)
        return
      }
      drawSprite(context, READY, palette, frame.x, frame.y, { anchorX: KEEPER_WIDTH / 2, anchorY: KEEPER_HEIGHT / 2, rotate: frame.angle })
    }
  }
}
