/**
 * Point d'entrée pour les services
 * 
 * Les services contiennent la logique métier de l'application
 * et interagissent avec la base de données via Prisma.
 */

// Services d'authentification
export * from "./auth.service.js";
export * from "./otp.service.js";
export * from "./consent.service.js";

// Services de catégories
export * from "./category.service.js";

// Services de transactions
export * from "./transaction.service.js";

// Services de statistiques
export * from "./stats.service.js";

// Services JWT
export * from "./jwt.service.js";

// Services de vérification d'email
export * from "./email-verification.service.js";

// Services de profil utilisateur
export * from "./profile.service.js";

// Services d'abonnements premium
export * from "./subscription.service.js";

// Services de dettes (premium uniquement)
export * from "./debt.service.js";

// Services d'abonnements externes (premium uniquement)
export * from "./external-subscription.service.js";

// Services de discussions de support client
export * from "./discussion.service.js";
export * from "./websocket.service.js";

