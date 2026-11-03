import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { buildJournal } from './journal.js'

const identity = { parse: (value) => value }
const commandCodec = {
  mode: 'strict',
  typeSymbol: 'dsh-lore-companion#JournalCommand',
  schema: { parse: parseJournalCommand },
  create: () => ({ parse: parseJournalCommand })
}
const resultCodec = {
  mode: 'strict',
  typeSymbol: 'dsh-lore-companion#JournalSnapshot',
  schema: identity,
  create: () => ({ parse: identity.parse })
}

export function parseJournalCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('journal command must be an object')
  const action = String(value.action || 'snapshot').toLowerCase()
  if (action !== 'snapshot') throw new Error('journal action must be snapshot')
  const game = value.game === 'hsr' ? 'hsr' : 'genshin'
  const command = { action, game }
  if (value.session !== undefined && value.session !== '') command.session = String(value.session).slice(0, 80)
  if (value.limit !== undefined) {
    const limit = Number(value.limit)
    if (!Number.isFinite(limit)) throw new Error('limit must be a number')
    command.limit = Math.max(20, Math.min(1200, Math.floor(limit)))
  }
  return command
}

export const journalRemote = {
  package: 'dsh-lore-companion',
  descriptors: [{
    id: 'dsh-lore-companion#loreJournal/execute',
    service: 'loreJournal',
    namespace: 'loreJournal',
    method: 'execute',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'command', wire: 'command', source: 'json', codec: commandCodec }],
    result: resultCodec
  }]
}

export class LoreJournalRemoteService extends TypertRemoteService {
  constructor(ctx, options) {
    super(ctx, 'loreJournal')
    this.logStore = options.logStore
  }

  async execute(command) {
    const parsed = parseJournalCommand(command)
    return buildJournal(this.logStore, parsed)
  }
}

export function registerJournalRemote(ctx, logStore) {
  try {
    ctx.plugin(LoreJournalRemoteService, { logStore })
  } catch {
    return
  }
  if (typeof ctx.inject !== 'function') return
  ctx.inject(['typert'], (scope) => {
    scope.effect(() => scope.typert.register({
      package: 'dsh-lore-companion',
      face: 'host',
      schemas: [],
      model: { services: [], events: [], objects: [] },
      invocations: journalRemote.descriptors
    }), 'dsh-lore-companion: register journal remote')
  })
}
