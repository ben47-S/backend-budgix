# 🚀 Budgix Backend - API REST de Gestion de Budget

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4-lightgrey?style=flat-square)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square)](https://www.postgresql.org/)

API REST complète pour l'application mobile de gestion de budget **Budgix**, développée avec **Express**, **TypeScript** et **Prisma ORM**.

---

## 📋 Table des Matières

- [Fonctionnalités](#-fonctionnalités)
- [Prérequis](#-prérequis)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Démarrage](#-démarrage)
- [Structure du Projet](#-structure-du-projet)
- [API Documentation](#-api-documentation)
- [Authentification](#-authentification)
- [Déploiement](#-déploiement)

---

## ✨ Fonctionnalités

### 🔐 Authentification
- ✅ **OTP par téléphone** (One-Time Password)
- ✅ **OAuth Google** (en développement)
- ✅ **Admin login** avec email + mot de passe

### 💰 Gestion Financière
- ✅ **Transactions** (revenus et dépenses)
- ✅ **Catégories** (globales et personnalisées)
- ✅ **Budgets** avec alertes et notifications
- ✅ **Dettes** (suivi des emprunts/prêts)
- ✅ **Abonnements externes** (Netflix, Spotify, etc.)

### 📊 Statistiques & Analyses
- ✅ **Statistiques complètes** (revenus, dépenses, différence)
- ✅ **Graphiques** et analyses personnalisées
- ✅ **Rapports** de transactions

### 🔔 Notifications
- ✅ **Push notifications** (Expo)
- ✅ **Alertes de budget**
- ✅ **Rappels de renouvellement** d'abonnement
- ✅ **Rappels de dette**

### 💎 Premium
- ✅ **Gestion des dettes** (fonctionnalité premium)
- ✅ **Statistiques avancées**
- ✅ **Abonnements multi-cycles**

### 💬 Support Client
- ✅ **Système de discussions** avec WebSocket temps réel
- ✅ **Chat admin-utilisateur**
- ✅ **Avis et suggestions** d'amélioration

### 👥 Administration
- ✅ **Panneau admin** complet
- ✅ **Gestion des utilisateurs**
- ✅ **Statistiques globales**
- ✅ **Modération des avis et suggestions**

---

## 📦 Prérequis

- **Node.js** 18 ou supérieur
- **PostgreSQL** 14 ou supérieur
- **pnpm** (ou npm/yarn)
- **Compte Expo** (pour les notifications push)

---

## 🔧 Installation

### 1. Cloner le repository
```bash
git clone https://github.com/votreorg/budgix-backend.git
cd budgix-backend
```

### 2. Installer les dépendances
```bash
pnpm install
```

### 3. Configurer les variables d'environnement
```bash
cp .env.example .env
```

Éditer `.env` avec vos configurations :
```env
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/budgix

# Authentification
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRES_IN=7d

# Frontend
FRONTEND_URL=http://localhost:5173

# Notifications (optionnel)
EXPO_ACCESS_TOKEN=exp_xxxxxxxxxxxxxxxxxxxxx

# Environment
NODE_ENV=development
PORT=3000
```

### 4. Générer le client Prisma
```bash
pnpm prisma:generate
```

### 5. Exécuter les migrations
```bash
pnpm prisma:migrate dev
```

### 6. Seed la base de données (optionnel)
```bash
pnpm prisma:seed
```

---

## 🚀 Démarrage

### Mode développement (avec watch)
```bash
pnpm dev
```

Le serveur démarre sur `http://localhost:3000`

### Mode production
```bash
pnpm build
pnpm start
```

---

## 📁 Structure du Projet

```
src/
├── config/              # Configuration (Swagger, etc.)
├── controllers/         # Contrôleurs HTTP
├── lib/                 # Bibliothèques (Prisma, Logger, etc.)
├── middleware/          # Middlewares Express
├── routes/              # Définition des routes
├── services/            # Logique métier
├── types/               # Types TypeScript
├── utils/               # Fonctions utilitaires
├── validations/         # Validation Zod
└── index.ts             # Point d'entrée

prisma/
├── schema.prisma        # Schéma de la base de données
├── migrations/          # Migrations
└── seed.ts              # Seed des données

tests/                   # Tests unitaires et d'intégration
```

---

## 📚 API Documentation

### Swagger UI
Accédez à la documentation interactive Swagger :
```
http://localhost:3000/api-docs
```

### OpenAPI JSON
Téléchargez la spécification OpenAPI :
```
http://localhost:3000/api-docs.json
```

### Routes principales

#### Authentification
```
POST   /api/auth/otp/send              # Envoyer un OTP
POST   /api/auth/otp/verify            # Vérifier l'OTP
POST   /api/auth/oauth/google          # OAuth Google
POST   /api/admin/auth/login           # Login admin
```

#### Transactions
```
GET    /api/transactions               # Lister les transactions
POST   /api/transactions               # Créer une transaction
GET    /api/transactions/:id           # Détails d'une transaction
PUT    /api/transactions/:id           # Modifier
DELETE /api/transactions/:id           # Supprimer
```

#### Budgets
```
GET    /api/budgets                    # Lister les budgets
POST   /api/budgets                    # Créer un budget
GET    /api/budgets/:id                # Détails
PUT    /api/budgets/:id                # Modifier
DELETE /api/budgets/:id                # Supprimer
GET    /api/budgets/overview           # Vue d'ensemble
```

#### Statistiques
```
GET    /api/stats/summary              # Résumé (revenus, dépenses)
GET    /api/stats/by-category          # Par catégorie
GET    /api/stats/by-period            # Par période
GET    /api/stats/trends               # Tendances
```

#### Admin
```
GET    /api/admin/users                # Lister les utilisateurs
GET    /api/admin/stats                # Statistiques globales
POST   /api/admin/users/:id/role       # Changer le rôle
DELETE /api/admin/users/:id            # Supprimer un utilisateur
```

---

## 🔐 Authentification

### OTP (Authentification recommandée pour les utilisateurs)

1. **Envoyer un OTP** :
```bash
POST /api/auth/otp/send
{
  "phone": "+2250123456789"
}
```

2. **Vérifier l'OTP** :
```bash
POST /api/auth/otp/verify
{
  "phone": "+2250123456789",
  "code": "123456"
}
```

Réponse :
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "phone": "...", "isPremium": false },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "isNewUser": false
  }
}
```

### Admin Login (Email + Password)

```bash
POST /api/admin/auth/login
{
  "email": "admin@budgix.com",
  "password": "SecurePassword123"
}
```

### Utiliser le Token

Ajouter le token dans les headers de toutes les requêtes protégées :
```http
Authorization: Bearer <your_jwt_token>
```

---

## 🔔 Notifications Push

### Configuration

1. Créer un compte sur [expo.dev](https://expo.dev)
2. Générer un Access Token
3. Ajouter à `.env` :
```env
EXPO_ACCESS_TOKEN=exp_xxxxxxxxxxxxxxxxxxxxx
```

### Enregistrer un Token
```bash
POST /api/notifications/token
{
  "token": "ExponentPushToken[...]",
  "platform": "ios"  # ou "android" | "web"
}
```

---

## 📊 Base de Données

### Modèles principaux
- **User** - Utilisateurs (avec rôles: USER, ADMIN)
- **Transaction** - Transactions financières
- **Category** - Catégories (globales/personnalisées)
- **Budget** - Budgets avec suivi
- **Debt** - Gestion des dettes
- **Subscription** - Abonnements premium
- **ExternalSubscription** - Abonnements externes
- **PushToken** - Tokens de notifications
- **Discussion** - Chats support
- **Review** - Avis utilisateurs
- **ImprovementSuggestion** - Suggestions d'amélioration

### Migrations
```bash
# Afficher le statut des migrations
pnpm prisma:migrate status

# Créer une nouvelle migration
pnpm prisma:migrate dev --name <name>

# Appliquer les migrations en production
pnpm prisma:migrate deploy
```

---

## 🧪 Tests

### Exécuter tous les tests
```bash
pnpm test
```

### Tests avec couverture
```bash
pnpm test:coverage
```

### Tests en mode watch
```bash
pnpm test:watch
```

---

## 🚢 Déploiement

### Heroku
```bash
heroku create budgix-backend
heroku config:set JWT_SECRET=your-secret
git push heroku main
```

### Docker
```bash
docker build -t budgix-backend .
docker run -p 3000:3000 budgix-backend
```

### Railway, Vercel, ou autre
Voir `.env.example` pour les variables requises.

---

## 📖 Documentation Supplémentaire

### Fichiers de référence
- **DOCUMENTATION.md** - Documentation complète du projet
- **Swagger UI** - Documentation interactive API (http://localhost:3000/api-docs)
- **Prisma Studio** - Explorateur de base de données (`pnpm prisma:studio`)

### Scripts disponibles
```bash
pnpm dev                    # Développement
pnpm build                  # Build production
pnpm start                  # Lancer production
pnpm test                   # Tests
pnpm prisma:generate        # Générer Prisma Client
pnpm prisma:migrate dev     # Migrations dev
pnpm prisma:seed            # Seed données
pnpm prisma:studio          # Prisma Studio UI
pnpm lint                   # Linter
pnpm format                 # Formater le code
```

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Veuillez :

1. Fork le repository
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

---

## 📝 Licence

Ce projet est sous licence **MIT**. Voir [LICENSE](LICENSE) pour les détails.

---

## 👥 Auteurs

- **[Votre Nom]** - Développeur Principal

---

## 📧 Support

Pour toute question ou problème :
- Ouvrir une [Issue](https://github.com/votreorg/budgix-backend/issues)
- Envoyer un email à : support@budgix.com
- Chat support dans l'app Budgix

---

## 🙏 Remerciements

- [Express.js](https://expressjs.com/) - Web framework
- [Prisma](https://www.prisma.io/) - ORM
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Swagger/OpenAPI](https://swagger.io/) - API documentation
- [Expo](https://expo.dev/) - Push notifications

---

**Dernière mise à jour** : 2026-02-02
