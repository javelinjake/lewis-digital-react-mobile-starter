import type { PlacementCandidate } from '@/game/build/candidates'
import type { CarDocument, WheelGroup } from '@/game/build/types'
import type { FreeTab } from '@/features/builder/components/FreePanels'
import type { PadDirection } from '@/features/builder/logic/nudge'
import type { PlacementView, ViewportHandle } from '@/features/builder/viewport/ViewportPane'
import { impact, notification } from '@ld/native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLaunchCheck } from '@/components/launch/LaunchDialog'
import { Icon } from '@/components/ui/Icon'
import { ColourPicker } from '@/features/builder/components/ColourPicker'
import { FreePanels } from '@/features/builder/components/FreePanels'
import { NudgePad } from '@/features/builder/components/NudgePad'
import { CoachMark, DeleteSheet, HeadsUp, IssueBanner, LooseChip, Notice, ViewButtons } from '@/features/builder/components/Overlays'
import { PartsTray } from '@/features/builder/components/PartsTray'
import { ToolStrip } from '@/features/builder/components/ToolStrip'
import { TopBar } from '@/features/builder/components/TopBar'
import { WheelPairPanel } from '@/features/builder/components/WheelPairPanel'
import { contactPreview } from '@/features/builder/logic/contact-preview'
import { useAssessment, useBuilderShortcuts, useLayoutKind, useLooseIds, useTutorialStep } from '@/features/builder/logic/hooks'
import { findLoosePosition } from '@/features/builder/logic/loose-position'
import { padStep } from '@/features/builder/logic/nudge'
import { usePlacementCandidates } from '@/features/builder/logic/use-placement'
import { registerViewportHandle } from '@/features/builder/viewport/handle-registry'
import { ViewportPane } from '@/features/builder/viewport/ViewportPane'
import { defaultRotation } from '@/game/build/candidates'
import { placeAll } from '@/game/build/geometry'
import { hubCoordinates } from '@/game/build/wheel-groups'
import { catalog } from '@/game/catalog/catalog'
import { colourHex } from '@/game/catalog/palette'
import { assessDrive } from '@/game/vehicle/analysis'
import { useEditorStore } from '@/stores/editor.store'
import { usePrefsStore } from '@/stores/prefs.store'
import { useSessionStore } from '@/stores/session.store'

const EMPTY: ReadonlySet<string> = new Set()

function groupLabelsFor(doc: CarDocument): Map<string, string> {
  const set = placeAll(doc.instances, catalog)
  const ordered = doc.wheelGroups
    .map(g => ({ g, f: hubCoordinates(set, g.instanceIds[0]!, doc.forward)?.f ?? 0 }))
    .sort((a, b) => b.f - a.f)
  const labels = new Map<string, string>()
  ordered.forEach(({ g }, i) => labels.set(g.id, ordered.length === 1 ? 'Axle' : i === 0 ? 'Front axle' : i === ordered.length - 1 ? 'Rear axle' : `Axle ${i + 1}`))
  return labels
}

