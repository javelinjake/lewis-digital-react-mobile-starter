import type { TabBarItem } from '@ld/mobile-ui'

// Packs and Shop join as tabs when they are built (M3, M6).
export const tabItems: TabBarItem[] = [
  { to: '/club', label: 'Club' },
  { to: '/squad', label: 'Squad' },
  { to: '/league', label: 'League' },
  { to: '/settings', label: 'Settings' },
]
