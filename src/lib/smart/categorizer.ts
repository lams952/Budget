import type { Learned, TxType } from '../types'
import { normalize } from './normalize'

const KEYWORDS: Record<string, string[]> = {
  courses: ['courses', 'supermarche', 'carrefour', 'leclerc', 'auchan', 'lidl', 'aldi', 'intermarche', 'monoprix', 'franprix', 'casino', 'super u', 'hyper u', 'picard', 'biocoop', 'naturalia', 'marche', 'boulangerie', 'boulanger', 'pain', 'baguette', 'boucherie', 'primeur', 'epicerie', 'fromager', 'grand frais'],
  resto: ['resto', 'restaurant', 'cafe', 'bar', 'brasserie', 'mcdo', 'mcdonald', 'burger', 'kfc', 'pizza', 'sushi', 'kebab', 'tacos', 'starbucks', 'deliveroo', 'uber eats', 'ubereats', 'just eat', 'dejeuner', 'diner', 'dej', 'brunch', 'cantine', 'sandwich', 'boulangerie midi', 'apero', 'biere', 'verre'],
  transport: ['essence', 'carburant', 'gasoil', 'diesel', 'plein', 'peage', 'parking', 'stationnement', 'uber', 'taxi', 'bolt', 'heetch', 'metro', 'navigo', 'ratp', 'bus', 'tram', 'train', 'sncf', 'ouigo', 'tgv', 'velib', 'trottinette', 'garage', 'pneu', 'vidange', 'controle technique', 'blablacar', 'autoroute', 'total', 'recharge'],
  logement: ['loyer', 'edf', 'engie', 'electricite', 'gaz', 'eau', 'internet', 'box', 'free', 'orange', 'sfr', 'bouygues', 'sosh', 'red', 'assurance habitation', 'charges', 'copro', 'syndic', 'taxe fonciere', 'taxe habitation', 'ikea', 'leroy merlin', 'castorama', 'bricolage', 'menage', 'pret immo', 'credit immo'],
  abonnements: ['netflix', 'spotify', 'deezer', 'disney', 'prime', 'amazon prime', 'canal', 'apple', 'icloud', 'youtube', 'chatgpt', 'claude', 'abonnement', 'abo', 'salle de sport', 'basic fit', 'fitness', 'forfait', 'mobile', 'telephone', 'molotov', 'max', 'crunchyroll', 'xbox', 'playstation', 'ps plus', 'game pass'],
  loisirs: ['cinema', 'cine', 'concert', 'theatre', 'musee', 'expo', 'sortie', 'soiree', 'boite', 'livre', 'fnac', 'jeu', 'jeux', 'steam', 'bowling', 'escape', 'piscine', 'sport', 'match', 'billet', 'festival', 'vacances'],
  shopping: ['vetement', 'vetements', 'zara', 'h m', 'hm', 'uniqlo', 'primark', 'decathlon', 'amazon', 'zalando', 'vinted', 'chaussures', 'baskets', 'shopping', 'sephora', 'cadeau', 'darty', 'boulanger electro', 'apple store', 'cdiscount', 'shein', 'action'],
  sante: ['pharmacie', 'medecin', 'docteur', 'dentiste', 'kine', 'osteo', 'mutuelle', 'ophtalmo', 'lunettes', 'opticien', 'hopital', 'analyse', 'psy', 'medicament', 'doliprane', 'coiffeur'],
  voyage: ['hotel', 'airbnb', 'booking', 'avion', 'vol', 'easyjet', 'ryanair', 'air france', 'transavia', 'location voiture', 'camping', 'auberge'],
  salaire: ['salaire', 'paie', 'paye', 'prime', 'bonus'],
  revenu: ['remboursement', 'rembourse', 'vente', 'vinted vente', 'cadeau recu', 'allocation', 'caf', 'virement', 'interets', 'dividendes', 'loyer percu'],
}

const INCOME_CATS = new Set(['salaire', 'revenu'])

export type Confidence = 'learned' | 'keyword' | 'default'

export interface CategoryGuess {
  category: string
  confidence: Confidence
}

const containsPhrase = (text: string, phrase: string) => ` ${text} `.includes(` ${phrase} `)

/** Devine la catégorie : d'abord ce que l'utilisateur a appris à l'app, puis les mots-clés. */
export function categorize(label: string, type: TxType, learned: Learned = {}): CategoryGuess {
  const norm = normalize(label)
  if (!norm) return { category: type === 'income' ? 'revenu' : 'autre', confidence: 'default' }

  const wanted = (cat: string) => (type === 'income') === INCOME_CATS.has(cat)

  // 1. correspondance exacte apprise
  if (learned[norm] && wanted(learned[norm])) return { category: learned[norm], confidence: 'learned' }
  // 2. un mot appris contenu dans le libellé (« carrefour city » → « carrefour »)
  let best: { cat: string; len: number } | null = null
  for (const [key, cat] of Object.entries(learned)) {
    if (wanted(cat) && containsPhrase(norm, key) && (!best || key.length > best.len)) best = { cat, len: key.length }
  }
  if (best) return { category: best.cat, confidence: 'learned' }

  // 3. mots-clés : la plus longue expression trouvée gagne
  best = null
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    if (!wanted(cat)) continue
    for (const w of words) {
      if ((containsPhrase(norm, w) || norm.split(' ').some((t) => t.length > 3 && t.startsWith(w) && w.length >= 4)) && (!best || w.length > best.len))
        best = { cat, len: w.length }
    }
  }
  if (best) return { category: best.cat, confidence: 'keyword' }

  return { category: type === 'income' ? 'revenu' : 'autre', confidence: 'default' }
}

/** Clé sous laquelle mémoriser une correction de l'utilisateur. */
export const learnKey = (label: string) => normalize(label)
