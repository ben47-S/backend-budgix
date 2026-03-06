/**
 * Contrôleur de test SMS
 *
 * Gère les requêtes HTTP pour tester l'API LeTexto en développement :
 * - Envoi de SMS personnalisés
 * - Envoi de codes OTP de test
 * - Vérification du solde LeTexto
 * - Vérification du statut des messages
 *
 * IMPORTANT: Ces endpoints sont uniquement disponibles en mode développement
 */

import type { Request, Response, NextFunction } from "express";
import { sendSMS, sendOTPSMS, getBalance, getMessageStatus } from "../services/sms.service";
import { createOTP } from "../services/otp.service";
import { sendVerificationEmail, verifyEmailConnection } from "../services/email.service";
import { isValidPhone, normalizePhone } from "../utils/validation";
import { isValidEmail } from "../services/email-verification.service";
import { createError } from "../middleware/errorHandler";
import logger from "../lib/logger";

/**
 * Envoie un SMS de test personnalisé
 *
 * POST /test/sms/send
 * Body: { phone: string, message: string }
 */
export async function testSendSMS(
  req: Request<{}, {}, { phone: string; message: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { phone, message } = req.body;

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

    logger.info("[TEST SMS] Tentative d'envoi de SMS de test", {
      phone: normalizedPhone,
      messageLength: message.length,
    });

    // Envoyer le SMS
    const success = await sendSMS(normalizedPhone, message);

    if (success) {
      res.json({
        success: true,
        message: "SMS de test envoyé avec succès",
        data: {
          phone: normalizedPhone,
          messageLength: message.length,
        },
      });
    } else {
      throw createError(
        "Échec de l'envoi du SMS. Vérifiez les logs pour plus de détails.",
        500,
        "SMS_SEND_FAILED"
      );
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Envoie un code OTP de test
 *
 * POST /test/sms/otp
 * Body: { phone: string }
 */
export async function testSendOTP(
  req: Request<{}, {}, { phone: string }>,
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

    logger.info("[TEST SMS] Tentative d'envoi d'OTP de test", {
      phone: normalizedPhone,
    });

    // Générer un code OTP de test (sans l'enregistrer en base)
    const code = await createOTP(normalizedPhone);

    // Envoyer le SMS
    const success = await sendOTPSMS(normalizedPhone, code);

    if (success) {
      res.json({
        success: true,
        message: "OTP de test envoyé avec succès",
        data: {
          phone: normalizedPhone,
          code, // Toujours retourner le code en mode test
        },
      });
    } else {
      throw createError(
        "Échec de l'envoi de l'OTP. Vérifiez les logs pour plus de détails.",
        500,
        "SMS_SEND_FAILED"
      );
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Vérifie le solde du compte LeTexto
 *
 * GET /test/sms/balance
 */
export async function testGetBalance(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    logger.info("[TEST SMS] Vérification du solde LeTexto");

    const balance = await getBalance();

    if (balance !== null) {
      res.json({
        success: true,
        message: "Solde récupéré avec succès",
        data: {
          balance,
          currency: "SMS credits",
        },
      });
    } else {
      throw createError(
        "Impossible de récupérer le solde. Vérifiez que l'API LeTexto est configurée.",
        500,
        "BALANCE_FETCH_FAILED"
      );
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Vérifie le statut d'un message envoyé
 *
 * GET /test/sms/status/:messageId
 */
export async function testCheckSMSStatus(
  req: Request<{ messageId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      throw createError(
        "L'ID du message est requis",
        400,
        "MISSING_MESSAGE_ID"
      );
    }

    logger.info("[TEST SMS] Vérification du statut du message", {
      messageId,
    });

    const status = await getMessageStatus(messageId);

    if (status !== null) {
      res.json({
        success: true,
        message: "Statut du message récupéré avec succès",
        data: {
          messageId,
          status,
        },
      });
    } else {
      throw createError(
        "Impossible de récupérer le statut du message. Vérifiez l'ID du message.",
        500,
        "STATUS_FETCH_FAILED"
      );
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Teste l'envoi d'un email de vérification
 *
 * POST /test/email/send
 * Body: { email: string }
 */
export async function testSendEmail(
  req: Request<{}, {}, { email: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { email } = req.body;

    // Valider l'email
    if (!email || !isValidEmail(email)) {
      throw createError(
        "Adresse email invalide",
        400,
        "INVALID_EMAIL"
      );
    }

    logger.info("[TEST EMAIL] Tentative d'envoi d'email de test", {
      email,
    });

    // Générer un code de test
    const testCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Envoyer l'email
    const success = await sendVerificationEmail(email, testCode);

    if (success) {
      res.json({
        success: true,
        message: "Email de vérification envoyé avec succès",
        data: {
          email,
          code: testCode, // À retirer en production !
        },
      });
    } else {
      throw createError(
        "Échec de l'envoi de l'email. Vérifiez la configuration et les logs.",
        500,
        "EMAIL_SEND_FAILED"
      );
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Vérifie la connexion au serveur SMTP
 *
 * GET /test/email/verify-connection
 */
export async function testEmailConnection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    logger.info("[TEST EMAIL] Vérification de la connexion SMTP");

    const isConnected = await verifyEmailConnection();

    if (isConnected) {
      res.json({
        success: true,
        message: "Connexion SMTP vérifiée avec succès",
        data: {
          host: process.env.EMAIL_HOST || "smtp.gmail.com",
          port: process.env.EMAIL_PORT || 587,
          user: process.env.EMAIL_USER,
        },
      });
    } else {
      throw createError(
        "Impossible de se connecter au serveur SMTP. Vérifiez la configuration.",
        500,
        "SMTP_CONNECTION_FAILED"
      );
    }
  } catch (error) {
    next(error);
  }
}
