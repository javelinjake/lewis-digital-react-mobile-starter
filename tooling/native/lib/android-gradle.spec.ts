import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { raiseMinSdk } from './android-gradle'

const gradle = 'ext {\n    minSdkVersion = 24\n    compileSdkVersion = 36\n}\n'

describe('raiseMinSdk', () => {
  it('raises a lower minimum', () => {
    assert.match(raiseMinSdk(gradle, 26), /minSdkVersion = 26\n/)
    assert.match(raiseMinSdk(gradle, 26), /compileSdkVersion = 36/)
  })

  it('never lowers a higher minimum set by hand', () => {
    const higher = gradle.replace('24', '28')
    assert.equal(raiseMinSdk(higher, 26), higher)
  })
})
