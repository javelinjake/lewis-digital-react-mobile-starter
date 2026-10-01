export type ActivityStatus = 'started' | 'completed' | null

export function StatusBadge({
  status,
  itemType,
  size = 'default',
}: {
  status: ActivityStatus
  itemType?: 'workout' | 'recipe' | 'video'
  size?: 'small' | 'default'
}) {
  if (!status)
    return null

  const base = size === 'small' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
  const label = status === 'started'
    ? 'Started'
    : itemType === 'video'
      ? 'Watched'
      : 'Completed'

  const classes = status === 'started'
    ? `${base} rounded-full bg-brand-yellow font-semibold text-brand-navy`
    : `${base} rounded-full bg-green-600 font-semibold text-white`

  return <span className={classes}>{label}</span>
}
