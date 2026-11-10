import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { Learned, Recurring, Settings, Transaction } from '../lib/types'
import { DEFAULT_SETTINGS } from '../lib/types'
import { BaseStore, newId, sortTx, type DataState, type ExportData, type NewRecurring, type NewTransaction, type Store } from './store'

/**
 * Données dans Supabase (Postgres). Stratégie « local d'abord » :
 * - l'état affiché = dernier état serveur connu + file d'attente des écritures non encore envoyées ;
 * - chaque écriture est appliquée tout de suite, puis envoyée ; si le réseau manque, elle reste dans la file
 *   (sauvegardée dans localStorage) et part au retour de la connexion ;
 * - le dernier état serveur est gardé en cache, donc l'app s'ouvre même hors-ligne.
 */

type Remote = {
  transactions: Transaction[]
  recurring: Recurring[]
  learned: Learned
  settings: Settings | null
}

type Op =
  | { k: 'txUpsert'; items: Transaction[] }
  | { k: 'txDelete'; ids: string[] }
  | { k: 'txPatch'; id: string; patch: Partial<Transaction> }
  | { k: 'recUpsert'; items: Recurring[] }
  | { k: 'recDelete'; ids: string[] }
  | { k: 'recPatch'; id: string; patch: Partial<Recurring> }
  | { k: 'settings'; value: Settings }
  | { k: 'learn'; entries: Learned }

const TABLES = ['transactions', 'recurring', 'learned', 'user_settings'] as const
const PAGE = 1000 // limite par défaut de l'API Supabase

/** Applique les écritures en attente sur l'état serveur. */
function applyOps(remote: Remote, ops: Op[]): Remote {
  const tx = new Map(remote.transactions.map((t) => [t.id, t]))
  const rec = new Map(remote.recurring.map((r) => [r.id, r]))
  let learned = { ...remote.learned }
  let settings = remote.settings

  for (const op of ops) {
    switch (op.k) {
      case 'txUpsert':
        for (const t of op.items) tx.set(t.id, t)
        break
      case 'txDelete':
        for (const id of op.ids) tx.delete(id)
        break
      case 'txPatch': {
        const t = tx.get(op.id)
        if (t) tx.set(op.id, { ...t, ...op.patch })
        break
      }
      case 'recUpsert':
        for (const r of op.items) rec.set(r.id, r)
        break
      case 'recDelete':
        for (const id of op.ids) rec.delete(id)
        break
      case 'recPatch': {
        const r = rec.get(op.id)
        if (r) rec.set(op.id, { ...r, ...op.patch })
        break
      }
      case 'settings':
        settings = op.value
        break
      case 'learn':
        learned = { ...learned, ...op.entries }
        break
    }
  }
  return { transactions: [...tx.values()], recurring: [...rec.values()], learned, settings }
}

const EMPTY_REMOTE: Remote = { transactions: [], recurring: [], learned: {}, settings: null }

export class SupabaseStore extends BaseStore implements Store {
  readonly mode = 'cloud' as const
  private remote: Remote | null
  private queue: Op[]
  private flushing = false
  private channel: RealtimeChannel | null = null
  private readonly queueKey: string
  private readonly cacheKey: string

