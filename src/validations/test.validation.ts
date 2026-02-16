/**
 * Schémas de validation Zod pour les routes de test
 */

import { z } from "zod";

/**
 * Schéma pour l'envoi d'un SMS de test
 */
export const testSendSMSSchema = {
  body: z.object({
    phone: z
      .string()
      .min(1, "Le numéro de téléphone est requis")
      .regex(
        /^\+?\d{13}$/,
        "Format de numéro de téléphone invalide. Format attendu : +2250123456789"
      ),
    message: z
      .string()
      .min(1, "Le message est requis")
      .max(160, "Le message ne doit pas dépasser 160 caractères"),
  }),
};

/**
 * Schéma pour l'envoi d'un OTP de test
 */
export const testSendOTPSchema = {
  body: z.object({
    phone: z
      .string()
      .min(1, "Le numéro de téléphone est requis")
      .regex(
        /^\+?\d{13}$/,
        "Format de numéro de téléphone invalide. Format attendu : +2250123456789"
      ),
  }),
};
