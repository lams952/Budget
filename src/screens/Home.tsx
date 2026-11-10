import { useMemo } from 'react'
import { BudgetRing } from '../components/BudgetRing'
import { TransactionRow } from '../components/TransactionRow'
import { Card, CategoryIcon, EmptyState, Icon, ScreenTitle, SectionTitle } from '../components/ui'
import { useData, useStore } from '../hooks/data'
import { useOnline, useUI } from '../hooks/ui'
import { getCategory } from '../lib/categories'
import { monthKey, monthOf } from '../lib/dates'
import { dateLabel } from '../lib/dateLabel'
import { money, moneyRound, moneyShort, monthName } from '../lib/format'
import { upcomingThisMonth } from '../lib/smart/fixed'
import { forecastMonth, type BudgetStatus, type Forecast } from '../lib/smart/forecast'
import { generateInsights } from '../lib/smart/insights'
import { normalize } from '../lib/smart/normalize'
import { detectRecurring } from '../lib/smart/recurring'

// couleurs lumineuses, lisibles sur la carte sombre dans les deux thèmes
const RING: Record<BudgetStatus, string> = { ok: '#3ddc91', warning: '#ffb545', over: '#ffb545', exceeded: '#ff6b6b', none: '#9a9bff' }

function statusText(f: Forecast): string {
  switch (f.status) {
    case 'ok':
      return `Dans les clous · environ ${moneyRound(Math.max(f.budget - f.projected, 0))} de marge`
    case 'warning':
      return `Ça va être juste · environ ${moneyRound(Math.max(f.budget - f.projected, 0))} de marge`
    case 'over':
      return `À ce rythme, dépassement d'environ ${moneyRound(f.projected - f.budget)}`
    case 'exceeded':
      return `Budget dépassé de ${moneyRound(-f.remaining)}`
    case 'none':
      return ''
  }
}

