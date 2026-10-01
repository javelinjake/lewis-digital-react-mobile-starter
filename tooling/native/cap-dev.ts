import { spawn } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import process from 'node:process'

/**
 * Live reload on a device or emulator: starts Vite on the LAN, points the
 * Capacitor shell at it via CAP_SERVER_URL, then runs the app.
 *
 *   pnpm cap:dev:ios
 *   pnpm cap:dev:android
 *
 * Android emulators reach the host at 10.0.2.2; physical devices use the LAN IP.
 */
const platform = process.argv[2]
if (platform !== 'ios' && platform !== 'android') {
  console.error('Usage: cap-dev.ts <ios|android>')
  process.exit(1)
}

const port = process.env.PORT ?? '5173'
const host = process.env.CAP_DEV_HOST ?? detectLanIp() ?? 'localhost'
const serverUrl = `http://${host}:${port}`

function detectLanIp(): string | undefined {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal)
        return entry.address
    }
  }
  return undefined
}

const vite = spawn('pnpm', ['exec', 'vite', '--host', '--port', port, '--strictPort'], {
  stdio: 'inherit',
  env: process.env,
})

function stop() {
  vite.kill('SIGTERM')
  process.exit(0)
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)

setTimeout(() => {
  console.log(`\nPointing ${platform} shell at ${serverUrl}\n`)

  const cap = spawn('pnpm', ['exec', 'cap', 'run', platform, '--live-reload', '--host', host, '--port', port], {
    stdio: 'inherit',
    env: { ...process.env, CAP_SERVER_URL: serverUrl },
  })

  cap.on('exit', (code) => {
    if (code !== 0)
      stop()
  })
}, 1500)
