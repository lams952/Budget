import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditTransactionSheet } from './components/EditTransactionSheet'
import { QuickAddSheet } from './components/QuickAddSheet'
import { TabBar } from './components/TabBar'
import { ConfirmSheet, Toast, type ConfirmData, type ToastData } from './components/ui'
import { SupabaseStore } from './data/supabaseStore'
import { LocalStore } from './data/localStore'
import type { Store } from './data/store'
import { getSupabase, supabaseEnabled } from './supabase'
import { StoreProvider, useData, useStore } from './hooks/data'
import { UIContext, type Tab, type UI } from './hooks/ui'
import { useAuth } from './hooks/useAuth'
import { toKey } from './lib/dates'
import { dueRecurring } from './lib/smart/recurring'
import type { Transaction } from './lib/types'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { Insights } from './screens/Insights'
import { Login, NewPassword } from './screens/Login'
import { Onboarding } from './screens/Onboarding'
import { Settings } from './screens/Settings'

export default function App() {
  const { user, recovering, endRecovery } = useAuth()
  if (!supabaseEnabled) return <WithStore id="local" make={() => new LocalStore()} />
  if (user === undefined) return <Splash />
  if (!user) return <Login />
  if (recovering) return <NewPassword onDone={endRecovery} />
  return <WithStore id={user.id} make={() => new SupabaseStore(getSupabase(), user.id)} email={user.email} />
}

function WithStore({ id, make, email }: { id: string; make: () => Store; email?: string | null }) {
  const [store, setStore] = useState<Store | null>(null)
  const makeRef = useRef(make)
  useEffect(() => {
    const s = makeRef.current()
    setStore(s)
    return () => s.dispose()
  }, [id])
  if (!store) return <Splash />
  return (
    <StoreProvider store={store}>
      <Shell email={email} />
    </StoreProvider>
  )
}

function Splash() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="spinner" />
    </div>
  )
}

/** Change quand on revient sur l'app un autre jour (pour les prévisions et les récurrentes). */
function useToday() {
  const [day, setDay] = useState(() => toKey(new Date()))
  useEffect(() => {
    const check = () => document.visibilityState === 'visible' && setDay(toKey(new Date()))
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [])
  return day
}

const TABS: Tab[] = ['home', 'history', 'insights', 'settings']

function Shell({ email }: { email?: string | null }) {
  const store = useStore()
  const data = useData()
  const day = useToday()
  const [tab, setTabState] = useState<Tab>('home')
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set(['home']))
  const [quickOpen, setQuickOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)
  const [confirmData, setConfirmData] = useState<ConfirmData | null>(null)
  const [search, setSearch] = useState('')
  const proxyRef = useRef<HTMLInputElement>(null)
  const scrollers = useRef<Partial<Record<Tab, HTMLDivElement | null>>>({})
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showToast = useCallback((message: string, action?: ToastData['action']) => {
    setToast({ message, action })
    clearTimeout(toastTimer.current)
    // un toast avec « Annuler » reste plus longtemps, le temps de réagir
    toastTimer.current = setTimeout(() => setToast(null), action ? 5000 : 2000)
  }, [])

  // Génère automatiquement les charges fixes arrivées à échéance.
  useEffect(() => {
    if (!data.ready) return
    const { toCreate, updates } = dueRecurring(data.recurring, data.transactions)
    if (toCreate.length) store.addTransactions(toCreate)
    for (const u of updates) {
      const r = data.recurring.find((x) => x.id === u.id)
      if (r && r.lastGenerated !== u.lastGenerated) store.updateRecurring(u.id, { lastGenerated: u.lastGenerated })
    }
  }, [data.ready, data.recurring, day])

  const setTab = useCallback((t: Tab) => {
    setTabState((cur) => {
      // re-taper l'onglet actif remonte en haut, comme sur iOS
      if (cur === t) scrollers.current[t]?.scrollTo({ top: 0, behavior: 'smooth' })
      return t
    })
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)))
  }, [])
  const openQuickAdd = useCallback(() => {
    // iOS n'ouvre le clavier que si le focus est donné pendant le tap : on focalise un champ relais
    // tout de suite, puis la feuille passe le focus à son vrai champ (le clavier reste ouvert).
    proxyRef.current?.focus({ preventScroll: true })
    setQuickOpen(true)
  }, [])
  const openHistory = useCallback(
    (query = '') => {
      setSearch(query)
      setTab('history')
      scrollers.current.history?.scrollTo({ top: 0 })
    },
    [setTab],
  )
  const ui: UI = useMemo(
    () => ({ tab, setTab, openQuickAdd, editTransaction: setEditing, search, setSearch, openHistory, toast: showToast, confirm: setConfirmData }),
    [tab, setTab, openQuickAdd, search, openHistory, showToast],
  )

  if (!data.ready) return <Splash />
  if (!data.settings.onboarded && data.transactions.length === 0 && data.recurring.length === 0) return <Onboarding />

  const screen = (t: Tab) => {
    switch (t) {
      case 'home':
        return <Home />
      case 'history':
        return <History />
      case 'insights':
        return <Insights />
      case 'settings':
        return <Settings email={email} />
    }
  }

  return (
    <UIContext.Provider value={ui}>
      <div className="relative h-full">
        {/* Chaque onglet a sa propre zone de défilement : il garde sa position et ne défile que s'il a du contenu. */}
        <div className="absolute inset-0">
          {TABS.filter((t) => visited.has(t)).map((t) => (
            <div
              key={`${t}-${day}`}
              ref={(el) => {
                scrollers.current[t] = el
              }}
              className={`scroller absolute inset-0 ${tab === t ? 'fade-up' : 'hidden'}`}
            >
              {/* marge basse : la barre flottante (saisie + onglets) recouvre le bas de l'écran */}
              <div className="pt-safe mx-auto max-w-lg px-4 pb-[calc(150px+env(safe-area-inset-bottom))]">{screen(t)}</div>
            </div>
          ))}
        </div>
        <TabBar tab={tab} setTab={setTab} onAdd={openQuickAdd} />
      </div>
      <input ref={proxyRef} aria-hidden tabIndex={-1} className="pointer-events-none fixed top-0 left-0 h-px w-px opacity-0" />
      <QuickAddSheet open={quickOpen} onClose={() => setQuickOpen(false)} />
      <EditTransactionSheet tx={editing} onClose={() => setEditing(null)} />
      <ConfirmSheet data={confirmData} onClose={() => setConfirmData(null)} />
      <Toast
        toast={toast}
        onAction={() => {
          toast?.action?.run()
          setToast(null)
        }}
      />
    </UIContext.Provider>
  )
}
