# Tester DALA Finance en conditions réelles

## 1. Récupérer l'APK Android

1. Ouvrez **GitHub › mastexcel/Dala › Actions › « APK Android de test »**.
2. Cliquez sur la dernière exécution terminée (coche verte), puis téléchargez l'artefact **DALA-Finance-apk** en bas de la page. C'est un `.zip` qui contient l'APK.
3. Pour reconstruire l'APK à tout moment, cliquez sur **Run workflow**.
   - Champ `api_url` vide : **mode démo**. Le backend est simulé dans l'app, aucun serveur n'est nécessaire.
   - Champ `api_url` rempli, par exemple `https://dala-api.onrender.com` : l'app utilise votre API déployée.

Chaque modification de l'app poussée sur la branche relance aussi la construction automatiquement.

## 2. Installer sur le téléphone

1. Transférez l'APK sur le téléphone (WhatsApp à vous-même, Google Drive, câble USB…).
2. Ouvrez le fichier. Android demande d'autoriser **« Installer des applications inconnues »** pour l'application utilisée (Fichiers, Chrome, WhatsApp) : acceptez.
3. Ouvrez **DALA Finance**.

Compatibilité : Android 7 (API 24) ou plus récent, processeurs ARM 32 et 64 bits, ce qui couvre la quasi-totalité des téléphones vendus en Côte d'Ivoire.

> L'APK est signé avec une clé de test. Il sert aux essais internes, pas à la publication sur le Play Store. Pour le Play Store et l'iPhone, il faudra un compte Expo (EAS Build) et les comptes développeur Google et Apple.

## 3. Identifiants du mode démo

| Champ | Valeur |
| --- | --- |
| Téléphone | n'importe quel numéro à 10 chiffres (ex. `07 07 00 00 00`) |
| Code OTP | `123456` |
| PIN | `1234` |

Les données démo (soldes, tontine, projets…) sont réinitialisées à chaque redémarrage de l'app.

## 4. Check-list de test

### Ce que seul un vrai téléphone permet de vérifier
- [ ] **Biométrie** : se connecter une fois, activer *Profil › Sécurité › Déverrouiller avec Face ID / empreinte*, fermer l'app, puis la rouvrir et utiliser **« Continuer avec biométrie »**.
- [ ] **Appareil photo / QR** : *Accueil › Scanner*, autoriser la caméra, puis scanner `docs/qr-test-paiement.png` affiché sur un autre écran. Le formulaire d'envoi doit se pré-remplir (5 000 FCFA vers +225 07 07 00 00 01).
- [ ] **KYC** : *Profil › Vérification d'identité*, photographier une pièce et prendre un selfie.
- [ ] **Hors-ligne** : ouvrir l'accueil, activer le mode avion, fermer puis rouvrir l'app. Le solde et les dernières transactions doivent rester affichés avec le bandeau « Hors ligne ».
- [ ] **Notifications push** : *Profil › Notifications › Notifications push* (demande d'autorisation).
- [ ] **Export** : *Transactions › CSV*, puis partager le fichier (WhatsApp, e-mail).
- [ ] **Vibrations** : retour haptique sur les boutons et le clavier PIN.
- [ ] **Accessibilité** : agrandir la police système (Paramètres › Affichage) et activer TalkBack.

### Parcours métier
- [ ] Investir plus de 50 000 FCFA dans un bon du Trésor : le PIN est demandé. Taper un mauvais PIN affiche un message d'erreur.
- [ ] Investir dans un projet de crowdfunding : le badge « Validé par Bridge Investment Partners » et la part du capital s'affichent.
- [ ] Demander un prêt : le TAEG et le coût total s'affichent avant validation, puis le prêt est approuvé.
- [ ] Créer un objectif d'épargne avec épargne automatique.
- [ ] Cotiser à la tontine (PIN demandé).
- [ ] Créer un coffre-fort de 3 mois.
- [ ] **Équipe commerciale** : *Accueil › Un conseiller*, choisir un sujet et écrire. En mode démo, une conseillère répond après environ 5 secondes. Répondre à nouveau dans la conversation.
- [ ] **Assistant IA** : *Accueil › Assistant IA › Connecter une IA*, coller une clé Claude (console.anthropic.com) ou OpenAI, puis poser une question sur le marché ou un projet. Tester aussi *Analyser avec l'assistant IA* depuis la fiche d'un projet. Les appels sont facturés par le fournisseur sur votre clé.

### Ressenti
- [ ] Fluidité sur un téléphone d'entrée de gamme
- [ ] Lisibilité en plein soleil
- [ ] Clarté des textes en français

## 5. Tester avec le vrai serveur (optionnel)

En mode démo, rien ne quitte le téléphone. Pour tester avec une vraie base de données :

1. Déployez l'API : `apps/api/Dockerfile` avec PostgreSQL 16 (Render, Railway…). Variables d'environnement : voir `apps/api/.env.example`.
2. Lancez `npx prisma migrate deploy`, puis éventuellement `npm run db:seed`.
3. Relancez le workflow **APK Android de test** avec `api_url` égal à l'URL de l'API.
4. Tant que `SMS_PROVIDER=console` (aucun fournisseur SMS configuré), le code OTP apparaît dans les journaux du serveur. Le compte de démo du seed est `+2250707000000` / PIN `1234`.

## 6. Signaler un problème

Pour chaque problème, notez : le modèle de téléphone, la version d'Android, l'écran concerné, ce que vous avez fait, ce qui s'est passé, et une capture d'écran.
