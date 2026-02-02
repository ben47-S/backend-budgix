# Tests - Backend Budgix

Ce dossier contient tous les scripts de test pour le backend.

## 📋 Tests disponibles

### `test-prisma.ts`
Teste la connexion à la base de données Prisma.

**Exécution :**
```bash
pnpm test:prisma
```

**Ce que ce test vérifie :**
- ✅ Connexion à la base de données
- ✅ Exécution d'une requête simple
- ✅ Existence des tables dans la base de données

**Prérequis :**
- Fichier `.env` configuré avec `DATABASE_URL`
- Migrations Prisma exécutées (`pnpm prisma:migrate`)

---

### `test-category.ts`
Teste la création et la gestion des catégories.

**Exécution :**
```bash
pnpm test:category
```

**Ce que ce test vérifie :**
- ✅ Création d'un utilisateur via OTP
- ✅ Liste des catégories (globales + personnalisées)
- ✅ Création d'une catégorie personnalisée

**Prérequis :**
- Serveur démarré (`pnpm dev`)
- Fichier `.env` configuré

---

### `test-rate-limit.ts`
Teste les différentes limites de rate limiting.

**Exécution :**
```bash
pnpm test:rate-limit
```

**Ce que ce test vérifie :**
- ✅ Rate limiting sur les routes d'authentification (5 req/15 min)
- ✅ Rate limiting sur les routes de profil (10 req/heure)
- ✅ Rate limiting sur les routes de création (20 req/heure)
- ✅ Rate limiting général (100 req/15 min)

**Prérequis :**
- Serveur démarré (`pnpm dev`)

---

### `test-swagger.ts`
Vérifie que la configuration Swagger est correcte.

**Exécution :**
```bash
pnpm test:swagger
```

**Ce que ce test vérifie :**
- ✅ Génération de la spécification Swagger
- ✅ Présence des propriétés essentielles
- ✅ Nombre de routes documentées
- ✅ Nombre de schémas définis

**Prérequis :**
- Aucun (test statique)

---

## 🚀 Exécuter tous les tests

```bash
# Exécuter tous les tests disponibles
pnpm test:all
```

**Note :** `test:all` exécute uniquement les tests qui ne nécessitent pas le serveur (`test:prisma` et `test:swagger`).

Pour exécuter tous les tests incluant ceux nécessitant le serveur :
```bash
pnpm test:prisma && pnpm test:swagger && pnpm test:category && pnpm test:rate-limit
```

---

## 📝 Ajouter un nouveau test

1. Créez un nouveau fichier `test-*.ts` dans ce dossier
2. Ajoutez un script dans `package.json` :
   ```json
   "test:nom-du-test": "tsx tests/test-nom-du-test.ts"
   ```
3. Documentez le test dans ce README

---

## 🔧 Structure des tests

Tous les tests suivent cette structure :

```typescript
/**
 * Description du test
 * 
 * Exécution : pnpm test:nom-du-test
 */

import "dotenv/config";
// Imports nécessaires depuis ../src/

async function main() {
  try {
    // Tests...
    console.log("✅ Test réussi");
  } catch (error) {
    console.error("❌ Test échoué:", error);
    process.exit(1);
  }
}

main();
```

---

## ⚠️ Notes importantes

- Les tests utilisent les variables d'environnement du fichier `.env`
- Certains tests modifient la base de données (création d'utilisateurs, etc.)
- Les tests de rate limiting peuvent prendre du temps (attente entre les requêtes)
- Assurez-vous que le serveur est démarré pour les tests qui nécessitent l'API


