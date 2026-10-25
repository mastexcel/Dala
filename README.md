# DALA Finance

> **Faire grandir vos ambitions**

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

### Tester sur un téléphone

Le workflow GitHub Actions **« APK Android de test »** produit un APK installable directement, sans compte Expo. Le guide pas à pas et la check-list sont dans [`docs/TEST-TERRAIN.md`](docs/TEST-TERRAIN.md).

### Mode démo (sans backend)

Avec `EXPO_PUBLIC_DEMO_MODE=true`, l'app tourne sur un backend simulé en mémoire (`apps/mobile/services/mock`). Ce backend applique les mêmes règles que l'API : PIN au-delà de 50 000 FCFA, plafonds de la phase de test, scoring. Identifiants : n'importe quel numéro, OTP `123456`, PIN `1234`.

Le mode démonstration doit être demandé explicitement. Il est refusé si `EXPO_PUBLIC_APP_ENV=production`. Sans API ni mode démo, l'app affiche « Application mal configurée » au lieu de démarrer.

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

**Fonds d'écran.** Un fond par section (`apps/mobile/assets/backgrounds`, planche de référence `design/backgrounds/planche-fonds.png`), appliqué avec `<Screen wallpaper="savings">` et fixe pendant le défilement. Correspondance : accueil → `home` (vagues bleues), connexion/inscription → `auth` (turquoise), épargne → `savings` (vert), investissement → `invest` (bleu/pêche), crowdfunding → `crowdfund` (lavande), crédit → `credit` (pêche), transactions → `transactions` (cyan), profil → `profile` (bleu clair), notifications → `notifications` (bleu/orange), portefeuille → `portfolio` (vert). `services` (jaune) et `opportunities` (doré) sont prêts pour de futures sections.

**Orientation et grands écrans.** Le téléphone reste verrouillé en portrait. La tablette tourne librement, et le web suit la fenêtre (`hooks/useOrientationPolicy.ts`, `expo-screen-orientation`). Mise en page (`theme/layout.ts`) :
- **Portrait sur grand écran** : colonne centrée de 600 px (480 px pour la connexion et le clavier PIN), fond sur tout l'écran, barre d'onglets recentrée, voile blanc autour de la colonne (`ContentVeil`).
- **Paysage** (≥ 900 px de large) : la barre d'onglets du bas est remplacée par un rail latéral avec le logo (`SideRail`). La colonne s'élargit à 960 px et les cartes passent sur deux colonnes (`ResponsiveGrid`) : piliers de l'accueil, objectifs d'épargne, projets de crowdfunding, fonds.

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
| Équipe commerciale | `GET/POST /advisor/conversations`, `GET /advisor/conversations/:id`, `POST /advisor/conversations/:id/messages` ; poste des conseillers (`x-admin-key`) : `GET /advisor-desk/conversations?status=OPEN` (avec `awaitingReply`), `POST /advisor-desk/conversations/:id/messages` (`authorName`, `body`), `POST /advisor-desk/conversations/:id/close` |
| Webhooks | `POST /webhooks/mobile-money/:provider` (signature HMAC) |

WebSocket (Socket.io) : événements `notification`, `balance:changed` et `advisor:message` dans la room de l'utilisateur.

## Échanges avec l'équipe commerciale et assistant IA

**Équipe commerciale** (`app/advisor`) : l'utilisateur choisit un sujet (paiements, épargne et tontines, crédit, autre ; placements et levée de fonds sont exclus pendant la phase de test) et écrit à l'équipe. Il reçoit un accusé de réception, puis les réponses des conseillers en temps réel (WebSocket, notification et push). Une conversation clôturée se rouvre dès que le client réécrit. En mode démo, une conseillère simulée répond après quelques secondes. Accès : carte « Un conseiller » sur l'accueil, Profil, Support.

