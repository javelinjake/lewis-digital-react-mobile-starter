import { createApiNextConfig } from '@ld/backend/next'
import { withPayload } from '@payloadcms/next/withPayload'

export default withPayload(createApiNextConfig())
