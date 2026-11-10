import type { Learned, Recurring, Settings, Transaction } from '../lib/types'
import { DEFAULT_SETTINGS } from '../lib/types'

export interface DataState {
  ready: boolean
  transactions: Transaction[] // triées du plus récent au plus ancien
  recurring: Recurring[]
  settings: Settings
  learned: Learned
  /** écritures pas encore envoyées au serveur (toujours 0 en mode local) */
  pending: number
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'> & { id?: string; createdAt?: number }
export type NewRecurring = Omit<Recurring, 'id'>

export interface ExportData {
  version: 1
  transactions: Transaction[]
  recurring: Recurring[]
  settings: Settings
  learned: Learned
}

export interface Store {
  readonly mode: 'cloud' | 'local'
  getState(): DataState
  subscribe(fn: () => void): () => void
  addTransactions(txs: NewTransaction[]): void
  updateTransaction(id: string, patch: Partial<Transaction>): void
  deleteTransaction(id: string): void
  addRecurring(r: NewRecurring): void
  updateRecurring(id: string, patch: Partial<Recurring>): void
  deleteRecurring(id: string): void
  saveSettings(patch: Partial<Settings>): void
  learn(key: string, category: string): void
  importAll(data: ExportData): Promise<void>
  dispose(): void
}

export const initialState = (): DataState => ({
  ready: false,
  transactions: [],
  recurring: [],
  settings: { ...DEFAULT_SETTINGS },
  learned: {},
  pending: 0,
})

export const sortTx = (txs: Transaction[]) =>
  [...txs].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))

export const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`).replace(/-/g, '').slice(0, 20)

/** Base commune : état en mémoire + abonnés (compatible useSyncExternalStore). */
export abstract class BaseStore {
  protected state: DataState = initialState()
  private listeners = new Set<() => void>()
  getState = () => this.state
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  protected set(patch: Partial<DataState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }
}
