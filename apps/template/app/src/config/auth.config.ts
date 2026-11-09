import { appMeta } from '../../app.meta'

/** Which sign-in methods this app offers. Declared once in `app.meta.ts`; the api app reads the same list. */
export const authMethods = appMeta.auth
