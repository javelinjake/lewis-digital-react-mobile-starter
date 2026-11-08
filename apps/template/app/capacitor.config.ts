import { createCapacitorConfig } from '@ld/config-capacitor'
import { appMeta } from './app.meta'

export default createCapacitorConfig({
  appId: appMeta.appId,
  appName: appMeta.name,
  backgroundColor: appMeta.backgroundColor,
  hostname: appMeta.hostname,
})
