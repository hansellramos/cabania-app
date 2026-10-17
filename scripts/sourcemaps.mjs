// Runs after `vite build`. When PostHog CLI credentials are present, injects
// chunk ids and uploads the source maps so production stack traces are readable.
// The .map files are always deleted from dist so they are never served.
import { execFileSync } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const dist = path.resolve('dist')
const maps = readdirSync(dist, { recursive: true }).filter(f => String(f).endsWith('.map'))
if (maps.length === 0) process.exit(0)

const { POSTHOG_CLI_TOKEN, POSTHOG_CLI_ENV_ID } = process.env
if (POSTHOG_CLI_TOKEN && POSTHOG_CLI_ENV_ID) {
  const cli = (...args) => execFileSync('npx', ['-y', '@posthog/cli@0.18.10', ...args], { stdio: 'inherit' })
  try {
    cli('sourcemap', 'inject', '--directory', dist)
    cli('sourcemap', 'upload', '--directory', dist)
    console.log(`[sourcemaps] uploaded ${maps.length} source maps to PostHog`)
  } catch (err) {
    // A failed upload must not block a deploy.
    console.warn('[sourcemaps] upload failed:', err.message)
  }
}

for (const f of maps) rmSync(path.join(dist, String(f)))
console.log(`[sourcemaps] removed ${maps.length} .map files from dist`)
