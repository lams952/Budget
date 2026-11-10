import type { Tab } from '../hooks/ui'
import { Icon } from './ui'

const ICONS: Record<Tab, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  history: 'M4 6h16M4 12h16M4 18h10',
  insights: 'M12 3v9l7.8 4.5M21 12a9 9 0 1 1-9-9',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
}
const LABELS: Record<Tab, string> = { home: 'Accueil', history: 'Historique', insights: 'Analyse', settings: 'Réglages' }

/** Barre du bas, flottante au-dessus du contenu : saisie rapide (pastille noire) + onglets en verre. */
export function TabBar({ tab, setTab, onAdd }: { tab: Tab; setTab: (t: Tab) => void; onAdd: () => void }) {
  const item = (t: Tab) => {
    const active = tab === t
    return (
      <button
        key={t}
        onClick={() => setTab(t)}
        className={`press flex flex-1 flex-col items-center gap-[3px] pt-2 pb-1 text-[10px] font-medium transition-colors ${active ? 'text-ink' : 'text-muted'}`}
        aria-current={active ? 'page' : undefined}
      >
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={ICONS[t]} />
        </svg>
        {LABELS[t]}
      </button>
    )
  }
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
      <div className="pointer-events-auto mx-auto max-w-lg px-3.5">
        <button
          onClick={onAdd}
          aria-label="Ajouter une opération"
          className="press flex w-full items-center gap-3 rounded-full bg-solid p-2 text-left text-on-solid shadow-[0_14px_30px_-12px_rgba(10,10,30,0.55)]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-on-solid/12">
            <Icon name="plus" size={20} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[15px] opacity-55">« 12,50 boulangerie hier »</span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-on-solid/12">
            <Icon name="sparkle" size={18} strokeWidth={1.8} />
          </span>
        </button>
      </div>
      <nav className="frost pb-safe pointer-events-auto mt-2.5 border-t border-card-line bg-[var(--dock)]">
        <div className="mx-auto flex max-w-lg items-start">
          {item('home')}
          {item('history')}
          {item('insights')}
          {item('settings')}
        </div>
      </nav>
    </div>
  )
}