  constructor(private sb: SupabaseClient, uid: string) {
    super()
    this.queueKey = `budget-queue-${uid}`
    this.cacheKey = `budget-cache-${uid}`
    this.remote = readJson<Remote>(this.cacheKey)
    this.queue = readJson<Op[]>(this.queueKey) ?? []
    this.recompute()

    this.channel = sb.channel(`budget-${uid}`)
    for (const table of TABLES) {
      this.channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${uid}` }, () => void this.refresh())
    }
    this.channel.subscribe()
    window.addEventListener('online', this.onOnline)

    void this.refresh()
    void this.flush()
  }

  private onOnline = () => {
    void this.flush()
    void this.refresh()
  }

  // ---------- Écritures (appliquées tout de suite, envoyées ensuite) ----------

  private enqueue(op: Op) {
    this.queue = [...this.queue, op]
    this.persistQueue()
    this.recompute()
    void this.flush()
  }

  addTransactions(txs: NewTransaction[]) {
    const ids = new Set(this.getState().transactions.map((t) => t.id))
    const items: Transaction[] = txs
      .map((t) => ({ ...t, id: t.id ?? newId(), createdAt: Date.now() }))
      .filter((t) => !ids.has(t.id))
    if (items.length) this.enqueue({ k: 'txUpsert', items })
  }
  updateTransaction(id: string, patch: Partial<Transaction>) {
    const { id: _ignored, ...rest } = patch
    this.enqueue({ k: 'txPatch', id, patch: rest })
  }
  deleteTransaction(id: string) {
    this.enqueue({ k: 'txDelete', ids: [id] })
  }
  addRecurring(r: NewRecurring) {
    this.enqueue({ k: 'recUpsert', items: [{ ...r, id: newId() }] })
  }
  updateRecurring(id: string, patch: Partial<Recurring>) {
    const { id: _ignored, ...rest } = patch
    this.enqueue({ k: 'recPatch', id, patch: rest })
  }
  deleteRecurring(id: string) {
    this.enqueue({ k: 'recDelete', ids: [id] })
  }
  saveSettings(patch: Partial<Settings>) {
    this.enqueue({ k: 'settings', value: { ...this.getState().settings, ...patch } })
  }
  learn(key: string, category: string) {
    if (key) this.enqueue({ k: 'learn', entries: { [key]: category } })
  }
  async importAll(data: ExportData) {
    if (data.transactions.length) this.enqueue({ k: 'txUpsert', items: data.transactions })
    if (data.recurring.length) this.enqueue({ k: 'recUpsert', items: data.recurring })
    if (data.learned && Object.keys(data.learned).length) this.enqueue({ k: 'learn', entries: data.learned })
    this.enqueue({ k: 'settings', value: { ...DEFAULT_SETTINGS, ...data.settings } })
    await this.flush()
  }

  // ---------- Synchronisation ----------

  private async flush() {
    if (this.flushing) return
    this.flushing = true
    let sent = false
    try {
      while (this.queue.length) {
        const op = this.queue[0]
        try {
          await this.send(op)
        } catch (err) {
          if (isNetworkError(err)) break // on réessaiera au retour de la connexion
          console.error('[budget] écriture refusée par Supabase, abandonnée', op, err)
        }
        // L'écriture est sur le serveur : on l'intègre à l'état serveur local pour éviter tout retour en arrière visuel.
        this.queue = this.queue.slice(1)
        if (this.remote) this.remote = applyOps(this.remote, [op])
        this.persistQueue()
        this.persistCache()
        this.recompute()
        sent = true
      }
    } finally {
      this.flushing = false
    }
    if (sent) void this.refresh()
  }

  private async refresh() {
    try {
      const transactions = (await selectAll<TxRow>(this.sb, 'transactions', 'id')).map(txFromRow)
      const recurring = (await selectAll<RecRow>(this.sb, 'recurring', 'id')).map(recFromRow)
      const learned = Object.fromEntries((await selectAll<{ key: string; category: string }>(this.sb, 'learned', 'key')).map((r) => [r.key, r.category]))
      const [settingsRow] = await selectAll<{ settings: Settings }>(this.sb, 'user_settings', 'user_id')
      this.remote = { transactions, recurring, learned, settings: settingsRow?.settings ?? null }
      this.persistCache()
      this.recompute()
    } catch (err) {
      console.warn('[budget] synchro impossible, données locales affichées', err)
      // Hors-ligne sans cache : on affiche ce qui est en file d'attente plutôt que de rester sur l'écran de chargement.
      if (!this.remote) {
        this.remote = EMPTY_REMOTE
        this.recompute()
      }
    }
  }

  private async send(op: Op) {
    const sb = this.sb
    switch (op.k) {
      case 'txUpsert':
        for (const part of chunks(op.items, 500)) throwIfError(await sb.from('transactions').upsert(part.map(txToRow), { onConflict: 'user_id,id' }))
        return
      case 'txDelete':
        throwIfError(await sb.from('transactions').delete().in('id', op.ids))
        return
      case 'txPatch':
        throwIfError(await sb.from('transactions').update(txToRow(op.patch)).eq('id', op.id))
        return
      case 'recUpsert':
        for (const part of chunks(op.items, 500)) throwIfError(await sb.from('recurring').upsert(part.map(recToRow), { onConflict: 'user_id,id' }))
        return
      case 'recDelete':
        throwIfError(await sb.from('recurring').delete().in('id', op.ids))
        return
      case 'recPatch':
        throwIfError(await sb.from('recurring').update(recToRow(op.patch)).eq('id', op.id))
        return
      case 'settings':
        throwIfError(await sb.from('user_settings').upsert({ settings: op.value }, { onConflict: 'user_id' }))
        return
      case 'learn': {
        const rows = Object.entries(op.entries).map(([key, category]) => ({ key, category }))
        for (const part of chunks(rows, 500)) throwIfError(await sb.from('learned').upsert(part, { onConflict: 'user_id,key' }))
        return
      }
    }
  }

  // ---------- État dérivé ----------

  private recompute() {
    if (!this.remote) return
    const merged = applyOps(this.remote, this.queue)
    this.set({
      ready: true,
      transactions: sortTx(merged.transactions),
      recurring: merged.recurring,
      settings: { ...DEFAULT_SETTINGS, ...merged.settings },
      learned: merged.learned,
    } satisfies Partial<DataState>)
  }

  private persistQueue() {
    writeJson(this.queueKey, this.queue)
  }
  private persistCache() {
    if (this.remote) writeJson(this.cacheKey, this.remote)
  }

  dispose() {
    window.removeEventListener('online', this.onOnline)
    if (this.channel) void this.sb.removeChannel(this.channel)
    this.channel = null
  }
}

// ---------- Correspondance colonnes SQL <-> modèle ----------

interface TxRow {
  id: string
  amount: number
  type: Transaction['type']
  category: string
  label: string
  date: string
  recurring_id: string | null
  created_at: number
}

interface RecRow {
  id: string
  label: string
  amount: number
  type: Recurring['type']
  category: string
  day_of_month: number
  active: boolean
  start_month: string
  last_generated: string | null
}

const txFromRow = (r: TxRow): Transaction => ({
  id: r.id,
  amount: Number(r.amount),
  type: r.type,
  category: r.category,
  label: r.label,
  date: r.date,
  recurringId: r.recurring_id ?? undefined,
  createdAt: Number(r.created_at),
})

const recFromRow = (r: RecRow): Recurring => ({
  id: r.id,
  label: r.label,
  amount: Number(r.amount),
  type: r.type,
  category: r.category,
  dayOfMonth: r.day_of_month,
  active: r.active,
  startMonth: r.start_month,
  lastGenerated: r.last_generated ?? undefined,
})

/** Les champs `undefined` sont retirés : un patch n'écrase que ce qui a été modifié. */
const toRow = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

const txToRow = (t: Partial<Transaction>) =>
  toRow({
    id: t.id,
    amount: t.amount,
    type: t.type,
    category: t.category,
    label: t.label,
    date: t.date,
    recurring_id: t.recurringId === undefined ? undefined : (t.recurringId ?? null),
    created_at: t.createdAt,
  })

const recToRow = (r: Partial<Recurring>) =>
  toRow({
    id: r.id,
    label: r.label,
    amount: r.amount,
    type: r.type,
    category: r.category,
    day_of_month: r.dayOfMonth,
    active: r.active,
    start_month: r.startMonth,
    last_generated: r.lastGenerated === undefined ? undefined : (r.lastGenerated ?? null),
  })

// ---------- Utilitaires ----------

/** Lit toutes les lignes d'une table, par pages de 1000. Lève une erreur en cas d'échec réseau ou serveur. */
async function selectAll<T>(sb: SupabaseClient, table: string, orderBy: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select('*')
      .order(orderBy)
      .range(from, from + PAGE - 1)
    throwIfError({ error })
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return out
  }
}

function throwIfError(r: { error: unknown }) {
  if (r.error) throw r.error
}

function isNetworkError(err: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = String((err as { message?: unknown })?.message ?? err)
  return /fetch|network|load failed|internet/i.test(msg)
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / navigation privée */
  }
}
