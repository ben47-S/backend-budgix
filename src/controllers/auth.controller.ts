/**
 * Contrôleur d'authentification
 * 
 * Gère les requêtes HTTP liées à l'authentification :
 * - Envoi de code OTP
 * - Vérification de code OTP (inscription/connexion)
 */

import type { Request, Response, NextFunction } from "express";
import { createOTP, verifyOTP } from "../services/otp.service.js";
import { createUser, getUserByPhone } from "../services/auth.service.js";
import { sendOTPSMS } from "../services/sms.service.js";
import { isValidPhone, normalizePhone, isValidOTP } from "../utils/validation.js";
import { createError } from "../middleware/errorHandler.js";
import { generateToken } from "../services/jwt.service.js";
import { getUserConsentStatus } from "../services/consent.service.js";
import { logEvent } from "../services/log.service.js";
import logger from "../lib/logger.js";
import type { OtpRequest, OtpVerifyRequest } from "../types/index.js";

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

    // Envoyer le code OTP via SMS (Texto)
    // Le service SMS log aussi le code en développement
    await sendOTPSMS(normalizedPhone, code);

    res.json({
      success: true,
      message: "Code OTP envoyé avec succès",
      // Retourner le code uniquement en développement pour faciliter les tests
      ...(process.env.NODE_ENV === "development" && { code }),
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

    // Vérifier le statut de consentement
    const consentStatus = await getUserConsentStatus(user.id);
    const needsConsent = consentStatus.needsConsent;

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

    // Logger l'événement de connexion réussie
    logEvent({
      level: "INFO",
      scope: "SECURITY",
      action: isNewUser ? "CREATE_USER" : "LOGIN_USER",
      userId: user.id,
      metadata: {
        phone: user.phone || phone,
        isNewUser: isNewUser,
        needsConsent: needsConsent,
        userAgent: req.headers["user-agent"] || ""
      },
      ip: req.ip || "",
      userAgent: req.headers["user-agent"] || ""
    });

    res.json({
      success: true,
      message: isNewUser ? "Inscription réussie" : "Connexion réussie",
      data: {
        user,
        isNewUser,
        token, // Token JWT pour l'authentification
        needsConsent, // Flag indiquant si l'utilisateur doit accepter les CGU/politiques
        status: user.status, // Statut de l'utilisateur (PENDING_CONSENT ou ACTIVE)
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
        const { getActivePushTokens } = await import("../services/pushToken.service.js");
        
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

/**
 * Accepte les CGU et la politique de confidentialité
 * 
 * POST /auth/accept-consent
 * Headers: Authorization: Bearer <token>
 * Body: { acceptTerms: boolean, acceptPrivacy: boolean }
 * 
 * Permet aux utilisateurs avec le statut PENDING_CONSENT d'accepter les conditions
 * et de passer au statut ACTIVE.
 */
export async function acceptConsentController(
  req: Request<{}, {}, { acceptTerms: boolean; acceptPrivacy: boolean }>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    const { acceptTerms, acceptPrivacy } = req.body;

    // S'assurer que l'utilisateur est authentifié
    if (!userId) {
      throw createError(
        "Authentification requise",
        401,
        "UNAUTHORIZED"
      );
    }

    // Valider les données d'entrée
    if (
      typeof acceptTerms !== "boolean" ||
      typeof acceptPrivacy !== "boolean"
    ) {
      throw createError(
        "acceptTerms et acceptPrivacy doivent être des booléens",
        400,
        "INVALID_INPUT"
      );
    }

    // Importer la fonction pour accepter les termes
    const { acceptConsentTerms } = await import("../services/consent.service.js");

    // Accepter les CGU et politiques
    const updatedUser = await acceptConsentTerms(
      userId,
      acceptTerms,
      acceptPrivacy
    );

    res.json({
      success: true,
      message: "CGU et politique de confidentialité acceptées avec succès",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère le statut de consentement de l'utilisateur
 * 
 * GET /auth/consent-status
 * Headers: Authorization: Bearer <token>
 * 
 * Permet aux utilisateurs de vérifier leur statut de consentement.
 */
export async function getConsentStatusController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;

    // S'assurer que l'utilisateur est authentifié
    if (!userId) {
      throw createError(
        "Authentification requise",
        401,
        "UNAUTHORIZED"
      );
    }

    // Importer la fonction pour récupérer le statut
    const { getUserConsentStatus } = await import("../services/consent.service.js");

    // Récupérer le statut de consentement
    const consentStatus = await getUserConsentStatus(userId);

    res.json({
      success: true,
      data: consentStatus,
    });
  } catch (error) {
    next(error);
  }
}
