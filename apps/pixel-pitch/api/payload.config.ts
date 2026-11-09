import path from 'node:path'
import process from 'node:process'
import { createAppBackend } from '@ld/backend'
import { buildConfig } from 'payload'
import { appMeta } from '../app/app.meta'
import { arcadeActions } from './cms/actions/arcade'
import { duplicateNoteAction } from './cms/actions/duplicate-note'
import { gameActions } from './cms/actions/game'
import { packActions } from './cms/actions/packs'
import { cardsCollection } from './cms/collections/cards'
import { clubsCollection } from './cms/collections/clubs'
import { fixturesCollection } from './cms/collections/fixtures'
import { ledgerCollection } from './cms/collections/ledger'
import { notesCollection } from './cms/collections/notes'
import { playersCollection } from './cms/collections/players'
import { gameConfigGlobal } from './cms/globals/game-config'

const root = path.dirname(new URL(import.meta.url).pathname)
process.env.CMS_LOCAL_DATABASE ??= 'pixel_pitch'

export default buildConfig(createAppBackend({
  app: { name: appMeta.name, hostname: appMeta.hostname },
  migrationDir: path.resolve(root, 'cms/migrations'),
  typesOutputFile: path.resolve(root, 'payload-types.ts'),
  importMapBaseDir: root,
  auth: { ...appMeta.auth, requireEmailVerification: true },
  collections: [playersCollection, clubsCollection, cardsCollection, fixturesCollection, ledgerCollection, notesCollection],
  globals: [gameConfigGlobal],
  endpoints: [...gameActions, ...packActions, ...arcadeActions, duplicateNoteAction],
  adminMeta: { titleSuffix: `· ${appMeta.name} admin` },
}))
