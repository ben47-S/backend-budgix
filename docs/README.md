# Backend Budgix - API de gestion de budget

Backend Express + TypeScript + Prisma pour l'application de gestion de budget Budgix.

## 🚀 Démarrage rapide

### Prérequis

- Node.js 18+
- PostgreSQL
- pnpm (gestionnaire de paquets)

### Installation

```bash
# Installer les dépendances
pnpm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env et configurer DATABASE_URL et JWT_SECRET

# Générer le client Prisma
pnpm prisma:generate

# Exécuter les migrations
pnpm prisma:migrate

# Créer les catégories globales
pnpm prisma:seed
```

### Démarrage

```bash
# Mode développement (avec watch)
pnpm dev

# Le serveur démarre sur http://localhost:3000
```

## 📚 Structure du projet

```
src/
├── controllers/    # Contrôleurs HTTP
├── services/       # Logique métier
├── routes/         # Définition des routes
├── middleware/     # Middlewares Express
├── utils/          # Fonctions utilitaires
├── types/          # Types TypeScript
└── lib/            # Bibliothèques (Prisma)
```

## 🔐 Authentification

L'application supporte deux méthodes d'authentification :

### 1. Authentification par OTP (One-Time Password)

L'authentification par téléphone avec code OTP :

1. **Envoyer un OTP** : `POST /api/auth/otp/send`
2. **Vérifier l'OTP** : `POST /api/auth/otp/verify`
3. **Recevoir un token JWT** : Le token est retourné dans la réponse de vérification
4. **Utiliser le token** : Ajouter `Authorization: Bearer <token>` dans les headers

**Note** : Le code OTP est valide pendant 5 minutes.

**Format de réponse** :
```json
{
  "success": true,
  "message": "Code OTP envoyé avec succès",
  "data": {
    "phone": "+2250123456789",
    "code": "123456"  // Uniquement en développement
  }
}
```

**Après vérification OTP** :
```json
{
  "success": true,
  "message": "Connexion réussie",
  "data": {
    "user": {
      "id": "clx...",
      "phone": "+2250123456789",
      "email": null,
      "isPremium": false,
      "createdAt": "2024-01-18T12:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "isNewUser": false
  }
}
```

### 2. Authentification OAuth Google

L'authentification via Google OAuth :

1. **Initiier la connexion** : `GET /api/auth/oauth/google` (redirige vers Google)
2. **Callback Google** : `GET /api/auth/oauth/google/callback` (géré automatiquement)
3. **Recevoir un token JWT** : Le token est retourné dans l'URL de redirection
4. **Utiliser le token** : Ajouter `Authorization: Bearer <token>` dans les headers

