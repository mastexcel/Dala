# DALA Finance

> **Djigui — Ton avenir commence ici**

Super-app financière mobile pour la zone UEMOA (Côte d'Ivoire en premier lieu) réunissant quatre piliers :

| Pilier | Fonctionnalités |
| --- | --- |
| 💰 **Épargne** | Objectifs avec épargne automatique, tontines digitales, coffre-fort à taux bonus |
| 📈 **Investissement** | Bons du Trésor UEMOA, FCP, Sukuk et fonds Halal, simulation de rendement |
| ⚡ **Micro-crédit** | Prêts instantanés de 5 000 à 500 000 FCFA, scoring ML, TAEG sous le taux d'usure |
| 🤝 **Crowdfunding en capital** | Equity uniquement, projets validés par Bridge Investment Partners |

Devise : franc CFA (XOF). Langue : français (anglais disponible, bambara prévu).
Cadre : Instruction BCEAO N°001-01-2024 relative aux services de paiement dans l'UMOA.

---

## Architecture

```
dala-finance/
├── apps/
│   ├── mobile/          Expo SDK 51 · Expo Router · TypeScript
│   └── api/             Node 20 · Express · Prisma · PostgreSQL 16 · Socket.io · BullMQ
├── packages/
│   ├── shared/          Types, constantes réglementaires, calculs financiers (partagés app + API)
│   └── ml-scoring/      FastAPI · XGBoost : scoring crédit
├── docker-compose.yml   PostgreSQL, Redis, service ML
└── turbo.json
```

Les règles financières (devis de prêt et TAEG, intérêts des bons et du coffre-fort, equity, plafonds KYC, détection LBC/FT) vivent dans `packages/shared` et sont testées une seule fois. L'app affiche donc exactement les montants que le serveur appliquera.

## Démarrage rapide

Prérequis : Node 20+, npm 10+, Docker (ou PostgreSQL 16 local), Python 3.12 pour le service ML.

```bash
npm install
npm run build -w @dala/shared

# 1. Infrastructure
docker compose up -d postgres redis

# 2. API
cp apps/api/.env.example apps/api/.env      # puis ajuster les secrets
cd apps/api
npx prisma migrate dev                      # crée le schéma
npm run db:seed                             # compte démo : +2250707000000 / PIN 1234
npm run dev                                 # http://localhost:4000/health
# En développement, l'OTP est journalisé et renvoyé dans la réponse (`devCode`).

# 3. Service de scoring (optionnel : l'API bascule sur une heuristique s'il est absent)
cd packages/ml-scoring
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
python -m model.train                       # entraîne model/credit_model.joblib
uvicorn api:app --port 8000

# 4. App mobile
cd apps/mobile
cp .env.example .env                        # EXPO_PUBLIC_API_URL=http://<ip-locale>:4000
npx expo start
```

### Mode démo (sans backend)

Si `EXPO_PUBLIC_API_URL` est vide, l'app tourne sur un backend simulé en mémoire (`apps/mobile/services/mock`). Ce backend applique les mêmes règles que l'API : PIN au-delà de 50 000 FCFA, plafonds, scoring, rétractation. Identifiants : n'importe quel numéro, OTP `123456`, PIN `1234`.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm test` | Tous les tests (Turborepo) |
| `npm run typecheck` | Vérification TypeScript |
| `npm test -w @dala/shared` | Calculs financiers et règles de conformité |
| `cd apps/api && npx vitest run` | Tests API (Supertest) et services |
| `cd apps/api && TEST_DATABASE_URL=postgresql://…/dala_test npm run test:integration` | Tests d'intégration contre PostgreSQL (la base est **vidée** ; son nom doit contenir « test ») |
| `cd apps/mobile && npm run e2e:build && npm run e2e` | Tests de bout en bout Playwright sur l'export web, en mode démo |
| `cd apps/mobile && npm run bundle:check` | Vérifie que le bundle Android compile |
| `cd packages/ml-scoring && pytest` | Tests du service de scoring |

## Application mobile

| Écran | Route |
| --- | --- |
| Splash animé | `app/index.tsx` |
| Onboarding (3 slides) | `app/onboarding.tsx` |
| Connexion (OTP + PIN, biométrie) / Inscription / OTP | `app/(auth)/*` |
| Accueil (tableau de bord) | `app/(tabs)/index.tsx` |
| Épargne : objectifs, tontines, coffre-fort | `app/(tabs)/savings.tsx`, `app/savings/*` |
| Investissement, détail d'un bon, parcours d'investissement | `app/invest/*` |
| Crowdfunding : explorer, portfolio, soumettre | `app/(tabs)/crowdfund.tsx`, `app/crowdfund/*` |
| Micro-crédit : score, demande, échéancier | `app/(tabs)/credit.tsx`, `app/credit/*` |
| Profil, KYC, sécurité, parrainage, support, mentions légales | `app/(tabs)/profile.tsx`, `app/profile/*` |
| Transactions (filtres, recherche, export CSV/PDF) | `app/transactions.tsx` |
| Portefeuille : recharger, envoyer, retirer, scanner | `app/wallet.tsx` |

**Design system.** Les tokens sont dans `theme/` : couleurs, DM Serif Display et Plus Jakarta Sans, espacements et rayons. Les composants partagés sont dans `components/ui`.

**Icônes DALA.** Les 62 icônes illustrées de la charte (`design/icon-sheet.png`) sont découpées en PNG transparents dans `apps/mobile/assets/icons` par `design/cut_icons.py`, et s'affichent avec `<DalaIcon name="savings" size={32} />` (noms typés). Elles sont multicolores et conçues pour fond clair : la barre d'onglets et les onglets segmentés sont donc blancs, et sur fond sombre les icônes sont posées dans une pastille blanche. Phosphor ne sert plus qu'aux petits pictogrammes d'interface (chevrons, recherche, retour arrière du clavier PIN). Pour modifier une icône, remplacez la planche puis relancez `python design/cut_icons.py design/icon-sheet.png apps/mobile/assets/icons 6`.

**Logos.** `<Logo variant="…" />` dans `components/ui/Logo.tsx` : `color` (dégradé, fond sombre : splash, connexion), `colorLight` (dégradé, fond clair : en-tête de l'accueil), `whiteFine` (rayures fines : onboarding, filigrane de la carte de solde), `white`, `black` (profil, mentions légales). Les originaux sont dans `assets/brand/logo-*-dark.png` / `-light.png`.

**Fonds d'écran.** Un fond par section (`apps/mobile/assets/backgrounds`, planche de référence `design/backgrounds/planche-fonds.png`), appliqué avec `<Screen wallpaper="savings">`. Le fond reste fixe pendant le défilement. Correspondance : accueil → `home` (bleu), connexion/inscription → `auth` (turquoise), épargne → `savings` (vert), investissement → `invest` (bleu/pêche), crowdfunding → `crowdfund` (lavande), crédit → `credit` (pêche), transactions → `transactions` (cyan), profil → `profile` (bleu clair), notifications → `notifications` (bleu/orange), portefeuille → `portfolio` (vert). `services` (jaune) et `opportunities` (doré) sont prêts pour les futures sections « Services complémentaires » et « Opportunités & Appels d'offres ». Les écrans de connexion passent en thème clair (texte navy) ; le splash, l'onboarding et les écrans de succès restent sur fond navy.

**Hors-ligne.** Le cache React Query est persisté dans AsyncStorage (solde, transactions, profil, objectifs, crédit). Les requêtes sont servies depuis le cache puis revalidées au retour du réseau, et un bandeau signale le mode hors-ligne.

**Accessibilité.** Rôles et libellés pour lecteurs d'écran sur tous les éléments interactifs. Le texte coloré utilise des variantes contrastées AA (`TEXT_ON_WHITE`). Les tailles de texte suivent le réglage système, plafonnées à 160 %.

## API

Préfixe : `/v1`. Authentification : `Authorization: Bearer <jwt>`.

| Domaine | Routes principales |
| --- | --- |
| Auth | `POST /auth/otp/request`, `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/pin/reset` |
| Utilisateur | `GET/PATCH /users/me`, `GET/PUT /users/me/limits`, `POST /users/me/kyc`, `GET /users/me/referrals` |
| Comptes | `GET /accounts/summary`, `POST /accounts/deposit`, `/withdraw`, `/transfer` |
| Épargne | `/savings/goals`, `/savings/tontines`, `/savings/vaults` |
| Investissement | `/investments/bonds`, `/funds`, `/portfolio`, `/simulate`, `POST /investments`, `POST /investments/:id/cancel` |
| Crowdfunding | `/crowdfund/projects`, `POST /crowdfund/projects/:id/invest`, `/crowdfund/portfolio`, `POST /crowdfund/projects` |
| Crédit | `GET /loans`, `/loans/quote`, `POST /loans`, `GET /loans/:id`, `POST /loans/:id/repay` |
| Transactions | `GET /transactions`, `GET /transactions/export?format=csv\|pdf` |
| Conformité | `POST /compliance/complaints` ; back-office (`x-admin-key`) : reporting BCEAO, réconciliation, vérification de la piste d'audit, alertes LBC/FT, validation KYC, revue des projets |
| Webhooks | `POST /webhooks/mobile-money/:provider` (signature HMAC) |

WebSocket (Socket.io) : événements `notification` et `balance:changed` dans la room de l'utilisateur.

## Conformité BCEAO — où c'est implémenté

| Exigence | Implémentation |
| --- | --- |
| **Authentification forte (art. 84)** | Connexion OTP (possession) + PIN (connaissance), ou biométrie (inhérence) sur appareil enrôlé. Le PIN (`x-transaction-pin`) est exigé au-delà de 50 000 FCFA et pour toute modification de profil ou de plafond : `middleware/auth.ts › requireStrongAuth`. Verrouillage après 5 PIN erronés. Les refresh tokens tournent à chaque usage ; la réutilisation d'un jeton révoqué révoque toute la famille. |
| **Cantonnement (art. 48-51)** | Comptes séparés par type (`MAIN`, `SAVINGS`, `VAULT`, `INVESTMENT`, `CROWDFUND`). Toutes les écritures passent par `services/ledger.ts`, de façon atomique et sans solde négatif. La piste d'audit est chaînée par SHA-256 (`AuditLog`) et vérifiable via `/compliance/admin/audit/verify`. Une réconciliation quotidienne compare les soldes clients aux comptes bancaires dédiés. |
| **LBC/FT (art. 27-31)** | KYC à 3 niveaux avec plafonds de 200 000 FCFA, 2 000 000 FCFA, puis sans plafond, et transferts interdits au niveau 1 (`middleware/kyc.ts`). Le middleware `aml.ts` filtre les listes de sanctions et détecte les gros montants, le fractionnement et la vélocité. Une alerte rouge gèle le compte et génère une déclaration de soupçon CENTIF. |
| **Protection des utilisateurs (art. 52-74)** | Devis et TAEG affichés avant engagement, récapitulatif et acceptation explicite, rétractation de 48 h sur les investissements, réclamations avec échéance à 15 jours ouvrés, notification immédiate de chaque opération, plafond personnalisable, mentions légales sur chaque écran financier. |

Les seuils marqués « à valider » dans `packages/shared/src/constants.ts` (taux d'usure, seuils LBC/FT) doivent être confirmés par le service Conformité avant la mise en production.

## Scoring crédit

Les variables (`packages/ml-scoring/features.py`) sont : ancienneté, solde et régularité d'épargne, activité sur 90 jours, entrées mensuelles, volume mobile money, prêts remboursés ou en retard, ponctualité en tontine et niveau KYC.

Le modèle est un XGBoost avec contraintes monotones : plus d'épargne n'abaisse jamais le score, et un retard ne l'améliore jamais. Les 3 facteurs explicatifs de chaque décision sont calculés par SHAP.

Le modèle est amorcé sur des données synthétiques. Il faut le ré-entraîner sur l'historique réel dès que les premiers prêts arrivent à échéance.

Décision : approuvé si p ≥ 0,70, revue manuelle si p ≥ 0,50, refusé sinon. Si le service ML est indisponible, l'API utilise une régression logistique de repli.

## Tests

| Niveau | Contenu |
| --- | --- |
| `packages/shared` (Vitest) | Calculs financiers, plafonds KYC, authentification forte, détection LBC/FT |
| API unitaires (Vitest + Supertest) | Validation, authentification, piste d'audit, scoring de repli, sanctions |
| API intégration (PostgreSQL réel, 32 tests) | Inscription, verrouillage du PIN, rotation et réutilisation des refresh tokens ; plafonds KYC, PIN au-delà de 50 000 FCFA, rétractation 48 h, solde insuffisant, retrait refusé par l'opérateur ; objectifs, coffre-fort, tontine complète, transferts ; crowdfunding (validation du comité, equity, clôture à l'objectif) ; prêt approuvé, refusé, en revue, repli heuristique, remboursements ; gel LBC/FT et déclaration CENTIF, webhook signé, réclamations, KYC back-office, altération de la piste d'audit, reporting BCEAO |
| App (Jest) | Backend simulé, composants, analytique |
| E2E (Playwright, web) | Connexion, accueil, investissement avec PIN (erreur puis succès), crowdfunding, prêt, objectif d'épargne, filtres de transactions |
| Scoring (pytest) | API, monotonie du modèle, explications |

Les tests E2E tournent sur la version web en mode démo. Ils ne remplacent pas un essai sur appareil (biométrie, appareil photo, notifications push) : pour ces parcours natifs, prévoir Maestro ou Detox sur un build de développement.

## Monitoring

- **Sentry** (erreurs) : API via `SENTRY_DSN`, app via `EXPO_PUBLIC_SENTRY_DSN`. Les en-têtes et champs sensibles (PIN, OTP, jetons, clé admin) sont retirés avant envoi.
- **Mixpanel** (analytique) : `EXPO_PUBLIC_MIXPANEL_TOKEN`. On envoie uniquement l'identifiant interne, le nom de l'événement et des tranches de montant (`<10k`, `10k-50k`…), jamais le nom, le téléphone ni le montant exact. Événements suivis : inscription, connexion, objectif, versement, coffre-fort, cotisation, investissement, crowdfunding, soumission de projet, prêt, remboursement, opération de portefeuille.
- Sans ces variables, rien n'est envoyé.

## Intégrations

- **Mobile money** : Orange Money, MTN MoMo, Wave et Moov Money (`apps/api/src/services/mobileMoney`). Le mode `sandbox` est actif par défaut ; en mode `live`, les opérateurs confirment les paiements par webhook.
- **SMS OTP** : `console` (dev), Twilio ou Orange SMS API.
- **Push** : FCM. **Stockage KYC** : Supabase Storage (URL de dépôt signée).
- **Titres publics** : référentiel `services/treasury.ts`, à synchroniser avec le flux UMOA-Titres.

## Écarts assumés par rapport au cahier des charges

- **Style** : `StyleSheet` et tokens typés (`theme/`) plutôt que NativeWind. Le design system reste centralisé, et NativeWind peut être ajouté sans toucher aux composants.
- **Navigation** : Expo Router (construit sur React Navigation) pour suivre l'arborescence de fichiers demandée.
- **Hachage** : `bcryptjs` (JavaScript pur, sans compilation native) au lieu de `bcrypt`.
- **Tests JS** : Vitest (API compatible Jest) côté API et `shared`. `jest-expo` est configuré pour l'app.
- **Schéma Prisma** : modèles repris tels quels, avec des ajouts de conformité regroupés en fin de fichier (coffre-fort, OTP, refresh tokens, piste d'audit, alertes LBC/FT, réclamations, statut de gel). Un seul champ existant a été modifié : `CrowdfundInvestment.equityPct` passe de `Decimal(5,4)` à `Decimal(9,8)`, car avec 4 décimales un ticket de 5 000 FCFA sur une valorisation de 250 M arrondissait la part du capital à 0.
