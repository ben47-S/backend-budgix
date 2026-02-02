/**
 * Contrôleurs pour la gestion du profil utilisateur
 * 
 * Gère :
 * - L'ajout/mise à jour du numéro de téléphone (pour utilisateurs OAuth)
 * - L'ajout/mise à jour de l'email (pour utilisateurs téléphone)
 * - La vérification des codes OTP et de vérification d'email
 */

import type { Request, Response, NextFunction } from "express";
import { createError } from "../middleware/errorHandler";
import { createOTP } from "../services/otp.service";
import { createEmailVerificationCode } from "../services/email-verification.service";
import { updateUserPhone, updateUserEmail, getUserProfile, updateUserUsername } from "../services/profile.service";
import { isValidPhone, normalizePhone } from "../utils/validation";
import { isValidEmail, normalizeEmail } from "../services/email-verification.service";
import { generateToken } from "../services/jwt.service";
import type {
  AddPhoneRequest,
  VerifyPhoneRequest,
  AddEmailRequest,
  VerifyEmailRequest,
} from "../types";

/**
 * Envoie un code OTP pour ajouter/mettre à jour le numéro de téléphone
 * 
 * POST /api/auth/profile/phone/send
 * Headers: Authorization: Bearer <token>
 * Body: { phone: string }
 */
