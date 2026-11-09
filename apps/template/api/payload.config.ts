import path from 'node:path'
import process from 'node:process'
import { createAppBackend } from '@ld/backend'
import { buildConfig } from 'payload'
import { appMeta } from '../app/app.meta'
import { duplicateNoteAction } from './cms/actions/duplicate-note'
import { notesCollection } from './cms/collections/notes'

const root = path.dirname(new URL(import.meta.url).pathname)
process.env.CMS_LOCAL_DATABASE ??= 'template'

export default buildConfig(createAppBackend({
  app: { name: appMeta.name, hostname: appMeta.hostname },
  migrationDir: path.resolve(root, 'cms/migrations'),
  typesOutputFile: path.resolve(root, 'payload-types.ts'),
  importMapBaseDir: root,
  auth: { ...appMeta.auth, requireEmailVerification: true },
  collections: [notesCollection],
  endpoints: [duplicateNoteAction],
  adminMeta: { titleSuffix: `· ${appMeta.name} admin` },
}))
