import { resolveConfig } from '../lib/config.js'
import { createEngineBootstrap } from '../lib/bootstrap.js'

const config = resolveConfig({})
console.error('[smoke] config ok')
const bootstrap = createEngineBootstrap({
  config,
  engineDir: new URL('../engine', import.meta.url).pathname.replace(/^\//, ''),
  dataDir: new URL('../data', import.meta.url).pathname.replace(/^\//, ''),
  env: process.env,
  onProgress: (line) => console.error('[bootstrap] ' + line)
})
console.error('[smoke] bootstrap created, ensuring...')
try {
  const info = await bootstrap.ensure()
  console.log('READY ' + JSON.stringify(info))
} catch (error) {
  console.error('FAILED ' + error.message)
  process.exitCode = 1
}
