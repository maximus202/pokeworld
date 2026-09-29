import { spawn, type ChildProcess } from 'node:child_process'
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

async function waitFor(url: string, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url)
      return
    }
    catch {
      await new Promise(r => setTimeout(r, 200))
    }
  }
  throw new Error(`Timed out waiting for ${url}`)
}

export interface AppOptions {
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
  const child: ChildProcess = spawn('node', ['.output/server/index.mjs'], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      NUXT_DB_PATH: options.dbPath,
      NUXT_POKEAPI_BASE_URL: options.pokeapiUrl,
      NUXT_MAX_COLLECTION_SIZE: String(options.maxCollectionSize ?? 1000),
    },
    stdio: 'ignore',
  })
  const baseUrl = `http://127.0.0.1:${port}`
  await waitFor(`${baseUrl}/api/me`)
  return { baseUrl, stop: () => void child.kill() }
}
