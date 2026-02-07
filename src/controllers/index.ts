/**
 * Point d'entrée pour les contrôleurs
 * 
 * Les contrôleurs gèrent la logique de traitement des requêtes HTTP
 * et appellent les services pour la logique métier.
 * 
 * Ce fichier centralise tous les exports des contrôleurs pour faciliter
 * les imports dans les routes et autres modules.
 */

// Contrôleurs d'authentification
export * from "./auth.controller";
export * from "./oauth.controller";

// Contrôleurs de catégories
export * from "./category.controller";

// Contrôleurs de transactions
export * from "./transaction.controller";

// Contrôleurs de statistiques
export * from "./stats.controller";

// Contrôleurs de profil utilisateur
export * from "./profile.controller";

// Contrôleurs d'abonnements premium
export * from "./subscription.controller";

// Contrôleurs de paiements d'abonnement
export * from "./payment.controller";

// Contrôleurs de dettes (premium uniquement)
export * from "./debt.controller";

// Contrôleurs de budgets (premium uniquement)
export * from "./budget.controller";

// Contrôleurs de notifications push
export * from "./notification.controller";

// Contrôleurs d'abonnements externes (premium uniquement)
export * from "./external-subscription.controller";

// Contrôleurs admin
export * from "./admin.controller";
export * from "./admin-auth.controller";

// Contrôleurs de discussions
export * from "./discussion.controller";

