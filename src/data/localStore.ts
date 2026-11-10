import type { Transaction } from '../lib/types'
import { DEFAULT_SETTINGS } from '../lib/types'
import { BaseStore, newId, sortTx, type ExportData, type NewRecurring, type NewTransaction, type Store } from './store'

const KEY = 'budget-data-v1'

/** Données stockées uniquement sur l'appareil (utilisé tant que Supabase n'est pas configuré). */
export class LocalStore extends BaseStore implements Store {
  readonly mode = 'local' as const

  constructor() {
    super()
    let saved: Partial<ExportData> = {}
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    } catch {
      /* stockage indisponible */
    }
    this.set({
      ready: true,
      transactions: sortTx(saved.transactions ?? []),
      recurring: saved.recurring ?? [],
      settings: { ...DEFAULT_SETTINGS, ...saved.settings },
      learned: saved.learned ?? {},
    })
  }

  private persist() {
    const { transactions, recurring, settings, learned } = this.state
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, transactions, recurring, settings, learned }))
    } catch {
      /* quota / navigation privée */
    }
  }
  private commit(patch: Parameters<BaseStore['set']>[0]) {
    this.set(patch)
    this.persist()
  }

  addTransactions(txs: NewTransaction[]) {
    const ids = new Set(this.state.transactions.map((t) => t.id))
    const created: Transaction[] = txs
      .map((t) => ({ ...t, id: t.id ?? newId(), createdAt: t.createdAt ?? Date.now() }))
      .filter((t) => !ids.has(t.id))
    this.commit({ transactions: sortTx([...this.state.transactions, ...created]) })
  }
  updateTransaction(id: string, patch: Partial<Transaction>) {
    this.commit({ transactions: sortTx(this.state.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t))) })
  }
  deleteTransaction(id: string) {
    this.commit({ transactions: this.state.transactions.filter((t) => t.id !== id) })
  }
  addRecurring(r: NewRecurring) {
    this.commit({ recurring: [...this.state.recurring, { ...r, id: newId() }] })
  }
  updateRecurring(id: string, patch: Partial<NewRecurring>) {
    this.commit({ recurring: this.state.recurring.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  }
  deleteRecurring(id: string) {
    this.commit({ recurring: this.state.recurring.filter((r) => r.id !== id) })
  }
  saveSettings(patch: Partial<ExportData['settings']>) {
    this.commit({ settings: { ...this.state.settings, ...patch } })
  }
  learn(key: string, category: string) {
    if (key) this.commit({ learned: { ...this.state.learned, [key]: category } })
  }
  async importAll(data: ExportData) {
    // fusion par identifiant : la sauvegarde complète ou remplace, sans rien effacer d'autre
    const byId = <T extends { id: string }>(current: T[], incoming: T[] = []) => [...new Map([...current, ...incoming].map((x) => [x.id, x])).values()]
    this.commit({
      transactions: sortTx(byId(this.state.transactions, data.transactions)),
      recurring: byId(this.state.recurring, data.recurring),
      settings: { ...DEFAULT_SETTINGS, ...this.state.settings, ...data.settings },
      learned: { ...this.state.learned, ...data.learned },
    })
  }
  dispose() {}
}
