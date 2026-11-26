import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkReleaseApiUrl, gradleSigningArgs, parseKeystoreProperties, parseReleaseArgs } from './release'

describe('parseReleaseArgs', () => {
  it('defaults to a production build and accepts staging', () => {
    assert.deepEqual(parseReleaseArgs(['android'], undefined), { platform: 'android', appEnv: 'prod' })
    assert.deepEqual(parseReleaseArgs(['ios'], 'staging'), { platform: 'ios', appEnv: 'staging' })
  })

  it('refuses a dev build and an unknown platform', () => {
    assert.throws(() => parseReleaseArgs(['ios'], 'dev'), /staging or prod/)
    assert.throws(() => parseReleaseArgs(['web'], undefined), /Usage/)
  })
})

describe('parseKeystoreProperties', () => {
  it('reads the four values, ignoring comments and spaces around =', () => {
    const keystore = parseKeystoreProperties('# upload key\nstoreFile=../upload.jks\nstorePassword = pa=ss\nkeyAlias=upload\nkeyPassword=secret\n')
    assert.deepEqual(keystore, { storeFile: '../upload.jks', storePassword: 'pa=ss', keyAlias: 'upload', keyPassword: 'secret' })
    assert.deepEqual(gradleSigningArgs(keystore, '/keys/upload.jks'), [
      '-Pandroid.injected.signing.store.file=/keys/upload.jks',
      '-Pandroid.injected.signing.store.password=pa=ss',
      '-Pandroid.injected.signing.key.alias=upload',
      '-Pandroid.injected.signing.key.password=secret',
    ])
  })

  it('names what is missing', () => {
    assert.throws(() => parseKeystoreProperties('storeFile=x\n'), /storePassword, keyAlias, keyPassword/)
  })
})

describe('checkReleaseApiUrl', () => {
  it('needs an https api', () => {
    assert.equal(checkReleaseApiUrl('https://api.example.com', 'prod'), undefined)
    assert.match(checkReleaseApiUrl('', 'prod')!, /environments\.prod\.apiUrl is empty/)
    assert.match(checkReleaseApiUrl('http://localhost:3001', 'staging')!, /must be an https/)
  })
})