**Configuration requise** : Les variables `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` doivent être configurées dans le fichier `.env`. Voir la section [Configuration OAuth Google](#configuration-oauth-google) ci-dessous.

## 📡 Routes API

> **📚 Documentation complète** : Pour les détails complets de chaque endpoint (schémas de requête/réponse, exemples, codes d'erreur), consultez la documentation Swagger :
> - **Interface Swagger UI** : `http://localhost:3000/api-docs` (quand le serveur est démarré)
> - **JSON Swagger** : `http://localhost:3000/api-docs.json`

### Health Check
- `GET /health` - Vérifie l'état du serveur et de la base de données
  - Paramètre `?simple=true` pour un check rapide sans vérification DB
  - Retourne `200` si healthy, `503` si unhealthy

### Authentification
- `POST /api/auth/otp/send` - Envoyer un code OTP
- `POST /api/auth/otp/verify` - Vérifier un code OTP (retourne un token JWT)
- `GET /api/auth/oauth/google` - Initiier l'authentification Google OAuth
- `GET /api/auth/oauth/google/callback` - Callback Google OAuth (géré automatiquement)
- `POST /api/auth/oauth/google/test` - Route de test pour OAuth (développement uniquement)

### Catégories
- `GET /api/categories` - Liste des catégories (globales + personnalisées)
- `POST /api/categories` - Créer une catégorie personnalisée
- *Requiert : Authentification*

### Transactions
- `GET /api/transactions` - Liste des transactions avec filtres
- `POST /api/transactions` - Créer une transaction
- `GET /api/transactions/summary` - Résumé des transactions (totaux)
- *Requiert : Authentification*

### Statistiques
- `GET /api/stats` - Statistiques complètes depuis l'inscription
- `GET /api/stats/totals` - Totaux depuis l'inscription
- `GET /api/stats/top-categories` - Top 2 catégories de dépenses
- *Requiert : Authentification*

### Profil
- `GET /api/profile` - Récupérer le profil utilisateur
- `POST /api/profile/phone/send` - Envoyer un code OTP pour ajouter un numéro de téléphone
- `POST /api/profile/phone/verify` - Vérifier le code OTP et ajouter le téléphone
- `POST /api/profile/email/send` - Envoyer un code de vérification pour ajouter un email
- `POST /api/profile/email/verify` - Vérifier le code et ajouter l'email
- *Requiert : Authentification*

### Abonnements (Premium)
- `POST /api/subscriptions` - Créer un abonnement premium
- `GET /api/subscriptions` - Récupérer l'abonnement actuel
- `POST /api/subscriptions/check-status` - Vérifier le statut de l'abonnement
- `POST /api/subscriptions/cancel` - Annuler l'abonnement
- *Requiert : Authentification*

### Dettes (Premium)
- `POST /api/debts` - Créer une dette
- `GET /api/debts` - Liste des dettes avec filtres
- `GET /api/debts/stats` - Statistiques sur les dettes
- `GET /api/debts/:id` - Récupérer une dette par ID
- `PUT /api/debts/:id` - Mettre à jour une dette
- `DELETE /api/debts/:id` - Supprimer une dette
- *Requiert : Authentification + Premium*

## 🧪 Tests

Les tests sont organisés dans le dossier `tests/` :

```bash
# Tester la connexion Prisma
pnpm test:prisma

# Tester les catégories (crée aussi un utilisateur)
pnpm test:category

# Tester le rate limiting
pnpm test:rate-limit

# Tester la configuration Swagger
pnpm test:swagger

# Exécuter tous les tests
pnpm test:all
```

**Note** : Certains tests nécessitent que le serveur soit démarré (`pnpm dev` dans un autre terminal).

## 🔧 Scripts disponibles

### Développement
- `pnpm dev` - Démarrer le serveur en mode développement (avec watch)
- `pnpm test:prisma` - Tester la connexion Prisma
- `pnpm test:category` - Tester les catégories

### Production
- `pnpm build` - Compiler le projet pour la production
- `pnpm start` - Démarrer le serveur en production (après build)
- `pnpm start:prod` - Démarrer avec NODE_ENV=production

### Prisma
- `pnpm prisma:generate` - Générer le client Prisma
- `pnpm prisma:migrate` - Exécuter les migrations (développement)
- `pnpm prisma:migrate:deploy` - Appliquer les migrations (production)
- `pnpm prisma:seed` - Créer les catégories globales
- `pnpm prisma:studio` - Ouvrir Prisma Studio

## 🏗️ Build et déploiement

### Build pour la production

```bash
# 1. Installer les dépendances
pnpm install --production=false

# 2. Compiler le projet
pnpm build

# 3. Appliquer les migrations
pnpm prisma:migrate:deploy

# 4. (Optionnel) Créer les catégories globales
pnpm prisma:seed

# 5. Démarrer le serveur
pnpm start:prod
```

Le build génère :
- `dist/` - Code JavaScript compilé
- Source maps pour le débogage
- Client Prisma généré

### Variables d'environnement en production

Assurez-vous de configurer toutes les variables nécessaires dans votre fichier `.env` :
- `DATABASE_URL` - URL de la base de données de production
- `JWT_SECRET` - Clé secrète forte et aléatoire
- `NODE_ENV=production` - Environnement de production
- `FRONTEND_URL` - URL du frontend en production
- `PORT` - Port du serveur (optionnel, défaut: 3000)
- `EXPO_ACCESS_TOKEN` - Token Expo pour les notifications push (optionnel)

## 📝 Variables d'environnement

### Configuration rapide

1. Copiez le fichier d'exemple :
```bash
cp .env.example .env
```

2. Éditez le fichier `.env` et configurez les variables nécessaires.

### Variables requises

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL de connexion PostgreSQL | `postgresql://user:password@localhost:5432/budgix?schema=public` |
| `JWT_SECRET` | Clé secrète pour signer les tokens JWT | `votre-secret-jwt-tres-securise` |
| `JWT_EXPIRES_IN` | Durée de validité des tokens | `7d` (7 jours) |

### Variables optionnelles

| Variable | Description | Défaut |
|----------|-------------|--------|
| `PORT` | Port du serveur | `3000` |
| `NODE_ENV` | Environnement d'exécution | `development` |
| `FRONTEND_URL` | URL du frontend (pour CORS) | `http://localhost:5173` |
| `API_URL` | URL de l'API (pour Swagger) | `http://localhost:3000/api` |
| `GOOGLE_CLIENT_ID` | Client ID Google OAuth | - |
| `GOOGLE_CLIENT_SECRET` | Client Secret Google OAuth | - |
| `TEST_PHONE` | Numéro de téléphone pour les tests | `+2250123456789` |
| `EXPO_ACCESS_TOKEN` | Token Expo pour les notifications push (optionnel) | `exp_xxxxxxxxxxxxxxxxxxxxx` |

### Configuration OAuth Google

Pour activer l'authentification OAuth Google :

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Activez l'API "Google+ API"
4. Créez des identifiants OAuth 2.0 :
   - Type : Application Web
   - URI de redirection autorisée : `http://localhost:3000/api/auth/oauth/google/callback` (développement)
   - Pour la production : `https://votre-domaine.com/api/auth/oauth/google/callback`
5. Copiez le **Client ID** et le **Client Secret** dans votre fichier `.env`

**Note** : L'authentification OTP fonctionne sans configuration OAuth. Les variables Google sont uniquement nécessaires si vous souhaitez utiliser l'authentification OAuth Google.

## 🔒 Sécurité

- Les routes protégées nécessitent un token JWT valide
- Le token est vérifié via le middleware `requireAuth`
- Les tokens expirent après 7 jours (configurable via `JWT_EXPIRES_IN`)
- **Rate Limiting** : Protection contre les abus et attaques par force brute
  - Authentification OTP : 5 requêtes / 15 min
  - Profil : 10 requêtes / heure
  - Création de ressources : 20 requêtes / heure
  - Routes générales : 100 requêtes / 15 min
  - 📖 Voir [RATE_LIMITING.md](./RATE_LIMITING.md) pour plus de détails

## 📊 Logging

L'application utilise **Winston** pour un logging structuré :

- **Développement** : Logs colorés dans la console avec timestamps
- **Production** : Logs JSON structurés dans des fichiers
  - `logs/error.log` - Erreurs uniquement
  - `logs/combined.log` - Tous les logs
  - `logs/exceptions.log` - Exceptions non capturées
  - `logs/rejections.log` - Rejets de promesses non gérés

**Niveaux de log** :
- `error` - Erreurs critiques
- `warn` - Avertissements
- `info` - Informations générales
- `http` - Requêtes HTTP
- `debug` - Informations de débogage (développement uniquement)

**Configuration** : Variable `LOG_LEVEL` dans `.env` (défaut: `info` en production, `debug` en développement)

## 📦 Technologies utilisées

- **Express** - Framework web
- **TypeScript** - Langage de programmation
- **Prisma** - ORM pour PostgreSQL
- **JWT** - Authentification par tokens
- **PostgreSQL** - Base de données

## 🎯 Fonctionnalités

### Version Standard
- ✅ Authentification par OTP (téléphone)
- ✅ Gestion des catégories (globales + personnalisées)
- ✅ Gestion des transactions (entrées/sorties)
- ✅ Filtres par période (semaine, mois, année)
- ✅ Statistiques (totaux, top catégories)

### Version Premium
- ✅ Gestion des abonnements (mensuel/annuel)
- ✅ Gestion des dettes (créances et dettes)
- ✅ Statistiques sur les dettes

## 📚 Documentation API complète

Pour développer le frontend, la documentation Swagger contient tous les détails nécessaires :

### Accès à la documentation

1. **Démarrez le serveur** : `pnpm dev`
2. **Ouvrez Swagger UI** : http://localhost:3000/api-docs
3. **Ou récupérez le JSON** : http://localhost:3000/api-docs.json

### Ce que contient Swagger

- ✅ **Schémas complets** : Formats exacts de toutes les requêtes et réponses
- ✅ **Exemples** : Exemples JSON pour chaque endpoint
- ✅ **Codes d'erreur** : Tous les codes d'erreur possibles avec leurs messages
- ✅ **Validation** : Contraintes et règles de validation pour chaque champ
- ✅ **Authentification** : Comment utiliser les tokens JWT
- ✅ **Test interactif** : Possibilité de tester les endpoints directement depuis Swagger UI

### Format standard des réponses

**Succès** :
```json
{
  "success": true,
  "message": "Message de succès",
  "data": { /* Données de la réponse */ }
}
```

**Erreur** :
```json
{
  "success": false,
  "error": {
    "message": "Message d'erreur descriptif",
    "code": "ERROR_CODE"  // Uniquement en développement
  }
}
```

### Codes d'erreur HTTP

- `200` - Succès
- `201` - Créé avec succès
- `400` - Requête invalide (validation échouée)
- `401` - Non authentifié (token manquant ou invalide)
- `403` - Accès refusé (fonctionnalité premium requise)
- `404` - Ressource non trouvée
- `409` - Conflit (ressource déjà existante)
- `429` - Trop de requêtes (rate limiting)
- `500` - Erreur serveur interne
- `503` - Service indisponible (health check)

### Gestion du token JWT

1. **Récupérer le token** : Après authentification (OTP ou OAuth), le token est dans `data.token`
2. **Stocker le token** : Stockez-le localement (localStorage, sessionStorage, etc.)
3. **Envoyer le token** : Ajoutez-le dans le header de chaque requête :
   ```
   Authorization: Bearer <token>
   ```
4. **Gérer l'expiration** : Le token expire après 7 jours (configurable). En cas d'erreur 401, reconnectez l'utilisateur.

## 📄 Licence

ISC

