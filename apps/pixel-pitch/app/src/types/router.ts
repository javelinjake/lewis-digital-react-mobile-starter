export interface RouteHandle {
  title?: string
  requiresAuth?: boolean
  guestOnly?: boolean
}

declare module 'react-router' {
  interface RouteHandle {
    title?: string
  }
}