export async function sendPhoneOTP(
  req: Request<{}, {}, AddPhoneRequest>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { phone } = req.body;

    // Valider le numéro de téléphone
    if (!phone || !isValidPhone(phone)) {
      throw createError(
        "Numéro de téléphone invalide",
        400,
        "INVALID_PHONE"
      );
    }

    // Normaliser le numéro de téléphone
    const normalizedPhone = normalizePhone(phone);

    // Vérifier si l'utilisateur a déjà ce numéro
    const user = await getUserProfile(userId);
    if (user.phone === normalizedPhone) {
      throw createError(
        "Ce numéro de téléphone est déjà associé à votre compte",
        400,
        "PHONE_ALREADY_SET"
      );
    }

    // Créer et envoyer le code OTP (avec userId pour l'associer à cet utilisateur)
    const code = await createOTP(normalizedPhone, userId);

    // TODO: Envoyer le code OTP par SMS (intégration avec un service SMS)
    // Pour l'instant, on retourne le code (à retirer en production)
    console.log(`📱 Code OTP pour ${normalizedPhone}: ${code}`);

    res.json({
      success: true,
      message: "Code OTP envoyé avec succès",
      data: {
        phone: normalizedPhone,
        // En production, ne pas retourner le code
        ...(process.env.NODE_ENV && { code }),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Vérifie le code OTP et met à jour le numéro de téléphone de l'utilisateur
 * 
 * POST /api/auth/profile/phone/verify
 * Headers: Authorization: Bearer <token>
 * Body: { phone: string, code: string }
 */
export async function verifyPhoneOTP(
  req: Request<{}, {}, VerifyPhoneRequest>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { phone, code } = req.body;

    // Valider les données d'entrée
    if (!phone || !isValidPhone(phone)) {
      throw createError(
        "Numéro de téléphone invalide",
        400,
        "INVALID_PHONE"
      );
    }

    // Normaliser le numéro de téléphone
    const normalizedPhone = normalizePhone(phone);

    // Mettre à jour le numéro de téléphone de l'utilisateur
    const updatedUser = await updateUserPhone(userId, normalizedPhone, code);

    // Générer un nouveau token JWT avec les informations mises à jour
    const tokenPayload: {
      userId: string;
      phone?: string;
      email?: string;
      isPremium: boolean;
    } = {
      userId: updatedUser.id,
      isPremium: updatedUser.isPremium,
    };

    if (updatedUser.phone) {
      tokenPayload.phone = updatedUser.phone;
    }
    if (updatedUser.email) {
      tokenPayload.email = updatedUser.email;
    }

    const token = generateToken(tokenPayload);

    res.json({
      success: true,
      message: "Numéro de téléphone ajouté avec succès",
      data: {
        user: updatedUser,
        token, // Nouveau token avec les informations mises à jour
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Envoie un code de vérification pour ajouter/mettre à jour l'email
 * 
 * POST /api/auth/profile/email/send
 * Headers: Authorization: Bearer <token>
 * Body: { email: string }
 */
export async function sendEmailVerification(
  req: Request<{}, {}, AddEmailRequest>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { email } = req.body;

    // Valider l'email
    if (!email || !isValidEmail(email)) {
      throw createError("Format d'email invalide", 400, "INVALID_EMAIL");
    }

    // Normaliser l'email
    const normalizedEmail = normalizeEmail(email);

    // Vérifier si l'utilisateur a déjà cet email
    const user = await getUserProfile(userId);
    if (user.email === normalizedEmail) {
      throw createError(
        "Cet email est déjà associé à votre compte",
        400,
        "EMAIL_ALREADY_SET"
      );
    }

    // Créer et envoyer le code de vérification
    const code = await createEmailVerificationCode(normalizedEmail, userId);

    // TODO: Envoyer l'email avec le code (intégration avec un service d'email)
    // Pour l'instant, on retourne le code (à retirer en production)
    console.log(`📧 Code de vérification pour ${normalizedEmail}: ${code}`);

    res.json({
      success: true,
      message: "Code de vérification envoyé avec succès",
      data: {
        email: normalizedEmail,
        // En production, ne pas retourner le code
        ...(process.env.NODE_ENV && { code }),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Vérifie le code de vérification et met à jour l'email de l'utilisateur
 * 
 * POST /api/auth/profile/email/verify
 * Headers: Authorization: Bearer <token>
 * Body: { email: string, code: string }
 */
export async function verifyEmailCode(
  req: Request<{}, {}, VerifyEmailRequest>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { email, code } = req.body;

    // Valider les données d'entrée
    if (!email || !isValidEmail(email)) {
      throw createError("Format d'email invalide", 400, "INVALID_EMAIL");
    }

    // Normaliser l'email
    const normalizedEmail = normalizeEmail(email);

    // Mettre à jour l'email de l'utilisateur
    const updatedUser = await updateUserEmail(userId, normalizedEmail, code);

    // Générer un nouveau token JWT avec les informations mises à jour
    const tokenPayload: {
      userId: string;
      phone?: string;
      email?: string;
      isPremium: boolean;
    } = {
      userId: updatedUser.id,
      isPremium: updatedUser.isPremium,
    };

    if (updatedUser.phone) {
      tokenPayload.phone = updatedUser.phone;
    }
    if (updatedUser.email) {
      tokenPayload.email = updatedUser.email;
    }

    const token = generateToken(tokenPayload);

    res.json({
      success: true,
      message: "Email ajouté avec succès",
      data: {
        user: updatedUser,
        token, // Nouveau token avec les informations mises à jour
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère le profil de l'utilisateur connecté
 * 
 * GET /api/profile
 * Headers: Authorization: Bearer <token>
 */
export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const user = await getUserProfile(userId);

    res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Met à jour le username de l'utilisateur connecté
 * 
 * PUT /api/profile
 * Headers: Authorization: Bearer <token>
 * Body: { username: string }
 */
export async function updateProfile(
  req: Request<{}, {}, { username: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw createError("Authentification requise", 401, "UNAUTHORIZED");
    }

    const { username } = req.body;

    // Mettre à jour le username
    const updatedUser = await updateUserUsername(userId, username);

    // Générer un nouveau token JWT avec les informations mises à jour
    const tokenPayload: {
      userId: string;
      phone?: string;
      email?: string;
      isPremium: boolean;
    } = {
      userId: updatedUser.id,
      isPremium: updatedUser.isPremium,
    };

    if (updatedUser.phone) {
      tokenPayload.phone = updatedUser.phone;
    }
    if (updatedUser.email) {
      tokenPayload.email = updatedUser.email;
    }

    const token = generateToken(tokenPayload);

    res.json({
      success: true,
      message: "Nom d'utilisateur mis à jour avec succès",
      data: {
        user: updatedUser,
        token, // Nouveau token avec les informations mises à jour
      },
    });
  } catch (error) {
    next(error);
  }
}

