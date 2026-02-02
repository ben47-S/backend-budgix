/**
 * Schémas de validation Zod pour l'authentification
 */

import { z } from "zod";

/**
 * Schéma pour l'envoi d'un code OTP
 */
export const sendOTPSchema = {
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

/**
 * Schéma pour la vérification d'un code OTP
 */
export const verifyOTPSchema = {
  body: z.object({
    phone: z
      .string()
      .min(1, "Le numéro de téléphone est requis")
      .regex(
        /^\+?\d{13}$/,
        "Format de numéro de téléphone invalide. Format attendu : +2250123456789"
      ),
    code: z
      .string()
      .length(6, "Le code OTP doit contenir exactement 6 chiffres")
      .regex(/^\d{6}$/, "Le code OTP doit contenir uniquement des chiffres"),
  }),
};

/**
 * Schéma pour le test OAuth Google (développement uniquement)
 */
export const googleTestSchema = {
  body: z.object({
    email: z.string().email("Format d'email invalide"),
    displayName: z.string().optional(),
  }),
};

