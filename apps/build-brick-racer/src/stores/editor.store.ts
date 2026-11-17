import type { PlacementCandidate } from '@/game/build/candidates'
import type { WheelRolePatch } from '@/game/build/edit'
import type { History } from '@/game/build/history'
/**
 * Builder state: the car being edited, undo history, selection, tray choice and autosave.
 * Easy Build and Free Build share this store and the same car data. Mode lives in preferences.
 * Every committed edit is one undoable transaction; an invalid edit changes nothing and leaves
 * its issues in `issues` for the editor to explain.
 */
import type { BuildIssue, CarDocument, EditResult, Forward } from '@/game/build/types'
import type { PartCategory } from '@/game/catalog/types'
import type { Rot } from '@/game/lattice'
import { create } from 'zustand'
import { defaultContext } from '@/game/build/doc'
import {
  addParts,
  deleteParts,
  duplicateParts,
  movePartsBy,
  paintParts,
  previewDelete,
  rotateParts,
  setForward,
  setWheelRoles,
  swapWheelGroup,
} from '@/game/build/edit'
import { emptyHistory, pushHistory, redo as redoHistory, undo as undoHistory } from '@/game/build/history'
import { defaultMirrorPlane2, mirrorPlacement } from '@/game/build/mirror'
import { catalog } from '@/game/catalog/catalog'
import { DEFAULT_COLOUR } from '@/game/catalog/palette'
import { getRepo } from '@/lib/platform/repo'
import { useGarageStore } from '@/stores/garage.store'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface EditorState {
  doc: CarDocument | null
  history: History
  selection: string[]
  /** Part chosen in the tray. */
  partId: string | null
  rotation: Rot
  colour: string
  mirror: boolean
  saveState: SaveState
  saveError: 'storage_full' | 'storage_error' | null
  /** Blocking reasons from the last rejected edit. Cleared by the next accepted edit. */
  issues: BuildIssue[]
  /** Non-blocking observations from the last accepted edit (rubbing wheels, etc.). */
  warnings: BuildIssue[]
  /** Label of the last accepted edit, for "Undo: ..." feedback. */
  lastLabel: string | null

  load: (doc: CarDocument) => void
  unload: () => Promise<void>
  setPart: (id: string | null, rotation?: Rot) => void
  setRotation: (rot: Rot) => void
  setColour: (colour: string) => void
  setCategory: (category: PartCategory) => void
  setCameraPose: (pose: NonNullable<CarDocument['ui']['camera']>) => void
  select: (ids: string[]) => void
  toggleSelect: (id: string) => void
  clearSelection: () => void
  toggleMirror: () => boolean

  place: (candidate: Pick<PlacementCandidate, 'defId' | 'pos' | 'rot'>) => boolean
  moveSelection: (delta: [number, number, number]) => boolean
  rotateSelection: (turns?: 1 | -1) => boolean
  paintSelection: (colour?: string) => boolean
  deleteSelection: () => boolean
  duplicateSelection: () => boolean
  swapWheels: (groupId: string, defId: string) => boolean
  setRoles: (groupId: string, patch: WheelRolePatch) => boolean
  setCarForward: (forward: Forward) => boolean
  rename: (name: string) => void
  /** What deleting the current selection would cut off. Used for the "Remove this part?" prompt. */
  previewDeleteSelection: () => { detached: string[], supporting: boolean, structural: boolean }

  undo: () => boolean
  redo: () => boolean
  flushSave: () => Promise<void>
  retrySave: () => Promise<void>
}

