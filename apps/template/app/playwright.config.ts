import { createPlaywrightConfig } from '@ld/config-playwright'
import { appMeta } from './app.meta'

export default createPlaywrightConfig({ tablet: appMeta.tablet })
