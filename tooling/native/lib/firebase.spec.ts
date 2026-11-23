import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { checkFirebaseBundleId, patchAppDelegate } from './firebase'

const appDelegate = readFileSync(join(import.meta.dirname, '../../../apps/pixel-pitch/app/ios/App/App/AppDelegate.swift'), 'utf8')

describe('patchAppDelegate', () => {
  it('adds the push methods inside the class, once', () => {
    const once = patchAppDelegate(appDelegate)
    assert.match(once, /capacitorDidRegisterForRemoteNotifications/)
    assert.match(once, /didReceiveRemoteNotification userInfo/)
    assert.equal(patchAppDelegate(once), once)
    // Still one class, closed once at the end.
    assert.equal(once.trimEnd().at(-1), '}')
    assert.ok(once.indexOf('capacitorDidRegister') > once.indexOf('configurationForConnecting'))
  })

  it('leaves methods added by hand alone', () => {
    const byHand = appDelegate.replace('var window', 'func application(_ a: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken d: Data) {}\n    var window')
    assert.equal(patchAppDelegate(byHand), byHand)
  })

  it('refuses a file it does not recognise', () => {
    assert.throws(() => patchAppDelegate('import UIKit\n'), /by hand/)
  })
})

describe('checkFirebaseBundleId', () => {
  it('accepts files made for this bundle id and names the wrong ones', () => {
    const android = '{ "client": [{ "client_info": { "android_client_info": { "package_name": "uk.co.acme.dev" } } }] }'
    const ios = '<dict><key>BUNDLE_ID</key>\n<string>uk.co.acme.dev</string></dict>'
    assert.deepEqual(checkFirebaseBundleId({ android, ios }, 'uk.co.acme.dev'), [])
    assert.equal(checkFirebaseBundleId({ android, ios }, 'uk.co.acme').length, 2)
  })
})
