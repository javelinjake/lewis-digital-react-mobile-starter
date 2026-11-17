/**
 * Minimal initial configuration (spec section 14). Feature flags for later phases stay false: photo reference,
 * assisted scanning, track builder and online sharing are roadmap items, not part of V1.
 */
export const gameConfig = {
  schemaVersion: 1,
  workingTitle: 'Build Brick Racer',
  releaseScope: 'v1',
  orientation: 'landscape',
  defaultBuildMode: 'easy',
  defaultDrivingAssist: 'light',
  defaultCamera: 'chase',
  smartCameraEnabled: false,
  offlinePlay: true,
  partsHaveInventoryLimits: false,
  challengeUnlockingRequired: false,
  physicsTickTargetHz: 60,
  replaySampleTargetHz: 15,
  replayStorageBudgetMB: 100,
  editorUndoTarget: 100,
  visualDirection: 'navy-cyan-orange-chamfered',
  features: {
    easyBuild: true,
    freeBuild: true,
    manualDriving: true,
    kitchen: true,
    garden: true,
    replay: true,
    photoReference: false,
    assistedScanning: false,
    trackBuilder: false,
    onlineSharing: false,
  },
} as const

export type GameConfig = typeof gameConfig
