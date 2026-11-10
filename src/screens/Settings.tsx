import { useEffect, useMemo, useRef, useState } from 'react'
import { RecurringSheet } from '../components/RecurringSheet'
import { CategoryIcon, Icon, ScreenTitle, SectionTitle, parseAmount } from '../components/ui'
import type { ExportData } from '../data/store'
import { getSupabase } from '../supabase'
import { useData, useStore } from '../hooks/data'
import { useOnline, useUI } from '../hooks/ui'
import { getCategory } from '../lib/categories'
import { toKey } from '../lib/dates'
import { money, moneyShort } from '../lib/format'
import { fixedMatcher } from '../lib/smart/fixed'
import { historicalDailyRate } from '../lib/smart/forecast'
import type { Recurring } from '../lib/types'

function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Settings({ email }: { email?: string | null }) {
  const store = useStore()
  const data = useData()
  const online = useOnline()
  const { toast, confirm } = useUI()
  const { settings, recurring } = data
  const [budget, setBudget] = useState(settings.monthlyBudget ? String(settings.monthlyBudget) : '')
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const budgetRef = useRef<HTMLInputElement>(null)
  const fixedOut = recurring.filter((r) => r.active && r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const fixedIn = recurring.filter((r) => r.active && r.type === 'income').reduce((s, r) => s + r.amount, 0)

  // le budget peut changer ailleurs (autre appareil, restauration) : on suit, sauf pendant la saisie
  useEffect(() => {
    if (document.activeElement !== budgetRef.current) setBudget(settings.monthlyBudget ? String(settings.monthlyBudget) : '')
  }, [settings.monthlyBudget])

  const applyBudget = (v: number) => {
    if (!(v >= 0) || v === settings.monthlyBudget) return
    store.saveSettings({ monthlyBudget: v })
    toast(v > 0 ? `Budget : ${moneyShort(v)} par mois` : 'Budget retiré')
  }
  const saveBudget = () => {
    const v = budget.trim() ? Math.round(parseAmount(budget)) : 0
    if (Number.isNaN(v) || v < 0) return setBudget(settings.monthlyBudget ? String(settings.monthlyBudget) : '')
    applyBudget(v)
  }

  // Suggestion : ce que tu dépenses réellement au quotidien, d'après les 3 derniers mois complets.
  const usual = useMemo(() => {
    const rate = historicalDailyRate(data.transactions, new Date(), fixedMatcher(recurring))
    return rate ? Math.round((rate * 30.4) / 50) * 50 : 0
  }, [data.transactions, recurring])
  const showUsual = usual > 0 && Math.abs(usual - settings.monthlyBudget) >= 50

  const today = toKey(new Date())
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
    let parsed: ExportData
    try {
      parsed = JSON.parse(await file.text()) as ExportData
      const ok = Array.isArray(parsed.transactions) && parsed.transactions.every((t) => t && typeof t.id === 'string' && typeof t.amount === 'number' && typeof t.date === 'string')
      if (!ok) throw new Error('format')
    } catch {
      toast("Ce fichier n'est pas une sauvegarde Budget valide")
      return
    }
    const n = parsed.transactions.length
    confirm({
      title: `Restaurer ${n} opération${n > 1 ? 's' : ''} ?`,
      text: 'Elles seront fusionnées avec tes données actuelles : rien ne sera effacé, les doublons sont ignorés.',
      confirm: 'Restaurer',
      run: () => {
        store
          .importAll({ ...parsed, recurring: Array.isArray(parsed.recurring) ? parsed.recurring : [], learned: parsed.learned ?? {} })
          .then(() => toast('Sauvegarde restaurée'))
          .catch(() => toast('La restauration a échoué'))
      },
    })
  }

  const empty = data.transactions.length === 0

  return (
    <div>
      <ScreenTitle>Réglages</ScreenTitle>

      <SectionTitle>Budget mensuel</SectionTitle>
      <div className="card rounded-3xl px-5 py-4">
        <label className="flex items-baseline gap-2">
          <input
            ref={budgetRef}
            inputMode="numeric"
            value={budget}
            onChange={(e) => setBudget(e.target.value.replace(/[^\d\s]/g, ''))}
            onBlur={saveBudget}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="0"
            enterKeyHint="done"
            aria-label="Budget mensuel en euros"
            className="num min-w-0 flex-1 bg-transparent text-[34px] font-bold outline-none placeholder:text-card2"
          />
          <span className="text-[16px] font-medium text-muted">€ / mois</span>
        </label>
        <p className="mt-1 text-[13px] text-muted">Pour le quotidien : courses, sorties, shopping… Les charges fixes ne sont pas déduites de ce budget.</p>
        {showUsual && (
          <button onClick={() => applyBudget(usual)} className="press mt-3 flex w-full items-center gap-2 rounded-2xl bg-accent/10 px-3.5 py-2.5 text-left text-[14px] font-medium text-accent">
            <Icon name="sparkle" size={16} />
            <span className="flex-1">
              Tu dépenses environ <b className="num">{moneyShort(usual)}</b> par mois. Utiliser ce montant
            </span>
          </button>
        )}
      </div>

      <SectionTitle
        action={
          <button onClick={() => setEditing('new')} className="press flex items-center gap-1 text-[14px] font-semibold text-accent">
            <Icon name="plus" size={15} strokeWidth={2.6} />
            Ajouter
          </button>
        }
      >
        Charges et revenus fixes
      </SectionTitle>
      {recurring.length === 0 ? (
        <button onClick={() => setEditing('new')} className="press card w-full rounded-3xl px-5 py-5 text-left">
          <p className="text-[16px] font-semibold">Automatise ce qui revient chaque mois</p>
          <p className="mt-1 text-[14px] text-muted">Loyer, abonnements, salaire… ajoute-les une fois, ils s'enregistrent tout seuls à la bonne date.</p>
        </button>
      ) : (
        <div className="card divide-y divide-line overflow-hidden rounded-3xl">
          {[...recurring]
            .sort((a, b) => a.dayOfMonth - b.dayOfMonth)
            .map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setEditing(r)} className={`press flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity ${r.active ? '' : 'opacity-45'}`}>
                  <CategoryIcon id={r.category} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] font-medium">{r.label}</div>
                    <div className="truncate text-[13px] text-muted">{r.active ? `Chaque mois, le ${r.dayOfMonth}` : 'En pause'}</div>
                  </div>
                  <span className={`num text-[15px] font-semibold ${r.type === 'income' ? 'text-good' : ''}`}>
                    {r.type === 'income' ? '+' : '−'}
                    {money(r.amount)}
                  </span>
                </button>
                <Toggle on={r.active} label={`${r.label} : ${r.active ? 'active' : 'en pause'}`} onChange={(v) => store.updateRecurring(r.id, { active: v })} />
              </div>
            ))}
        </div>
      )}
      {(fixedOut > 0 || fixedIn > 0) && (
        <p className="mt-2 px-1 text-[13px] text-muted">
          {fixedOut > 0 && <>Charges : {money(fixedOut)} / mois</>}
          {fixedOut > 0 && fixedIn > 0 && ' · '}
          {fixedIn > 0 && <>Revenus : {money(fixedIn)} / mois</>}
        </p>
      )}

      <SectionTitle>Données</SectionTitle>
      <div className="card divide-y divide-line overflow-hidden rounded-3xl text-[16px]">
        <Row icon="table" onClick={exportCsv} disabled={empty} hint="Excel">
          Exporter en CSV
        </Row>
        <Row icon="download" onClick={exportJson} disabled={empty} hint="JSON">
          Sauvegarder
        </Row>
        <Row icon="upload" onClick={() => fileRef.current?.click()}>
          Restaurer une sauvegarde
        </Row>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // permet de re-choisir le même fichier
          if (file) void importJson(file)
        }}
      />

      <SectionTitle>Compte</SectionTitle>
      {store.mode === 'cloud' ? (
        <div className="card divide-y divide-line overflow-hidden rounded-3xl text-[16px]">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${!online ? 'bg-warn/15 text-warn' : 'bg-good/15 text-good'}`}>
              <Icon name={online ? 'cloud' : 'cloudOff'} size={18} />
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium">{email}</div>
              <div className="text-[13px] text-muted">
                {!online
                  ? `Hors ligne${data.pending ? ` · ${data.pending} modification${data.pending > 1 ? 's' : ''} en attente` : ''}`
                  : data.pending
                    ? 'Synchronisation en cours…'
                    : 'Synchronisé sur tous tes appareils'}
              </div>
            </div>
          </div>
          <Row
            icon="logout"
            danger
            onClick={() =>
              confirm({
                title: 'Se déconnecter ?',
                text: data.pending ? `${data.pending} modification${data.pending > 1 ? 's ne sont' : " n'est"} pas encore synchronisée${data.pending > 1 ? 's' : ''}. Reconnecte-toi sur cet appareil pour les envoyer.` : 'Tes données restent en sécurité dans le cloud.',
                confirm: 'Se déconnecter',
                danger: true,
                run: () => void getSupabase().auth.signOut(),
              })
            }
          >
            Se déconnecter
          </Row>
        </div>
      ) : (
        <p className="card rounded-3xl px-5 py-4 text-[14px] text-muted">
          <b className="text-ink">Mode local.</b> Tes données restent sur cet appareil : pense à créer une sauvegarde de temps en temps.
        </p>
      )}

      <p className="mt-10 text-center text-[12px] text-muted">Budget · gratuit, sans pub, sans pistage</p>

      <RecurringSheet editing={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function Row({ children, onClick, danger, disabled, icon, hint }: { children: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean; icon: Parameters<typeof Icon>[0]['name']; hint?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`press flex w-full items-center gap-3 px-4 py-3.5 text-left font-medium disabled:opacity-40 ${danger ? 'text-bad' : ''}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-bad/10' : 'bg-field text-muted'}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[13px] font-normal text-muted">{hint}</span>}
      {!danger && <Icon name="chevronRight" size={16} className="text-muted" />}
    </button>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${on ? 'bg-good' : 'bg-card2'}`}>
      <span className={`absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[20px]' : ''}`} />
    </button>
  )
}
