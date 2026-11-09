/**
 * Pixel art must be scaled by whole numbers, or edges blur and pixels come out uneven widths.
 * Picks the largest whole scale at which the art still fits, and never below 1.
 */
export function integerScale(availableWidth: number, availableHeight: number, logicalWidth: number, logicalHeight: number) {
  return Math.max(1, Math.floor(Math.min(availableWidth / logicalWidth, availableHeight / logicalHeight)))
}

/** The canvas backing size for a logical size: scaled up by the whole-number display scale and the device pixel ratio, rounded. */
export function canvasBackingSize(logicalWidth: number, logicalHeight: number, scale: number, devicePixelRatio: number) {
  const ratio = Math.max(1, Math.round(devicePixelRatio))
  return { width: logicalWidth * scale * ratio, height: logicalHeight * scale * ratio, cssWidth: logicalWidth * scale, cssHeight: logicalHeight * scale }
}

/** CSS for a 9-slice image (buttons, panels, bars). `slice` is the inset in source pixels, `scale` the whole-number zoom. */
export function nineSliceStyle(url: string, slice: number, scale = 3) {
  return {
    borderStyle: 'solid',
    borderWidth: `${slice * scale}px`,
    borderImage: `url(${url}) ${slice} fill / ${slice * scale}px stretch`,
    imageRendering: 'pixelated',
  } as const
}
