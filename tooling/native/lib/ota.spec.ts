import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blobPath, readPublishEnv, sha256Hex } from './ota'

describe('ota publish helpers', () => {
  it('hashes the zip as hex SHA-256, the form the updater checks', () => {
    assert.equal(sha256Hex(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('names both missing secrets', () => {
    assert.throws(() => readPublishEnv({}), /OTA_PUBLISH_SECRET[\s\S]*BLOB_READ_WRITE_TOKEN/)
    assert.deepEqual(readPublishEnv({ OTA_PUBLISH_SECRET: ' s ', BLOB_READ_WRITE_TOKEN: 't' }), { secret: 's', blobToken: 't' })
  })

  it('keeps one path per app and release', () => {
    assert.equal(blobPath('uk.co.acme', '1.2.0+42'), 'ota/uk.co.acme/1.2.0+42.zip')
  })
})
