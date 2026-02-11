/**
 * Point d'entrée pour les services
 * 
 * Les services contiennent la logique métier de l'application
 * et interagissent avec la base de données via Prisma.
 */

// Services d'authentification
export * from "./auth.service";
export * from "./otp.service";
export * from "./consent.service";

// Services de catégories
export * from "./category.service";

// Services de transactions
export * from "./transaction.service";

// Services de statistiques
export * from "./stats.service";

// Services JWT
export * from "./jwt.service";

// Services OAuth
export * from "./oauth.service";

// Services de vérification d'email
export * from "./email-verification.service";

// Services de profil utilisateur
export * from "./profile.service";

// Services d'abonnements premium
export * from "./subscription.service";

// Services de dettes (premium uniquement)
export * from "./debt.service";

// Services d'abonnements externes (premium uniquement)
export * from "./external-subscription.service";

// Services de discussions de support client
export * from "./discussion.service";
export * from "./websocket.service";

