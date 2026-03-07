/**
 * Service JWT - Gestion des tokens d'authentification
 * 
 * Ce service gère :
 * - La génération de tokens JWT
 * - La vérification de tokens JWT
 * - L'extraction des données utilisateur depuis le token
 * - Le renouvellement automatique des tokens proches de l'expiration
 */

import jwt from "jsonwebtoken";
import { createError } from "../middleware/errorHandler.js";

// Clé secrète pour signer les tokens (à mettre dans .env en production)
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d"; // 7 jours par défaut
// Seuil de renouvellement : renouveler le token s'il reste moins de 2 jours avant expiration
const JWT_RENEWAL_THRESHOLD_DAYS = parseInt(process.env.JWT_RENEWAL_THRESHOLD_DAYS || "2", 10);

// Interface pour le payload du token
export interface TokenPayload {
  userId: string;
  phone?: string;
  email?: string;
  isPremium: boolean;
  role?: string; // Rôle utilisateur (USER ou ADMIN)
}

/**
 * Génère un token JWT pour un utilisateur
 * 
 * @param payload - Données à inclure dans le token
 * @returns Token JWT signé
 */
export function generateToken(payload: TokenPayload): string {
  try {
    // jwt.sign avec options - expiresIn accepte string ou number
    // Utiliser une assertion de type pour satisfaire TypeScript strict
    const options = {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions;

    const token = jwt.sign(payload, JWT_SECRET, options);
    return token;
  } catch (error: any) {
    throw createError("Erreur lors de la génération du token", 500, "TOKEN_GENERATION_ERROR");
  }
}

/**
 * Vérifie et décode un token JWT
 * 
 * @param token - Token JWT à vérifier
 * @returns Payload décodé du token
 * @throws Erreur si le token est invalide ou expiré
 */
export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw createError("Token expiré", 401, "TOKEN_EXPIRED");
    }
    if (error.name === "JsonWebTokenError") {
      throw createError("Token invalide", 401, "INVALID_TOKEN");
    }
    throw createError("Erreur lors de la vérification du token", 401, "TOKEN_VERIFICATION_ERROR");
  }
}

/**
 * Décode un token JWT sans vérification (pour obtenir la date d'expiration)
 * 
 * @param token - Token JWT à décoder
 * @returns Payload décodé avec la date d'expiration (exp)
 */
export function decodeToken(token: string): TokenPayload & { exp?: number; iat?: number } {
  try {
    const decoded = jwt.decode(token) as TokenPayload & { exp?: number; iat?: number };
    if (!decoded) {
      throw createError("Impossible de décoder le token", 401, "INVALID_TOKEN");
    }
    return decoded;
  } catch (error: any) {
    throw createError("Erreur lors du décodage du token", 401, "TOKEN_DECODE_ERROR");
  }
}

/**
 * Vérifie si un token doit être renouvelé (proche de l'expiration)
 * 
 * @param token - Token JWT à vérifier
 * @returns true si le token doit être renouvelé, false sinon
 */
export function shouldRenewToken(token: string): boolean {
  try {
    const decoded = decodeToken(token);
    
    // Si le token n'a pas de date d'expiration, ne pas renouveler
    if (!decoded.exp) {
      return false;
    }

    // Calculer le nombre de jours restants avant expiration
    const expirationDate = new Date(decoded.exp * 1000); // exp est en secondes
    const now = new Date();
    const daysUntilExpiration = (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    // Renouveler si moins de JWT_RENEWAL_THRESHOLD_DAYS jours restants
    return daysUntilExpiration < JWT_RENEWAL_THRESHOLD_DAYS;
  } catch (error) {
    // En cas d'erreur, ne pas renouveler (la vérification normale gérera l'erreur)
    return false;
  }
}

/**
 * Extrait le token depuis le header Authorization
 * 
 * @param authHeader - Header Authorization (format: "Bearer <token>")
 * @returns Token extrait
 */
export function extractTokenFromHeader(authHeader: string | undefined): string {
  if (!authHeader) {
    throw createError("Token d'authentification manquant", 401, "MISSING_TOKEN");
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw createError("Format de token invalide. Format attendu : Bearer <token>", 401, "INVALID_TOKEN_FORMAT");
  }

  const token = parts[1];
  if (!token) {
    throw createError("Token manquant dans le header", 401, "MISSING_TOKEN");
  }

  return token;
}

