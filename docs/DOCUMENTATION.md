# 📚 DOCUMENTATION COMPLÈTE - Budgix Backend

**Date de génération** : 2026-02-02  
**Projet** : Backend Budgix - API REST Express + TypeScript + Prisma  
**Statut** : Documentation consolidée

---

## 📖 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Démarrage rapide](#démarrage-rapide)
3. [Authentification](#authentification)
4. [Gestion des utilisateurs](#gestion-des-utilisateurs)
5. [Budgets](#budgets)
6. [Notifications Push](#notifications-push)
7. [Débogages et diagnostics](#débogages-et-diagnostics)
8. [Guides de test](#guides-de-test)
9. [Configuration et déploiement](#configuration-et-déploiement)

---

# Vue d'ensemble

## Backend Budgix - API de gestion de budget

Backend Express + TypeScript + Prisma pour l'application de gestion de budget Budgix.

### 🚀 Démarrage rapide

#### Prérequis

- Node.js 18+
- PostgreSQL
- pnpm (gestionnaire de paquets)

#### Installation

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

#### Démarrage

```bash
# Mode développement (avec watch)
pnpm dev

# Le serveur démarre sur http://localhost:3000
```

### 📚 Structure du projet

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

---

# Authentification

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

---

# Gestion des utilisateurs

## 🛡️ Guide d'implémentation Admin - Budgix

Ce guide contient toutes les informations nécessaires pour utiliser et déployer le système admin de Budgix.

### 📋 Table des matières

1. [Installation et migration](#installation-et-migration)
2. [Routes API Admin](#routes-api-admin)
3. [Authentification Admin](#authentification-admin)
4. [Fonctionnalités disponibles](#fonctionnalités-disponibles)
5. [Recommandation Frontend](#recommandation-frontend)

---

### 🚀 Installation et migration

#### 1. Créer la migration Prisma

Le schéma Prisma a été mis à jour pour inclure les champs `role` et `password` (optionnel) dans le modèle `User`. Vous devez créer et appliquer la migration :

```bash
# Générer la migration
pnpm prisma migrate dev --name add_user_role_and_password

# Ou si vous êtes en production
pnpm prisma migrate deploy
```

#### 2. Créer un utilisateur admin

Après la migration, vous devez créer au moins un utilisateur avec le rôle `ADMIN`. Vous pouvez le faire via le script fourni :

```bash
# Promouvoir un utilisateur existant au rôle ADMIN (par email)
pnpm admin:create --email admin@budgix.com

# Ou par ID utilisateur
pnpm admin:create <userId>

# Ou par téléphone
pnpm admin:create --phone +2250123456789
```

**Important** : L'utilisateur doit avoir un **email** pour pouvoir se connecter avec email + mot de passe.

#### 3. Définir le mot de passe admin

Une fois l'utilisateur promu au rôle ADMIN, définissez son mot de passe :

```bash
# Définir le mot de passe par email
pnpm admin:set-password --email admin@budgix.com "VotreMotDePasse123"

# Ou par ID utilisateur
pnpm admin:set-password --id <userId> "VotreMotDePasse123"
```

**Note** : Le mot de passe doit contenir au moins 8 caractères.

#### 4. Régénérer le client Prisma

Après la migration, régénérez le client Prisma :

```bash
pnpm prisma:generate
```

---

### 🔐 Authentification Admin

#### Méthodes d'authentification

Il existe **deux méthodes** pour se connecter en tant qu'administrateur :

##### 1. Connexion avec Email + Mot de passe (Recommandé pour les admins)

**Route** : `POST /api/admin/auth/login`

**Body** :
```json
{
  "email": "admin@budgix.com",
  "password": "VotreMotDePasse123"
}
```

**Réponse** :
```json
{
  "success": true,
  "message": "Connexion administrateur réussie",
  "data": {
    "user": {
      "id": "clx...",
      "email": "admin@budgix.com",
      "role": "ADMIN",
      "isPremium": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## Corrections du filtre role pour les utilisateurs admin

### Problème identifié

Le paramètre `role=USER` dans la requête `/api/admin/users` n'était pas correctement pris en compte, empêchant l'affichage des utilisateurs standards.

### Corrections apportées

#### 1. Schéma de validation (`src/validations/admin.validation.ts`)

**Avant :**
```typescript
role: z.enum(["USER", "ADMIN"]).optional(),
```

**Après :**
```typescript
role: z
  .string()
  .optional()
  .refine((val) => !val || val.toUpperCase() === "USER" || val.toUpperCase() === "ADMIN", {
    message: "Le rôle doit être USER ou ADMIN",
  })
  .transform((val) => (val ? val.toUpperCase() as "USER" | "ADMIN" : undefined)),
```

**Changements :**
- Accepte maintenant le rôle en majuscules ou minuscules
- Transforme automatiquement en majuscules pour correspondre à l'enum Prisma
- Validation plus flexible

---

# Budgets

## 📋 Détails complets : Créer un budget pour une catégorie

Ce document détaille **exactement** ce que le backend attend pour créer un budget pour une catégorie spécifique.

### 🔗 Endpoint

```
POST /api/budgets
```

**Méthode HTTP :** `POST`  
**URL complète :** `http://localhost:3000/api/budgets` (ou votre URL de production)

### 🔐 Authentification

#### Headers requis

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Détails :**
- `Authorization` : **OBLIGATOIRE** - Token JWT de l'utilisateur connecté
- `Content-Type` : **OBLIGATOIRE** - Doit être `application/json`

**Exemple :**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWtqc25pOTQwMDAxbmtsOGc2Y3NrbXI1IiwiaWF0IjoxNzM3NTI4NDgwfQ.xxx
Content-Type: application/json
```

### 📦 Body de la requête

#### Structure JSON

```json
{
  "amount": 50000,
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "categoryId": "cmkpgxs1u00016cl8h876o5jr"
}
```

#### Champs détaillés

##### 1. `amount` (OBLIGATOIRE)

- **Type :** `number`
- **Description :** Montant limite du budget pour la période
- **Validation :**
  - ✅ Doit être un nombre
  - ✅ Doit être **positif** (`> 0`)
  - ✅ Maximum : `999999999999.99`
  - ❌ Ne peut pas être `0` ou négatif
  - ❌ Ne peut pas être `null` ou `undefined`
- **Exemples valides :**
  - `50000` (50 000 FCFA)
  - `100000.50` (100 000.50 FCFA)
  - `0.01` (0.01 FCFA - minimum)
- **Exemples invalides :**
  - `0` → Erreur : "Le montant du budget doit être positif"
  - `-100` → Erreur : "Le montant du budget doit être positif"
  - `"50000"` → Erreur : "Le montant du budget doit être un nombre"
  - `null` → Erreur : "Le montant du budget doit être un nombre"

##### 2. `startDate` (OBLIGATOIRE)

- **Type :** `string`
- **Description :** Date de début de la période du budget
- **Formats acceptés :**
  - ✅ `YYYY-MM-DD` (format recommandé) : `"2026-01-01"`
  - ✅ Format ISO date-time : `"2026-01-01T00:00:00.000Z"` ou `"2026-01-01T10:30:00Z"`
- **Validation :**
  - ✅ Doit être une date valide
  - ✅ Doit être antérieure ou égale à `endDate`
  - ❌ Ne peut pas être `null` ou `undefined`
  - ❌ Ne peut pas être après `endDate`
- **Exemples valides :**
  - `"2026-01-01"`
  - `"2026-01-15"`
  - `"2026-01-01T00:00:00.000Z"`
- **Exemples invalides :**
  - `"2026-13-01"` → Erreur : "Format de date invalide"
  - `"01-01-2026"` → Erreur : "Format de date invalide"
  - `"2026-01-32"` → Erreur : "Format de date invalide"
  - `"2026-01-31"` avec `endDate: "2026-01-01"` → Erreur : "La date de début doit être antérieure ou égale à la date de fin"

##### 3. `endDate` (OBLIGATOIRE)

- **Type :** `string`
- **Description :** Date de fin de la période du budget
- **Formats acceptés :**
  - ✅ `YYYY-MM-DD` (format recommandé) : `"2026-01-31"`
  - ✅ Format ISO date-time : `"2026-01-31T23:59:59.000Z"` ou `"2026-01-31T10:30:00Z"`
- **Validation :**
  - ✅ Doit être une date valide
  - ✅ Doit être postérieure ou égale à `startDate`
  - ❌ Ne peut pas être `null` ou `undefined`
  - ❌ Ne peut pas être avant `startDate`
- **Exemples valides :**
  - `"2026-01-31"`
  - `"2026-02-28"`
  - `"2026-01-31T23:59:59.000Z"`
- **Exemples invalides :**
  - `"2026-01-01"` avec `startDate: "2026-01-31"` → Erreur : "La date de début doit être antérieure ou égale à la date de fin"

##### 4. `categoryId` (OPTIONNEL)

- **Type :** `string | null`
- **Description :** ID de la catégorie pour laquelle créer le budget
- **Validation :**
  - ✅ Doit être un **CUID valide** (format : `cmk...` ou `clx...`)
  - ✅ La catégorie doit exister dans la base de données
  - ✅ La catégorie doit appartenir à l'utilisateur OU être une catégorie globale (`userId: null`)
  - ✅ Peut être `null` (pour un budget global)
  - ✅ Peut être omis (sera traité comme `null`)
  - ❌ Ne peut pas être une chaîne vide `""`
  - ❌ Ne peut pas être un ID invalide
  - ❌ Ne peut pas être un ID de catégorie qui n'existe pas
  - ❌ Ne peut pas être un ID de catégorie d'un autre utilisateur (sauf catégorie globale)
- **Exemples valides :**
  - `"cmkpgxs1u00016cl8h876o5jr"` (catégorie personnalisée de l'utilisateur)
  - `"clx1234567890abcdefghij"` (catégorie globale)
  - `null` (budget global)
  - Omis (sera traité comme `null`)
- **Exemples invalides :**
  - `"invalid-id"` → Erreur : "Format d'ID de catégorie invalide"
  - `"cmkxxxxxxxxxxxxxxxxxxxx"` (catégorie inexistante) → Erreur : "Catégorie non trouvée"
  - `""` → Erreur : "Format d'ID de catégorie invalide"

### ✅ Exemple de requête complète

#### Avec cURL

```bash
curl -X POST http://localhost:3000/api/budgets \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWtqc25pOTQwMDAxbmtsOGc2Y3NrbXI1IiwiaWF0IjoxNzM3NTI4NDgwfQ.xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "startDate": "2026-01-01",
    "endDate": "2026-01-31",
    "categoryId": "cmkpgxs1u00016cl8h876o5jr"
  }'
```

---

## 📊 Limites et conditions pour les notifications de budget

Ce document détaille les conditions exactes d'envoi des notifications push pour les budgets.

### 🔔 Types de notifications

#### 1. BUDGET_WARNING (Avertissement)
Notification envoyée quand le budget est entre **70% et 99.99%**.

#### 2. BUDGET_ALERT (Alerte)
Notification envoyée quand le budget est **atteint (100%)** ou **dépassé (> 100%)**.

---

## Formats de Dates Renvoyés par le Backend

### 📅 Format Principal

**Toutes les dates dans les réponses API sont formatées au format : `jj-mm-yyyy`**

**⚠️ IMPORTANT : Toutes les dates envoyées au backend doivent également être au format `jj-mm-yyyy`**

### Exemples :
- `"26-01-2026"` (26 janvier 2026)
- `"15-12-2025"` (15 décembre 2025)
- `"01-01-2026"` (1er janvier 2026)

---

# Notifications Push

## 📋 Informations requises pour le backend - Notifications Push

Ce document liste **toutes les informations et configurations** que le backend doit avoir pour que les notifications push fonctionnent correctement.

### 🔧 1. Dépendances NPM

#### Dépendance principale
```json
{
  "dependencies": {
    "expo-server-sdk": "^4.0.0"
  }
}
```

**Installation** :
```bash
pnpm add expo-server-sdk
```

### 🔑 2. Variables d'environnement

#### Variable optionnelle (recommandée)
```env
# Expo Push Notifications
# Optionnel mais recommandé pour les stats avancées et le debugging
EXPO_ACCESS_TOKEN=exp_xxxxxxxxxxxxxxxxxxxxx
```

**Comment obtenir l'EXPO_ACCESS_TOKEN** :
1. Aller sur [expo.dev](https://expo.dev)
2. Se connecter à son compte
3. Aller dans **Account Settings** → **Access Tokens**
4. Cliquer sur **Create Token**
5. Nommer le token : "Backend Push Notifications"
6. Copier le token généré (commence par `exp_`)

**Note** : Cette variable est **optionnelle**. Les notifications fonctionnent sans elle, mais elle permet :
- Accès aux stats avancées
- Meilleur debugging
- Vérification des erreurs de notification

### 🗄️ 3. Base de données - Modèle Prisma

#### Modèle PushToken (déjà créé)
```prisma
model PushToken {
  id        String   @id @default(cuid())
  token     String   @unique // Token Expo (format: ExponentPushToken[...])
  platform  String   // "ios" | "android" | "web"
  deviceId  String?  // Identifiant unique de l'appareil (optionnel)
  userId    String   // Utilisateur propriétaire du token
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Préférences de notification pour cet appareil
  enabled      Boolean @default(true) // Si l'utilisateur a activé les notifications sur cet appareil
  budgetAlerts Boolean @default(true) // Alertes de budget dépassé
  reminders    Boolean @default(true) // Rappels de transaction
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([userId])
  @@index([token])
}
```

#### Relation dans le modèle User
```prisma
model User {
  // ... autres champs
  pushTokens PushToken[] // Relation avec les tokens de notification
}
```

**Migration** : La migration doit être appliquée :
```bash
pnpm prisma:migrate dev --name add_push_token
pnpm prisma:generate
```

### 📁 4. Structure des fichiers backend

#### Fichiers requis
```
src/
├── services/
│   ├── expo-notification.service.ts  ✅ Service Expo Push
│   ├── pushToken.service.ts          ✅ Gestion des tokens
│   └── notification.service.ts       ✅ Notifications métier
├── controllers/
│   └── notification.controller.ts    ✅ Contrôleurs HTTP
├── routes/
│   └── notification.routes.ts        ✅ Routes API
├── validations/
│   └── notification.validation.ts   ✅ Validation Zod
└── routes/
    └── index.ts                      ✅ Intégration des routes
```

---

## Notifications - Guide complet

### 🔔 Types de notifications

1. **BUDGET_WARNING** - Avertissement (70% à 99.99%)
2. **BUDGET_ALERT** - Alerte (100% ou dépassé)
3. **TRANSACTION_REMINDER** - Rappel de transaction
4. **SUBSCRIPTION_RENEWAL** - Renouvellement d'abonnement
5. **DEBT_REMINDER** - Rappel de dette

---

## Notifications Push Simples

### Configuration minimale

Pour envoyer des notifications push simples, vous avez besoin de :

1. Un token Expo valide (`ExponentPushToken[...]`)
2. Une message de contenu
3. La librairie `expo-server-sdk`

```typescript
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

// Envoyer une notification simple
const messages = [
  {
    to: 'ExponentPushToken[...]',
    sound: 'default',
    title: 'Titre',
    body: 'Message',
    data: { customKey: 'value' },
  },
];

await expo.sendPushNotificationsAsync(messages);
```

---

# Débogages et diagnostics

## 🔍 Guide de débogage - Connexion Admin

### Erreurs courantes et solutions

#### 1. Erreur de validation

**Symptôme** : "Erreur de validation" ou message d'erreur de validation Zod

**Causes possibles** :
- Email invalide ou manquant
- Mot de passe trop court (< 8 caractères)
- Format JSON incorrect dans la requête

**Solution** :
- Vérifier que l'email est au format valide : `admin@budgix.com`
- Vérifier que le mot de passe contient au moins 8 caractères
- Vérifier le format JSON de la requête

**Exemple de requête correcte** :
```json
{
  "email": "admin@budgix.com",
  "password": "Admin123456"
}
```

#### 2. "Email ou mot de passe incorrect"

**Causes possibles** :
- L'email n'existe pas dans la base de données
- Le mot de passe est incorrect
- L'utilisateur n'a pas le rôle ADMIN
- L'utilisateur n'a pas de mot de passe défini

**Solution** :
1. Vérifier que l'utilisateur existe :
```bash
pnpm prisma studio
# Chercher l'utilisateur par email
```

2. Vérifier le rôle :
```sql
SELECT email, role, password IS NOT NULL as has_password 
FROM "User" 
WHERE email = 'admin@budgix.com';
```

3. Si le mot de passe n'est pas défini, le définir :
```bash
pnpm admin:set-password --email admin@budgix.com "NouveauMotDePasse123"
```

---

## 🔍 Guide de débogage - Connexion Admin (Frontend)

### Problème : Aucun message dans les logs du backend

Si vous ne voyez **que** la requête OPTIONS dans les logs mais **pas** la requête POST, cela signifie que la requête POST n'arrive jamais au serveur.

### Causes possibles

1. **Erreur JavaScript côté frontend** qui empêche l'envoi
2. **Problème CORS** qui bloque la requête avant qu'elle n'arrive au serveur
3. **Code frontend incorrect** qui n'envoie pas la requête

### Solution étape par étape

#### Étape 1 : Vérifier la console du navigateur

1. Ouvrez la console développeur (F12)
2. Allez dans l'onglet **Console**
3. Essayez de vous connecter
4. **Regardez les erreurs** affichées en rouge

**Erreurs courantes** :
- `CORS policy` → Problème CORS
- `Failed to fetch` → Problème de connexion
- `SyntaxError` → Erreur JavaScript
- `TypeError` → Erreur de code

#### Étape 2 : Vérifier l'onglet Network

1. Ouvrez l'onglet **Network** (F12)
2. **Rafraîchissez la page** (F5)
3. Essayez de vous connecter
4. **Filtrez sur "login"** ou "admin"
5. Regardez les requêtes :

**Ce que vous devriez voir** :
- ✅ `OPTIONS /api/admin/auth/login` (204) → OK
- ✅ `POST /api/admin/auth/login` → **Doit être présent !**

**Si vous ne voyez PAS la requête POST** :
- La requête n'est jamais envoyée
- Vérifiez votre code JavaScript

---

## 🔍 Guide de débogage des notifications push

### ✅ Checklist de vérification

#### 1. **Côté Backend - Vérifications**

##### A. Token enregistré ?
Vérifiez dans les logs du backend après connexion :
```
[info]: Push token enregistré/réassigné {"userId":"...","tokenId":"...","platform":"ios",...}
```

##### B. Budget créé avec progression >= 80% ?
Vérifiez dans les logs :
```
[debug]: Notification de budget programmée (2 min) {"userId":"...","budgetId":"...","percentage":85}
```

##### C. Notification envoyée après 2 minutes ?
Vérifiez dans les logs :
```
[info]: ✅ Notification de budget envoyée (2 min après détection) {"userId":"...","tokensCount":1}
```

**OU** si échec :
```
[warn]: ⚠️ Notification de budget non envoyée {"reason":"Aucun token actif ou préférences désactivées"}
```

---

## 🔍 Diagnostic des notifications push non reçues

### ✅ Vérifications Backend (FAIT)

D'après les logs et les receipts Expo :
- ✅ Token enregistré et actif
- ✅ Notification envoyée à Expo avec succès
- ✅ Ticket Expo accepté (status: "ok")
- ✅ Receipt Expo confirmé : **Notification livrée avec succès**

**Conclusion** : Le backend fonctionne correctement. Expo a livré la notification à l'appareil.

### ❌ Problème probable : Côté Frontend

Si Expo confirme la livraison mais vous ne recevez pas la notification, le problème est dans votre application frontend.

---

## 🔍 Diagnostic : Notifications non reçues (Backend OK)

### ✅ Votre situation

Les logs backend montrent `[STATUS: SUCCESS]` → **Le backend fonctionne correctement !**

Le problème est **côté frontend**. Voici comment diagnostiquer :

---

# Guides de test

## 🧪 Test Authentification

### 1. Test OTP

#### Envoyer un OTP

```bash
curl -X POST http://localhost:3000/api/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"+2250123456789"}'
```

#### Vérifier l'OTP

```bash
curl -X POST http://localhost:3000/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"+2250123456789","code":"123456"}'
```

---

## 🧪 Test des catégories

### Récupérer les catégories

```bash
curl -X GET http://localhost:3000/api/categories \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🧪 Test des notifications Push

### Enregistrer un token

```bash
curl -X POST http://localhost:3000/api/notifications/token \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "ExponentPushToken[...]",
    "platform": "ios"
  }'
```

---

# Configuration et déploiement

## ⚙️ Configuration générale

### Variables d'environnement nécessaires

```env
DATABASE_URL=postgresql://user:password@localhost:5432/budgix
JWT_SECRET=your-secret-key
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
EXPO_ACCESS_TOKEN=exp_xxxxxxxxxxxxxxxxxxxxx
```

---

## 📝 Notes supplémentaires

Cette documentation regroupe l'ensemble de la documentation du projet Budgix Backend. Elle doit être mise à jour à chaque modification importante.

**Dernière mise à jour** : 2026-02-02

---
