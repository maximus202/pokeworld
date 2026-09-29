import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number }
      s.close(() => resolve(port))
    })
    s.on('error', reject)
  })
}

export interface AppOptions {
  /** Directory containing `.output/` (the project root). */
  cwd: string
  dbPath: string
  pokeapiUrl: string
  maxCollectionSize?: number
}

export interface RunningApp {
  baseUrl: string
  stop(): void
}

/** Boots the already-built production server (`.output/`) as a separate process. */
export async function startApp(options: AppOptions): Promise<RunningApp> {
  const port = await freePort()
  const child = spawn('node', ['.output/server/index.mjs'], {
    cwd: options.cwd,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      NUXT_DB_PATH: options.dbPath,
      NUXT_POKEAPI_BASE_URL: options.pokeapiUrl,
      NUXT_MAX_COLLECTION_SIZE: String(options.maxCollectionSize ?? 1000),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let output = ''
  child.stdout.on('data', chunk => (output += chunk))
  child.stderr.on('data', chunk => (output += chunk))
  let exitCode: number | null | undefined
  child.on('exit', code => (exitCode = code))

  const baseUrl = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (exitCode !== undefined) {
      throw new Error(`App exited with code ${exitCode} before it was ready:\n${output}`)
    }
    try {
      await fetch(`${baseUrl}/api/me`)
      return { baseUrl, stop: () => void child.kill() }
    }
    catch {
      await new Promise(r => setTimeout(r, 200))
    }
  }
  child.kill()
  throw new Error(`Timed out waiting for the app at ${baseUrl}:\n${output}`)
}