export function BuilderWorkspace({ doc, recovered, migrated }: { doc: CarDocument, recovered: boolean, migrated: boolean }) {
  const navigate = useNavigate()
  const layout = useLayoutKind()
  const mode = usePrefsStore(s => s.prefs.buildMode)
  const reduced = usePrefsStore(s => s.prefs.reducedMotion)
  const vibration = usePrefsStore(s => s.prefs.vibration)
  const prefs = usePrefsStore.getState

  const selection = useEditorStore(s => s.selection)
  const partId = useEditorStore(s => s.partId)
  const rotation = useEditorStore(s => s.rotation)
  const colour = useEditorStore(s => s.colour)
  const mirror = useEditorStore(s => s.mirror)
  const issues = useEditorStore(s => s.issues)
  const saveState = useEditorStore(s => s.saveState)
  const saveError = useEditorStore(s => s.saveError)
  const canUndo = useEditorStore(s => s.history.past.length > 0)
  const canRedo = useEditorStore(s => s.history.future.length > 0)
  const editor = useEditorStore.getState

  const viewport = useRef<ViewportHandle | null>(null)
  const [armed, setArmed] = useState<{ index: number, count: number } | null>(null)
  const [colourOpen, setColourOpen] = useState(false)
  const [nudgeOpen, setNudgeOpen] = useState(false)
  const [multi, setMulti] = useState(false)
  const [freeOpen, setFreeOpen] = useState(false)
  const [freeTab, setFreeTab] = useState<FreeTab>('inspect')
  const [showContacts, setShowContacts] = useState(true)
  const [deleteSheet, setDeleteSheet] = useState<{ structural: boolean, detached: number, count: number } | null>(null)
  const [dismissedIssues, setDismissedIssues] = useState<unknown>(null)
  const [focusIds, setFocusIds] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(recovered ? 'Your car was recovered from the last complete save.' : migrated ? 'Your car was updated to the newest format.' : null)
  const [wheelPanelOff, setWheelPanelOff] = useState('')

  const loose = useLooseIds(doc)
  const assessment = useAssessment(doc)
  const step = useTutorialStep(mode)
  const def = partId ? (catalog.get(partId) ?? null) : null
  const candidates = usePlacementCandidates(doc, def, rotation)

  useEffect(() => registerViewportHandle(viewport), [])

  // Reset transient UI when the context changes.
  useEffect(() => {
    if (mode === 'easy') {
      setMulti(false)
      setFreeOpen(false)
      setNudgeOpen(false)
    }
  }, [mode])
  useEffect(() => {
    if (selection.length === 0)
      setNudgeOpen(false)
  }, [selection.length])
  useEffect(() => {
    if (!issues.length)
      return
    const timer = setTimeout(() => setDismissedIssues(issues), 7000)
    return () => clearTimeout(timer)
  }, [issues])
  useEffect(() => {
    if (focusIds.length === 0)
      return
    const timer = setTimeout(() => setFocusIds([]), 5000)
    return () => clearTimeout(timer)
  }, [focusIds])

  const visibleIssues = issues === dismissedIssues ? [] : issues
  const issueIds = useMemo(() => new Set([...visibleIssues.flatMap(i => i.instanceIds), ...focusIds]), [visibleIssues, focusIds]) // eslint-disable-line react-hooks/exhaustive-deps
  const selectionSet = useMemo(() => new Set(selection), [selection])

  // Paired wheel change.
  const selected = useMemo(() => doc.instances.filter(i => selection.includes(i.id)), [doc, selection])
  const selectedWheel = selected.length > 0 && selected.every(i => catalog.get(i.defId)?.wheel)
  const wheelGroup: WheelGroup | undefined = selectedWheel ? doc.wheelGroups.find(g => g.instanceIds.includes(selected[0]!.id)) : undefined
  const wheelKey = selection.join(',')
  const wheelPanelOpen = selectedWheel && !partId && wheelPanelOff !== wheelKey
  const highlight = useMemo(() => (wheelPanelOpen && wheelGroup ? new Set(wheelGroup.instanceIds) : EMPTY), [wheelPanelOpen, wheelGroup])

  const placement: PlacementView | null = useMemo(
    () => (def ? { def, rotation, candidates, mirrorPlane2: mirror ? doc.ui.mirrorPlane2 : null } : null),
    [def, rotation, candidates, mirror, doc.ui.mirrorPlane2],
  )

  const contacts = useMemo(() => (mode === 'free' && freeOpen && freeTab === 'inspect' && showContacts ? contactPreview(doc, catalog) : null), [mode, freeOpen, freeTab, showContacts, doc.revisionId]) // eslint-disable-line react-hooks/exhaustive-deps
  const groupLabels = useMemo(() => (freeOpen && freeTab === 'wheels' ? groupLabelsFor(doc) : new Map<string, string>()), [freeOpen, freeTab, doc.revisionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const buzz = useCallback((ok: boolean) => {
    if (!vibration)
      return
    void (ok ? impact('light') : notification('warning'))
  }, [vibration])

  // ---- Actions ---------------------------------------------------------------------------------------

  const afterEdit = (ok: boolean) => {
    buzz(ok)
    if (ok)
      setDismissedIssues(null)
    return ok
  }

  const onCommit = (c: Pick<PlacementCandidate, 'defId' | 'pos' | 'rot'>) => {
    const ok = afterEdit(editor().place(c))
    if (ok)
      prefs().completeTutorial('build-place')
    return ok
  }

  const onTapPart = (id: string | null, additive: boolean) => {
    setColourOpen(false)
    if (id === null) {
      if (!partId)
        editor().clearSelection()
      return
    }
    if (partId)
      editor().setPart(null)
    if (mode === 'free' && (additive || multi))
      editor().toggleSelect(id)
    else
      editor().select([id])
  }

  const onPart = (defId: string | null) => {
    setColourOpen(false)
    if (!defId) {
      editor().setPart(null)
      return
    }
    const d = catalog.get(defId)
    editor().clearSelection()
    editor().setPart(defId, d ? defaultRotation(d, doc.forward) : 0)
    prefs().completeTutorial('build-brick')
  }

  const onRotate = () => {
    if (partId)
      editor().setRotation(((rotation + 1) % 4) as 0 | 1 | 2 | 3)
    else
      afterEdit(editor().rotateSelection(1))
  }

  const onPickColour = (id: string) => {
    editor().setColour(id)
    if (editor().selection.length > 0)
      afterEdit(editor().paintSelection(id))
    prefs().completeTutorial('build-colour')
  }

  const requestDelete = () => {
    if (editor().selection.length === 0)
      return
    const pv = editor().previewDeleteSelection()
    const protectedPart = (mode === 'easy' && pv.structural) || pv.supporting
    if (protectedPart)
      setDeleteSheet({ structural: pv.structural, detached: pv.detached.length, count: editor().selection.length })
    else
      afterEdit(editor().deleteSelection())
  }

  const placeFree = () => {
    if (!def)
      return
    const pos = findLoosePosition(doc, def, rotation)
    onCommit({ defId: def.id, pos, rot: rotation })
  }

  const onNudge = (dir: PadDirection) => {
    afterEdit(editor().moveSelection(padStep(dir, viewport.current?.getYaw() ?? 0)))
  }

  const onCancel = () => {
    viewport.current?.cancelArmed()
    editor().setPart(null)
    editor().clearSelection()
    setColourOpen(false)
  }

  useBuilderShortcuts({
    undo: () => editor().undo(),
    redo: () => editor().redo(),
    remove: requestDelete,
    rotate: onRotate,
    escape: () => {
      if (armed)
        viewport.current?.cancelArmed()
      else
        onCancel()
    },
  })

  const launch = useLaunchCheck(
    () => assessDrive(editor().doc ?? doc, catalog),
    () => {
      void (async () => {
        await editor().flushSave()
        if (editor().saveState === 'error') {
          setNotice('Couldn’t save your car yet, so it can’t be driven. Tap Retry, then Drive again.')
          return
        }
        useSessionStore.getState().chooseCar(doc.carId)
        navigate('/play')
      })()
    },
    (ids) => {
      editor().select(ids)
      setFocusIds(ids)
      setNotice('Check the highlighted pieces, then try Drive again.')
    },
  )

  const back = async () => {
    await editor().flushSave()
    navigate('/')
  }

  const warnings = assessment?.warnings ?? []
  const emptyCar = doc.instances.length === 0
  const saveNotice = saveState === 'error'
    ? (saveError === 'storage_full' ? 'This device is full, so your car could not be saved. Free some space, then tap Retry.' : 'Your car could not be saved. Your changes are still here. Tap Retry.')
    : null
  const banner = visibleIssues.length > 0
    ? <IssueBanner issues={visibleIssues} onDismiss={() => setDismissedIssues(issues)} />
    : (saveNotice ?? notice)
        ? <Notice text={saveNotice ?? notice} onDismiss={() => setNotice(null)} />
        : step ? <CoachMark step={step} onSkip={() => prefs().update({ tutorial: { ...prefs().prefs.tutorial, dismissed: true } })} /> : null

  const tray = (
    <PartsTray
      layout={layout}
      category={doc.ui.category}
      onCategory={c => editor().setCategory(c)}
      partId={partId}
      onPart={onPart}
    />
  )

  return (
    <div className="bd-screen" data-layout={layout} data-mode={mode} data-testid="builder">
      <TopBar
        name={doc.name}
        onRename={n => editor().rename(n)}
        mode={mode}
        onMode={m => prefs().update({ buildMode: m })}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => editor().undo()}
        onRedo={() => editor().redo()}
        saveState={saveState}
        saveError={saveError}
        onRetry={() => void editor().retrySave()}
        onBack={() => void back()}
        onHelp={() => navigate('/help')}
        onDrive={launch.start}
      />
      {layout === 'rail' && tray}
      <main className="bd-view" aria-label="Car workshop">
        <ViewportPane
          handleRef={viewport}
          doc={doc}
          loose={loose}
          selection={selectionSet}
          issues={issueIds}
          highlight={highlight}
          placement={placement}
          forwardArrow={mode === 'free' ? doc.forward : null}
          contacts={contacts}
          reducedMotion={reduced}
          onTapPart={onTapPart}
          onCommit={onCommit}
          onCameraSettled={pose => editor().setCameraPose(pose)}
          onArmed={setArmed}
        />

        <div className="bd-corner">
          <ViewButtons onView={v => viewport.current?.viewPreset(v)} />
          <div className="bd-chiprow">
            {mode === 'free' && (
              <button type="button" className={`bd-chip-cyan ${freeOpen ? 'is-on' : ''}`} aria-expanded={freeOpen} data-testid="free-panels" onClick={() => setFreeOpen(v => !v)}>
                <Icon name="list" size={18} />
                <span>Inspect</span>
              </button>
            )}
            <LooseChip count={loose.size} onSelect={() => { editor().select([...loose]); setFocusIds([...loose]) }} />
            <HeadsUp warnings={warnings} onFocus={ids => setFocusIds(ids)} />
          </div>
        </div>

        <div className="bd-top-centre">{banner}</div>

        {emptyCar && !partId && <p className="bd-empty-hint br-panel">Choose a brick to start building.</p>}
        {emptyCar && partId && (
          <button type="button" className="btn br-btn br-cta bd-first" data-testid="place-first" onClick={placeFree}>Place first brick</button>
        )}

        <ToolStrip
          mode={mode}
          placing={Boolean(partId)}
          hasSelection={selection.length > 0}
          colour={colour}
          colourHex={colourHex(colour)}
          mirror={mirror}
          coachColour={step === 'build-colour'}
          multi={multi}
          nudgeOpen={nudgeOpen}
          emptyCar={emptyCar}
          armed={armed}
          onRotate={onRotate}
          onColour={() => setColourOpen(v => !v)}
          onMirror={() => editor().toggleMirror()}
          onDelete={requestDelete}
          onDuplicate={() => afterEdit(editor().duplicateSelection())}
          onCancel={onCancel}
          onMulti={() => setMulti(v => !v)}
          onNudge={() => setNudgeOpen(v => !v)}
          onPlaceLoose={placeFree}
          onCycle={d => viewport.current?.cycle(d)}
          onConfirmArmed={() => viewport.current?.commitArmed()}
        />
        {colourOpen && <ColourPicker colour={colour} onPick={onPickColour} onClose={() => setColourOpen(false)} />}
        {mode === 'free' && nudgeOpen && selection.length > 0 && <NudgePad onStep={onNudge} />}

        {wheelPanelOpen && selected[0] && (
          <WheelPairPanel
            currentDefId={selected[0].defId}
            count={wheelGroup?.instanceIds.length ?? selected.length}
            grouped={Boolean(wheelGroup)}
            onPick={(id) => {
              if (wheelGroup)
                afterEdit(editor().swapWheels(wheelGroup.id, id))
            }}
            onClose={() => setWheelPanelOff(wheelKey)}
          />
        )}

        {mode === 'free' && freeOpen && (
          <FreePanels
            tab={freeTab}
            onTab={setFreeTab}
            onClose={() => setFreeOpen(false)}
            doc={doc}
            assessment={assessment}
            looseCount={loose.size}
            showContacts={showContacts}
            onToggleContacts={() => setShowContacts(v => !v)}
            groupLabels={groupLabels}
            onRoles={(gid, patch) => afterEdit(editor().setRoles(gid, patch))}
            onFocusGroup={g => setFocusIds(g.instanceIds)}
            onForward={f => afterEdit(editor().setCarForward(f))}
          />
        )}
      </main>
      {layout === 'bottom' && tray}
      {launch.dialog}
      {deleteSheet && (
        <DeleteSheet
          count={deleteSheet.count}
          structural={deleteSheet.structural}
          detached={deleteSheet.detached}
          onCancel={() => setDeleteSheet(null)}
          onConfirm={() => {
            setDeleteSheet(null)
            afterEdit(editor().deleteSelection())
          }}
        />
      )}
    </div>
  )
}
