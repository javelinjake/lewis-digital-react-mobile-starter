/** Reference implementation: pure, deterministic, deliberately not wired into production. */
export interface FamilyIdea {
  id: string
  published: boolean
  minutes: number
  setting: 'indoors' | 'outdoors'
  kit: 'none' | 'ingredients' | 'objects'
  kind: 'move' | 'make' | 'chat'
  hasSeatedVersion: boolean
  editorialPriority: number
}

export interface MomentContext {
  minutes: number
  setting: FamilyIdea['setting']
  availableKit: readonly FamilyIdea['kit'][]
  seatedRequired: boolean
  kind?: FamilyIdea['kind']
  recentIdeaIds: readonly string[]
}

/** Content access/age-suitability must already have been checked by the caller. */
export function eligibleIdeas(ideas: readonly FamilyIdea[], context: MomentContext): FamilyIdea[] {
  const recent = new Set(context.recentIdeaIds)
  return ideas
    .filter(idea => idea.published
      && Number.isFinite(idea.minutes) && idea.minutes > 0
      && idea.minutes <= context.minutes
      && idea.setting === context.setting
      && context.availableKit.includes(idea.kit)
      && (!context.seatedRequired || idea.hasSeatedVersion)
      && (!context.kind || idea.kind === context.kind))
    .sort((a, b) => Number(recent.has(a.id)) - Number(recent.has(b.id))
      || b.editorialPriority - a.editorialPriority
      || a.id.localeCompare(b.id))
}

/** Try another cycles only the eligible set. Empty stays empty; invalid rotation resets. */
export function chooseIdea(
  ideas: readonly FamilyIdea[],
  context: MomentContext,
  rotation = 0,
): FamilyIdea | null {
  const eligible = eligibleIdeas(ideas, context)
  if (!eligible.length)
    return null
  const index = Number.isFinite(rotation) ? Math.max(0, Math.floor(rotation)) : 0
  return eligible[index % eligible.length] ?? null
}

/** Canonical YYYY-MM-DD dates are supplied by the household service, not UTC slicing. */
export function participatingDays(
  moments: readonly { operationId: string, householdLocalDate: string }[],
  weekStart: string,
  nextWeekStart: string,
): number {
  const operations = new Set<string>()
  const dates = new Set<string>()
  for (const moment of moments) {
    if (operations.has(moment.operationId))
      continue
    operations.add(moment.operationId)
    if (moment.householdLocalDate >= weekStart && moment.householdLocalDate < nextWeekStart)
      dates.add(moment.householdLocalDate)
  }
  return dates.size
}
