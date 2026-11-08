// architecture: public-data
// Every number the game runs on. Validated by the same schema the rules use; each save bumps `version`, which is
// stamped on results so any result can be traced to the rules that produced it.
import type { GlobalConfig } from 'payload'
import { adminOnly } from '@ld/backend'
import { DEFAULT_CONFIG, parseConfig } from '@ld/pixel-pitch-core'
import { APIError } from 'payload'

export const gameConfigGlobal: GlobalConfig = {
  slug: 'game-config',
  access: { read: () => true, update: adminOnly },
  fields: [
    {
      name: 'config',
      type: 'json',
      admin: { description: 'Leave empty to use the built-in defaults. Invalid values are refused on save.' },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        if (data.config === null || data.config === undefined)
          return data
        let parsed
        try {
          parsed = parseConfig(data.config)
        }
        catch (error) {
          throw new APIError(`The game config is not valid: ${error instanceof Error ? error.message : String(error)}`, 400)
        }
        const previous = (originalDoc?.config as { version?: number } | null | undefined)?.version ?? DEFAULT_CONFIG.version
        return { ...data, config: { ...parsed, version: previous + 1 } }
      },
    ],
  },
}
