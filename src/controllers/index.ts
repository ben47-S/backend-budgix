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
export * from "./auth.controller.js";
export * from "./oauth.controller.js";

// Contrôleurs de catégories
export * from "./category.controller.js";

// Contrôleurs de transactions
export * from "./transaction.controller.js";

// Contrôleurs de statistiques
export * from "./stats.controller.js";

// Contrôleurs de profil utilisateur
export * from "./profile.controller.js";

// Contrôleurs d'abonnements premium
export * from "./subscription.controller.js";

// Contrôleurs de paiements d'abonnement
export * from "./payment.controller.js";

// Contrôleurs de dettes (premium uniquement)
export * from "./debt.controller.js";

// Contrôleurs de budgets (premium uniquement)
export * from "./budget.controller.js";

// Contrôleurs de notifications push
export * from "./notification.controller.js";

// Contrôleurs d'abonnements externes (premium uniquement)
export * from "./external-subscription.controller.js";

// Contrôleurs admin
export * from "./admin.controller.js";
export * from "./admin-auth.controller.js";

// Contrôleurs de discussions
export * from "./discussion.controller.js";

