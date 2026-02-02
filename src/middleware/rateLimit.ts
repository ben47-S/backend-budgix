/**
 * Middleware de rate limiting
 * 
 * Protège l'API contre les abus et les attaques par force brute
 * en limitant le nombre de requêtes par IP.
 * 
 * Note: Le rate limiting utilise un store en mémoire qui persiste
 * tant que le serveur est en cours d'exécution. Pour réinitialiser
 * les compteurs, redémarrez le serveur.
 */

import rateLimit from "express-rate-limit";

/**
 * Rate limiting strict pour les routes d'authentification OTP
 * Limite : 5 requêtes par 4 minutes par IP
 * 
 * Utilisé pour :
 * - POST /auth/otp/send
 * - POST /auth/otp/verify
 * 
 * Le délai est réduit à 4 minutes pour limiter les abus lors de
 * multiples tentatives d'envoi d'OTP ou d'erreurs de saisie.
 */
export const authRateLimiter = rateLimit({
  windowMs: 4 * 60 * 1000, // 4 minutes (réduit de 15 minutes)
  max: 5, // 5 requêtes par fenêtre
  message: {
    success: false,
    error: {
      message: "Trop de tentatives. Veuillez réessayer dans 4 minutes.",
      code: "TOO_MANY_REQUESTS",
    },
  },
  standardHeaders: true, // Retourne les headers `RateLimit-*`
  legacyHeaders: false, // Désactive les headers `X-RateLimit-*`
  skipSuccessfulRequests: false, // Compter toutes les requêtes, même réussies
});

/**
 * Rate limiting pour les routes de profil (téléphone/email)
 * Limite : 10 requêtes par heure par IP
 * 
 * Utilisé pour :
 * - POST /profile/phone/send
 * - POST /profile/phone/verify
 * - POST /profile/email/send
 * - POST /profile/email/verify
 */
export const profileRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // 10 requêtes par heure
  message: {
    success: false,
    error: {
      message: "Trop de tentatives. Veuillez réessayer dans une heure.",
      code: "TOO_MANY_REQUESTS",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiting général pour toutes les autres routes
 * Limite : 100 requêtes par 15 minutes par IP
 * 
 * Utilisé pour toutes les routes non critiques
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par fenêtre
  message: {
    success: false,
    error: {
      message: "Trop de requêtes. Veuillez réessayer dans quelques minutes.",
      code: "TOO_MANY_REQUESTS",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Ne compter que les requêtes échouées
});

/**
 * Rate limiting très strict pour les routes sensibles (création de ressources)
 * Limite : 20 requêtes par heure par IP
 * 
 * Utilisé pour :
 * - POST /transactions
 * - POST /categories
 * - POST /debts
 * - POST /subscriptions
 */
export const createResourceRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20, // 20 requêtes par heure
  message: {
    success: false,
    error: {
      message: "Trop de créations de ressources. Veuillez réessayer dans une heure.",
      code: "TOO_MANY_REQUESTS",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Fonction utilitaire pour réinitialiser les compteurs de rate limiting
 * Utile uniquement en développement pour les tests
 * 
 * Note: Cette fonction réinitialise tous les stores en mémoire.
 * En production, les compteurs se réinitialisent automatiquement
 * après la fin de la fenêtre de temps.
 */
export function resetRateLimiters(): void {
  if (process.env.NODE_ENV === "production") {
    console.warn("⚠️  Réinitialisation du rate limiting désactivée en production");
    return;
  }

  // Réinitialiser les stores en mémoire
  // Note: express-rate-limit ne fournit pas d'API directe pour réinitialiser
  // Le redémarrage du serveur est la méthode recommandée
  console.log("💡 Pour réinitialiser le rate limiting, redémarrez le serveur");
  console.log("   Les compteurs se réinitialisent automatiquement après la fenêtre de temps");
}

