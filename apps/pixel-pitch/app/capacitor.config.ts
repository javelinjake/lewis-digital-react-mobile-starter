import process from 'node:process'
import { createCapacitorConfig } from '@ld/config-capacitor'
import { resolveIdentity } from '@ld/config-capacitor/identity'
import { appMeta } from './app.meta'

const identity = resolveIdentity(appMeta, process.env.APP_ENV)

export default createCapacitorConfig({
  appId: identity.appId,
  appName: identity.name,
  backgroundColor: appMeta.backgroundColor,
  hostname: identity.hostname,
})
