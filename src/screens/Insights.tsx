import { useMemo, useState } from 'react'
import { Donut } from '../components/Donut'
import { Card, CategoryIcon, EmptyState, Icon, ScreenTitle, SectionTitle } from '../components/ui'
import { useData } from '../hooks/data'
import { useUI } from '../hooks/ui'
import { getCategory } from '../lib/categories'
import { addMonths, fromKey, monthKey, monthOf } from '../lib/dates'
import { moneyShort, monthName } from '../lib/format'
import { fixedMatcher } from '../lib/smart/fixed'
import { generateInsights, totalsByCategory } from '../lib/smart/insights'

const shortMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short' })

export function Insights() {
  const { transactions, settings, recurring } = useData()
  const { openHistory, openQuickAdd } = useUI()
  const current = monthKey(new Date())
  const [month, setMonth] = useState(current)
  const oldest = transactions.length ? monthOf(transactions[transactions.length - 1].date) : current

  const totals = useMemo(() => totalsByCategory(transactions, month), [transactions, month])
  // mois en cours : on compare au mois précédent « à la même date », sinon tout paraîtrait en baisse
  const before = useMemo(() => {
    const prev = addMonths(month, -1)
    const cutoff = month === current ? new Date().getDate() : 31
    return new Map(totalsByCategory(transactions.filter((t) => monthOf(t.date) === prev && Number(t.date.slice(8)) <= cutoff), prev).map((c) => [c.category, c.total]))
  }, [transactions, month, current])
  const total = totals.reduce((s, c) => s + c.total, 0)
  const income = useMemo(() => transactions.reduce((s, t) => (t.type === 'income' && monthOf(t.date) === month ? s + t.amount : s), 0), [transactions, month])
  const insights = useMemo(() => generateInsights(transactions, month, new Date(), recurring.map((r) => r.label)), [transactions, month, recurring])
  const balance = income - total

  // dépenses du quotidien (comparées au budget) + charges fixes empilées au-dessus
  const months = useMemo(() => {
    const isFixed = fixedMatcher(recurring)
    // la fenêtre reste fixe sur les 6 derniers mois tant que le mois affiché en fait partie
    const end = month >= addMonths(current, -5) ? current : month
    return Array.from({ length: 6 }, (_, i) => addMonths(end, i - 5)).map((m) => {
      let daily = 0
      let fixed = 0
      for (const t of transactions) {
        if (t.type !== 'expense' || monthOf(t.date) !== m) continue
        if (isFixed(t)) fixed += t.amount
        else daily += t.amount
      }
      return { m, daily, fixed, total: daily + fixed }
    })
  }, [transactions, month, recurring, current])
  const maxBar = Math.max(settings.monthlyBudget, ...months.map((x) => x.total), 1)
  const hasHistory = months.some((x) => x.total > 0)

  const navBtn = 'press flex h-10 w-10 items-center justify-center rounded-full text-accent disabled:text-muted disabled:opacity-30'

  return (
    <div>
      <ScreenTitle>Analyse</ScreenTitle>

      <div className="card mt-4 flex items-center justify-between rounded-full p-1">
        <button onClick={() => setMonth(addMonths(month, -1))} disabled={month <= oldest} className={navBtn} aria-label="Mois précédent">
          <Icon name="chevronLeft" size={20} strokeWidth={2.4} />
        </button>
        <button onClick={() => setMonth(current)} disabled={month === current} className="px-3 text-[16px] font-semibold" aria-label={`${monthName(fromKey(month))}. Revenir au mois en cours.`}>
          {monthName(fromKey(month))}
        </button>
        <button onClick={() => setMonth(addMonths(month, 1))} disabled={month >= current} className={navBtn} aria-label="Mois suivant">
          <Icon name="chevronRight" size={20} strokeWidth={2.4} />
        </button>
      </div>

      {total === 0 && income === 0 ? (
        <Card className="mt-3">
          <EmptyState emoji="📊" title="Pas encore de données" text="Ajoute quelques dépenses ce mois-ci pour voir leur répartition et des conseils.">
            {month === current && (
              <button onClick={openQuickAdd} className="press accent-grad mt-5 rounded-full px-5 py-2.5 text-[15px] font-semibold">
                Ajouter une dépense
              </button>
            )}
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="card mt-3 grid grid-cols-3 divide-x divide-line rounded-3xl py-3.5 text-center">
            <Summary label="Revenus" value={moneyShort(income)} className={income > 0 ? 'text-good' : ''} />
            <Summary label="Dépenses" value={moneyShort(total)} />
            <Summary label="Solde" value={`${balance > 0 ? '+' : balance < 0 ? '−' : ''}${moneyShort(Math.abs(balance))}`} className={balance < 0 ? 'text-bad' : balance > 0 ? 'text-good' : ''} />
          </div>

          {totals.length > 0 && (
            <Card className="mt-3">
              <Donut data={totals.map((c) => ({ value: c.total, color: getCategory(c.category).color }))}>
                <span className="text-[13px] font-medium text-muted">Dépenses</span>
                <span className="num text-[30px] leading-tight font-bold">{moneyShort(total)}</span>
                <span className="text-[12px] text-muted">
                  {totals.length} catégorie{totals.length > 1 ? 's' : ''}
                </span>
              </Donut>
              <div className="mt-5 -mb-1.5">
                {totals.map((c) => {
                  const cat = getCategory(c.category)
                  const share = total ? c.total / total : 0
                  const diff = c.total - (before.get(c.category) ?? 0)
                  const showDiff = before.size > 0 && Math.abs(diff) >= 1
                  return (
                    <button key={c.category} onClick={() => openHistory(cat.label)} className="press flex w-full items-center gap-3 py-2 text-left" aria-label={`${cat.label}, ${moneyShort(c.total)}. Voir les opérations.`}>
                      <CategoryIcon id={c.category} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2 text-[15px]">
                          <span className="truncate font-medium">{cat.label}</span>
                          <span className="num font-semibold">{moneyShort(c.total)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-card2">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(share * 100, 2)}%`, background: cat.color, transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} />
                        </div>
                        <div className="mt-1 flex justify-between text-[12px] text-muted">
                          <span>
                            {Math.round(share * 100)} % · {c.count} opération{c.count > 1 ? 's' : ''}
                          </span>
                          {showDiff && (
                            <span className={`num ${diff > 0 ? 'text-warn' : 'text-good'}`}>
                              {diff > 0 ? '+' : '−'}
                              {moneyShort(Math.abs(diff))} vs {shortMonth.format(fromKey(addMonths(month, -1))).replace('.', '')}
                            </span>
                          )}
                        </div>
                      </div>
                      <Icon name="chevronRight" size={16} className="text-muted" />
                    </button>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}

      {insights.length > 0 && (
        <>
          <SectionTitle>Ce qu'il faut retenir</SectionTitle>
          <div className="card divide-y divide-line overflow-hidden rounded-3xl">
            {insights.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-field text-[22px]">{i.icon}</span>
                <div className="min-w-0">
                  <p className={`text-[16px] font-semibold ${i.tone === 'warn' ? 'text-warn' : i.tone === 'good' ? 'text-good' : ''}`}>{i.title}</p>
                  <p className="mt-0.5 text-[14px] text-muted">{i.text}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {hasHistory && (
        <>
          <SectionTitle>Sur 6 mois</SectionTitle>
          <Card>
            <div className="relative flex h-40 items-end gap-2.5">
              {settings.monthlyBudget > 0 && (
                <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-muted/70" style={{ bottom: `${(settings.monthlyBudget / maxBar) * 82}%` }}>
                  <span className="absolute -top-4 right-0 rounded bg-card px-1 text-[10px] font-medium text-muted">budget</span>
                </div>
              )}
              {months.map((x) => (
                <button key={x.m} onClick={() => setMonth(x.m < oldest ? oldest : x.m)} className="flex h-full flex-1 flex-col items-center justify-end gap-1" aria-label={`${monthName(fromKey(x.m))} : ${moneyShort(x.total)}`}>
                  <span className={`num text-[10px] ${x.m === month ? 'font-semibold text-ink' : 'text-muted'}`}>{x.total ? moneyShort(x.total) : ''}</span>
                  <div className="flex w-full flex-col gap-0.5" style={{ height: `${Math.max((x.total / maxBar) * 82, 2)}%`, transition: 'height .6s cubic-bezier(.2,.8,.2,1)' }}>
                    {x.fixed > 0 && <div className="w-full rounded-t-lg rounded-b-[3px]" style={{ flex: x.fixed, background: x.m === month ? 'var(--accent)' : 'var(--card2)', opacity: x.m === month ? 0.35 : 0.45 }} />}
                    <div
                      className={`w-full ${x.fixed > 0 ? 'rounded-t-[3px]' : 'rounded-t-lg'} rounded-b-lg`}
                      style={{
                        flex: Math.max(x.daily, x.total ? 0 : 1),
                        background: x.m === month ? (settings.monthlyBudget && x.daily > settings.monthlyBudget ? 'var(--bad)' : 'var(--accent)') : 'var(--card2)',
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2.5">
              {months.map((x) => (
                <span key={x.m} className={`flex-1 text-center text-[11px] ${x.m === month ? 'font-semibold text-accent' : 'text-muted'}`}>
                  {shortMonth.format(fromKey(x.m)).replace('.', '')}
                </span>
              ))}
            </div>
            <div className="mt-4 flex justify-center gap-4 border-t border-line pt-3 text-[12px] text-muted">
              <span className="flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-[3px] bg-accent" /> Quotidien
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-[3px] bg-accent opacity-35" /> Charges fixes
              </span>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function Summary({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0 px-2">
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className={`num mt-0.5 truncate text-[18px] font-bold ${className}`}>{value}</div>
    </div>
  )
}