export function Home() {
  const { transactions, recurring, settings, pending } = useData()
  const store = useStore()
  const online = useOnline()
  const { setTab, editTransaction, openQuickAdd, openHistory, toast } = useUI()
  const today = new Date()
  const month = monthKey(today)
  const detected = useMemo(() => detectRecurring(transactions, recurring, settings.dismissedSuggestions), [transactions, recurring, settings.dismissedSuggestions])
  const f = useMemo(() => forecastMonth(transactions, recurring, settings.monthlyBudget, new Date(), { detected }), [transactions, recurring, settings.monthlyBudget, detected])
  const upcoming = useMemo(() => upcomingThisMonth(recurring, transactions), [recurring, transactions])
  const suggestion = detected[0]
  const insight = useMemo(() => generateInsights(transactions, monthKey(new Date()), new Date(), recurring.map((r) => r.label))[0], [transactions, recurring])
  const recent = transactions.slice(0, 5)
  const hasBudget = f.status !== 'none'
  const color = RING[f.status]
  const todayLeft = f.dayBudget - f.spentToday
  const balance = f.income - f.spent - f.fixedPaid

  const addSuggestion = () => {
    // si elle a déjà été saisie à la main ce mois-ci, la première échéance automatique sera le mois prochain
    const seen = transactions.some((t) => monthOf(t.date) === month && normalize(t.label) === suggestion.key)
    store.addRecurring({
      label: suggestion.label,
      amount: suggestion.amount,
      type: 'expense',
      category: suggestion.category,
      dayOfMonth: suggestion.dayOfMonth,
      active: true,
      startMonth: month,
      lastGenerated: seen || suggestion.dayOfMonth <= today.getDate() ? month : undefined,
    })
    toast(`${suggestion.label} ajouté aux charges fixes`)
  }

  return (
    <div>
      <ScreenTitle
        sub={monthName(today)}
        right={
          store.mode === 'cloud' && (!online || pending > 0) ? (
            <span className="mb-1.5 flex items-center gap-1.5 rounded-full bg-card2 px-2.5 py-1 text-[12px] font-semibold text-muted">
              <Icon name={online ? 'cloud' : 'cloudOff'} size={14} />
              {online ? 'Synchro…' : 'Hors ligne'}
            </span>
          ) : undefined
        }
      >
        Budget
      </ScreenTitle>

      <section className="hero mt-4 overflow-hidden rounded-[32px] px-5 pt-7 pb-5">
        <BudgetRing progress={hasBudget ? f.progress : 0} color={color} marker={hasBudget && f.status !== 'exceeded' ? f.elapsed : undefined}>
          <span className="text-[13px] font-medium text-white/60">{!hasBudget ? 'Dépensé ce mois-ci' : f.remaining >= 0 ? 'Reste à dépenser' : 'Dépassement'}</span>
          <span className="num text-[44px] leading-[1.1] font-bold">{moneyRound(hasBudget ? Math.abs(f.remaining) : f.spent)}</span>
          {hasBudget && <span className="num text-[13px] text-white/60">sur {moneyShort(f.budget)}</span>}
        </BudgetRing>

        {hasBudget ? (
          <>
            <p className="mt-4 text-center text-[14px] font-medium text-white/85">
              <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />
              {statusText(f)}
            </p>
            <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-4">
              <HeroStat label="Aujourd'hui" value={todayLeft >= 0 ? moneyRound(todayLeft) : `−${moneyRound(-todayLeft)}`} hint={todayLeft >= 0 ? 'encore dispo' : 'de trop'} color={todayLeft < 0 ? RING.warning : undefined} />
              <HeroStat label="Par jour" value={moneyRound(f.perDay)} hint={`${f.daysLeft} j restant${f.daysLeft > 1 ? 's' : ''}`} />
              <HeroStat label="Fin de mois" value={moneyRound(f.projected)} hint="prévision" color={f.projected > f.budget ? RING.warning : undefined} />
            </div>
          </>
        ) : (
          <div className="mt-5 text-center">
            <p className="text-[14px] text-white/70">Fixe un budget pour savoir combien tu peux dépenser chaque jour.</p>
            <button onClick={() => setTab('settings')} className="press mt-3 rounded-full bg-white px-5 py-2.5 text-[15px] font-semibold text-black">
              Définir mon budget
            </button>
          </div>
        )}
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat
          label="Charges fixes"
          value={moneyShort(f.fixedPaid + f.fixedUpcoming)}
          hint={f.fixedUpcoming > 0 ? `dont ${moneyShort(f.fixedUpcoming)} à venir` : f.fixedPaid > 0 ? 'toutes passées' : 'aucune ce mois-ci'}
          onClick={() => setTab('settings')}
        />
        {f.income > 0 ? (
          <Stat label="Solde du mois" value={`${balance >= 0 ? '+' : '−'}${moneyShort(Math.abs(balance))}`} hint={`${moneyShort(f.income)} de revenus`} tone={balance >= 0 ? 'good' : 'bad'} onClick={() => setTab('insights')} />
        ) : (
          <Stat label="Revenus" value={moneyShort(0)} hint="tape « +1800 salaire »" onClick={openQuickAdd} />
        )}
      </div>

      {suggestion && (
        <Card className="fade-up mt-3">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-accent">
            <Icon name="repeat" size={15} />
            Dépense récurrente détectée
          </p>
          <p className="mt-1.5 text-[16px] leading-snug">
            <b>{suggestion.label}</b> revient chaque mois (environ {money(suggestion.amount)}, vers le {suggestion.dayOfMonth}). La passer en charge fixe, hors budget ?
          </p>
          <div className="mt-3.5 flex gap-2">
            <button onClick={addSuggestion} className="press accent-grad rounded-full px-4 py-2 text-[15px] font-semibold">
              Oui, automatiser
            </button>
            <button onClick={() => store.saveSettings({ dismissedSuggestions: [...settings.dismissedSuggestions, suggestion.key] })} className="press rounded-full bg-field px-4 py-2 text-[15px] font-medium text-muted">
              Non merci
            </button>
          </div>
        </Card>
      )}

      {insight && !suggestion && (
        <button onClick={() => setTab('insights')} className="press mt-3 block w-full text-left">
          <Card className="flex items-center gap-3 !py-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-field text-[22px]">{insight.icon}</span>
            <div className="min-w-0 flex-1">
              <p className={`text-[16px] font-semibold ${insight.tone === 'warn' ? 'text-warn' : insight.tone === 'good' ? 'text-good' : ''}`}>{insight.title}</p>
              <p className="mt-0.5 text-[14px] text-muted">{insight.text}</p>
            </div>
            <Icon name="chevronRight" size={18} className="text-muted" />
          </Card>
        </button>
      )}

      {upcoming.length > 0 && (
        <>
          <SectionTitle>À venir ce mois-ci</SectionTitle>
          <div className="card divide-y divide-line overflow-hidden rounded-3xl">
            {upcoming.slice(0, 4).map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <CategoryIcon id={u.category} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-medium">{u.label}</div>
                  <div className="text-[13px] text-muted">{u.inDays === 1 ? 'Demain' : `Dans ${u.inDays} jours`} · le {u.day}</div>
                </div>
                <div className={`num text-[16px] font-semibold ${u.type === 'income' ? 'text-good' : 'text-muted'}`}>
                  {u.type === 'income' ? '+' : '−'}
                  {money(u.amount)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle
        action={
          transactions.length > 5 && (
            <button onClick={() => openHistory()} className="press text-[14px] font-semibold text-accent">
              Tout voir
            </button>
          )
        }
      >
        Dernières opérations
      </SectionTitle>
      {recent.length === 0 ? (
        <div className="card rounded-3xl">
          <EmptyState emoji="✍️" title="Aucune opération" text="Tape simplement « 12,50 boulangerie » : la catégorie est devinée toute seule.">
            <button onClick={openQuickAdd} className="press accent-grad mt-5 rounded-full px-5 py-2.5 text-[15px] font-semibold">
              Ajouter ma première dépense
            </button>
          </EmptyState>
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden rounded-3xl">
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

function HeroStat({ label, value, hint, color }: { label: string; value: string; hint: string; color?: string }) {
  return (
    <div className="min-w-0 px-2 text-center">
      <div className="text-[11px] font-semibold tracking-wide text-white/55 uppercase">{label}</div>
      <div className="num mt-1 truncate text-[19px] font-bold" style={{ color }}>
        {value}
      </div>
      <div className="truncate text-[11px] text-white/55">{hint}</div>
    </div>
  )
}

function Stat({ label, value, hint, tone, onClick }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad'; onClick: () => void }) {
  return (
    <button onClick={onClick} className="press card rounded-3xl px-4 py-3.5 text-left">
      <div className="flex items-center justify-between text-[13px] font-medium text-muted">
        {label}
        <Icon name="chevronRight" size={14} />
      </div>
      <div className={`num mt-1 text-[22px] font-bold ${tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : ''}`}>{value}</div>
      {hint && <div className="truncate text-[12px] text-muted">{hint}</div>}
    </button>
  )
}
