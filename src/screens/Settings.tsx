import { useRef, useState } from 'react'
import { RecurringSheet } from '../components/RecurringSheet'
import { CategoryIcon, SectionTitle } from '../components/ui'
import type { ExportData } from '../data/store'
import { getSupabase } from '../supabase'
import { useData, useStore } from '../hooks/data'
import { getCategory } from '../lib/categories'
import { money } from '../lib/format'
import type { Recurring } from '../lib/types'

function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Settings({ email, onToast }: { email?: string | null; onToast: (m: string) => void }) {
  const store = useStore()
  const data = useData()
  const { settings, recurring } = data
  const [budget, setBudget] = useState(settings.monthlyBudget ? String(settings.monthlyBudget) : '')
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const fixed = recurring.filter((r) => r.active && r.type === 'expense').reduce((s, r) => s + r.amount, 0)

  const saveBudget = () => {
    const v = Math.round(Number(budget.replace(/\s/g, '').replace(',', '.')))
    if (v >= 0 && v !== settings.monthlyBudget) {
      store.saveSettings({ monthlyBudget: v })
      onToast('Budget enregistré ✓')
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const exportJson = () => {
    const out: ExportData = { version: 1, transactions: data.transactions, recurring: data.recurring, settings: data.settings, learned: data.learned }
    download(`budget-${today}.json`, JSON.stringify(out, null, 2), 'application/json')
  }
  const exportCsv = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const rows = data.transactions.map((t) =>
      [t.date, t.type === 'income' ? 'revenu' : 'dépense', esc(getCategory(t.category).label), esc(t.label), (t.type === 'income' ? t.amount : -t.amount).toFixed(2).replace('.', ',')].join(';'),
    )
    download(`budget-${today}.csv`, '﻿date;type;catégorie;libellé;montant\n' + rows.join('\n'), 'text/csv')
  }
  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as ExportData
      if (!Array.isArray(parsed.transactions)) throw new Error('format')
      if (!confirm(`Importer ${parsed.transactions.length} opérations ? Elles seront fusionnées avec tes données.`)) return
      await store.importAll(parsed)
      onToast('Import terminé ✓')
    } catch {
      alert("Ce fichier n'est pas une sauvegarde Budget valide.")
    }
  }

  return (
    <div className="fade-up">
      <h1 className="px-1 pt-2 text-[34px] font-bold tracking-tight">Réglages</h1>

      <SectionTitle>Budget mensuel</SectionTitle>
      <div className="flex items-center rounded-2xl bg-card px-4">
        <input
          inputMode="numeric"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          onBlur={saveBudget}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="1500"
          className="tabular min-w-0 flex-1 bg-transparent py-4 text-[22px] font-semibold outline-none placeholder:text-muted"
        />
        <span className="text-[17px] text-muted">€ / mois</span>
      </div>
      <p className="mt-2 px-1 text-[13px] text-muted">Tout ce que tu peux dépenser dans le mois, charges fixes comprises.</p>

      <SectionTitle
        action={
          <button onClick={() => setEditing('new')} className="text-[15px] text-accent">
            Ajouter
          </button>
        }
      >
        Charges fixes
      </SectionTitle>
      {recurring.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-4 text-[15px] text-muted">Loyer, abonnements, salaire… ajoute-les une fois, ils s'enregistrent tout seuls chaque mois.</p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl bg-card">
          {[...recurring]
            .sort((a, b) => a.dayOfMonth - b.dayOfMonth)
            .map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setEditing(r)} className="press flex min-w-0 flex-1 items-center gap-3 text-left">
                  <CategoryIcon id={r.category} size={34} />
                  <div className={`min-w-0 flex-1 ${r.active ? '' : 'opacity-40'}`}>
                    <div className="truncate text-[16px]">{r.label}</div>
                    <div className="text-[13px] text-muted">le {r.dayOfMonth} de chaque mois</div>
                  </div>
                  <span className={`tabular text-[15px] ${r.type === 'income' ? 'text-good' : ''} ${r.active ? '' : 'opacity-40'}`}>
                    {r.type === 'income' ? '+' : ''}
                    {money(r.amount)}
                  </span>
                </button>
                <Toggle on={r.active} onChange={(v) => store.updateRecurring(r.id, { active: v })} />
              </div>
            ))}
        </div>
      )}
      {fixed > 0 && <p className="mt-2 px-1 text-[13px] text-muted">Total des charges fixes : {money(fixed)} / mois</p>}

      <SectionTitle>Données</SectionTitle>
      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-card text-[16px]">
        <Row onClick={exportCsv}>Exporter en CSV (Excel, Numbers)</Row>
        <Row onClick={exportJson}>Sauvegarder (JSON)</Row>
        <Row onClick={() => fileRef.current?.click()}>Restaurer une sauvegarde</Row>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />

      <SectionTitle>Compte</SectionTitle>
      {store.mode === 'cloud' ? (
        <div className="divide-y divide-line overflow-hidden rounded-2xl bg-card text-[16px]">
          <div className="px-4 py-3.5">
            <div className="text-[13px] text-muted">Connecté · synchronisé</div>
            <div className="truncate">{email}</div>
          </div>
          <Row onClick={() => confirm('Se déconnecter ?') && void getSupabase().auth.signOut()} danger>
            Se déconnecter
          </Row>
        </div>
      ) : (
        <p className="rounded-2xl bg-card px-4 py-4 text-[15px] text-muted">
          Mode local : tes données restent sur cet appareil. Configure Supabase (voir README) pour les synchroniser dans le cloud.
        </p>
      )}

      <p className="mt-10 text-center text-[12px] text-muted">Budget · gratuit, sans pub, sans pistage</p>

      <RecurringSheet editing={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function Row({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`press flex w-full items-center justify-between px-4 py-3.5 text-left ${danger ? 'text-bad' : ''}`}>
      {children}
      {!danger && <span className="text-muted">›</span>}
    </button>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${on ? 'bg-good' : 'bg-card2'}`}
    >
      <span className={`absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[20px]' : ''}`} />
    </button>
  )
}
