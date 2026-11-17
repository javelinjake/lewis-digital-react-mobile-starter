export type BackdropKind = 'garage' | 'kitchen' | 'garden' | 'plain'

/**
 * Placeholder backdrop: layered gradients that stand in for the blurred photographic scenes of the design
 * boards (workbench, kitchen, garden). Replace with licensed artwork without touching screen logic.
 */
const backgrounds: Record<BackdropKind, string> = {
  garage: [
    'radial-gradient(ellipse at 12% 8%, rgba(255,244,214,.95) 0, rgba(255,244,214,0) 34%)',
    'radial-gradient(ellipse at 88% 12%, rgba(120,190,120,.55) 0, rgba(120,190,120,0) 30%)',
    'linear-gradient(180deg, #cfe3ef 0%, #a9c4d6 34%, #b7824f 36%, #9a6538 70%, #6e4424 100%)',
  ].join(','),
  kitchen: [
    'radial-gradient(ellipse at 20% 6%, rgba(255,246,222,.95) 0, rgba(255,246,222,0) 36%)',
    'repeating-linear-gradient(90deg, rgba(255,255,255,.18) 0 2px, rgba(255,255,255,0) 2px 46px)',
    'linear-gradient(180deg, #f4dcb4 0%, #e9c996 34%, #dfe7ee 36%, #c3ced9 100%)',
  ].join(','),
  garden: [
    'radial-gradient(ellipse at 80% 4%, rgba(255,255,230,.95) 0, rgba(255,255,230,0) 30%)',
    'linear-gradient(180deg, #8fd0ff 0%, #c4ecff 30%, #5fae45 32%, #3f8b33 60%, #6b4423 100%)',
  ].join(','),
  plain: 'linear-gradient(180deg, #0f2a4d, #081a33)',
}

export function SceneBackdrop({ kind = 'garage', dim = 0.18 }: { kind?: BackdropKind, dim?: number }) {
  return (
    <div className="br-backdrop" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: backgrounds[kind], filter: 'blur(3px) saturate(1.1)', transform: 'scale(1.04)' }} />
      <div className="absolute inset-0" style={{ background: `rgba(6, 18, 40, ${dim})` }} />
    </div>
  )
}
