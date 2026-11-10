# Budget

Web app iPhone (PWA) pour suivre ses dépenses : saisie rapide en texte, catégories devinées automatiquement, prévision de fin de mois, charges fixes automatiques et conseils mensuels. 100 % gratuit.

## Lancer en local

```bash
npm install
npm run dev
```

Sans configuration Supabase, l'app tourne en **mode local** (données dans le navigateur de l'appareil). Pratique pour l'essayer.

## Activer la synchro cloud (Supabase, gratuit)

1. Va sur <https://supabase.com> → **New project** → choisis une région Europe (Frankfurt ou Londres) et un mot de passe de base de données.
2. **SQL Editor** → **New query** → colle le contenu de [`supabase/schema.sql`](supabase/schema.sql) → **Run**. Cela crée les tables et les règles de sécurité (RLS).
3. **Authentication → Sign In / Providers → Email** : laisse activé. Désactive *Confirm email* si tu ne veux pas de confirmation par email à la création du compte.
4. **Authentication → URL Configuration** → ajoute `https://<ton-pseudo>.github.io/Budget/` dans *Site URL* ou *Redirect URLs* (utile pour la réinitialisation du mot de passe).
5. **Project Settings → API** → copie **Project URL** et la clé **anon public** dans `src/config.ts` (`supabaseUrl` et `supabaseAnonKey`).

La clé `anon` est publique par nature : la sécurité repose sur les règles RLS du schéma. Ne mets jamais la clé `service_role` dans le code.

Le plan gratuit de Supabase suffit très largement pour un usage personnel.

## Mettre en ligne (GitHub Pages, gratuit)

1. Crée un dépôt sur GitHub (par ex. `Budget`) et pousse le code sur `main` :
   ```bash
   git remote add origin https://github.com/<ton-pseudo>/Budget.git
   git push -u origin main
   ```
2. Sur GitHub : **Settings → Pages → Source : GitHub Actions**.
3. Chaque push sur `main` lance les tests puis déploie sur `https://<ton-pseudo>.github.io/Budget/`.

## Installer sur l'iPhone

Ouvre l'URL dans **Safari** → bouton **Partager** → **Sur l'écran d'accueil**. L'app s'ouvre alors en plein écran, comme une vraie app, et fonctionne hors-ligne (les données se synchronisent au retour du réseau).

## Utilisation

- **+** : tape `12,50 boulangerie`, `45 essence hier`, `+1800 salaire`, `9,90 ciné samedi`, `30 resto 03/11`…
  La catégorie est devinée ; si tu la corriges, l'app s'en souvient pour la prochaine fois.
- **Accueil** : reste à dépenser, montant par jour, prévision de fin de mois.
- **Historique** : recherche, tap pour modifier, glisse à gauche pour supprimer.
- **Analyse** : répartition par catégorie, comparaison avec le mois dernier, conseils.
- **Réglages** : budget mensuel, charges fixes (ajoutées automatiquement chaque mois), export CSV / sauvegarde.

## Développement

```bash
npm test         # tests des fonctions « intelligentes » (src/lib/smart)
npm run build    # build de production dans dist/
npm run icons    # régénère les icônes PNG
```
