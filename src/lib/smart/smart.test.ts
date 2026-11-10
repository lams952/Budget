import { describe, expect, it } from 'vitest'
import { parseQuickInput } from './parser'
import { categorize, learnFromHistory } from './categorizer'
import { upcomingThisMonth } from './fixed'
import { forecastMonth } from './forecast'
import { detectRecurring, dueRecurring } from './recurring'
import { generateInsights } from './insights'
import type { Recurring, Transaction } from '../types'

const today = new Date(2026, 10, 10) // mardi 10 novembre 2026
let n = 0
const tx = (date: string, amount: number, label = 'x', category = 'autre', extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`, amount, type: 'expense', category, label, date, createdAt: 0, ...extra,
})

describe('parseQuickInput', () => {
  it('montant à virgule + libellé + hier', () => {
    expect(parseQuickInput('12,50 boulangerie hier', today)).toEqual({ amount: 12.5, type: 'expense', label: 'Boulangerie', date: '2026-11-09' })
  })
  it('revenu avec +', () => {
    const r = parseQuickInput('+1800 salaire', today)
    expect(r).toMatchObject({ amount: 1800, type: 'income', label: 'Salaire' })
  })
  it('revenu détecté par mot-clé', () => {
    expect(parseQuickInput('remboursement 20', today).type).toBe('income')
  })
  it('montant après le libellé, avec €', () => {
    expect(parseQuickInput('Netflix 13.49€', today)).toMatchObject({ amount: 13.49, label: 'Netflix' })
  })
  it('milliers avec espace', () => {
    expect(parseQuickInput('1 200 loyer', today)).toMatchObject({ amount: 1200, label: 'Loyer' })
  })
  it('préfère le nombre suivi de €', () => {
    expect(parseQuickInput('2 cafés 5€', today)).toMatchObject({ amount: 5, label: '2 cafés' })
  })
  it('préfère le nombre à décimales', () => {
    expect(parseQuickInput('2 cafés 7,50', today)).toMatchObject({ amount: 7.5, label: '2 cafés' })
  })
  it('date jj/mm', () => {
    expect(parseQuickInput('45 essence 03/11', today).date).toBe('2026-11-03')
  })
  it('jour de la semaine passé', () => {
    expect(parseQuickInput('30 resto samedi', today).date).toBe('2026-11-07')
  })
  it('« le 2 »', () => {
    expect(parseQuickInput('9 ciné le 2', today)).toMatchObject({ date: '2026-11-02', label: 'Ciné' })
  })
  it('sans montant', () => {
    expect(parseQuickInput('boulangerie', today).amount).toBeNull()
  })
})

describe('categorize', () => {
  it('mots-clés', () => {
    expect(categorize('Boulangerie', 'expense').category).toBe('courses')
    expect(categorize('Essence Total', 'expense').category).toBe('transport')
    expect(categorize('Netflix', 'expense').category).toBe('abonnements')
    expect(categorize('Uber Eats', 'expense').category).toBe('resto')
    expect(categorize('Pharmacie', 'expense').category).toBe('sante')
    expect(categorize('Salaire', 'income').category).toBe('salaire')
  })
  it('les corrections apprises passent avant', () => {
    expect(categorize('Boulangerie', 'expense', { boulangerie: 'resto' })).toEqual({ category: 'resto', confidence: 'learned' })
    expect(categorize('Chez Paul midi', 'expense', { 'chez paul': 'resto' }).category).toBe('resto')
  })
  it('inconnu → autre', () => {
    expect(categorize('zzz', 'expense')).toEqual({ category: 'autre', confidence: 'default' })
  })
})

describe('forecastMonth', () => {
  const rec: Recurring[] = [{ id: 'r', label: 'Loyer', amount: 600, type: 'expense', category: 'logement', dayOfMonth: 28, active: true, startMonth: '2026-01' }]
  it('les charges fixes ne consomment pas le budget', () => {
    const txs = [tx('2026-11-02', 200), tx('2026-11-05', 300), tx('2026-11-05', 50, 'Netflix', 'abonnements', { recurringId: 'n' })]
    const f = forecastMonth(txs, rec, 2000, today)
    expect(f.spent).toBe(500)
    expect(f.fixedPaid).toBe(50)
    expect(f.fixedUpcoming).toBe(600)
    expect(f.remaining).toBe(1500)
    expect(f.daysLeft).toBe(21)
    expect(f.perDay).toBeCloseTo(1500 / 21)
    expect(f.projected).toBeCloseTo(500 + 50 * 20)
    expect(f.status).toBe('ok')
  })
  it('un loyer saisi à la main est reconnu comme charge fixe', () => {
    const f = forecastMonth([tx('2026-11-05', 600, 'loyer')], rec, 1000, today)
    expect(f.spent).toBe(0)
    expect(f.fixedPaid).toBe(600)
    expect(f.fixedUpcoming).toBe(0)
  })
  it("n'extrapole ni les récurrentes détectées ni les grosses dépenses ponctuelles", () => {
    const txs = [tx('2026-11-05', 30, 'Salle de sport'), tx('2026-11-06', 400, 'Vélo'), tx('2026-11-08', 100, 'Courses')]
    const f = forecastMonth(txs, [], 2000, today, { detected: [{ key: 'salle de sport', amount: 30, dayOfMonth: 5 }, { key: 'spotify', amount: 10, dayOfMonth: 12 }] })
    expect(f.projected).toBeCloseTo(530 + 10 * 20 + 10)
    expect(f.perDay).toBeCloseTo((2000 - 530 - 10) / 21)
  })
  it('dépassement prévu', () => {
    expect(forecastMonth([tx('2026-11-03', 140), tx('2026-11-05', 140), tx('2026-11-08', 140)], [], 1000, today).status).toBe('over')
  })
})

describe('recurring', () => {
  const r: Recurring = { id: 'r', label: 'Netflix', amount: 13.49, type: 'expense', category: 'abonnements', dayOfMonth: 5, active: true, startMonth: '2026-09' }
  it('génère les mois manquants une seule fois', () => {
    const { toCreate, updates } = dueRecurring([r], [], today)
    expect(toCreate.map((t) => t.date)).toEqual(['2026-09-05', '2026-10-05', '2026-11-05'])
    expect(updates).toEqual([{ id: 'r', lastGenerated: '2026-11' }])
    expect(dueRecurring([{ ...r, lastGenerated: '2026-11' }], toCreate, today).toCreate).toHaveLength(0)
  })
  it("n'anticipe pas une échéance future", () => {
    expect(dueRecurring([{ ...r, dayOfMonth: 20, startMonth: '2026-11' }], [], today).toCreate).toHaveLength(0)
  })
  it('détecte un abonnement', () => {
    const txs = [tx('2026-09-12', 9.99, 'Spotify'), tx('2026-10-12', 9.99, 'Spotify'), tx('2026-11-11', 9.99, 'spotify'), tx('2026-11-01', 30, 'Resto'), tx('2026-10-20', 80, 'Resto')]
    const s = detectRecurring(txs, [], [], today)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ amount: 9.99, dayOfMonth: 12, months: 3 })
  })
})

describe('insights', () => {
  it('compare au mois dernier à la même date', () => {
    const txs = [tx('2026-10-03', 100, 'a', 'resto'), tx('2026-10-25', 900), tx('2026-11-03', 200, 'b', 'resto')]
    const ins = generateInsights(txs, '2026-11', today)
    expect(ins.find((i) => i.id === 'trend')?.tone).toBe('warn')
    expect(ins.find((i) => i.id === 'cat-up-resto')).toBeTruthy()
  })
  it('épargne du mois précédent', () => {
    const txs = [tx('2026-10-01', 2000, 'Salaire', 'salaire', { type: 'income' }), tx('2026-10-10', 1500)]
    expect(generateInsights(txs, '2026-11', today).find((i) => i.id === 'saved')?.title).toContain('500')
  })
})

describe('nouveautés', () => {
  const rec = (over: Partial<Recurring>): Recurring => ({ id: 'r', label: 'Spotify', amount: 10.99, type: 'expense', category: 'abonnements', dayOfMonth: 22, active: true, startMonth: '2026-11', ...over })

  it("apprend la catégorie depuis l'historique, sauf les catégories par défaut", () => {
    const learned = learnFromHistory([tx('2026-11-09', 12, 'Chez Momo', 'resto'), tx('2026-11-08', 12, 'Chez Momo', 'loisirs'), tx('2026-11-07', 5, 'Truc', 'autre')])
    expect(learned).toEqual({ 'chez momo': 'resto' })
    expect(categorize('chez momo', 'expense', learned)).toEqual({ category: 'resto', confidence: 'learned' })
  })

  it('liste les échéances restantes du mois', () => {
    const up = upcomingThisMonth([rec({}), rec({ id: 'r2', label: 'Loyer', dayOfMonth: 5 }), rec({ id: 'r3', label: 'Salle', dayOfMonth: 31, active: false })], [], today)
    expect(up.map((u) => [u.label, u.day, u.inDays])).toEqual([['Spotify', 22, 12]])
  })

  it("n'annonce pas une échéance déjà saisie à la main ce mois-ci", () => {
    expect(upcomingThisMonth([rec({})], [tx('2026-11-02', 10.99, 'spotify', 'abonnements')], today)).toEqual([])
  })

  it("calcule l'enveloppe du jour sur ce qu'il restait ce matin", () => {
    const f = forecastMonth([tx('2026-11-05', 150), tx('2026-11-10', 20)], [], 1200, today)
    // 1200 − 150 = 1050 sur 21 jours restants (10 → 30 nov.) = 50 € par jour
    expect(f.dayBudget).toBeCloseTo(50)
    expect(f.spentToday).toBe(20)
    expect(f.elapsed).toBeCloseTo(10 / 30)
  })
})
