# Tester DALA Finance en conditions réelles

## 1. Récupérer l'APK Android

1. Ouvrez **GitHub › mastexcel/Dala › Actions › « APK Android de test »**.
2. Cliquez sur la dernière exécution terminée (coche verte), puis téléchargez l'artefact **DALA-Finance-apk** en bas de la page. C'est un `.zip` qui contient l'APK.
3. Pour reconstruire l'APK à tout moment, cliquez sur **Run workflow**.
   - Champ `api_url` vide : **mode démo**. Le backend est simulé dans l'app, aucun serveur n'est nécessaire.
   - Champ `api_url` rempli, par exemple `https://dala-api.onrender.com` : l'app utilise votre API déployée.

Chaque modification de l'app poussée sur la branche relance aussi la construction automatiquement.

## Lien permanent (toujours la dernière version)

**https://github.com/mastexcel/Dala/releases/download/test-android/DALA-Finance.apk**

Ce lien ne change jamais. Vous pouvez aussi scanner `docs/qr-installation-apk.png` avec l'appareil photo de la tablette ou du téléphone.

Ouvrez le lien **dans Chrome**. Un lien ouvert depuis une autre application (WhatsApp, Gmail, Claude…) s'affiche dans un navigateur intégré qui refuse souvent de télécharger un APK : choisissez « Ouvrir dans Chrome ».

À partir de la version 14, l'application vérifie elle-même s'il existe une version plus récente. Le bandeau « Nouvelle version disponible » apparaît alors sur l'accueil et dans le profil : touchez-le, puis ouvrez le fichier téléchargé. La mise à jour s'installe par-dessus l'application existante, sans perdre vos données.

## 2. Installer sur le téléphone

1. Transférez l'APK sur le téléphone (WhatsApp à vous-même, Google Drive, câble USB…).
2. Ouvrez le fichier. Android demande d'autoriser **« Installer des applications inconnues »** pour l'application utilisée (Fichiers, Chrome, WhatsApp) : acceptez.
3. Ouvrez **DALA Finance**.

Compatibilité : Android 7 (API 24) ou plus récent, processeurs ARM 32 et 64 bits, ce qui couvre la quasi-totalité des téléphones vendus en Côte d'Ivoire.

> L'APK est signé avec une clé de test. Il sert aux essais internes, pas à la publication sur le Play Store. Pour le Play Store et l'iPhone, il faudra un compte Expo (EAS Build) et les comptes développeur Google et Apple.

### Si l'installation échoue

| Message | Cause probable | Solution |
| --- | --- | --- |
| « Problème lors de l'analyse du package » | Fichier incomplet (transfert interrompu ou coupé par la messagerie) | Télécharger l'APK directement depuis le lien, dans Chrome, sur le téléphone |
| « Application non installée » | Fichier incomplet, ou version déjà installée provenant d'une autre source | Retélécharger ; si besoin, désinstaller DALA puis réinstaller |
| « Bloquée par Play Protect » / « Application dangereuse » | APK de test signé avec une clé de développement | Toucher « Plus de détails » puis « Installer quand même » |
| « Espace insuffisant » | Moins de 200 Mo libres | Libérer de l'espace |
| Rien ne se passe | Installation d'applications inconnues non autorisée | Autoriser la source (Chrome, Fichiers…) dans les réglages |

L'APK pèse environ 55 Mo. Chaque nouvelle version porte un numéro plus élevé et s'installe par-dessus la précédente, sans perdre la connexion.

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
- [ ] Retirer plus de 50 000 FCFA vers Orange Money : le PIN est demandé. Taper un mauvais PIN affiche un message d'erreur. Wave n'apparaît pas.
- [ ] Envoyer de l'argent vers le mobile money d'un proche (*Envoyer › Vers un mobile money*) : l'opérateur se sélectionne d'après le numéro (07 Orange, 05 MTN, 01 Moov).
- [ ] *Recevoir › Demander* : créer un lien de paiement, le partager par WhatsApp. En démo, le bouton « Simuler le paiement » joue le rôle du payeur ; avec l'API, le lien s'ouvre sur la page de paiement.
- [ ] *Accueil › Scanner* : scanner `docs/qr-test-marchand.png` (demande d'un commerçant, 3 500 FCFA) et payer avec le solde ; scanner `docs/qr-test-emvco.png` (QR interopérable MTN, 2 000 FCFA) : l'envoi vers MTN MoMo se pré-remplit. Sans appareil photo, coller le contenu du QR dans le champ prévu.
- [ ] *Recevoir › Demander › Mon QR DALA* : un autre testeur scanne ce QR pour vous envoyer de l'argent.
- [ ] **Trusty** (*Accueil › Trusty*) : ouvrir « Commande de 20 pagnes wax » (vous êtes la vendeuse), saisir le code de remise de l'acheteuse `482913` : les 90 000 FCFA arrivent sur le solde.
- [ ] **Trusty, achat** : *Nouvelle transaction sécurisée › J'achète*, un numéro, un objet, un montant. En démo, le vendeur accepte au bout de quelques secondes : bloquer les fonds, noter le code de remise, attendre la livraison, puis « J'ai reçu, payer le vendeur » (PIN). Essayer aussi « Signaler un problème » sur un autre achat.
- [ ] Vérifier que les placements et le crowdfunding n'apparaissent nulle part (phase de test).
- [ ] Créer un compte : l'écran « Avant de commencer » s'affiche, puis la date de naissance est demandée (moins de 18 ans refusé).
- [ ] Demander un prêt de plus de 100 000 FCFA : impossible.
- [ ] *Profil › Mes données* : exporter ses données, lire la politique de conservation.
- [ ] Demander un prêt : le TAEG et le coût total s'affichent avant validation, puis le prêt est approuvé.
- [ ] Créer un objectif d'épargne avec épargne automatique.
- [ ] Cotiser à la tontine (PIN demandé).
- [ ] Créer un coffre-fort de 3 mois : il est affiché sans rémunération.
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
