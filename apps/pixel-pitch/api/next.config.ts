import { createApiNextConfig } from '@ld/backend/next'
import { withPayload } from '@payloadcms/next/withPayload'

export default withPayload(createApiNextConfig({ transpilePackages: ['@ld/pixel-pitch-core', '@ld/utils'] }))
