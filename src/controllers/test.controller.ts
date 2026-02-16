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
import { isValidPhone, normalizePhone } from "../utils/validation";
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
