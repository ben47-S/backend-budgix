/**
 * Contrôleur d'authentification
 * 
 * Gère les requêtes HTTP liées à l'authentification :
 * - Envoi de code OTP
 * - Vérification de code OTP (inscription/connexion)
 */

import type { Request, Response, NextFunction } from "express";
import { createOTP, verifyOTP } from "../services/otp.service";
import { createUser, getUserByPhone } from "../services/auth.service";
import { isValidPhone, normalizePhone, isValidOTP } from "../utils/validation";
import { createError } from "../middleware/errorHandler";
import { generateToken } from "../services/jwt.service";
import logger from "../lib/logger";
import type { OtpRequest, OtpVerifyRequest } from "../types/index";

/**
 * Envoie un code OTP à un numéro de téléphone
 * 
 * POST /auth/otp/send
 * Body: { phone: string }
 */
export async function sendOTP(
  req: Request<{}, {}, OtpRequest>,
  res: Response,
  next: NextFunction
) {
  try {
    const { phone } = req.body;

    // Valider le numéro de téléphone
    if (!phone || !isValidPhone(phone)) {
      throw createError(
        "Numéro de téléphone invalide. Format attendu : +2250123456789",
        400,
        "INVALID_PHONE"
      );
    }

    // Normaliser le numéro de téléphone
    const normalizedPhone = normalizePhone(phone);

    // Vérifier si l'utilisateur existe déjà
    let userId: string | undefined;
    try {
      const existingUser = await getUserByPhone(normalizedPhone);
      userId = existingUser.id;
    } catch {
      // L'utilisateur n'existe pas, c'est une inscription
      userId = undefined;
    }

    // Générer et sauvegarder le code OTP
    const code = await createOTP(normalizedPhone, userId);

    // TODO: Envoyer le code OTP via SMS (Twilio, etc.)
    // Pour l'instant, on le retourne dans la réponse (à retirer en production)
    if (process.env.NODE_ENV) {
      console.log(`📱 Code OTP pour ${normalizedPhone}: ${code}`);
    }

    res.json({
      success: true,
      message: "Code OTP envoyé avec succès",
      // TODO: Retirer cette ligne en production
      ...(process.env.NODE_ENV && { code }),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Vérifie un code OTP et authentifie l'utilisateur
 * 
 * POST /auth/otp/verify
 * Body: { phone: string, code: string }
 */
export async function verifyOTPController(
  req: Request<{}, {}, OtpVerifyRequest>,
  res: Response,
  next: NextFunction
) {
  try {
    const { phone, code } = req.body;

    // Valider les données d'entrée
    if (!phone || !isValidPhone(phone)) {
      throw createError(
        "Numéro de téléphone invalide",
        400,
        "INVALID_PHONE"
      );
    }

    if (!code || !isValidOTP(code)) {
      throw createError(
        "Code OTP invalide. Le code doit contenir exactement 6 chiffres",
        400,
        "INVALID_OTP_FORMAT"
      );
    }

    // Normaliser le numéro de téléphone
    const normalizedPhone = normalizePhone(phone);

    // Vérifier le code OTP
    const { userId, isNewUser } = await verifyOTP(normalizedPhone, code);

    let user;

    if (isNewUser) {
      // Créer un nouvel utilisateur (inscription)
      user = await createUser(normalizedPhone);
    } else {
      // Récupérer l'utilisateur existant (connexion)
      if (!userId) {
        throw createError(
          "Erreur lors de la vérification du code OTP",
          500,
          "VERIFICATION_ERROR"
        );
      }
      user = await getUserByPhone(normalizedPhone);
    }

    // Générer un token JWT pour l'utilisateur
    // Construire le payload conditionnellement pour éviter undefined avec exactOptionalPropertyTypes
    const tokenPayload: {
      userId: string;
      phone?: string;
      email?: string;
      isPremium: boolean;
      role?: string;
    } = {
      userId: user.id,
      isPremium: user.isPremium,
    };

    // Ajouter phone, email et role seulement s'ils existent
    if (user.phone) {
      tokenPayload.phone = user.phone;
    }
    if (user.email) {
      tokenPayload.email = user.email;
    }
    if (user.role) {
      tokenPayload.role = user.role;
    }

    const token = generateToken(tokenPayload);

    res.json({
      success: true,
      message: isNewUser ? "Inscription réussie" : "Connexion réussie",
      data: {
        user,
        isNewUser,
        token, // Token JWT pour l'authentification
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Déconnexion de l'utilisateur
 * 
 * POST /api/auth/logout
 * Headers: Authorization: Bearer <token>
 * 
 * Note: Avec JWT stateless, la déconnexion se fait principalement côté client
 * en supprimant le token. Cette route confirme la déconnexion.
 * 
 * ⚠️ IMPORTANT : Les tokens push ne sont PAS supprimés lors de la déconnexion.
 * Le token appartient à l'appareil et sera automatiquement réassigné au prochain
 * utilisateur (même compte ou autre) qui se connecte sur le même appareil.
 */
export async function logoutController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;

    // Ne pas supprimer les tokens push lors de la déconnexion
    // Le token appartient à l'appareil et sera automatiquement réassigné
    // lors de la prochaine connexion (même utilisateur ou autre) via upsertPushToken
    if (userId) {
      try {
        const { getActivePushTokens } = await import("../services/pushToken.service");
        
        // Logger les tokens qui restent (pour debug)
        const tokens = await getActivePushTokens(userId);
        
        if (tokens.length > 0) {
          logger.info('Déconnexion - tokens push conservés (seront réassignés à la prochaine connexion)', {
            userId,
            tokensCount: tokens.length,
            tokens: tokens.map(t => ({
              id: t.id,
              platform: t.platform,
              deviceId: t.deviceId,
              token: process.env.NODE_ENV === 'production'
                ? t.token.substring(0, 30) + '...' // En production, logger seulement le début pour la sécurité
                : t.token, // En développement, logger le token complet
            })),
          });
        }
      } catch (error) {
        // Ne pas faire échouer la déconnexion si la récupération des tokens échoue
        logger.error("Erreur lors de la récupération des tokens push:", error);
      }
    }

    // La déconnexion avec JWT se fait côté client en supprimant le token
    // Cette route confirme la déconnexion et indique qu'une redirection est nécessaire
    res.setHeader("X-Redirect-To-Login", "true");
    res.json({
      success: true,
      message: "Déconnexion réussie",
      redirectToLogin: true, // Flag pour indiquer qu'une redirection est nécessaire
    });
  } catch (error) {
    next(error);
  }
}