**Poste des conseillers** (`apps/api/desk`, servi par l'API sur **`/desk/`**) : page web pour l'équipe commerciale.
- **Connexion :** avec la clé `ADMIN_API_KEY` et le nom affiché aux clients. La clé reste dans la session de l'onglet.
- **Onglet « À traiter » :** les conversations dont le dernier message client n'a pas encore de réponse, avec un compteur dans le titre de l'onglet.
- **Pour chaque client :** nom, téléphone et niveau KYC, puis le fil complet.
- **Réponse :** réponses types (rappel, phase de test, crédit, précisions, hors périmètre), envoi par Ctrl + Entrée, clôture de la conversation.
- **Mise à jour :** automatique toutes les 10 secondes. La page s'adapte au téléphone.

Le contenu des clients est toujours affiché comme du texte, jamais interprété comme du HTML. La page est servie sous la politique de sécurité stricte de l'API (scripts de même origine uniquement).

En production, réservez `/desk/` au réseau interne ou placez-le derrière le SSO de l'entreprise : la clé back-office donne aussi accès aux autres routes d'administration.

**Assistant IA** (`app/assistant`, `services/ai`) : l'utilisateur connecte **sa propre clé d'API** :
- **Claude (Anthropic)**, via le SDK officiel `@anthropic-ai/sdk`. Opus 5.5 est le modèle par défaut ; Sonnet 5.5 et Haiku 5.5 sont aussi proposés. Le repli automatique est activé en cas de refus du modèle. La recherche web, désactivable, sert pour l'actualité des marchés, avec les sources citées.
- **OpenAI**.
- Tout fournisseur **compatible OpenAI** : Mistral, Groq, OpenRouter, DeepSeek, Ollama…

Fonctionnement :
- La clé reste dans le trousseau sécurisé de l'appareil. Les requêtes partent directement de l'app vers le fournisseur, jamais par les serveurs DALA. La connexion est vérifiée sans consommer de jetons, via la liste des modèles.
- Chaque question est accompagnée des offres DALA : titres publics et Sukuk, FCP, projets de crowdfunding validés par Bridge Investment Partners. La situation de l'utilisateur (soldes, placements, participations) n'est jointe que s'il l'accepte.
- Le prompt système impose le français, les montants en FCFA, le crowdfunding en capital uniquement et l'absence de conseil personnalisé. Il renvoie vers un conseiller pour une recommandation adaptée.
- L'assistant répond aussi à tout autre sujet.
- Raccourci « Analyser avec l'assistant IA » sur les fiches titre et projet (question préremplie, relue avant envoi).

Le polyfill `react-native-url-polyfill` est chargé sur Android et iOS : sans lui, l'implémentation `URL` de React Native corrompt l'adresse des requêtes du SDK (test `sdkOnReactNative.test.ts`).

## Phase de test au sein du LIF-BCEAO

Les engagements du dossier sont réunis dans `TEST_PHASE` (`packages/shared/src/constants.ts`), la source unique pour l'app et l'API. L'API les applique dans `apps/api/src/services/testPhase.ts`. Les tests `apps/api/test/integration/testPhase.test.ts` et `packages/shared/src/testPhase.test.ts` les vérifient.

| Engagement | Mise en œuvre |
| --- | --- |
| Périmètre : épargne, crédit, paiements | Investissement et crowdfunding (AMF-UMOA) fermés : routes en 404 `MODULE_DISABLED`, écrans masqués, liens directs redirigés. Le crowdfunding ne peut pas être rouvert sans cabinet de validation indépendant (`CROWDFUND_VALIDATOR_DESIGNATED`). |
| Plafonds | Prêt ≤ 100 000 FCFA ; 500 utilisateurs ; KYC niveaux 1 et 2 ; 30 tontines en cours de 20 membres au plus ; encours de crédit total ≤ 5 M FCFA ; fonds clients ≤ 30 M FCFA. Vérifiés sous verrou transactionnel (`409 TEST_LIMIT_REACHED`). |
| Épargne non rémunérée | Coffre-fort à 0 % : seul un établissement agréé peut rémunérer l'épargne. |
| Consentement | Écran d'avertissement avant l'inscription (nature expérimentale, durée, plafonds, droits). Acceptation horodatée en base (`consentVersion`, `consentAcceptedAt`) et dans la piste d'audit (`CONSENT_ACCEPTED`). |
| Majorité | Date de naissance obligatoire ; moins de 18 ans refusés (`UNDERAGE`). |
| Mention légale et bandeau | `LEGAL_NOTICE` (éditeur, RCCM, LIF, partenaire agréé) sur les écrans financiers, les mentions légales, les relevés CSV et PDF ; bandeau « Service en phase de test au sein du LIF-BCEAO » en tête de chaque écran. |
| Droits des utilisateurs | Profil › Mes données : export JSON, politique de conservation, clôture du compte (solde nul, pas de prêt, PIN). Données conservées 10 ans puis anonymisées (`purgeExpiredAccounts`). |
| Données dans l'UEMOA | Pièces KYC chez l'hébergeur d'Abidjan (S3). Sentry, Twilio, Firebase et Mixpanel restent inactifs tant qu'ils ne figurent pas dans `FOREIGN_PROCESSORS_DECLARED` (API) ou `EXPO_PUBLIC_FOREIGN_PROCESSORS_DECLARED` (app). |
| Assistant IA | Désactivé (`aiAssistant: 'off'`). Le mode `'help'` le limite à l'aide à l'usage de l'application, sans données personnelles ni conseil d'investissement. |
| Rapport mensuel BCEAO | Ajout des indicateurs du plan de test (activation, recouvrement, réclamations dans les délais) et du suivi de chaque plafond. |
| TAEG | Calcul actuariel pour les prêts à mensualités, plafonné sous le taux d'usure du prêteur (24 % SFD, 15 % banque : à confirmer avec le partenaire). |

Valeurs à renseigner : date de fin du test (`TEST_PHASE.endDate`), e-mail du support (`SUPPORT_EMAIL`), taux d'usure et seuils LBC/FT du partenaire agréé.

## Conformité BCEAO — où c'est implémenté

**Statut affiché.** L'application affiche **« Service en phase de test au sein du LIF-BCEAO »** à ces endroits :
- l'écran de démarrage, l'accueil de bienvenue, la connexion et l'inscription ;
- la mention légale de chaque écran financier, le profil et les mentions légales ;
- le relevé PDF.

Elle ne présente jamais DALA comme un établissement de paiement. L'APK de démonstration ajoute « Version de démonstration : aucune opération réelle n'est effectuée et aucun fonds n'est déposé ». Le texte est centralisé dans `packages/shared/src/constants.ts` (`TEST_PHASE_NOTICE`, `LEGAL_NOTICE`). Un test (`apps/mobile/__tests__/legalStatus.test.ts`) bloque toute réapparition de la mention « établissement de paiement » dans l'app. Le tableau ci-dessous décrit les mécanismes prévus par l'Instruction N°001-01-2024, pas un agrément.

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
| API intégration (PostgreSQL réel, 46 tests) | Engagements de la phase de test LIF-BCEAO (modules fermés, consentement horodaté, majorité, 500 utilisateurs, prêt 100 000 FCFA, encours 5 M, fonds 30 M, tontines, KYC 1-2, Wave, export, clôture et purge, rapport BCEAO) ; Échanges avec l'équipe commerciale (accusé de réception, file « à traiter », réponse du conseiller, non-lus, isolation entre clients, clôture et réouverture, page du poste des conseillers) ; inscription, verrouillage du PIN, rotation et réutilisation des refresh tokens ; plafonds KYC, PIN au-delà de 50 000 FCFA, rétractation 48 h, solde insuffisant, retrait refusé par l'opérateur ; objectifs, coffre-fort, tontine complète, transferts ; crowdfunding (validation du comité, equity, clôture à l'objectif) ; prêt approuvé, refusé, en revue, repli heuristique, remboursements ; gel LBC/FT et déclaration CENTIF, webhook signé, réclamations, KYC back-office, altération de la piste d'audit, reporting BCEAO |
| App (Jest) | Backend simulé (dont conseillère démo), composants, analytique ; assistant IA : contexte de marché, appel Claude (en-têtes, repli, recherche web, reprise après pause, refus, erreurs), fournisseur compatible OpenAI, SDK sous l'URL de React Native |
| E2E (Playwright, web) | Connexion, accueil (piliers du test uniquement), retrait avec PIN (erreur puis succès, Wave absent), modules fermés par lien direct, prêt, objectif d'épargne, filtres de transactions, paysage ; échange avec une conseillère ; mention légale ; inscription (avertissement accepté, mineur refusé) |
| Scoring (pytest) | API, monotonie du modèle, explications |

Les tests E2E tournent sur la version web en mode démo. Ils ne remplacent pas un essai sur appareil (biométrie, appareil photo, notifications push) : pour ces parcours natifs, prévoir Maestro ou Detox sur un build de développement.

## Monitoring

- **Sentry** (erreurs) : API via `SENTRY_DSN`, app via `EXPO_PUBLIC_SENTRY_DSN`. Les en-têtes et champs sensibles (PIN, OTP, jetons, clé admin) sont retirés avant envoi.
- **Mixpanel** (analytique) : `EXPO_PUBLIC_MIXPANEL_TOKEN`. On envoie uniquement l'identifiant interne, le nom de l'événement et des tranches de montant (`<10k`, `10k-50k`…), jamais le nom, le téléphone ni le montant exact. Événements suivis : inscription, connexion, objectif, versement, coffre-fort, cotisation, investissement, crowdfunding, soumission de projet, prêt, remboursement, opération de portefeuille, contact de l'équipe commerciale, réponse de l'assistant IA (fournisseur uniquement, jamais le contenu).
- Sans ces variables, rien n'est envoyé.

## Intégrations

- **Mobile money** : Orange Money, MTN MoMo et Moov Money (`apps/api/src/services/mobileMoney`). Le connecteur Wave existe mais il est désactivé pendant la phase de test, tant que son statut d'émetteur de monnaie électronique n'est pas vérifié. Le mode `sandbox` est actif par défaut ; en mode `live`, les opérateurs confirment les paiements par webhook.
- **SMS OTP** : `console` (dev), Twilio ou Orange SMS API.
- **Push** : FCM, inactif tant qu'il n'est pas déclaré à l'ARTCI (le contenu des notifications reste générique). **Stockage KYC** : stockage compatible S3 chez l'hébergeur d'Abidjan (`STORAGE_DRIVER=s3`, URL de dépôt signée).
- **Titres publics** : référentiel `services/treasury.ts`, à synchroniser avec le flux UMOA-Titres.

## Écarts assumés par rapport au cahier des charges

- **Style** : `StyleSheet` et tokens typés (`theme/`) plutôt que NativeWind. Le design system reste centralisé, et NativeWind peut être ajouté sans toucher aux composants.
- **Navigation** : Expo Router (construit sur React Navigation) pour suivre l'arborescence de fichiers demandée.
- **Hachage** : `bcryptjs` (JavaScript pur, sans compilation native) au lieu de `bcrypt`.
- **Tests JS** : Vitest (API compatible Jest) côté API et `shared`. `jest-expo` est configuré pour l'app.
- **Schéma Prisma** : modèles repris tels quels, avec des ajouts de conformité regroupés en fin de fichier (coffre-fort, OTP, refresh tokens, piste d'audit, alertes LBC/FT, réclamations, statut de gel). Un seul champ existant a été modifié : `CrowdfundInvestment.equityPct` passe de `Decimal(5,4)` à `Decimal(9,8)`, car avec 4 décimales un ticket de 5 000 FCFA sur une valorisation de 250 M arrondissait la part du capital à 0.
