import { useEffect, useState } from 'react'
import { useStore } from '../hooks/data'
import { useUI } from '../hooks/ui'
import { toKey } from '../lib/dates'
import { categoriesFor, getCategory } from '../lib/categories'
import { learnKey } from '../lib/smart/categorizer'
import type { Transaction, TxType } from '../lib/types'
import { CategoryPicker } from './CategoryPicker'
import { Field, Icon, Segmented, Sheet, inputClass, parseAmount, useVisualViewport } from './ui'

export function EditTransactionSheet({ tx, onClose }: { tx: Transaction | null; onClose: () => void }) {
  const store = useStore()
  const { toast } = useUI()
  const { keyboard } = useVisualViewport()
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<TxType>('expense')
  const [category, setCategory] = useState('autre')
  const [date, setDate] = useState('')

  useEffect(() => {
    if (!tx) return
    setAmount(String(tx.amount).replace('.', ','))
    setLabel(tx.label)
    setType(tx.type)
    setCategory(tx.category)
    setDate(tx.date)
  }, [tx])

  const value = parseAmount(amount)
  const valid = value > 0 && !!date

  const save = () => {
    if (!tx || !valid) return
    store.updateTransaction(tx.id, { amount: value, label: label.trim(), type, category, date })
    if (category !== tx.category && label.trim()) store.learn(learnKey(label), category)
    toast('Modification enregistrée')
    onClose()
  }

  return (
    <Sheet
      open={!!tx}
      onClose={onClose}
      title="Modifier"
      right={
        <button onClick={save} disabled={!valid} className="press text-[17px] font-semibold text-accent disabled:opacity-30">
          Enregistrer
        </button>
      }
    >
      <div className="space-y-3 px-5 pt-2 pb-4">
        <Segmented
          value={type}
          onChange={(t) => {
            setType(t)
            if (getCategory(category).type !== t) setCategory(categoriesFor(t)[0].id)
          }}
          options={[
            { value: 'expense', label: 'Dépense' },
            { value: 'income', label: 'Revenu' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant">
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} num !py-3 text-[22px] font-bold`} aria-invalid={!(value > 0)} />
          </Field>
          <Field label="Date">
            <input type="date" value={date} max={toKey(new Date())} onChange={(e) => setDate(e.target.value)} className={`${inputClass} !min-h-0 !py-3 appearance-none`} />
          </Field>
        </div>
        <Field label="Description">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={`${inputClass} !py-3`} />
        </Field>
        {keyboard ? (
          <p className="px-1 text-[13px] text-muted">
            Catégorie : <b className="text-ink">{getCategory(category).emoji} {getCategory(category).label}</b>
          </p>
        ) : (
          <div>
            <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted">Catégorie</span>
            <CategoryPicker type={type} value={category} onChange={setCategory} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              if (!tx) return
              const { id: _id, createdAt: _c, recurringId: _r, ...copy } = tx
              store.addTransactions([{ ...copy, date: toKey(new Date()) }])
              toast("Dupliquée à aujourd'hui")
              onClose()
            }}
            className="press flex items-center justify-center gap-2 rounded-2xl bg-field py-3 text-[16px] font-semibold"
          >
            <Icon name="copy" size={18} />
            Dupliquer
          </button>
          <button
            onClick={() => {
              if (!tx) return
              store.deleteTransaction(tx.id)
              toast('Opération supprimée', { label: 'Annuler', run: () => store.addTransactions([tx]) })
              onClose()
            }}
            className="press flex items-center justify-center gap-2 rounded-2xl bg-bad/10 py-3 text-[16px] font-semibold text-bad"
          >
            <Icon name="trash" size={18} />
            Supprimer
          </button>
        </div>
      </div>
    </Sheet>
  )
}
