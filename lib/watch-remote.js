import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

const identity = { parse: (value) => value }
const commandCodec = {
  mode: 'strict',
  typeSymbol: 'dsh-lore-companion#WatchCommand',
  schema: { parse: parseCommand },
  create: () => ({ parse: parseCommand })
}
const statusCodec = {
  mode: 'strict',
  typeSymbol: 'dsh-lore-companion#WatchStatus',
  schema: identity,
  create: () => ({ parse: identity.parse })
}

export const watchRemote = {
  package: 'dsh-lore-companion',
  descriptors: [{
    id: 'dsh-lore-companion#loreWatch/execute',
    service: 'loreWatch',
    namespace: 'loreWatch',
    method: 'execute',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'command', wire: 'command', source: 'json', codec: commandCodec }],
    result: statusCodec
  }]
}

export function parseCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('watch command must be an object')
  const action = String(value.action || '').toLowerCase()
  if (!['start', 'stop', 'status'].includes(action)) throw new Error('watch action must be start, stop or status')
  const command = { action }
  if (value.intervalSec !== undefined) {
    const interval = Number(value.intervalSec)
    if (!Number.isFinite(interval)) throw new Error('intervalSec must be a number')
    command.intervalSec = interval
  }
  if (value.game !== undefined) {
    const game = String(value.game).toLowerCase()
    if (!['auto', 'genshin', 'hsr'].includes(game)) throw new Error('game must be auto, genshin or hsr')
    command.game = game
  }
  if (value.mode !== undefined) {
    const mode = String(value.mode).toLowerCase()
    if (!['dialogue', 'read'].includes(mode)) throw new Error('mode must be dialogue or read')
    command.mode = mode
  }
  for (const key of ['window', 'session', 'note']) {
    if (value[key] !== undefined) command[key] = String(value[key])
  }
  return command
}

export class LoreWatchRemoteService extends TypertRemoteService {
  constructor(ctx, options) {
    super(ctx, 'loreWatch')
    this.watcher = options.watcher
  }

  async execute(command) {
    const parsed = parseCommand(command)
    if (parsed.action === 'start') return this.watcher.start(parsed)
    if (parsed.action === 'stop') return this.watcher.stop()
    return this.watcher.status()
  }
}

export function registerWatchRemote(ctx, watcher) {
  try {
    ctx.plugin(LoreWatchRemoteService, { watcher })
  } catch {
    // The composer button stays absent when the Host has no Typert face.
    return
  }
  if (typeof ctx.inject !== 'function') return
  ctx.inject(['typert'], (scope) => {
    scope.effect(() => scope.typert.register({
      package: 'dsh-lore-companion',
      face: 'host',
      schemas: [],
      model: { services: [], events: [], objects: [] },
      invocations: watchRemote.descriptors
    }), 'dsh-lore-companion: register watch remote')
  })
}