const ctx = defaultContext
const SAVE_DELAY_MS = 700
let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useEditorStore = create<EditorState>((set, get) => {
  const writeNow = async (): Promise<void> => {
    const doc = get().doc
    if (!doc)
      return
    const outcome = await getRepo().saveCar(doc)
    if (get().doc?.carId !== doc.carId)
      return
    if (outcome.ok) {
      set({ saveState: get().doc === doc ? 'saved' : 'saving', saveError: null })
      void useGarageStore.getState().refreshThumbnail(doc)
      void useGarageStore.getState().refresh()
    }
    else {
      set({ saveState: 'error', saveError: outcome.error ?? 'storage_error' })
    }
  }

  const schedule = () => {
    if (saveTimer)
      clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      void writeNow()
    }, SAVE_DELAY_MS)
  }

  const updateUi = (patch: Partial<CarDocument['ui']>) => {
    const doc = get().doc
    if (!doc)
      return
    set({ doc: { ...doc, ui: { ...doc.ui, ...patch } } })
    schedule()
  }

  /** Apply an edit result. One accepted result is one undo step. */
  const apply = (label: string, result: EditResult, select?: string[]): boolean => {
    const { doc, history } = get()
    if (!doc)
      return false
    if (!result.ok) {
      set({ issues: result.issues })
      return false
    }
    const selection = select ?? result.created ?? get().selection.filter(id => result.doc.instances.some(i => i.id === id))
    set({
      doc: result.doc,
      history: pushHistory(history, doc, label),
      selection,
      issues: [],
      warnings: result.warnings,
      lastLabel: label,
      saveState: 'saving',
    })
    schedule()
    return true
  }

  return {
    doc: null,
    history: emptyHistory(),
    selection: [],
    partId: null,
    rotation: 0,
    colour: DEFAULT_COLOUR,
    mirror: false,
    saveState: 'idle',
    saveError: null,
    issues: [],
    warnings: [],
    lastLabel: null,

    load: doc => set({ doc, history: emptyHistory(), selection: [], partId: null, rotation: 0, mirror: false, issues: [], warnings: [], saveState: 'saved', saveError: null, lastLabel: null }),

    async unload() {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      await writeNow()
      set({ doc: null, history: emptyHistory(), selection: [], partId: null })
    },

    setPart: (id, rotation) => set({ partId: id, ...(rotation !== undefined ? { rotation } : {}), issues: [] }),
    setRotation: rotation => set({ rotation }),
    setColour: colour => set({ colour }),
    setCategory: category => updateUi({ category }),
    setCameraPose: camera => updateUi({ camera }),
    select: selection => set({ selection }),
    toggleSelect: id => set(s => ({ selection: s.selection.includes(id) ? s.selection.filter(x => x !== id) : [...s.selection, id] })),
    clearSelection: () => set({ selection: [] }),

    toggleMirror() {
      const { doc, mirror } = get()
      if (!doc)
        return false
      const next = !mirror
      if (next && doc.ui.mirrorPlane2 === null)
        updateUi({ mirrorPlane2: defaultMirrorPlane2(doc, ctx) })
      set({ mirror: next })
      return next
    },

    place(candidate) {
      const { doc, mirror, colour } = get()
      if (!doc)
        return false
      const parts = [{ defId: candidate.defId, pos: candidate.pos, rot: candidate.rot, colour }]
      if (mirror && doc.ui.mirrorPlane2 !== null) {
        const mirrored = mirrorPlacement(candidate, doc.ui.mirrorPlane2, ctx)
        if (!mirrored) {
          set({ issues: [{ code: 'mirror_unavailable', severity: 'block', instanceIds: [], message: 'This piece cannot be mirrored.' }] })
          return false
        }
        if (!mirrored.onPlane)
          parts.push({ defId: mirrored.defId, pos: mirrored.pos, rot: mirrored.rot, colour })
      }
      // Both pieces go in as one transaction: a failure on either side commits nothing.
      return apply(parts.length > 1 ? 'Place mirrored pair' : 'Place piece', addParts(doc, parts, ctx))
    },

    moveSelection(delta) {
      const { doc, selection } = get()
      return doc ? apply('Move', movePartsBy(doc, selection, delta, ctx), selection) : false
    },
    rotateSelection(turns = 1) {
      const { doc, selection } = get()
      return doc ? apply('Rotate', rotateParts(doc, selection, ctx, turns), selection) : false
    },
    paintSelection(colour) {
      const { doc, selection } = get()
      return doc ? apply('Paint', paintParts(doc, selection, colour ?? get().colour, ctx), selection) : false
    },
    deleteSelection() {
      const { doc, selection } = get()
      return doc ? apply('Remove', deleteParts(doc, selection, ctx), []) : false
    },
    duplicateSelection() {
      const { doc, selection } = get()
      return doc ? apply('Duplicate', duplicateParts(doc, selection, ctx)) : false
    },
    swapWheels: (groupId, defId) => {
      const doc = get().doc
      return doc ? apply('Change wheels', swapWheelGroup(doc, groupId, defId, ctx), get().selection) : false
    },
    setRoles: (groupId, patch) => {
      const doc = get().doc
      return doc ? apply('Wheel roles', setWheelRoles(doc, groupId, patch, ctx), get().selection) : false
    },
    setCarForward: (forward) => {
      const doc = get().doc
      return doc ? apply('Set front', setForward(doc, forward, ctx), get().selection) : false
    },
    rename(name) {
      const doc = get().doc
      if (!doc)
        return
      set({ doc: { ...doc, name: name.trim() || doc.name, updatedAt: ctx.now() }, saveState: 'saving' })
      schedule()
    },

    previewDeleteSelection() {
      const { doc, selection } = get()
      if (!doc)
        return { detached: [], supporting: false, structural: false }
      const preview = previewDelete(doc, selection, ctx)
      const structural = selection.some(id => catalog.get(doc.instances.find(i => i.id === id)?.defId ?? '')?.structural)
      return { ...preview, structural }
    },

    undo() {
      const { doc, history } = get()
      if (!doc)
        return false
      const step = undoHistory(history, doc)
      if (!step)
        return false
      set({ doc: step.doc, history: step.history, selection: [], issues: [], lastLabel: `Undid ${step.label.toLowerCase()}`, saveState: 'saving' })
      schedule()
      return true
    },
    redo() {
      const { doc, history } = get()
      if (!doc)
        return false
      const step = redoHistory(history, doc)
      if (!step)
        return false
      set({ doc: step.doc, history: step.history, selection: [], issues: [], lastLabel: `Redid ${step.label.toLowerCase()}`, saveState: 'saving' })
      schedule()
      return true
    },

    async flushSave() {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      set({ saveState: 'saving' })
      await writeNow()
    },

    async retrySave() {
      set({ saveState: 'saving' })
      await writeNow()
    },
  }
})
