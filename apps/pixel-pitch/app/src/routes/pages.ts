/**
 * Every page loads on demand, so the first screen only downloads what it shows. The tab screens are also fetched when
 * the browser is idle (`preloadTabScreens`), so switching tabs never waits on the network.
 */
export const pages = {
  login: () => import('@/pages/LoginPage').then(m => ({ Component: m.LoginPage })),
  register: () => import('@/pages/RegisterPage').then(m => ({ Component: m.RegisterPage })),
  forgotPassword: () => import('@/pages/ForgotPasswordPage').then(m => ({ Component: m.ForgotPasswordPage })),
  resetPassword: () => import('@/pages/ResetPasswordPage').then(m => ({ Component: m.ResetPasswordPage })),
  onboarding: () => import('@/pages/OnboardingPage').then(m => ({ Component: m.OnboardingPage })),
  club: () => import('@/pages/ClubPage').then(m => ({ Component: m.ClubPage })),
  arcade: () => import('@/pages/ArcadePage').then(m => ({ Component: m.ArcadePage })),
  arcadePlay: () => import('@/pages/ArcadePlayPage').then(m => ({ Component: m.ArcadePlayPage })),
  packs: () => import('@/pages/PacksPage').then(m => ({ Component: m.PacksPage })),
  squad: () => import('@/pages/SquadPage').then(m => ({ Component: m.SquadPage })),
  league: () => import('@/pages/LeaguePage').then(m => ({ Component: m.LeaguePage })),
  match: () => import('@/pages/MatchPage').then(m => ({ Component: m.MatchPage })),
  settings: () => import('@/pages/SettingsPage').then(m => ({ Component: m.SettingsPage })),
  notFound: () => import('@/pages/NotFoundPage').then(m => ({ Component: m.NotFoundPage })),
}

export function preloadTabScreens() {
  const load = () => {
    void pages.club()
    void pages.packs()
    void pages.squad()
    void pages.league()
    void pages.settings()
  }

  if ('requestIdleCallback' in window) {
    const handle = window.requestIdleCallback(load, { timeout: 4000 })
    return () => window.cancelIdleCallback(handle)
  }

  const handle = setTimeout(load, 2000)
  return () => clearTimeout(handle)
}
