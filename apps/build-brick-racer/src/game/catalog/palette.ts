/** Twelve clear colours. Colour has no physical effect. Hex values are theme-able via the renderer. */
export interface PaletteColour {
  id: string
  label: string
  hex: string
}

export const PALETTE: readonly PaletteColour[] = [
  { id: 'white', label: 'White', hex: '#f4f4f2' },
  { id: 'black', label: 'Black', hex: '#202126' },
  { id: 'grey', label: 'Grey', hex: '#8d949c' },
  { id: 'red', label: 'Red', hex: '#e3342f' },
  { id: 'orange', label: 'Orange', hex: '#ff7a1a' },
  { id: 'yellow', label: 'Yellow', hex: '#ffd21f' },
  { id: 'green', label: 'Green', hex: '#2fbf4a' },
  { id: 'teal', label: 'Teal', hex: '#14b8a6' },
  { id: 'blue', label: 'Blue', hex: '#2563eb' },
  { id: 'purple', label: 'Purple', hex: '#8b5cf6' },
  { id: 'pink', label: 'Pink', hex: '#ff6fb5' },
  { id: 'brown', label: 'Brown', hex: '#8a5a2b' },
]

export const DEFAULT_COLOUR = 'orange'
export const TYRE_HEX = '#1c1c20'
export const GLASS_HEX = '#6ec6ff'

export const colourHex = (id: string): string => PALETTE.find(c => c.id === id)?.hex ?? PALETTE[0]!.hex
