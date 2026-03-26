# 🎯 FONCTIONNALITÉS PREMIUM - BUDGIX

Ce document liste **TOUTES** les fonctionnalités restreintes aux utilisateurs Premium dans l'application Budgix.

---

## 📋 TABLE DES MATIÈRES

1. [Backend - Routes Protégées](#backend---routes-protégées)
2. [Frontend - Pages et Composants](#frontend---pages-et-composants)
3. [Comment Modifier les Restrictions](#comment-modifier-les-restrictions)

---

## 🔒 BACKEND - ROUTES PROTÉGÉES

### 1. STATISTIQUES PREMIUM

**Fichier:** `src/routes/stats.routes.ts`

| Route | Méthode | Description | Ligne |
|-------|---------|-------------|-------|
| `/api/stats/premium` | GET | Statistiques avancées sur période personnalisée (jour/mois/année/personnalisé) | 354 |

**Middleware utilisé:** `requirePremium`

**Fonctionnalités:**
- ✅ Statistiques par jour spécifique
- ✅ Statistiques par mois spécifique
- ✅ Statistiques par année spécifique
- ✅ Statistiques sur période personnalisée (date début -> date fin)
- ✅ Détails des revenus et dépenses par catégorie
- ✅ Nombre de transactions par période

---

### 2. BUDGETS / LIMITATIONS

**Fichier:** `src/routes/budget.routes.ts`

| Route | Méthode | Description | Ligne |
|-------|---------|-------------|-------|
| `/api/budgets` | GET | Lister toutes les limitations (mensuelles et personnalisées) | 236 |
| `/api/budgets` | POST | Créer une limitation personnalisée | 244 |
| `/api/budgets/overview` | GET | Vue d'ensemble des budgets (dépassés, en cours, à venir) | 340 |
| `/api/budgets/:id` | DELETE | Supprimer une limitation | 413 |
| `/api/budgets/check` | POST | Vérifier les budgets et envoyer notifications si dépassement | 473 |
| `/api/budgets/monthly` | POST | Créer/Modifier un budget mensuel | 530 |
| `/api/budgets/monthly` | GET | Récupérer les budgets mensuels | 639 |

**Middleware utilisé:** `requirePremium`

**Fonctionnalités:**
- ✅ Créer des limitations de dépenses par catégorie
- ✅ Définir des budgets mensuels récurrents
- ✅ Définir des budgets sur périodes personnalisées
- ✅ Recevoir des notifications de dépassement de budget
- ✅ Voir l'aperçu de tous les budgets (dépassés, en cours, à venir)
- ✅ Limitation globale (tous types de dépenses confondus)

---

### 3. ABONNEMENTS EXTERNES (Netflix, Spotify, etc.)

**Fichier:** `src/routes/external-subscription.routes.ts`

| Route | Méthode | Description | Ligne |
|-------|---------|-------------|-------|
| `/api/external-subscriptions` | GET | Lister tous les abonnements externes | 74 |
| `/api/external-subscriptions/:id` | GET | Détails d'un abonnement externe | 109 |
| `/api/external-subscriptions` | POST | Créer un nouvel abonnement externe | 172 |
| `/api/external-subscriptions/:id` | PUT | Modifier un abonnement externe | 233 |
| `/api/external-subscriptions/:id` | DELETE | Supprimer un abonnement externe | 271 |
| `/api/external-subscriptions/:id/renew` | POST | Renouveler un abonnement externe manuellement | 316 |

**Middleware utilisé:** `requirePremium`

**Fonctionnalités:**
- ✅ Suivre les abonnements externes (Netflix, Spotify, Apple Music, etc.)
- ✅ Cycles de facturation: Mensuel, Trimestriel, Annuel, Personnalisé
- ✅ Calcul automatique du % du cycle écoulé
- ✅ Notifications avant échéance
- ✅ Filtrer par statut (actif/inactif)
- ✅ Associer à une catégorie de dépense

---

### 4. GESTION DES DETTES

**Fichier:** `src/routes/debt.routes.ts`

| Route | Méthode | Description | Ligne |
|-------|---------|-------------|-------|
| `/api/debts` | POST | Créer une nouvelle dette | 93 |
| `/api/debts` | GET | Lister toutes les dettes (avec filtres) | 140 |
| `/api/debts/stats` | GET | Statistiques des dettes (solde net, créances, dettes) | 192 |
| `/api/debts/:id` | GET | Détails d'une dette spécifique | 232 |
| `/api/debts/:id` | PUT | Modifier une dette | 293 |
| `/api/debts/:id` | DELETE | Supprimer une dette | 329 |

**Middleware utilisé:** `requirePremium`

**Fonctionnalités:**
- ✅ Créer des dettes (je dois / on me doit)
- ✅ Marquer une dette comme réglée
- ✅ Filtrer les dettes:
  - Toutes les dettes
  - On me doit (créances)
  - Je dois
  - Réglées
  - Non réglées
- ✅ Statistiques:
  - Solde net (créances - dettes)
  - Total des créances
  - Total des dettes
- ✅ Date de remboursement
- ✅ Notes sur la dette

---

## 📱 FRONTEND - PAGES ET COMPOSANTS

### 1. PAGES COMPLÈTES PREMIUM

#### **A. Gestion des Dettes**
**Fichier:** `../front-budgix/app/premium/debts.tsx`

**Accès:** Vérifié au chargement, affiche message si non-premium

**Fonctionnalités:**
- Interface de gestion des dettes
- Filtres (toutes, créances, dettes, réglées, non réglées)
- Carte récapitulative du solde net
- Liste des dettes avec options (modifier, supprimer, marquer réglé)
- Modal de création/modification

---

#### **B. Abonnements Externes**
**Fichier:** `../front-budgix/app/premium/subscriptions.tsx`

**Accès:** Vérifié au chargement, affiche message si non-premium

**Fonctionnalités:**
- Interface de gestion des abonnements externes
- Filtres (tous, actifs, inactifs)
- Calcul du % cycle écoulé
- Renouvellement manuel
- Total des abonnements actifs
- Modal de création/modification

---

#### **C. Budgets/Limitations**
**Fichier:** `../front-budgix/app/premium/budgets.tsx`

**Accès:** Vérifié au chargement, affiche message si non-premium

**Fonctionnalités:**
- Interface de gestion des budgets
- Types: Mensuels / Personnalisés
- Vue d'ensemble des dépenses du mois
- Liste des budgets avec progression
- Badges de statut (dépassé, en cours, à venir)
- Modal de création

---

#### **D. Statistiques Premium**
**Fichier:** `../front-budgix/app/premium/stats.tsx`

**Accès:** Vérifié au chargement, affiche message si non-premium

**Fonctionnalités:**
- Statistiques sur période relative (jour/mois/année)
- Statistiques sur période personnalisée (date début -> date fin)
- Détails des revenus et dépenses par catégorie
- Graphiques avancés
- Export des données

---

### 2. RESTRICTIONS DANS LES PAGES STANDARDS

#### **A. Onglet "Avancés"**
**Fichier:** `../front-budgix/app/(tabs)/_layout.tsx` (ligne 108)

```typescript
href: isPremium ? undefined : null
```

**Comportement:**
- ❌ **Non-Premium:** Onglet complètement masqué dans la navigation
- ✅ **Premium:** Onglet visible et accessible

---

#### **B. Page "Avancés"**
**Fichier:** `../front-budgix/app/(tabs)/advancedPage.tsx`

**Fonctionnalités affichées:**
- Section "Fonctionnalités Premium" avec badge premium
- Bouton "Ouvrir" vers chaque fonctionnalité premium:
  - Gestion des dettes
  - Abonnements externes
  - Mes limitations (budgets)

---

#### **C. Page Statistiques**
**Fichier:** `../front-budgix/app/(tabs)/stats.tsx` (ligne 293)

**Restrictions:**
- Bouton "Stats Premium" visible **uniquement pour premium**
- Icône notification masquée si premium

```typescript
isPremium ? null : (
  <MaterialIcons name="message" size={28} />
)
```

---

#### **D. Thèmes de Fond**
**Fichier:** `../front-budgix/app/background-themes.tsx` (ligne 43)

**Accès:**
```typescript
const isPremium = user?.isPremium || false;
```

**Comportement:**
- ❌ **Non-Premium:** Redirection ou message d'erreur
- ✅ **Premium:** Accès aux thèmes personnalisés

---

### 3. VÉRIFICATIONS CÔTÉ FRONTEND

#### **Messages d'erreur Premium**

**Traductions françaises** (`../front-budgix/src/i18n/locales/fr.json`):

```json
{
  "debts": {
    "premiumRequired": "Premium requis pour accéder aux dettes"
  },
  "budgets": {
    "premiumRequired": "Cette fonctionnalité nécessite un abonnement premium"
  },
  "debts.subscriptions": {
    "premiumRequired": "Cette fonctionnalité nécessite un abonnement premium."
  }
}
```

---

## 🔧 COMMENT MODIFIER LES RESTRICTIONS

### ✅ RENDRE UNE FONCTIONNALITÉ ACCESSIBLE À TOUS

#### **Backend (Supprimer la restriction)**

**Exemple: Rendre les dettes accessibles à tous**

**Fichier:** `src/routes/debt.routes.ts`

**AVANT:**
```typescript
router.post("/", requireAuth, requirePremium, createResourceRateLimiter, validate(createDebtSchema), createDebtController);
```

**APRÈS:**
```typescript
router.post("/", requireAuth, createResourceRateLimiter, validate(createDebtSchema), createDebtController);
//                            ^^^^^^^^^^^^^^^ Retirer requirePremium
```

**Répéter pour TOUTES les routes de dettes (lignes 93, 140, 192, 232, 293, 329)**

---

#### **Frontend (Supprimer la vérification)**

**Exemple: Page des dettes**

**Fichier:** `../front-budgix/app/premium/debts.tsx`

**AVANT:**
```typescript
if (!user?.isPremium) {
  return (
    <View>
      <Text>Premium requis</Text>
    </View>
  );
}
```

**APRÈS:**
```typescript
// Supprimer complètement la vérification
// OU remplacer par:
if (!isAuthenticated) {
  return <AuthErrorScreen />;
}
```

---

### 🔒 RESTREINDRE UNE NOUVELLE FONCTIONNALITÉ

#### **Backend (Ajouter la restriction)**

**Exemple: Limiter la création de transactions aux premium**

**Fichier:** `src/routes/transaction.routes.ts`

**AVANT:**
```typescript
router.post("/", requireAuth, validate(createTransactionSchema), createTransactionController);
```

**APRÈS:**
```typescript
router.post("/", requireAuth, requirePremium, validate(createTransactionSchema), createTransactionController);
//                            ^^^^^^^^^^^^^^^ Ajouter requirePremium
```

---

#### **Frontend (Ajouter la vérification)**

**Exemple: Bloquer l'ajout de transaction si non-premium**

**Fichier:** `../front-budgix/app/addTransaction.tsx` (ou équivalent)

**Ajouter avant la fonction de création:**
```typescript
const handleCreateTransaction = () => {
  // Vérifier premium
  if (!user?.isPremium) {
    showAlert(
      "Premium requis",
      "Cette fonctionnalité nécessite un abonnement premium"
    );
    return;
  }

  // Continuer la création...
}
```

---

### 📊 LIMITER LE NOMBRE D'ÉLÉMENTS

#### **Backend (Limiter les transactions)**

**Exemple: Max 100 transactions pour les non-premium**

**Fichier:** `src/controllers/transaction.controller.ts`

**Dans `createTransactionController`, ajouter:**
```typescript
// Vérifier le nombre de transactions si non-premium
if (!req.user?.isPremium) {
  const transactionCount = await prisma.transaction.count({
    where: { userId: req.userId }
  });

  if (transactionCount >= 100) {
    return next(
      createError(
        "Limite atteinte - Passez à Premium pour des transactions illimitées",
        403,
        "TRANSACTION_LIMIT_REACHED"
      )
    );
  }
}

// Continuer la création de la transaction...
```

---

## 📝 CHECKLIST DE MODIFICATION

Quand vous modifiez une restriction, suivez cette checklist:

### ✅ Pour LIBÉRER une fonctionnalité:

- [ ] **Backend:** Retirer `requirePremium` de toutes les routes concernées
- [ ] **Frontend:** Retirer les vérifications `isPremium` des pages
- [ ] **Navigation:** Mettre à jour les conditions d'affichage dans `_layout.tsx`
- [ ] **Messages:** Retirer les messages "Premium requis"
- [ ] **Tester:** Vérifier avec un compte gratuit

### 🔒 Pour RESTREINDRE une fonctionnalité:

- [ ] **Backend:** Ajouter `requirePremium` aux routes concernées
- [ ] **Frontend:** Ajouter les vérifications `isPremium`
- [ ] **Messages:** Ajouter les traductions des messages d'erreur
- [ ] **Navigation:** Masquer/Désactiver les accès si non-premium
- [ ] **UX:** Afficher un badge "Premium" sur les fonctionnalités
- [ ] **Tester:** Vérifier avec compte gratuit ET premium

---

## 🎯 RÉSUMÉ DES FICHIERS CLÉS

### Backend
- `src/middleware/auth.ts` - Middleware `requirePremium`
- `src/routes/stats.routes.ts` - Routes stats premium
- `src/routes/budget.routes.ts` - Routes budgets
- `src/routes/debt.routes.ts` - Routes dettes
- `src/routes/external-subscription.routes.ts` - Routes abonnements

### Frontend
- `../front-budgix/app/premium/*.tsx` - Toutes les pages premium
- `../front-budgix/app/(tabs)/_layout.tsx` - Navigation tabs
- `../front-budgix/app/(tabs)/advancedPage.tsx` - Page avancés
- `../front-budgix/src/contexts/AuthContext.tsx` - Context utilisateur

---

## 🚀 PROCHAINES ÉTAPES

1. **Identifiez** les fonctionnalités que vous voulez modifier
2. **Cochez** les cases correspondantes
3. **Demandez-moi** de faire les modifications
4. **Testez** avec un compte gratuit et premium

---

*Document généré le 2026-03-25*
*Version: 1.0.0*
