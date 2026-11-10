import { useState } from 'react'
import { PrimaryButton, inputClass } from '../components/ui'
import { getSupabase } from '../supabase'

/** Traduit les erreurs Supabase Auth (en anglais) en messages français. */
function translate(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? '').toLowerCase()
  if (msg.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (msg.includes('invalid email')) return 'Adresse email invalide.'
  if (msg.includes('already registered') || msg.includes('already been registered')) return 'Un compte existe déjà avec cet email.'
  if (msg.includes('password should be at least')) return 'Mot de passe trop court (6 caractères minimum).'
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Trop de tentatives, réessaie dans quelques minutes.'
  if (msg.includes('fetch') || msg.includes('network')) return 'Pas de connexion internet.'
  return 'Une erreur est survenue.'
}

export function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const auth = getSupabase().auth
      if (mode === 'login') {
        const { error } = await auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { data, error } = await auth.signUp({ email: email.trim(), password })
        if (error) throw error
        // Si la confirmation par email est activée dans Supabase, il n'y a pas encore de session.
        if (!data.session) setInfo('Vérifie ta boîte mail pour confirmer ton compte.')
      }
    } catch (err) {
      setError(translate(err))
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    if (!email.trim()) return setError("Entre ton email d'abord.")
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim())
      if (error) throw error
      setInfo('Email de réinitialisation envoyé.')
      setError(null)
    } catch (err) {
      setError(translate(err))
    }
  }

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-md flex-col justify-center px-6">
      <div className="fade-up">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[22px] bg-ink text-[40px] text-bg">€</div>
        <h1 className="text-center text-[34px] font-bold tracking-tight">Budget</h1>
        <p className="mt-2 text-center text-[17px] text-muted">{mode === 'login' ? 'Content de te revoir.' : 'Crée ton compte gratuit pour synchroniser tes données.'}</p>

        <form onSubmit={submit} className="mt-10 space-y-3">
          <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            required
            minLength={6}
          />
          {error && <p className="px-1 text-[14px] text-bad">{error}</p>}
          {info && <p className="px-1 text-[14px] text-good">{info}</p>}
          <PrimaryButton type="submit" disabled={busy} className="!mt-6">
            {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </PrimaryButton>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3 text-[15px]">
          <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-accent">
            {mode === 'login' ? 'Pas de compte ? Créer un compte' : "J'ai déjà un compte"}
          </button>
          {mode === 'login' && (
            <button onClick={reset} className="text-muted">
              Mot de passe oublié
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
