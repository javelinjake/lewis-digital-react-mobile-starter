export interface ContentTag {
  id: number
  name: string
  type: string
}

export function flattenRelationTags(rows: unknown, relationKey: string): ContentTag[] {
  if (!Array.isArray(rows))
    return []

  return rows
    .map(row => (row as Record<string, unknown>)?.[relationKey])
    .filter((tag): tag is Record<string, unknown> => !!tag && typeof tag === 'object' && typeof (tag as { id?: unknown }).id === 'number')
    .map(tag => ({
      id: tag.id as number,
      name: String(tag.name ?? '').trim(),
      type: String(tag.type ?? '').trim(),
    }))
    .filter(tag => tag.name && tag.type)
}

export function groupTagsByType(tags: ContentTag[]) {
  return tags.reduce<Record<string, ContentTag[]>>((acc, tag) => {
    (acc[tag.type] ??= []).push(tag)
    return acc
  }, {})
}

const TYPE_LABELS: Record<string, string> = {
  'program': 'Program',
  'for': 'For',
  'target-area': 'Target area',
  'equipment': 'Equipment',
  'exercise': 'Exercise',
}

export const WORKOUT_DETAIL_TAG_TYPES = ['program', 'for', 'target-area', 'equipment'] as const

export function tagTypeLabel(type: string) {
  return TYPE_LABELS[type] ?? type.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())
}

export function workoutSummaryTagGroups(rows: unknown) {
  const flat = flattenRelationTags(rows, 'workout_tags_id')
  const grouped = groupTagsByType(flat)

  return WORKOUT_DETAIL_TAG_TYPES
    .filter(type => grouped[type]?.length)
    .map(type => ({
      type,
      label: tagTypeLabel(type),
      tags: grouped[type]!,
    }))
}
