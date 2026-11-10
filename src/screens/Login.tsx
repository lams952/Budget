import { useState } from 'react'
import { Icon, PrimaryButton, inputClass, useVisualViewport } from '../components/ui'
import { getSupabase } from '../supabase'

/** Traduit les erreurs Supabase Auth (en anglais) en messages français. */
function translate(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? '').toLowerCase()
  if (msg.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (msg.includes('invalid email')) return 'Adresse email invalide.'
  if (msg.includes('already registered') || msg.includes('already been registered')) return 'Un compte existe déjà avec cet email.'
  if (msg.includes('password should be at least')) return 'Mot de passe trop court (6 caractères minimum).'
  if (msg.includes('not confirmed')) return "Confirme d'abord ton adresse grâce à l'email reçu."
  if (msg.includes('different from the old')) return "Choisis un mot de passe différent de l'ancien."
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Trop de tentatives, réessaie dans quelques minutes.'
  if (msg.includes('fetch') || msg.includes('network')) return 'Pas de connexion internet.'
  return 'Une erreur est survenue.'
}

/** Adresse de l'app, pour les liens envoyés par email (confirmation, mot de passe oublié). */
const appUrl = () => `${location.origin}${import.meta.env.BASE_URL}`

function Logo() {
  return (
    <div className="accent-grad display mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full text-[38px] font-light">€</div>
  )
}

function PasswordInput({ value, onChange, autoComplete, placeholder }: { value: string; onChange: (v: string) => void; autoComplete: string; placeholder: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} pr-12`}
        required
        minLength={6}
      />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted">
        <Icon name={show ? 'eyeOff' : 'eye'} size={20} />
      </button>
    </div>
  )
}

export function Login() {
  // occupe la zone visible au-dessus du clavier pour que le bouton reste accessible
  const vv = useVisualViewport()
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
        const { data, error } = await auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: appUrl() } })
        if (error) throw error
        // Si la confirmation par email est activée dans Supabase, il n'y a pas encore de session.
        if (!data.session) {
          setInfo('Compte créé. Ouvre le lien reçu par email pour le confirmer, puis connecte-toi.')
          setMode('login')
        }
      }
    } catch (err) {
      setError(translate(err))
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    setInfo(null)
    if (!email.trim()) return setError("Entre d'abord ton email ci-dessus.")
    setBusy(true)
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() })
      if (error) throw error
      setInfo('Email envoyé. Ouvre le lien reçu pour choisir un nouveau mot de passe.')
      setError(null)
    } catch (err) {
      setError(translate(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ top: vv.top, height: vv.height }} className={`scroller pt-safe fixed inset-x-0 mx-auto flex max-w-md flex-col ${vv.keyboard ? 'pb-3' : 'pb-safe'} justify-center px-6`}>
      <div className="fade-up">
        {!vv.keyboard && <Logo />}
        <h1 className="text-center text-[36px] font-medium tracking-[-0.025em]">Budget</h1>
        <p className="mt-2 text-center text-[17px] text-muted">{mode === 'login' ? 'Content de te revoir.' : 'Crée ton compte gratuit pour retrouver tes données sur tous tes appareils.'}</p>

        <form onSubmit={submit} className="mt-8 space-y-3">
          <input type="email" inputMode="email" autoComplete="email" autoCapitalize="off" autoCorrect="off" placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
          <PasswordInput value={password} onChange={setPassword} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Mot de passe' : 'Mot de passe (6 caractères min.)'} />
          {error && (
            <p role="alert" className="rounded-xl bg-bad/10 px-3.5 py-2.5 text-[14px] font-medium text-bad">
              {error}
            </p>
          )}
          {info && (
            <p role="status" className="rounded-xl bg-good/10 px-3.5 py-2.5 text-[14px] font-medium text-good">
              {info}
            </p>
          )}
          <PrimaryButton type="submit" disabled={busy} className="!mt-5">
            {busy ? 'Un instant…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </PrimaryButton>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3 text-[15px]">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError(null)
              setInfo(null)
            }}
            className="press font-semibold text-accent"
          >
            {mode === 'login' ? 'Pas de compte ? Créer un compte' : "J'ai déjà un compte"}
          </button>
          {mode === 'login' && (
            <button onClick={reset} disabled={busy} className="press text-muted">
              Mot de passe oublié ?
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Affiché après un clic sur le lien « mot de passe oublié » : l'utilisateur choisit son nouveau mot de passe. */
export function NewPassword({ onDone }: { onDone: () => void }) {
  const vv = useVisualViewport()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error } = await getSupabase().auth.updateUser({ password })
      if (error) throw error
      onDone()
    } catch (err) {
      setError(translate(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ top: vv.top, height: vv.height }} className={`scroller pt-safe fixed inset-x-0 mx-auto flex max-w-md flex-col ${vv.keyboard ? 'pb-3' : 'pb-safe'} justify-center px-6`}>
      <div className="fade-up">
        {!vv.keyboard && <Logo />}
        <h1 className="text-center text-[28px] font-medium tracking-[-0.02em]">Nouveau mot de passe</h1>
        <p className="mt-2 text-center text-[17px] text-muted">Choisis le mot de passe que tu utiliseras désormais.</p>
        <form onSubmit={submit} className="mt-8 space-y-3">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" placeholder="Nouveau mot de passe (6 caractères min.)" />
          {error && (
            <p role="alert" className="rounded-xl bg-bad/10 px-3.5 py-2.5 text-[14px] font-medium text-bad">
              {error}
            </p>
          )}
          <PrimaryButton type="submit" disabled={busy || password.length < 6} className="!mt-5">
            {busy ? 'Un instant…' : 'Enregistrer'}
          </PrimaryButton>
        </form>
        <button onClick={onDone} className="press mt-5 w-full text-center text-[15px] text-muted">
          Plus tard
        </button>
      </div>
    </div>
  )
}
