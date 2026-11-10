import { useMemo } from 'react'
import { BudgetRing } from '../components/BudgetRing'
import { TransactionRow } from '../components/TransactionRow'
import { Card, SectionTitle } from '../components/ui'
import { useData, useStore } from '../hooks/data'
import { useUI } from '../hooks/ui'
import { getCategory } from '../lib/categories'
import { monthKey } from '../lib/dates'
import { dateLabel } from '../lib/dateLabel'
import { money, moneyShort, monthName } from '../lib/format'
import { forecastMonth, type BudgetStatus } from '../lib/smart/forecast'
import { generateInsights } from '../lib/smart/insights'
import { detectRecurring } from '../lib/smart/recurring'

const STATUS: Record<BudgetStatus, { color: string; text: string }> = {
  ok: { color: 'var(--good)', text: 'Tu es dans les clous 👌' },
  warning: { color: 'var(--warn)', text: 'Attention, tu approches de ton budget' },
  over: { color: 'var(--warn)', text: 'À ce rythme, tu dépasseras ton budget' },
  exceeded: { color: 'var(--bad)', text: 'Budget dépassé ce mois-ci' },
  none: { color: 'var(--ink)', text: 'Définis un budget dans les réglages' },
}

export function Home() {
  const { transactions, recurring, settings } = useData()
  const store = useStore()
  const { setTab, editTransaction, openQuickAdd } = useUI()
  const today = new Date()
  const detected = useMemo(() => detectRecurring(transactions, recurring, settings.dismissedSuggestions), [transactions, recurring, settings.dismissedSuggestions])
  const f = useMemo(() => forecastMonth(transactions, recurring, settings.monthlyBudget, new Date(), { detected }), [transactions, recurring, settings.monthlyBudget, detected])
  const suggestion = detected[0]
  const insight = useMemo(() => generateInsights(transactions, monthKey(new Date()), new Date(), recurring.map((r) => r.label))[0], [transactions, recurring])
  const recent = transactions.slice(0, 5)
  const st = STATUS[f.status]
  const hasBudget = f.status !== 'none'

  return (
    <div className="fade-up">
      <header className="px-1 pt-2">
        <p className="text-[15px] text-muted">{monthName(today)}</p>
        <h1 className="text-[34px] leading-tight font-bold tracking-tight">Budget</h1>
      </header>

      <div className="mt-6">
        <BudgetRing progress={hasBudget ? f.progress : 0} color={st.color}>
          <span className="text-[13px] text-muted">{f.remaining >= 0 || !hasBudget ? 'Reste à dépenser' : 'Dépassement'}</span>
          <span className="tabular text-[40px] leading-tight font-semibold tracking-tight">
            {hasBudget ? moneyShort(Math.abs(f.remaining)) : moneyShort(f.spent)}
          </span>
          {hasBudget && <span className="text-[13px] text-muted">sur {moneyShort(f.budget)}</span>}
        </BudgetRing>
      </div>

      {hasBudget && (
        <div className="mt-4 text-center">
          <p className="text-[17px] font-medium">
            {f.perDay > 0 ? (
              <>
                ≈ <span className="tabular">{money(f.perDay)}</span> par jour
              </>
            ) : (
              'Plus de marge ce mois-ci'
            )}
          </p>
          <p className="mt-1 text-[14px]" style={{ color: f.status === 'ok' ? 'var(--muted)' : st.color }}>
            {st.text}
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-2">
        <Stat label="Dépensé" value={moneyShort(f.spent)} />
        <Stat label="Fin de mois" value={moneyShort(f.projected)} hint="prévision" tone={hasBudget && f.projected > f.budget ? 'warn' : undefined} />
        <Stat label="Revenus" value={moneyShort(f.income)} tone={f.income > 0 ? 'good' : undefined} />
      </div>
      {f.upcomingRecurring > 0 && (
        <p className="mt-3 px-1 text-center text-[13px] text-muted">dont {moneyShort(f.upcomingRecurring)} de charges fixes encore à venir ce mois-ci</p>
      )}

      {suggestion && (
        <Card className="fade-up mt-6">
          <p className="text-[13px] font-medium text-accent">↻ Dépense récurrente détectée</p>
          <p className="mt-1 text-[16px]">
            <b>{suggestion.label}</b> revient chaque mois (~{money(suggestion.amount)}, le {suggestion.dayOfMonth}). L'ajouter aux charges fixes ?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() =>
                store.addRecurring({
                  label: suggestion.label,
                  amount: suggestion.amount,
                  type: 'expense',
                  category: suggestion.category,
                  dayOfMonth: suggestion.dayOfMonth,
                  active: true,
                  startMonth: monthKey(today),
                  // ce mois-ci, la dépense a déjà été saisie à la main si le jour est passé
                  lastGenerated: suggestion.dayOfMonth <= today.getDate() ? monthKey(today) : undefined,
                })
              }
              className="press rounded-full bg-ink px-4 py-2 text-[15px] font-medium text-bg"
            >
              Ajouter
            </button>
            <button
              onClick={() => store.saveSettings({ dismissedSuggestions: [...settings.dismissedSuggestions, suggestion.key] })}
              className="press rounded-full px-4 py-2 text-[15px] text-muted"
            >
              Ignorer
            </button>
          </div>
        </Card>
      )}

      {insight && !suggestion && (
        <button onClick={() => setTab('insights')} className="press mt-6 block w-full text-left">
          <Card className="flex items-start gap-3">
            <span className="text-[24px]">{insight.icon}</span>
            <div>
              <p className="text-[16px] font-medium">{insight.title}</p>
              <p className="mt-0.5 text-[14px] text-muted">{insight.text}</p>
            </div>
          </Card>
        </button>
      )}

      <SectionTitle
        action={
          transactions.length > 5 && (
            <button onClick={() => setTab('history')} className="text-[15px] text-accent">
              Tout voir
            </button>
          )
        }
      >
        Récent
      </SectionTitle>
      {recent.length === 0 ? (
        <button onClick={openQuickAdd} className="press w-full rounded-3xl border border-dashed border-line px-6 py-8 text-center text-[15px] text-muted">
          Aucune dépense pour l'instant.
          <br />
          Appuie sur <b className="text-ink">+</b> pour ajouter la première.
        </button>
      ) : (
        <div className="divide-y divide-line">
          {recent.map((t) => (
            <button key={t.id} onClick={() => editTransaction(t)} className="press block w-full text-left">
              <TransactionRow t={t} subtitle={`${getCategory(t.category).label} · ${dateLabel(t.date)}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="rounded-2xl bg-card px-3 py-3 text-center">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`tabular mt-0.5 text-[17px] font-semibold ${tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : ''}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  )
}
