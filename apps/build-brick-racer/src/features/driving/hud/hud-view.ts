/**
 * Direct DOM writer for the HUD. The game loop never calls React setState per frame: it writes text, classes and
 * styles to elements marked `data-hud="name"`, and only when the value changed.
 */
export class HudView {
  private readonly nodes = new Map<string, HTMLElement>()
  private readonly text = new Map<string, string>()
  private readonly flags = new Map<string, boolean>()
  private readonly styles = new Map<string, string>()

  constructor(private readonly root: HTMLElement) {}

  private node(name: string): HTMLElement | null {
    let n = this.nodes.get(name)
    if (!n) {
      n = this.root.querySelector<HTMLElement>(`[data-hud="${name}"]`) ?? undefined
      if (n)
        this.nodes.set(name, n)
    }
    return n ?? null
  }

  set(name: string, value: string): void {
    if (this.text.get(name) === value)
      return
    const n = this.node(name)
    if (!n)
      return
    this.text.set(name, value)
    n.textContent = value
  }

  /** Toggle a CSS class on a node. */
  toggle(name: string, className: string, on: boolean): void {
    const key = `${name}:${className}`
    if (this.flags.get(key) === on)
      return
    const n = this.node(name)
    if (!n)
      return
    this.flags.set(key, on)
    n.classList.toggle(className, on)
  }

  show(name: string, visible: boolean): void {
    this.toggle(name, 'is-hidden', !visible)
  }

  style(name: string, prop: string, value: string): void {
    const key = `${name}:${prop}`
    if (this.styles.get(key) === value)
      return
    const n = this.node(name)
    if (!n)
      return
    this.styles.set(key, value)
    n.style.setProperty(prop, value)
  }

  attr(name: string, attr: string, value: string): void {
    const key = `${name}@${attr}`
    if (this.text.get(key) === value)
      return
    const n = this.node(name)
    if (!n)
      return
    this.text.set(key, value)
    n.setAttribute(attr, value)
  }

  /** Forget cached nodes after the HUD markup was re-rendered. */
  invalidate(): void {
    this.nodes.clear()
    this.text.clear()
    this.flags.clear()
    this.styles.clear()
  }
}
